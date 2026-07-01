import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Calculator, Copy, Download, Moon, Plus, Sun, Trash2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import * as XLSX from 'xlsx'
import { calculateEmi, calculateLoanSchedule, type LoanScenario, type LumpSumPayment, type PaymentFrequency } from './lib/loan'

const STORAGE_KEY = 'smart-loan-planner-scenarios-v1'
const THEME_STORAGE_KEY = 'smart-loan-planner-theme-v1'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `scenario-${Date.now()}`
}

function createScenario(overrides?: Partial<LoanScenario>): LoanScenario {
  return {
    id: createId(),
    name: 'New loan plan',
    principal: 0,
    annualRate: 0,
    tenureYears: 0,
    frequency: 'monthly',
    monthlyExtraPayment: 0,
    annualExtraEmi: 0,
    annualIncreasePercent: 0,
    annualIncreaseStartYear: 0,
    customEmi: false,
    customEmiAmount: 0,
    lumpSums: [],
    ...overrides,
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatTooltipValue(value: number | string | ReadonlyArray<number | string> | undefined) {
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'number' ? formatCurrency(entry) : String(entry))).join(', ')
  }

  if (typeof value === 'number') {
    return formatCurrency(value)
  }

  return String(value ?? '')
}

function formatPayoff(years: number, months: number) {
  if (!years && !months) {
    return '—'
  }

  return `${years}y ${months}m`
}

function getInputValue(value: number) {
  return value > 0 ? value : ''
}

function loadScenarios() {
  if (typeof window === 'undefined') {
    return [createScenario({ name: 'Baseline home loan' })]
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return [createScenario({ name: 'Baseline home loan' })]
    }

    const parsed = JSON.parse(saved) as LoanScenario[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createScenario({ name: 'Baseline home loan' })]
  } catch {
    return [createScenario({ name: 'Baseline home loan' })]
  }
}

function loadTheme() {
  if (typeof window === 'undefined') {
    return 'dark' as const
  }

  return (window.localStorage.getItem(THEME_STORAGE_KEY) as 'dark' | 'light' | null) ?? 'dark'
}

