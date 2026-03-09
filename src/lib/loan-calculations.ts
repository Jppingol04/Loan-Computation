
export type LoanStatus = 'projected' | 'paid' | 'unpaid' | 'recalculated';

export type DayCountConvention = '30/360' | '30/365' | 'ACT/360' | 'ACT/365';

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
  totalPayment: number; // Added for annuity calculations
  principalPortion: number; // Added for annuity calculations
}

export interface LoanInput {
  loanName: string;
  principalAmount: number;
  annualInterestRate: number;
  termInMonths: number;
  startDate: string;
  currency: string;
  dayCountConvention: DayCountConvention;
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

/**
 * Calculates days between two dates based on convention.
 */
function calculateDays(start: Date, end: Date, convention: DayCountConvention): number {
  if (convention === '30/360') {
    let d1 = start.getDate();
    let m1 = start.getMonth() + 1;
    let y1 = start.getFullYear();
    let d2 = end.getDate();
    let m2 = end.getMonth() + 1;
    let y2 = end.getFullYear();

    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;

    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  }
  
  if (convention === '30/365') {
    // Standard 30/365: months are 30 days, year is 365.
    // However, some implementations treat it as actual days / 365 but limiting months.
    // We'll follow the simple rule: (Months * 30) + DayDiff.
    let m1 = start.getMonth() + 1;
    let y1 = start.getFullYear();
    let m2 = end.getMonth() + 1;
    let y2 = end.getFullYear();
    let d1 = Math.min(start.getDate(), 30);
    let d2 = Math.min(end.getDate(), 30);
    
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1); 
  }

  // ACT conventions
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getYearBasis(convention: DayCountConvention): number {
  if (convention.endsWith('360')) return 360;
  return 365;
}

export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  const schedule: AmortizationPeriod[] = [];
  const { 
    principalAmount, 
    annualInterestRate, 
    termInMonths, 
    startDate, 
    dayCountConvention = '30/360',
    isBullet,
    drawdowns = [], 
    manualPayments = [],
    periodStatuses = {}
  } = input;
  
  const start = parseLocalDate(startDate);
  const rate = annualInterestRate / 100;

  // Aggregate drawdowns at or before start
  const initialDrawdownAmount = drawdowns
    .filter(d => parseLocalDate(d.date) <= start)
    .reduce((acc, d) => acc + d.amount, 0);

  let currentBalance = principalAmount + initialDrawdownAmount;
  let cumulativeInterest = 0;

  for (let i = 1; i <= termInMonths; i++) {
    // Period end date (EOM)
    const targetDate = new Date(start.getFullYear(), start.getMonth() + i, 0);
    const dateStr = toDateString(targetDate);

    // Period window
    const prevPeriodEnd = i === 1 
      ? new Date(start) 
      : new Date(start.getFullYear(), start.getMonth() + i - 1, 0);

    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = parseLocalDate(d.date);
      return dDate > prevPeriodEnd && dDate <= targetDate;
    });
    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // Interest Calculation
    const days = calculateDays(prevPeriodEnd, targetDate, dayCountConvention);
    const yearBasis = getYearBasis(dayCountConvention);
    const interestAccrual = Number((currentBalance * rate * (days / yearBasis)).toFixed(2));
    
    const manualPmtList = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = manualPmtList.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = manualPmtList.reduce((acc, p) => acc + p.interestAmount, 0);

    // Bullet Repayment Logic at Maturity
    if (i === termInMonths && isBullet) {
      const totalOutstanding = currentBalance + interestAccrual - principalPaid - interestPaid;
      if (totalOutstanding > 0) {
        principalPaid = Number((currentBalance - principalPaid).toFixed(2));
        interestPaid = Number((interestAccrual - interestPaid).toFixed(2));
      }
    }

    const closingBalance = Number((currentBalance + drawdownAmount + interestAccrual - principalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    let status: LoanStatus = periodStatuses[i] || (manualPmtList.length > 0 ? 'paid' : 'projected');

    schedule.push({
      periodNumber: i,
      date: dateStr,
      openingBalance: Number(currentBalance.toFixed(2)),
      drawdownAmount,
      interestAccrual,
      principalPaid,
      interestPaid,
      principalPortion: principalPaid,
      totalPayment: principalPaid + interestPaid,
      closingBalance: Math.max(0, closingBalance),
      cumulativeInterest,
      status,
    });

    currentBalance = Math.max(0, closingBalance);
  }

  return schedule;
}
