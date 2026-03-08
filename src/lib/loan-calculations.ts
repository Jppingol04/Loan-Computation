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

/**
 * Parses a YYYY-MM-DD string into a Date object at midnight local time.
 * Avoids UTC timezone shifts.
 */
function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a Date object back to YYYY-MM-DD string.
 */
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateMonthsBetween(start: string, end: string): number {
  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);
  return (
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())
  );
}

/**
 * Generates an IFRS 9 schedule based on anniversary dates.
 * If a loan starts on Jan 31st, subsequent months will fall on the 31st
 * or the last day of the month if it's shorter (e.g., Feb 28th).
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
  const start = parseLocalDate(startDate);
  const anchorDay = start.getDate();

  // Aggregate drawdowns that happened AT or BEFORE the exact start date as "Initial"
  const initialDrawdowns = drawdowns.filter(d => {
    const dDate = parseLocalDate(d.date);
    return dDate <= start;
  });
  const initialDrawdownAmount = initialDrawdowns.reduce((acc, d) => acc + d.amount, 0);

  let currentBalance = (principalAmount || 0) + initialDrawdownAmount;
  let cumulativeInterest = 0;

  for (let i = 1; i <= (termInMonths || 1); i++) {
    // Calculate the anniversary date for this period
    // new Date(y, m + i, d) handles overflows automatically.
    // However, to mimic banking logic (e.g. 31st -> 28th), we need a check.
    let targetDate = new Date(start.getFullYear(), start.getMonth() + i, anchorDay);
    
    // If we passed the intended month (e.g. Jan 31 -> March 3), snap to month end
    if (targetDate.getDate() !== anchorDay) {
      targetDate = new Date(start.getFullYear(), start.getMonth() + i + 1, 0);
    }
    
    const dateStr = toDateString(targetDate);

    // Calculate the period window (Previous period end to current period end)
    let prevPeriodEnd: Date;
    if (i === 1) {
      prevPeriodEnd = new Date(start);
    } else {
      prevPeriodEnd = new Date(start.getFullYear(), start.getMonth() + i - 1, anchorDay);
      if (prevPeriodEnd.getDate() !== anchorDay) {
        prevPeriodEnd = new Date(start.getFullYear(), start.getMonth() + i, 0);
      }
    }

    // Filter drawdowns falling strictly within this month's window
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = parseLocalDate(d.date);
      return dDate > prevPeriodEnd && dDate <= targetDate;
    });
    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // Interest accrues on the daily average balance or balance after drawdowns
    // For this simple engine, we accrue on balance + period drawdowns
    const balanceForInterest = currentBalance + drawdownAmount;
    const interestAccrual = Number((balanceForInterest * monthlyRate).toFixed(2));
    
    const manualPmtList = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = manualPmtList.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = manualPmtList.reduce((acc, p) => acc + p.interestAmount, 0);

    // Bullet Repayment Logic at Maturity
    if (i === termInMonths && isBullet && principalPaid === 0) {
      principalPaid = Number((balanceForInterest + interestAccrual).toFixed(2));
    }

    const closingBalance = Number((balanceForInterest + interestAccrual - principalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

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

    currentBalance = closingBalance;
  }

  return schedule;
}
