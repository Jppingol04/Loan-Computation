import { AmortizationPeriod } from './loan-calculations';

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function generateAmortizationCSV(schedule: AmortizationPeriod[]): string {
  const headers = ['Period', 'Date', 'Opening Balance', 'Interest Accrual', 'Principal Portion', 'Total Payment', 'Closing Balance', 'Cumulative Interest', 'Status'];
  const rows = schedule.map(p => [
    p.periodNumber,
    p.date,
    p.openingBalance,
    p.interestAccrual,
    p.principalPortion,
    p.totalPayment,
    p.closingBalance,
    p.cumulativeInterest,
    p.status
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}

export function generateOdooJournalCSV(schedule: AmortizationPeriod[], loanName: string): string {
  const headers = ['journal_id/name', 'date', 'ref', 'line_ids/account_id/code', 'line_ids/name', 'line_ids/debit', 'line_ids/credit'];
  const lines: any[][] = [];

  schedule.forEach(p => {
    // Accrual Entry
    const ref = `${loanName} - Period ${p.periodNumber}`;
    lines.push(['Miscellaneous Operations', p.date, ref, '6110', 'Interest Expense Accrual', p.interestAccrual, 0]);
    lines.push(['Miscellaneous Operations', p.date, ref, '2310', 'Interest Payable Accrual', 0, p.interestAccrual]);

    // Payment Entry (Simplified for example)
    if (p.status === 'paid') {
      const pRef = `${loanName} - Payment ${p.periodNumber}`;
      lines.push(['Bank', p.date, pRef, '2200', 'Loan Principal Repayment', p.principalPortion, 0]);
      lines.push(['Bank', p.date, pRef, '2310', 'Interest Settlement', p.interestAccrual, 0]);
      lines.push(['Bank', p.date, pRef, '1010', 'Bank Payment', 0, p.totalPayment]);
    }
  });

  return [headers, ...lines].map(r => r.join(',')).join('\n');
}
