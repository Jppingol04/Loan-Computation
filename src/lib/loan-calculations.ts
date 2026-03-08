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
  drawdowns?: Drawdown[];
  manualPayments?: ManualPayment[];
}

export function calculateMonthlyPayment(principal: number, annualRate: number, termInMonths: number): number {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / termInMonths;
  const pmt = (principal * r * Math.pow(1 + r, termInMonths)) / (Math.pow(1 + r, termInMonths) - 1);
  return Number(pmt.toFixed(2));
}

export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  const schedule: AmortizationPeriod[] = [];
  const { principalAmount, annualInterestRate, termInMonths, startDate, drawdowns = [], manualPayments = [] } = input;
  const monthlyRate = annualInterestRate / 12 / 100;

  let currentBalance = principalAmount;
  let cumulativeInterest = 0;
  const start = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    // Determine the end of the current period (last day of the month)
    const periodEndDate = new Date(start.getFullYear(), start.getMonth() + i, 0);
    const dateStr = periodEndDate.toISOString().split('T')[0];

    // Determine the start of the current period for filtering drawdowns
    const periodStartDate = i === 1 
      ? new Date(startDate) 
      : new Date(start.getFullYear(), start.getMonth() + i - 1, 1);

    // Calculate drawdowns that occurred within this specific period window
    const periodDrawdowns = drawdowns.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= periodStartDate && dDate <= periodEndDate;
    });
    const drawdownAmount = periodDrawdowns.reduce((acc, d) => acc + d.amount, 0);
    
    // Accrue interest based on balance after drawdowns
    const balanceForInterest = currentBalance + drawdownAmount;
    const interestAccrual = Number((balanceForInterest * monthlyRate).toFixed(2));
    
    const manualPmt = manualPayments.find(p => p.periodNumber === i);
    const principalPaid = manualPmt?.principalAmount || 0;
    const interestPaid = manualPmt?.interestAmount || 0;

    // Repay everything at the final bullet maturity if not manually handled
    let finalPrincipalPaid = principalPaid;
    if (i === termInMonths && principalPaid === 0) {
      finalPrincipalPaid = balanceForInterest;
    }

    const closingBalance = Number((balanceForInterest + interestAccrual - finalPrincipalPaid - interestPaid).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    schedule.push({
      periodNumber: i,
      date: dateStr,
      openingBalance: Number(currentBalance.toFixed(2)),
      drawdownAmount,
      interestAccrual,
      principalPaid: finalPrincipalPaid,
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
  const periodIndex = effectivePeriod - 1;
  const preservedPeriods = existingSchedule.slice(0, periodIndex);
  const targetPeriod = existingSchedule[periodIndex];
  
  if (!targetPeriod) return existingSchedule;

  const monthlyRate = newAnnualRate / 12 / 100;
  const updatedSchedule = [...preservedPeriods];
  let currentBalance = targetPeriod.openingBalance;
  let cumulativeInterest = preservedPeriods.length > 0 
    ? preservedPeriods[preservedPeriods.length - 1].cumulativeInterest 
    : 0;

  for (let i = effectivePeriod; i <= existingSchedule.length; i++) {
    const periodData = existingSchedule[i-1];
    const interestAccrual = Number(((currentBalance + periodData.drawdownAmount) * monthlyRate).toFixed(2));
    
    const principalPaid = periodData.principalPaid;
    const interestPaid = periodData.interestPaid;

    const closingBalance = Number((currentBalance + periodData.drawdownAmount + interestAccrual - principalPaid - interestPaid).toFixed(2));
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
