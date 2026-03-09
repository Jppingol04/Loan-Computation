
import { AmortizationPeriod } from './loan-calculations';
import * as XLSX from 'xlsx';

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

export function exportToExcel(schedule: AmortizationPeriod[], loanName: string) {
  const data = schedule.map(p => ({
    'Period': p.periodNumber,
    'Date': p.date,
    'Opening Balance': p.openingBalance,
    'Drawdown': p.drawdownAmount,
    'Interest Accrual': p.interestAccrual,
    'Principal Paid': p.principalPaid,
    'Interest Paid': p.interestPaid,
    'Closing Balance': p.closingBalance,
    'Cumulative Interest': p.cumulativeInterest,
    'Status': p.status
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Amortization Schedule");
  
  // Basic styling - set column widths
  const wscols = [
    {wch: 8}, {wch: 12}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 18}, {wch: 12}
  ];
  worksheet['!cols'] = wscols;

  XLSX.writeFile(workbook, `${loanName || 'Loan_Schedule'}.xlsx`);
}

export function generateAmortizationCSV(schedule: AmortizationPeriod[]): string {
  const headers = ['Period', 'Date', 'Opening Balance', 'Drawdown', 'Interest Accrual', 'Principal Paid', 'Interest Paid', 'Closing Balance', 'Cumulative Interest', 'Status'];
  const rows = schedule.map(p => [
    p.periodNumber,
    p.date,
    p.openingBalance,
    p.drawdownAmount,
    p.interestAccrual,
    p.principalPaid,
    p.interestPaid,
    p.closingBalance,
    p.cumulativeInterest,
    p.status
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}
