export type PaymentFrequency = 'monthly' | 'biweekly' | 'weekly'

export interface LumpSumPayment {
  id: string
  month: number
  amount: number
  label: string
}

export interface LoanScenario {
  id: string
  name: string
  principal: number
  annualRate: number
  tenureYears: number
  frequency: PaymentFrequency
  monthlyExtraPayment: number
  annualExtraEmi: number
  annualIncreasePercent: number
  annualIncreaseStartYear: number
  customEmi: boolean
  customEmiAmount: number
  lumpSums: LumpSumPayment[]
}

export interface LoanScheduleEntry {
  paymentNumber: number
  paymentDate: string
  openingBalance: number
  emi: number
  monthlyExtraPayment: number
  annualExtraEmi: number
  lumpSum: number
  interest: number
  principal: number
  closingBalance: number
  cumulativePrincipal: number
  cumulativeInterest: number
}

export interface LoanYearSummary {
  year: number
  payments: number
  openingBalance: number
  closingBalance: number
  principalPaid: number
  interestPaid: number
  totalPaid: number
}

export interface LoanScheduleSummary {
  totalPaid: number
  totalPrincipal: number
  totalInterest: number
  payoffMonths: number
  payoffYear: number
  payoffMonth: number
  interestSaved: number
}

export interface LoanSchedule {
  entries: LoanScheduleEntry[]
  yearSummaries: LoanYearSummary[]
  summary: LoanScheduleSummary
}

interface FrequencyConfig {
  paymentsPerYear: number
  label: string
}

const frequencyMap: Record<PaymentFrequency, FrequencyConfig> = {
  monthly: { paymentsPerYear: 12, label: 'Monthly' },
  biweekly: { paymentsPerYear: 26, label: 'Biweekly' },
  weekly: { paymentsPerYear: 52, label: 'Weekly' },
}

const toCurrency = (value: number) => Number(value.toFixed(2))

export function calculateEmi({
  principal,
  annualRate,
  tenureYears,
  frequency,
}: {
  principal: number
  annualRate: number
  tenureYears: number
  frequency: PaymentFrequency
}) {
  const { paymentsPerYear } = frequencyMap[frequency]
  const paymentCount = Math.max(1, Math.round(tenureYears * paymentsPerYear))
  const periodicRate = annualRate / 100 / paymentsPerYear

  if (periodicRate <= 0) {
    return principal / paymentCount
  }

  const numerator = principal * periodicRate
  const denominator = 1 - Math.pow(1 + periodicRate, -paymentCount)
  return numerator / denominator
}

