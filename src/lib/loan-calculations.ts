
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

function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  
  const start = parseLocalDate(startDate);
  const rate = annualInterestRate / 100;

  const initialDrawdownAmount = drawdowns
    .filter(d => parseLocalDate(d.date) <= start)
    .reduce((acc, d) => acc + d.amount, 0);

  let currentBalance = principalAmount + initialDrawdownAmount;
  let cumulativeInterest = 0;

  for (let i = 1; i <= termInMonths; i++) {
    const targetDate = new Date(start.getFullYear(), start.getMonth() + i, 0);
    const dateStr = toDateString(targetDate);

    const prevPeriodEnd = i === 1 
      ? new Date(start) 
      : new Date(start.getFullYear(), start.getMonth() + i - 1, 0);

    const yearBasis = getYearBasis(dayCountConvention);
    
    // 1. Accrue interest on Opening Balance for the whole period
    const totalDaysInPeriod = calculateDays(prevPeriodEnd, targetDate, dayCountConvention);
    let interestAccrual = currentBalance * rate * (totalDaysInPeriod / yearBasis);

    // 2. Accrue interest for intra-month drawdowns (prospective from drawdown date)
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
    
    const manualPmtList = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = manualPmtList.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = manualPmtList.reduce((acc, p) => acc + p.interestAmount, 0);

    if (i === termInMonths && isBullet) {
      const totalOutstanding = currentBalance + drawdownAmount + interestAccrual - principalPaid - interestPaid;
      if (totalOutstanding > 0) {
        principalPaid = Number((currentBalance + drawdownAmount - principalPaid).toFixed(2));
        interestPaid = Number((interestAccrual - interestPaid).toFixed(2));
      }
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
  }

  return schedule;
}
