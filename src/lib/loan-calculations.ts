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
  totalPayment: number;
  principalPortion: number;
}

export interface LoanInput {
  loanName: string;
  principalAmount: number;
  annualInterestRate: number;
  termInMonths: number;
  startDate: string;
  currency: string;
  dayCountConvention: DayCountConvention;
  isBullet: boolean;
  drawdowns?: Drawdown[];
  manualPayments?: ManualPayment[];
  periodStatuses?: Record<number, LoanStatus>;
}

// Improved date parsing to handle various common formats
function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      [y, m, d] = parts.map(Number);
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY
      [d, m, y] = parts.map(Number);
    } else {
      return new Date(dateStr);
    }
    return new Date(y, m - 1, d);
  }
  
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculateDays(start: Date, end: Date, convention: DayCountConvention): number {
  if (convention === '30/360' || convention === '30/365') {
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
  
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
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
  
  const originalStart = parseLocalDate(startDate);
  const rate = annualInterestRate / 100;

  // Determine the EARLIEST relevant date (Start Date or any Drawdown)
  let earliestDate = new Date(originalStart);
  drawdowns.forEach(d => {
    const dDate = parseLocalDate(d.date);
    if (dDate < earliestDate) earliestDate = new Date(dDate);
  });

  // Align calculation start to the beginning of the earliest month
  const calcStart = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
  const originalEnd = new Date(originalStart.getFullYear(), originalStart.getMonth() + termInMonths, 0);
  
  // Total months to calculate (from earliest event to intended maturity)
  const totalMonths = (originalEnd.getFullYear() - calcStart.getFullYear()) * 12 + (originalEnd.getMonth() - calcStart.getMonth());

  let currentBalance = 0;
  // If the loan has an initial principal that isn't represented as a drawdown, 
  // we add it at the original Start Date or the first period.
  let principalInjected = false;
  let cumulativeInterest = 0;

  for (let i = 1; i <= Math.max(1, totalMonths); i++) {
    const targetDate = new Date(calcStart.getFullYear(), calcStart.getMonth() + i, 0);
    const dateStr = toDateString(targetDate);
    const prevPeriodEnd = i === 1 
      ? new Date(calcStart.getFullYear(), calcStart.getMonth(), 0)
      : new Date(calcStart.getFullYear(), calcStart.getMonth() + i - 1, 0);

    const yearBasis = getYearBasis(dayCountConvention);

    // Inject principal if we reach the original start date and haven't yet
    if (!principalInjected && targetDate >= originalStart) {
      currentBalance += principalAmount;
      principalInjected = true;
    }

    // 1. Accrue interest on Opening Balance
    const totalDaysInPeriod = calculateDays(prevPeriodEnd, targetDate, dayCountConvention);
    let interestAccrual = currentBalance * rate * (totalDaysInPeriod / yearBasis);

    // 2. Intra-month drawdowns
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = parseLocalDate(d.date);
      return dDate > prevPeriodEnd && dDate <= targetDate;
    });

    periodDrawdowns.forEach(d => {
      const dDate = parseLocalDate(d.date);
      const daysRemaining = calculateDays(dDate, targetDate, dayCountConvention);
      interestAccrual += d.amount * rate * (daysRemaining / yearBasis);
    });

    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // 3. Payments
    // Find matching payments. Note: manualPayments currently use "periodNumber" 
    // which might need to be shifted if calcStart != originalStart.
    // For now, we align them to the month sequence.
    const manualPmtList = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = manualPmtList.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = manualPmtList.reduce((acc, p) => acc + p.interestAmount, 0);

    // 4. Bullet Settlement at Maturity
    if (i === totalMonths && isBullet) {
      const totalOutstandingPrincipal = currentBalance + drawdownAmount;
      principalPaid = Number(totalOutstandingPrincipal.toFixed(2));
      interestPaid = Number(interestAccrual.toFixed(2));
    }

    interestAccrual = Number(interestAccrual.toFixed(2));
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
      totalPayment: Number((principalPaid + interestPaid).toFixed(2)),
      closingBalance: Math.max(0, closingBalance),
      cumulativeInterest,
      status,
    });

    currentBalance = Math.max(0, closingBalance);
    
    // Stop if balance is zeroed and we've passed the original term
    if (currentBalance <= 0 && i >= totalMonths) break;
  }

  return schedule;
}
