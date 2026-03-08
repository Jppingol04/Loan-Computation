export type LoanStatus = 'projected' | 'paid' | 'unpaid';

export interface Drawdown {
  id: string;
  date: string;
  amount: number;
}

export interface ManualPayment {
  periodNumber: number;
  principalAmount: number;
  interestAmount: number;
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
  isBullet: boolean; // Whether to automatically repay principal at maturity
  drawdowns?: Drawdown[];
  manualPayments?: ManualPayment[];
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

export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  const schedule: AmortizationPeriod[] = [];
  const { 
    principalAmount, 
    annualInterestRate, 
    termInMonths, 
    startDate, 
    isBullet,
    drawdowns = [], 
    manualPayments = [] 
  } = input;
  
  const monthlyRate = (annualInterestRate || 0) / 12 / 100;
  let currentBalance = principalAmount || 0;
  let cumulativeInterest = 0;
  
  // Parse start date safely
  const start = new Date(startDate || new Date().toISOString());

  for (let i = 1; i <= (termInMonths || 1); i++) {
    // Current period end date (last day of the month)
    const periodEndDate = new Date(start.getFullYear(), start.getMonth() + i, 0);
    const dateStr = periodEndDate.toISOString().split('T')[0];

    // Current period start date
    const periodStartDate = new Date(start.getFullYear(), start.getMonth() + i - 1, 1);

    // Calculate drawdowns in this window
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= periodStartDate && dDate <= periodEndDate;
    });
    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // Accrue interest on the balance *after* drawdowns are applied
    const balanceForInterest = currentBalance + drawdownAmount;
    const interestAccrual = Number((balanceForInterest * monthlyRate).toFixed(2));
    
    // Look for manual payment inputs for this period
    const manualPmt = manualPayments.find(p => p.periodNumber === i);
    let principalPaid = manualPmt?.principalAmount || 0;
    let interestPaid = manualPmt?.interestAmount || 0;

    // Bullet Repayment Logic: 
    // Repay everything (principal + any un-repaid accrued interest) at final maturity if isBullet is true
    if (i === termInMonths && isBullet && principalPaid === 0) {
      principalPaid = balanceForInterest + interestAccrual;
    }

    const closingBalance = Number((balanceForInterest + interestAccrual - principalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

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
      status: 'projected',
    });

    currentBalance = closingBalance;
  }

  return schedule;
}

export function recalculateProspectively(
  existingSchedule: AmortizationPeriod[],
  effectivePeriod: number,
  newAnnualRate: number
): AmortizationPeriod[] {
  if (!existingSchedule.length) return [];
  
  const periodIndex = effectivePeriod - 1;
  const preservedPeriods = existingSchedule.slice(0, Math.max(0, periodIndex));
  const targetPeriod = existingSchedule[periodIndex];
  
  if (!targetPeriod) return existingSchedule;

  const monthlyRate = (newAnnualRate || 0) / 12 / 100;
  const updatedSchedule = [...preservedPeriods];
  let currentBalance = targetPeriod.openingBalance;
  
  let cumulativeInterest = preservedPeriods.length > 0 
    ? preservedPeriods[preservedPeriods.length - 1].cumulativeInterest 
    : 0;

  for (let i = effectivePeriod; i <= existingSchedule.length; i++) {
    const periodData = existingSchedule[i-1];
    const balanceForInterest = currentBalance + periodData.drawdownAmount;
    const interestAccrual = Number((balanceForInterest * monthlyRate).toFixed(2));
    
    const principalPaid = periodData.principalPaid;
    const interestPaid = periodData.interestPaid;

    const closingBalance = Number((balanceForInterest + interestAccrual - principalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    updatedSchedule.push({
      ...periodData,
      openingBalance: Number(currentBalance.toFixed(2)),
      interestAccrual,
      closingBalance: Math.max(0, closingBalance),
      cumulativeInterest,
      status: 'projected',
    });

    currentBalance = closingBalance;
  }

  return updatedSchedule;
}
