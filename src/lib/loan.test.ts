import { describe, expect, it } from 'vitest'
import { calculateLoanSchedule, calculateEmi } from './loan'

describe('loan calculations', () => {
  it('calculates EMI for a standard loan', () => {
    const emi = calculateEmi({
      principal: 100000,
      annualRate: 12,
      tenureYears: 1,
      frequency: 'monthly',
    })

    expect(emi).toBeCloseTo(8884.88, 2)
  })

  it('builds a schedule that fully repays the loan', () => {
    const schedule = calculateLoanSchedule({
      id: 'test',
      name: 'Test Loan',
      principal: 100000,
      annualRate: 12,
      tenureYears: 1,
      frequency: 'monthly',
      monthlyExtraPayment: 0,
      annualExtraEmi: 0,
      annualIncreasePercent: 0,
      annualIncreaseStartYear: 1,
      customEmi: false,
      customEmiAmount: 0,
      lumpSums: [],
    })

    expect(schedule.entries.length).toBe(12)
    expect(schedule.entries[schedule.entries.length - 1].closingBalance).toBeLessThan(0.01)
    expect(schedule.summary.totalInterest).toBeGreaterThan(0)
    expect(schedule.summary.totalPaid).toBeGreaterThan(100000)
  })

  it('reports payoff in whole years and months', () => {
    const schedule = calculateLoanSchedule({
      id: 'test',
      name: '20-year loan',
      principal: 9000000,
      annualRate: 7.25,
      tenureYears: 20,
      frequency: 'monthly',
      monthlyExtraPayment: 0,
      annualExtraEmi: 0,
      annualIncreasePercent: 0,
      annualIncreaseStartYear: 1,
      customEmi: false,
      customEmiAmount: 0,
      lumpSums: [],
    })

    expect(schedule.summary.payoffYear).toBe(20)
    expect(schedule.summary.payoffMonth).toBe(0)
  })
})
