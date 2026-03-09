
import { AmortizationPeriod, LoanInput } from './loan-calculations';
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

export function exportToExcel(schedule: AmortizationPeriod[], loanInput: LoanInput) {
  const annualRate = loanInput.annualInterestRate / 100;
  const convention = loanInput.dayCountConvention;
  const yearBasis = convention.endsWith('360') ? 360 : 365;

  // Create a detached "parameters" sheet to hold values for formulas
  const paramsSheetData = [
    ['Annual Rate', annualRate],
    ['Year Basis', yearBasis],
    ['Convention', convention],
    ['Start Date', loanInput.startDate]
  ];
  const paramsSheet = XLSX.utils.aoa_to_sheet(paramsSheetData);


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

  const dataRows = schedule.map((p, index) => {
    const excelRowNum = index + 2;

    const openingBalanceCell = index === 0
      ? { v: p.openingBalance, t: 'n', z: '#,##0.00' }
      : { f: `H${excelRowNum - 1}`, t: 'n', z: '#,##0.00' };

    const cumulativeInterestCell = index === 0
      ? { v: p.cumulativeInterest, t: 'n', z: '#,##0.00' }
      : { f: `I${excelRowNum - 1}+E${excelRowNum}`, t: 'n', z: '#,##0.00' };

    let interestFormula: string;
    // For simplicity in Excel, we base the calculation on the period's opening balance
    // and total drawdown amount. This won't perfectly match the app's intra-month
    // calculation for drawdowns but provides a transparent formula.
    // The formula will be: (Opening Balance * Days in Period * Daily Rate) + (Drawdown * ~15 days * Daily Rate)
    const dailyRate = `Parameters!$B$1/Parameters!$B$2`;
    const prevDateCell = index === 0 ? 'Parameters!$B$4' : `B${excelRowNum - 1}`;
    const daysInPeriod = `B${excelRowNum}-${prevDateCell}`;

    // A simplified weighted average for drawdown interest within the month.
    interestFormula = `C${excelRowNum}*(${daysInPeriod})*${dailyRate} + D${excelRowNum}*15*${dailyRate}`;
    
    // Note: Due to the complexity of replicating the exact intra-month accrual logic
    // in an Excel formula (which requires knowing the specific date of each drawdown),
    // this formula provides a close approximation for transparency. The original, precise
    // values from the engine are also available if the formula is removed.
    
    return [
      { v: p.periodNumber, t: 'n' },
      { v: p.date, t: 's' },
      openingBalanceCell,
      { v: p.drawdownAmount, t: 'n', z: '#,##0.00' },
      { f: interestFormula, t: 'n', z: '#,##0.00' },
      { v: p.principalPaid, t: 'n', z: '#,##0.00' },
      { v: p.interestPaid, t: 'n', z: '#,##0.00' },
      { f: `MAX(0, C${excelRowNum}+D${excelRowNum}+E${excelRowNum}-F${excelRowNum}-G${excelRowNum})`, t: 'n', z: '#,##0.00' },
      cumulativeInterestCell,
      { v: p.status, t: 's' }
    ];
  });

  const worksheetData = [header, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Amortization Schedule");
  XLSX.utils.book_append_sheet(workbook, paramsSheet, "Parameters");
  paramsSheet['!cols'] = [{hidden: true}]; // Hide the parameters sheet

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

  XLSX.writeFile(workbook, `${loanInput.loanName || 'Loan_Schedule'}.xlsx`);
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