function buildSchedule(scenario: LoanScenario, includeExtras: boolean): LoanSchedule {
  const { paymentsPerYear } = frequencyMap[scenario.frequency]
  const paymentCount = Math.max(1, Math.round(scenario.tenureYears * paymentsPerYear))
  const baseEmi = scenario.customEmiAmount > 0
    ? scenario.customEmiAmount
    : calculateEmi({
        principal: scenario.principal,
        annualRate: scenario.annualRate,
        tenureYears: scenario.tenureYears,
        frequency: scenario.frequency,
      })

  const payments: LoanScheduleEntry[] = []
  let balance = scenario.principal
  let cumulativePrincipal = 0
  let cumulativeInterest = 0
  let totalPaid = 0
  let payoffMonth = 0
  let payoffYear = 0

  for (let paymentNumber = 1; paymentNumber <= paymentCount; paymentNumber += 1) {
    const yearNumber = Math.floor((paymentNumber - 1) / paymentsPerYear) + 1
    const annualIncreaseMultiplier =
      scenario.annualIncreasePercent > 0 && yearNumber >= scenario.annualIncreaseStartYear
        ? Math.pow(1 + scenario.annualIncreasePercent / 100, yearNumber - scenario.annualIncreaseStartYear)
        : 1
    const emi = baseEmi * annualIncreaseMultiplier
    const monthlyExtraPayment = includeExtras ? scenario.monthlyExtraPayment : 0
    const annualExtraEmi =
      includeExtras && scenario.annualExtraEmi > 0 && paymentNumber % paymentsPerYear === 0
        ? emi * scenario.annualExtraEmi
        : 0
    const lumpSum = includeExtras
      ? scenario.lumpSums
          .filter((payment) => payment.month === paymentNumber)
          .reduce((sum, item) => sum + item.amount, 0)
      : 0

    const openingBalance = balance
    const interest = balance * (scenario.annualRate / 100 / paymentsPerYear)
    const totalPayment = emi + monthlyExtraPayment + annualExtraEmi + lumpSum
    const paymentAmount = Math.min(totalPayment, balance + interest)
    const principal = paymentAmount - interest
    const closingBalance = Math.max(0, balance + interest - paymentAmount)

    balance = closingBalance
    cumulativePrincipal += principal
    cumulativeInterest += interest
    totalPaid += paymentAmount

    payments.push({
      paymentNumber,
      paymentDate: `${yearNumber}-${String(((paymentNumber - 1) % paymentsPerYear) + 1).padStart(2, '0')}`,
      openingBalance: toCurrency(openingBalance),
      emi: toCurrency(emi),
      monthlyExtraPayment: toCurrency(monthlyExtraPayment),
      annualExtraEmi: toCurrency(annualExtraEmi),
      lumpSum: toCurrency(lumpSum),
      interest: toCurrency(interest),
      principal: toCurrency(principal),
      closingBalance: toCurrency(closingBalance),
      cumulativePrincipal: toCurrency(cumulativePrincipal),
      cumulativeInterest: toCurrency(cumulativeInterest),
    })

    if (closingBalance <= 0.01) {
      payoffMonth = paymentNumber % paymentsPerYear
      payoffYear = Math.floor(paymentNumber / paymentsPerYear)
      break
    }
  }

  const monthsInYear = paymentsPerYear
  const yearGroups: Array<{ yearNumber: number; entries: LoanScheduleEntry[] }> = []
  let currentYear = 1

  for (let index = 0; index < payments.length; index += 1) {
    const entry = payments[index]
    const entryYear = Math.floor((entry.paymentNumber - 1) / monthsInYear) + 1
    if (entryYear !== currentYear) {
      currentYear = entryYear
      yearGroups.push({ yearNumber: entryYear, entries: [] })
    }
    if (!yearGroups.length) {
      yearGroups.push({ yearNumber: entryYear, entries: [] })
    }
    yearGroups[yearGroups.length - 1].entries.push(entry)
  }

  const yearTotals = yearGroups.map((group) => {
    const yearEntryTotal = group.entries.reduce(
      (acc, entry) => ({
        principal: acc.principal + entry.principal,
        interest: acc.interest + entry.interest,
        totalPaid: acc.totalPaid + entry.emi + entry.monthlyExtraPayment + entry.annualExtraEmi + entry.lumpSum,
      }),
      { principal: 0, interest: 0, totalPaid: 0 },
    )

    return {
      year: group.yearNumber,
      payments: group.entries.length,
      openingBalance: group.entries[0]?.openingBalance ?? 0,
      closingBalance: group.entries[group.entries.length - 1]?.closingBalance ?? 0,
      principalPaid: toCurrency(yearEntryTotal.principal),
      interestPaid: toCurrency(yearEntryTotal.interest),
      totalPaid: toCurrency(yearEntryTotal.totalPaid),
    }
  })

  const baselineSchedule = includeExtras
    ? buildSchedule(
        {
          ...scenario,
          customEmi: false,
          customEmiAmount: calculateEmi({
            principal: scenario.principal,
            annualRate: scenario.annualRate,
            tenureYears: scenario.tenureYears,
            frequency: scenario.frequency,
          }),
          monthlyExtraPayment: 0,
          annualExtraEmi: 0,
          annualIncreasePercent: 0,
          annualIncreaseStartYear: 1,
          lumpSums: [],
        },
        false,
      )
    : null

  return {
    entries: payments,
    yearSummaries: yearTotals,
    summary: {
      totalPaid: toCurrency(totalPaid),
      totalPrincipal: toCurrency(scenario.principal),
      totalInterest: toCurrency(cumulativeInterest),
      payoffMonths: payments.length,
      payoffYear,
      payoffMonth,
      interestSaved: toCurrency(baselineSchedule ? baselineSchedule.summary.totalInterest - cumulativeInterest : 0),
    },
  }
}

export function calculateLoanSchedule(scenario: LoanScenario): LoanSchedule {
  return buildSchedule(scenario, true)
}
