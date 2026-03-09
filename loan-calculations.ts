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
  date?: string;
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
  const parts = dateStr.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [y, m, d] = parts.map(Number);
      return new Date(y, m - 1, d);
    } else if (parts[2].length === 4) {
      const [d, m, y] = parts.map(Number);
      return new Date(y, m - 1, d);
    }
  }
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateDays(start: Date, end: Date, convention: DayCountConvention): number {
  if (convention === '30/360' || convention === '30/365') {
    let d1 = start.getDate(), d2 = end.getDate();
    const m1 = start.getMonth() + 1, m2 = end.getMonth() + 1;
    const y1 = start.getFullYear(), y2 = end.getFullYear();
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 >= 30) d2 = 30;
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  }
  return Math.round(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function getYearBasis(convention: DayCountConvention): number {
  return convention.endsWith('360') ? 360 : 365;
}

function validateInput(input: LoanInput): void {
  if (input.principalAmount < 0) throw new Error('Principal cannot be negative.');
  if (input.annualInterestRate < 0 || input.annualInterestRate > 100) throw new Error('Rate must be 0-100%.');
  if (input.termInMonths < 1 || input.termInMonths > 600) throw new Error('Term must be 1-600 months.');
  if (!input.startDate) throw new Error('Start date required.');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  validateInput(input);
  const schedule: AmortizationPeriod[] = [];
  const {
    principalAmount, annualInterestRate, termInMonths, startDate,
    dayCountConvention = 'ACT/365', isBullet,
    drawdowns = [], manualPayments = [], periodStatuses = {},
  } = input;

  const originalStart = parseLocalDate(startDate);
  const rate = annualInterestRate / 100;
  const yearBasis = getYearBasis(dayCountConvention);

  let earliestDate = new Date(originalStart);
  for (const d of drawdowns) {
    const dDate = parseLocalDate(d.date);
    if (dDate < earliestDate) earliestDate = new Date(dDate);
  }

  const calcStart = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
  const originalEnd = new Date(originalStart.getFullYear(), originalStart.getMonth() + termInMonths, 0);
  const totalMonths = (originalEnd.getFullYear() - calcStart.getFullYear()) * 12 + (originalEnd.getMonth() - calcStart.getMonth());

  // Full-precision running balances (round only for output)
  let principalBalance = 0;
  let accruedInterest = 0;
  let cumulativeInterest = 0;
  let principalInjected = false;

  for (let i = 1; i <= Math.max(1, totalMonths); i++) {
    const periodEnd = new Date(calcStart.getFullYear(), calcStart.getMonth() + i, 0);
    const prevPeriodEnd = i === 1
      ? new Date(calcStart.getFullYear(), calcStart.getMonth(), 0)
      : new Date(calcStart.getFullYear(), calcStart.getMonth() + i - 1, 0);
    const dateStr = toDateString(periodEnd);

    // OPENING = previous period's closing (carried forward properly)
    const openingBalance = principalBalance + accruedInterest;

    // Interest on existing principal only (simple interest, not EIR compounding)
    const daysInPeriod = calculateDays(prevPeriodEnd, periodEnd, dayCountConvention);
    let interestAccrual = principalBalance * rate * (daysInPeriod / yearBasis);

    // Initial principal injection (pro-rata first month)
    if (!principalInjected && periodEnd >= originalStart) {
      const effectiveStart = originalStart.getDate() === 1
        ? new Date(originalStart.getFullYear(), originalStart.getMonth(), 0)
        : originalStart;
      const daysRemaining = calculateDays(effectiveStart, periodEnd, dayCountConvention);
      interestAccrual += principalAmount * rate * (daysRemaining / yearBasis);
      principalBalance += principalAmount;
      principalInjected = true;
    }

    // Intra-month drawdowns (pro-rata)
    let periodDrawdownTotal = 0;
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = parseLocalDate(d.date);
      return dDate > prevPeriodEnd && dDate <= periodEnd;
    });
    for (const d of periodDrawdowns) {
      const dDate = parseLocalDate(d.date);
      const effectiveDDate = dDate.getDate() === 1
        ? new Date(dDate.getFullYear(), dDate.getMonth(), 0) : dDate;
      const daysRemaining = calculateDays(effectiveDDate, periodEnd, dayCountConvention);
      interestAccrual += d.amount * rate * (daysRemaining / yearBasis);
      periodDrawdownTotal += d.amount;
    }
    principalBalance += periodDrawdownTotal;

    // Payments
    const periodPayments = manualPayments.filter(p => p.periodNumber === i);
    let principalPaid = periodPayments.reduce((acc, p) => acc + p.principalAmount, 0);
    let interestPaid = periodPayments.reduce((acc, p) => acc + p.interestAmount, 0);

    // Bullet at maturity
    if (i === totalMonths && isBullet) {
      principalPaid = principalBalance;
      interestPaid = accruedInterest + interestAccrual;
    }

    // Update running balances
    accruedInterest += interestAccrual;
    cumulativeInterest += interestAccrual;
    principalBalance -= principalPaid;
    accruedInterest -= interestPaid;

    if (Math.abs(principalBalance) < 0.005) principalBalance = 0;
    if (Math.abs(accruedInterest) < 0.005) accruedInterest = 0;

    const closingBalance = principalBalance + accruedInterest;
    const status: LoanStatus = periodStatuses[i] || (periodPayments.length > 0 ? 'paid' : 'projected');

    schedule.push({
      periodNumber: i,
      date: dateStr,
      openingBalance: round2(openingBalance),
      drawdownAmount: round2(periodDrawdownTotal),
      interestAccrual: round2(interestAccrual),
      principalPaid: round2(principalPaid),
      interestPaid: round2(interestPaid),
      principalPortion: round2(principalPaid),
      totalPayment: round2(principalPaid + interestPaid),
      closingBalance: round2(Math.max(0, closingBalance)),
      cumulativeInterest: round2(cumulativeInterest),
      status,
    });

    if (closingBalance <= 0 && i >= totalMonths) break;
  }
  return schedule;
}
