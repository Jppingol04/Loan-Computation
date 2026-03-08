export type LoanStatus = 'projected' | 'paid' | 'unpaid';

export interface Drawdown {
  id: string;
  date: string;
  amount: number;
}

export interface ManualPayment {
  id: string;
  periodNumber: number;
  principalAmount: number;
  interestAmount: number;
  date?: string; // Optional metadata
}

export interface AmortizationPeriod {
  periodNumber: number;
  date: string;
  openingBalance: number;
  drawdownAmount: number;
  interestAccrual: number;
  principalPaid: number;
  interestPaid: number;
  closingBalance: number;
  cumulativeInterest: number;
  status: LoanStatus;
}

export interface LoanInput {
  loanName: string;
  principalAmount: number;
  annualInterestRate: number;
  termInMonths: number;
  startDate: string;
  currency: string;
  isBullet: boolean; // Whether to automatically repay remaining principal at maturity
  drawdowns?: Drawdown[];
  manualPayments?: ManualPayment[];
  periodStatuses?: Record<number, LoanStatus>; // Map of periodNumber to override status
}

export function calculateMonthsBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 12;
  
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
  );
}

/**
 * Generates an IFRS 9 EIR schedule.
 * Correctly carries forward balances by iterating through periods and aggregating
 * drawdowns and payments within those specific monthly windows.
 */
export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  const schedule: AmortizationPeriod[] = [];
  const { 
    principalAmount, 
    annualInterestRate, 
    termInMonths, 
    startDate, 
    isBullet,
    drawdowns = [], 
    manualPayments = [],
    periodStatuses = {}
  } = input;
  
  const monthlyRate = (annualInterestRate || 0) / 12 / 100;
  
  // Parse start date safely
  const start = new Date(startDate || new Date().toISOString());

  // Aggregate drawdowns that happened BEFORE the first period starts
  // (Historical catch-all for data before the start date)
  const firstPeriodStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const initialDrawdowns = drawdowns.filter(d => new Date(d.date) < firstPeriodStart);
  const initialDrawdownAmount = initialDrawdowns.reduce((acc, d) => acc + d.amount, 0);

  let currentBalance = (principalAmount || 0) + initialDrawdownAmount;
  let cumulativeInterest = 0;

  for (let i = 1; i <= (termInMonths || 1); i++) {
    // Current period end date (last day of the month)
    const periodEndDate = new Date(start.getFullYear(), start.getMonth() + i, 0);
    const dateStr = periodEndDate.toISOString().split('T')[0];

    // Current period start date
    const periodStartDate = new Date(start.getFullYear(), start.getMonth() + i - 1, 1);

    // Calculate drawdowns in this specific window
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= periodStartDate && dDate <= periodEndDate;
    });
    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // Accrue interest on the balance AFTER drawdowns are applied for the period
    const balanceForInterest = currentBalance + drawdownAmount;
    const interestAccrual = Number((balanceForInterest * monthlyRate).toFixed(2));
    
    // Aggregate manual payments for this period
    const manualPmtList = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = manualPmtList.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = manualPmtList.reduce((acc, p) => acc + p.interestAmount, 0);

    // Bullet Repayment Logic at Maturity
    if (i === termInMonths && isBullet && principalPaid === 0) {
      principalPaid = Number((balanceForInterest + interestAccrual).toFixed(2));
    }

    const closingBalance = Number((balanceForInterest + interestAccrual - principalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    // Determine Status: Manual overrides take precedence
    let status: LoanStatus = 'projected';
    if (periodStatuses[i]) {
      status = periodStatuses[i];
    } else if (manualPmtList.length > 0) {
      status = 'paid';
    }

    schedule.push({
      periodNumber: i,
      date: dateStr,
      openingBalance: Number(currentBalance.toFixed(2)),
      drawdownAmount,
      interestAccrual,
      principalPaid,
      interestPaid,
      closingBalance: Math.max(0, closingBalance),
      cumulativeInterest,
      status,
    });

    // Carry balance forward to next month
    currentBalance = closingBalance;
  }

  return schedule;
}