function App() {
  const [scenarios, setScenarios] = useState<LoanScenario[]>(() => loadScenarios())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme())

  useEffect(() => {
    if (!selectedId && scenarios.length > 0) {
      setSelectedId(scenarios[0].id)
    }
  }, [selectedId, scenarios])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios))
    }
  }, [scenarios])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.style.colorScheme = theme
    }

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedId) ?? scenarios[0],
    [scenarios, selectedId],
  )

  const activeSchedule = useMemo(() => {
    if (!selectedScenario) {
      return null
    }
    return calculateLoanSchedule(selectedScenario)
  }, [selectedScenario])

  const comparisonRows = useMemo(() => {
    return scenarios.map((scenario) => {
      const schedule = calculateLoanSchedule(scenario)
      return {
        name: scenario.name,
        emi: schedule.entries[0]?.emi ?? 0,
        totalInterest: schedule.summary.totalInterest,
        totalPaid: schedule.summary.totalPaid,
        payoff: formatPayoff(schedule.summary.payoffYear, schedule.summary.payoffMonth),
      }
    })
  }, [scenarios])

  const chartData = useMemo(() => {
    return (activeSchedule?.entries ?? []).map((entry) => ({
      payment: entry.paymentNumber,
      balance: Number(entry.closingBalance),
      principal: Number(entry.principal),
      interest: Number(entry.interest),
    }))
  }, [activeSchedule])

  const updateScenario = (field: keyof LoanScenario, value: string | number | boolean | LumpSumPayment[]) => {
    if (!selectedId) {
      return
    }

    setScenarios((previous) =>
      previous.map((scenario) => (scenario.id === selectedId ? { ...scenario, [field]: value } : scenario)),
    )
  }

  const handleCreateScenario = () => {
    const next = createScenario({ name: `Scenario ${scenarios.length + 1}` })
    setScenarios((previous) => [...previous, next])
    setSelectedId(next.id)
  }

  const handleDuplicateScenario = (id?: string) => {
    const sourceScenario = scenarios.find((scenario) => scenario.id === id) ?? selectedScenario
    if (!sourceScenario) {
      return
    }

    const next = createScenario({
      ...sourceScenario,
      id: createId(),
      name: `${sourceScenario.name} Copy`,
      lumpSums: sourceScenario.lumpSums.map((payment) => ({ ...payment, id: createId() })),
    })
    setScenarios((previous) => [...previous, next])
    setSelectedId(next.id)
  }

  const handleDeleteScenario = (id: string) => {
    if (scenarios.length === 1) {
      const fallback = createScenario({ name: 'Fresh plan' })
      setScenarios([fallback])
      setSelectedId(fallback.id)
      return
    }

    const next = scenarios.filter((scenario) => scenario.id !== id)
    setScenarios(next)
    if (selectedId === id) {
      setSelectedId(next[0]?.id ?? null)
    }
  }

  const updateLumpSum = (id: string, field: 'month' | 'amount' | 'label', value: string | number) => {
    if (!selectedScenario) {
      return
    }

    setScenarios((previous) =>
      previous.map((scenario) => {
        if (scenario.id !== selectedScenario.id) {
          return scenario
        }

        return {
          ...scenario,
          lumpSums: scenario.lumpSums.map((payment) => {
            if (payment.id !== id) {
              return payment
            }
            return {
              ...payment,
              [field]: field === 'month' || field === 'amount' ? Number(value) : value,
            }
          }),
        }
      }),
    )
  }

  const addLumpSum = () => {
    if (!selectedScenario) {
      return
    }

    setScenarios((previous) =>
      previous.map((scenario) => {
        if (scenario.id !== selectedScenario.id) {
          return scenario
        }
        return {
          ...scenario,
          lumpSums: [
            ...scenario.lumpSums,
            {
              id: createId(),
              month: scenario.lumpSums.length + 1,
              amount: 100000,
              label: `Prepayment ${scenario.lumpSums.length + 1}`,
            },
          ],
        }
      }),
    )
  }

  const removeLumpSum = (id: string) => {
    if (!selectedScenario) {
      return
    }

    setScenarios((previous) =>
      previous.map((scenario) => {
        if (scenario.id !== selectedScenario.id) {
          return scenario
        }
        return {
          ...scenario,
          lumpSums: scenario.lumpSums.filter((payment) => payment.id !== id),
        }
      }),
    )
  }

  const exportToExcel = () => {
    if (!selectedScenario || !activeSchedule) {
      return
    }

    const summaryRows = [
      ['Scenario', selectedScenario.name],
      ['Principal', selectedScenario.principal],
      ['Annual Rate', `${selectedScenario.annualRate}%`],
      ['Tenure', `${selectedScenario.tenureYears} years`],
      ['EMI', calculateEmi({
        principal: selectedScenario.principal,
        annualRate: selectedScenario.annualRate,
        tenureYears: selectedScenario.tenureYears,
        frequency: selectedScenario.frequency,
      })],
      ['Total Interest', activeSchedule.summary.totalInterest],
      ['Total Paid', activeSchedule.summary.totalPaid],
      ['Payoff', formatPayoff(activeSchedule.summary.payoffYear, activeSchedule.summary.payoffMonth)],
    ]

    const monthlyRows = activeSchedule.entries.map((entry) => ({
      Payment: entry.paymentNumber,
      Opening: entry.openingBalance,
      EMI: entry.emi,
      Extra: entry.monthlyExtraPayment,
      AnnualExtra: entry.annualExtraEmi,
      LumpSum: entry.lumpSum,
      Interest: entry.interest,
      Principal: entry.principal,
      Closing: entry.closingBalance,
    }))

    const yearlyRows = activeSchedule.yearSummaries.map((entry) => ({
      Year: entry.year,
      Payments: entry.payments,
      Opening: entry.openingBalance,
      Closing: entry.closingBalance,
      PrincipalPaid: entry.principalPaid,
      InterestPaid: entry.interestPaid,
      TotalPaid: entry.totalPaid,
    }))

    const comparisonRowsForExport = scenarios.map((scenario) => {
      const schedule = calculateLoanSchedule(scenario)
      return {
        Scenario: scenario.name,
        Principal: scenario.principal,
        Rate: `${scenario.annualRate}%`,
        EMI: schedule.entries[0]?.emi ?? 0,
        TotalInterest: schedule.summary.totalInterest,
        TotalPaid: schedule.summary.totalPaid,
        Payoff: formatPayoff(schedule.summary.payoffYear, schedule.summary.payoffMonth),
      }
    })

    const workbook = XLSX.utils.book_new()
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
    const monthSheet = XLSX.utils.json_to_sheet(monthlyRows)
    const yearSheet = XLSX.utils.json_to_sheet(yearlyRows)
    const comparisonSheet = XLSX.utils.json_to_sheet(comparisonRowsForExport)

    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    XLSX.utils.book_append_sheet(workbook, monthSheet, 'Month-wise')
    XLSX.utils.book_append_sheet(workbook, yearSheet, 'Year-wise')
    XLSX.utils.book_append_sheet(workbook, comparisonSheet, 'Comparison')
    XLSX.writeFile(workbook, `${selectedScenario.name.replace(/\s+/g, '-').toLowerCase()}.xlsx`)
  }

  const baseEmi = selectedScenario
    ? calculateEmi({
        principal: selectedScenario.principal,
        annualRate: selectedScenario.annualRate,
        tenureYears: selectedScenario.tenureYears,
        frequency: selectedScenario.frequency,
      })
    : 0
  const isAnnualIncreaseEnabled = (selectedScenario?.annualIncreasePercent ?? 0) > 0
  const isDarkMode = theme === 'dark'

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Frontend-only loan simulator</p>
          <h1>Smart Loan Planner</h1>
          <p className="hero-copy">
            Compare repayment strategies, model prepayments, and export a detailed workbook in one place.
          </p>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{isDarkMode ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="card-label">Principal</span>
          <strong>{selectedScenario && selectedScenario.principal > 0 ? formatCurrency(selectedScenario.principal) : '—'}</strong>
        </article>
        <article className="summary-card">
          <span className="card-label">EMI</span>
          <strong>{selectedScenario && baseEmi > 0 ? formatCurrency(baseEmi) : '—'}</strong>
        </article>
        <article className="summary-card">
          <span className="card-label">Interest saved</span>
          <strong>{activeSchedule && activeSchedule.summary.interestSaved > 0 ? formatCurrency(activeSchedule.summary.interestSaved) : '—'}</strong>
        </article>
        <article className="summary-card">
          <span className="card-label">Payoff</span>
          <strong>
            {activeSchedule ? formatPayoff(activeSchedule.summary.payoffYear, activeSchedule.summary.payoffMonth) : '—'}
          </strong>
        </article>
      </section>

      <section className="content-grid">
        <aside className="panel">
          <div className="panel-heading">
            <h2>Scenarios</h2>
            <button type="button" className="icon-button" onClick={handleCreateScenario}>
              <Plus size={16} />
            </button>
          </div>
          <div className="scenario-list">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className={`scenario-card ${scenario.id === selectedScenario?.id ? 'active' : ''}`}>
                <button type="button" className="scenario-main" onClick={() => setSelectedId(scenario.id)}>
                  <div>
                    <strong>{scenario.name}</strong>
                    <p>{formatCurrency(scenario.principal)} • {scenario.annualRate}%</p>
                  </div>
                </button>
                <div className="scenario-actions">
                  <button type="button" className="tiny-button" onClick={() => handleDuplicateScenario(scenario.id)}>
                    <Copy size={14} />
                  </button>
                  <button type="button" className="tiny-button" onClick={() => handleDeleteScenario(scenario.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="panel form-panel">
          <div className="panel-heading">
            <h2>Scenario setup</h2>
            <button type="button" className="secondary-button" onClick={exportToExcel}>
              <Download size={16} /> Export workbook
            </button>
          </div>

          {selectedScenario ? (
            <div className="form-grid">
              <label>
                <span>Scenario name</span>
                <input value={selectedScenario.name} onChange={(event) => updateScenario('name', event.target.value)} />
              </label>
              <label>
                <span>Loan amount</span>
                <input type="number" value={getInputValue(selectedScenario.principal)} onChange={(event) => updateScenario('principal', Number(event.target.value))} />
              </label>
              <label>
                <span>Annual interest rate (%)</span>
                <input type="number" step="0.1" value={getInputValue(selectedScenario.annualRate)} onChange={(event) => updateScenario('annualRate', Number(event.target.value))} />
              </label>
              <label>
                <span>Tenure (years)</span>
                <input type="number" value={getInputValue(selectedScenario.tenureYears)} onChange={(event) => updateScenario('tenureYears', Number(event.target.value))} />
              </label>
              <label>
                <span>Payment frequency</span>
                <select value={selectedScenario.frequency} onChange={(event) => updateScenario('frequency', event.target.value as PaymentFrequency)}>
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label>
                <span>Custom EMI amount</span>
                <input type="number" value={getInputValue(selectedScenario.customEmiAmount)} onChange={(event) => updateScenario('customEmiAmount', Number(event.target.value))} />
              </label>
              <label>
                <span>Monthly extra payment</span>
                <input type="number" value={getInputValue(selectedScenario.monthlyExtraPayment)} onChange={(event) => updateScenario('monthlyExtraPayment', Number(event.target.value))} />
              </label>
              <label>
                <span>Extra EMI every year</span>
                <input type="number" value={getInputValue(selectedScenario.annualExtraEmi)} onChange={(event) => updateScenario('annualExtraEmi', Number(event.target.value))} />
              </label>
              <label>
                <span>Annual EMI increase (%)</span>
                <input
                  type="number"
                  value={getInputValue(selectedScenario.annualIncreasePercent)}
                  onChange={(event) => updateScenario('annualIncreasePercent', Number(event.target.value))}
                />
              </label>
              <label>
                <span>Increase start year</span>
                <input
                  type="number"
                  value={selectedScenario.annualIncreaseStartYear}
                  disabled={!isAnnualIncreaseEnabled}
                  onChange={(event) => updateScenario('annualIncreaseStartYear', Number(event.target.value))}
                />
              </label>
            </div>
          ) : null}
          <div className="lump-sum-section">
            <div className="panel-heading">
              <h3>Lump-Sum Prepayments</h3>
              <button type="button" className="secondary-button" onClick={addLumpSum}>
                <Plus size={16} /> Add
              </button>
            </div>
            {selectedScenario?.lumpSums.length ? (
              <div className="lump-sum-grid-labels">
                <span>Label</span>
                <span>Month</span>
                <span>Amount</span>
                <span aria-hidden="true" />
              </div>
            ) : null}
            {selectedScenario?.lumpSums.map((payment) => (
              <div key={payment.id} className="lump-sum-row">
                <input value={payment.label} onChange={(event) => updateLumpSum(payment.id, 'label', event.target.value)} />
                <input type="number" value={payment.month} onChange={(event) => updateLumpSum(payment.id, 'month', Number(event.target.value))} />
                <input type="number" value={payment.amount} onChange={(event) => updateLumpSum(payment.id, 'amount', Number(event.target.value))} />
                <button type="button" className="icon-button" onClick={() => removeLumpSum(payment.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </main>
      </section>

          <section className="mobile-summary-stack" aria-label="Key loan summary">
            <article className="summary-card">
              <span className="card-label">Principal</span>
              <strong>{selectedScenario && selectedScenario.principal > 0 ? formatCurrency(selectedScenario.principal) : '—'}</strong>
            </article>
            <article className="summary-card">
              <span className="card-label">EMI</span>
              <strong>{selectedScenario && baseEmi > 0 ? formatCurrency(baseEmi) : '—'}</strong>
            </article>
            <article className="summary-card">
              <span className="card-label">Interest saved</span>
              <strong>{activeSchedule && activeSchedule.summary.interestSaved > 0 ? formatCurrency(activeSchedule.summary.interestSaved) : '—'}</strong>
            </article>
            <article className="summary-card">
              <span className="card-label">Payoff</span>
              <strong>
                {activeSchedule ? formatPayoff(activeSchedule.summary.payoffYear, activeSchedule.summary.payoffMonth) : '—'}
              </strong>
            </article>
          </section>

      <section className="charts-grid">
        <article className="panel chart-card">
          <div className="panel-heading">
            <h2>Balance Trend</h2>
            <Calculator size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="payment" />
              <YAxis />
              <Tooltip formatter={(value) => formatTooltipValue(value)} />
              <Legend />
              <Line type="monotone" dataKey="balance" stroke="#7c3aed" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </article>

        <article className="panel chart-card">
          <div className="panel-heading">
            <h2>Principal vs Interest</h2>
            <BarChart3 size={18} />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={activeSchedule?.yearSummaries ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip formatter={(value) => formatTooltipValue(value)} />
              <Legend />
              <Bar dataKey="principalPaid" fill="#0f766e" />
              <Bar dataKey="interestPaid" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="tables-grid">
        <article className="panel">
          <div className="panel-heading">
            <h2>Month Wise Schedule</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Opening</th>
                  <th>EMI</th>
                  <th>Extra</th>
                  <th>Interest</th>
                  <th>Principal</th>
                  <th>Closing</th>
                </tr>
              </thead>
              <tbody>
                {activeSchedule?.entries.slice(0, 12).map((entry) => (
                  <tr key={entry.paymentNumber}>
                    <td>{entry.paymentNumber}</td>
                    <td>{formatCurrency(entry.openingBalance)}</td>
                    <td>{formatCurrency(entry.emi)}</td>
                    <td>{formatCurrency(entry.monthlyExtraPayment + entry.annualExtraEmi + entry.lumpSum)}</td>
                    <td>{formatCurrency(entry.interest)}</td>
                    <td>{formatCurrency(entry.principal)}</td>
                    <td>{formatCurrency(entry.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <h2>Year Wise Summary</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total paid</th>
                </tr>
              </thead>
              <tbody>
                {activeSchedule?.yearSummaries.map((entry) => (
                  <tr key={entry.year}>
                    <td>{entry.year}</td>
                    <td>{formatCurrency(entry.principalPaid)}</td>
                    <td>{formatCurrency(entry.interestPaid)}</td>
                    <td>{formatCurrency(entry.totalPaid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel comparison-panel">
        <div className="panel-heading">
          <h2>Scenario Comparison</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Scenario</th>
                <th>EMI</th>
                <th>Total interest</th>
                <th>Total paid</th>
                <th>Payoff</th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((entry) => (
                <tr key={entry.name}>
                  <td>{entry.name}</td>
                  <td>{formatCurrency(entry.emi)}</td>
                  <td>{formatCurrency(entry.totalInterest)}</td>
                  <td>{formatCurrency(entry.totalPaid)}</td>
                  <td>{entry.payoff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default App
