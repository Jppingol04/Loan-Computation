
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
  const header = [
    'Period',             // A
    'Date',               // B
    'Opening Balance',    // C
    'Drawdown',           // D
    'Interest Accrual',   // E
    'Principal Paid',     // F
    'Interest Paid',      // G
    'Closing Balance',    // H
    'Cumulative Interest',// I
    'Status'              // J
  ];

  // Map schedule to rows of cell objects for XLSX creation
  const dataRows = schedule.map((p, index) => {
    const excelRowNum = index + 2; // Excel rows are 1-based, and we have a header

    const openingBalanceCell = index === 0
      ? { v: p.openingBalance, t: 'n', z: '#,##0.00' }
      // For subsequent rows, Opening Balance is the previous Closing Balance
      : { f: `H${excelRowNum - 1}`, t: 'n', z: '#,##0.00' };

    const cumulativeInterestCell = index === 0
      ? { v: p.cumulativeInterest, t: 'n', z: '#,##0.00' }
      // For subsequent rows, it's previous cumulative + current accrual
      : { f: `I${excelRowNum - 1}+E${excelRowNum}`, t: 'n', z: '#,##0.00' };
    
    return [
      { v: p.periodNumber, t: 'n' },
      { v: p.date, t: 's' },
      openingBalanceCell,
      { v: p.drawdownAmount, t: 'n', z: '#,##0.00' },
      { v: p.interestAccrual, t: 'n', z: '#,##0.00' }, // This is calculated by the app, so it's a static value
      { v: p.principalPaid, t: 'n', z: '#,##0.00' },
      { v: p.interestPaid, t: 'n', z: '#,##0.00' },
      // Closing Balance = Opening + Drawdown + Accrual - Pmt(P) - Pmt(I)
      { f: `MAX(0, C${excelRowNum}+D${excelRowNum}+E${excelRowNum}-F${excelRowNum}-G${excelRowNum})`, t: 'n', z: '#,##0.00' },
      cumulativeInterestCell,
      { v: p.status, t: 's' }
    ];
  });

  const worksheetData = [header, ...dataRows];
  
  // Create worksheet from an array of arrays of cell objects
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Amortization Schedule");
  
  // Set column widths for readability
  const wscols = [
    {wch: 8},   // Period
    {wch: 12},  // Date
    {wch: 18},  // Opening Balance
    {wch: 18},  // Drawdown
    {wch: 18},  // Interest Accrual
    {wch: 18},  // Principal Paid
    {wch: 18},  // Interest Paid
    {wch: 18},  // Closing Balance
    {wch: 18},  // Cumulative Interest
    {wch: 12}   // Status
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
