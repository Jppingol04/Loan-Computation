export type LoanStatus = 'projected' | 'paid' | 'recalculated';

export interface AmortizationPeriod {
  periodNumber: number;
  date: string;
  openingBalance: number;
  interestAccrual: number;
  principalPortion: number;
  totalPayment: number;
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
}

export function calculateMonthlyPayment(principal: number, annualRate: number, termInMonths: number): number {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / termInMonths;
  const pmt = (principal * r * Math.pow(1 + r, termInMonths)) / (Math.pow(1 + r, termInMonths) - 1);
  return Number(pmt.toFixed(2));
}

export function generateAmortizationSchedule(input: LoanInput): AmortizationPeriod[] {
  const schedule: AmortizationPeriod[] = [];
  const { principalAmount, annualInterestRate, termInMonths, startDate } = input;
  const monthlyRate = annualInterestRate / 12 / 100;
  const monthlyPayment = calculateMonthlyPayment(principalAmount, annualInterestRate, termInMonths);

  let currentBalance = principalAmount;
  let cumulativeInterest = 0;
  const start = new Date(startDate);

  for (let i = 1; i <= termInMonths; i++) {
    const periodDate = new Date(start);
    periodDate.setMonth(start.getMonth() + i);
    // Set to end of month
    periodDate.setDate(0); 

    const interestAccrual = Number((currentBalance * monthlyRate).toFixed(2));
    let principalPortion = Number((monthlyPayment - interestAccrual).toFixed(2));
    
    // Final period adjustment to zero out
    if (i === termInMonths) {
      principalPortion = currentBalance;
    }

    const totalPayment = Number((principalPortion + interestAccrual).toFixed(2));
    const closingBalance = Number((currentBalance - principalPortion).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    schedule.push({
      periodNumber: i,
      date: periodDate.toISOString().split('T')[0],
      openingBalance: Number(currentBalance.toFixed(2)),
      interestAccrual,
      principalPortion,
      totalPayment,
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
  
  const remainingPrincipal = targetPeriod.openingBalance;
  const remainingTerm = existingSchedule.length - effectivePeriod + 1;
  const monthlyRate = newAnnualRate / 12 / 100;
  const newMonthlyPayment = calculateMonthlyPayment(remainingPrincipal, newAnnualRate, remainingTerm);

  const updatedSchedule = [...preservedPeriods];
  let currentBalance = remainingPrincipal;
  let cumulativeInterest = preservedPeriods.length > 0 
    ? preservedPeriods[preservedPeriods.length - 1].cumulativeInterest 
    : 0;

  const startBaseDate = new Date(existingSchedule[0].date);
  
  for (let i = effectivePeriod; i <= existingSchedule.length; i++) {
    const periodDate = new Date(existingSchedule[i-1].date);

    const interestAccrual = Number((currentBalance * monthlyRate).toFixed(2));
    let principalPortion = Number((newMonthlyPayment - interestAccrual).toFixed(2));
    
    if (i === existingSchedule.length) {
      principalPortion = currentBalance;
    }

    const totalPayment = Number((principalPortion + interestAccrual).toFixed(2));
    const closingBalance = Number((currentBalance - principalPortion).toFixed(2));
    cumulativeInterest = Number((cumulativeInterest + interestAccrual).toFixed(2));

    updatedSchedule.push({
      periodNumber: i,
      date: periodDate.toISOString().split('T')[0],
      openingBalance: Number(currentBalance.toFixed(2)),
      interestAccrual,
      principalPortion,
      totalPayment,
      closingBalance: Math.max(0, closingBalance),
      cumulativeInterest,
      status: 'recalculated',
    });

    currentBalance = closingBalance;
  }

  return updatedSchedule;
}
