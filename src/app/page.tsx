"use client"

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Calculator, Table as TableIcon, Download, RefreshCw, Sparkles, Plus, Trash2, TrendingUp, History, Settings2, Wallet, Upload, CreditCard, ChevronRight, FileSpreadsheet, FileText, Eraser, PlayCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  LoanStatus,
  Drawdown,
  ManualPayment,
  DayCountConvention
} from '@/lib/loan-calculations';
import { 
  downloadCSV, 
  generateAmortizationCSV,
  exportToExcel
} from '@/lib/export-utils';

export default function LoanEngineDashboard() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loanInput, setLoanInput] = useState<LoanInput>({
    loanName: 'Corporate Multi-Drawdown Facility',
    principalAmount: 100000000,
    annualInterestRate: 5.8,
    termInMonths: 24,
    startDate: '2026-01-01',
    currency: 'USD',
    dayCountConvention: 'ACT/365',
    isBullet: true,
    drawdowns: [
      { id: '1', date: '2026-01-23', amount: 50000000 }
    ],
    manualPayments: [],
    periodStatuses: {}
  });

  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('setup');
  const [isComputing, setIsComputing] = useState(false);
  
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [newDrawdown, setNewDrawdown] = useState({ date: '', amount: 0 });
  const [newPayment, setNewPayment] = useState({ periodNumber: 1, principal: 0, interest: 0 });
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Robust date normalization for imports
  const normalizeDateString = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();
    
    // Attempt parsing various common formats (YYYY-MM-DD, DD/MM/YYYY, etc)
    const parts = cleanStr.split(/[-/.]/);
    if (parts.length === 3) {
      let y, m, d;
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        [y, m, d] = parts;
      } else if (parts[2].length === 4) {
        // DD/MM/YYYY or MM/DD/YYYY
        // We assume DD/MM/YYYY for international consistency unless it's obviously MM/DD
        const first = parseInt(parts[0]);
        const second = parseInt(parts[1]);
        if (first > 12) {
          [d, m, y] = parts;
        } else {
          // Default to DD/MM/YYYY
          [d, m, y] = parts;
        }
      }
      if (y && m && d) {
        return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }
    }

    // Fallback to standard JS parsing (can be inconsistent but better than nothing)
    try {
      const dt = new Date(cleanStr);
      if (!isNaN(dt.getTime())) {
        return dt.toISOString().split('T')[0];
      }
    } catch (e) {}
    
    return cleanStr; // Return as is if all else fails
  };

  // Core calculation logic
  const performCalculation = (input: LoanInput) => {
    setIsComputing(true);
    try {
      const newSchedule = generateAmortizationSchedule(input);
      setSchedule(newSchedule);
      logAudit('Schedule Recomputed', `Recalculated accruals for ${input.loanName} across ${input.termInMonths} periods.`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Calculation Error", description: err.message });
    } finally {
      setIsComputing(false);
    }
  };

  // Automatically compute on input changes
  useEffect(() => {
    performCalculation(loanInput);
  }, [loanInput]);

  const handleManualCompute = () => {
    performCalculation(loanInput);
    toast({
      title: "Engine Recomputed",
      description: "Accrued interest and balances have been refreshed based on current inputs.",
    });
  };

  const logAudit = (action: string, details: string) => {
    const entry = {
      timestamp: new Date().toISOString(),
      actionType: action,
      details,
      user: 'Internal Auditor'
    };
    setAuditTrail(prev => [entry, ...prev]);
  };

  const handleAddDrawdown = () => {
    if (!newDrawdown.date || newDrawdown.amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Drawdown", description: "Please provide a valid date and amount." });
      return;
    }
    const updatedDrawdowns = [...(loanInput.drawdowns || []), { id: Math.random().toString(36).substr(2, 9), ...newDrawdown }];
    setLoanInput({ ...loanInput, drawdowns: updatedDrawdowns });
    setNewDrawdown({ date: '', amount: 0 });
    logAudit('Drawdown Added', `New drawdown of ${newDrawdown.amount} on ${newDrawdown.date}.`);
  };

  const handleClearDrawdowns = () => {
    setLoanInput(prev => ({ ...prev, drawdowns: [] }));
    logAudit('Drawdowns Cleared', 'All drawdown records were removed.');
    toast({ title: "Drawdowns Cleared", description: "All incremental exposure records have been removed." });
  };

  const handleAddPayment = () => {
    if (newPayment.periodNumber < 1 || (newPayment.principal <= 0 && newPayment.interest <= 0)) {
      toast({ variant: "destructive", title: "Invalid Payment", description: "Provide a valid period and payment amount." });
      return;
    }
    const payment: ManualPayment = {
      id: Math.random().toString(36).substr(2, 9),
      periodNumber: newPayment.periodNumber,
      principalAmount: newPayment.principal,
      interestAmount: newPayment.interest
    };
    setLoanInput(prev => ({ ...prev, manualPayments: [...(prev.manualPayments || []), payment] }));
    setNewPayment({ periodNumber: 1, principal: 0, interest: 0 });
    logAudit('Payment Recorded', `Payment for Month ${newPayment.periodNumber} recorded.`);
  };

  const handleClearPayments = () => {
    setLoanInput(prev => ({ ...prev, manualPayments: [] }));
    logAudit('Payments Cleared', 'All manual settlement records were removed.');
    toast({ title: "Payments Cleared", description: "All historical settlement records have been removed." });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        const data = results.data as any[];
        const importedDrawdowns: Drawdown[] = [];
        const importedPayments: ManualPayment[] = [];

        data.forEach(row => {
          const type = row.type?.toLowerCase();
          const amount = parseFloat(String(row.amount || '0').replace(/,/g, '')) || 0;
          const principal = parseFloat(String(row.principal || '0').replace(/,/g, '')) || 0;
          const interest = parseFloat(String(row.interest || '0').replace(/,/g, '')) || 0;
          const period = parseInt(String(row.period || '1')) || 1;
          const rawDate = String(row.date || '');
          const normalizedDate = normalizeDateString(rawDate);

          if (type === 'drawdown' && normalizedDate && amount > 0) {
            importedDrawdowns.push({
              id: Math.random().toString(36).substr(2, 9),
              date: normalizedDate,
              amount
            });
          } else if (type === 'payment' && (principal > 0 || interest > 0)) {
            importedPayments.push({
              id: Math.random().toString(36).substr(2, 9),
              periodNumber: period,
              principalAmount: principal,
              interestAmount: interest
            });
          }
        });

        if (importedDrawdowns.length === 0 && importedPayments.length === 0) {
          toast({ variant: "destructive", title: "Import Failed", description: "No valid drawdown or payment records found in CSV." });
          return;
        }

        // Functional update to ensure we use the latest state and trigger the re-calculation
        setLoanInput(prev => {
          const updated = {
            ...prev,
            drawdowns: [...(prev.drawdowns || []), ...importedDrawdowns],
            manualPayments: [...(prev.manualPayments || []), ...importedPayments]
          };
          return updated;
        });
        
        setIsImportOpen(false);
        toast({ title: "Import Successful", description: `Loaded ${importedDrawdowns.length} drawdowns and ${importedPayments.length} payments. Ledger will recompute.` });
        logAudit('Bulk Import', `Imported ${importedDrawdowns.length} drawdowns and ${importedPayments.length} payments from CSV.`);
      },
      error: (err) => {
        toast({ variant: "destructive", title: "Import Error", description: err.message });
      }
    });
    // Reset file input
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    const headers = "type,date,amount,period,principal,interest\n";
    const example1 = "drawdown,2026-01-23,50000000,,\n";
    const example2 = "payment,, ,1,10000,5000\n";
    downloadCSV("loan_import_template.csv", headers + example1 + example2);
    toast({ title: "Template Downloaded", description: "Follow the column format to import historical data." });
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    schedule.forEach(p => years.add(p.date.split('-')[0]));
    return Array.from(years).sort();
  }, [schedule]);

  const filteredSchedule = useMemo(() => {
    if (yearFilter === 'all') return schedule;
    return schedule.filter(p => p.date.startsWith(yearFilter));
  }, [schedule, yearFilter]);

  const totalCurrentPrincipal = loanInput.principalAmount + (loanInput.drawdowns?.reduce((a,b) => a+b.amount, 0) || 0);
  const totalInterestAccrued = schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 font-body">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LoanGuard <span className="text-primary">EIR</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">IFRS 9 ACCRUAL ENGINE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-white/10" onClick={() => setIsImportOpen(true)}><Upload className="h-4 w-4 mr-2" /> Bulk Import</Button>
            <Button size="sm" onClick={() => exportToExcel(schedule, loanInput.loanName)} className="shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90"><FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel</Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4 text-primary" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gross Exposure</p></div>
              <p className="text-2xl font-bold font-code">{loanInput.currency} {totalCurrentPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Accrued Interest</p></div>
              <p className="text-2xl font-bold font-code text-amber-500">{loanInput.currency} {totalInterestAccrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><RefreshCw className="h-4 w-4 text-blue-400" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">EIR Annual Rate</p></div>
              <p className="text-2xl font-bold font-code text-blue-400">{loanInput.annualInterestRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-purple-400" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Computation Basis</p></div>
              <p className="text-2xl font-bold font-code text-purple-400">{loanInput.dayCountConvention}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-fit bg-slate-900 border border-white/5 p-1 mb-8 rounded-xl">
            <TabsTrigger value="setup" className="data-[state=active]:bg-primary rounded-lg">Setup</TabsTrigger>
            <TabsTrigger value="drawdowns" className="data-[state=active]:bg-primary rounded-lg">Drawdowns</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary rounded-lg">Payments</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary rounded-lg">Ledger (EOM)</TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary rounded-lg">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="md:col-span-2 bg-slate-900/50 border-white/5">
                <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings2 className="h-5 w-5" /> Facility Parameters</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Facility Reference</Label><Input className="bg-slate-800 border-white/10" value={loanInput.loanName} onChange={e => setLoanInput({...loanInput, loanName: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Principal</Label><Input type="number" className="bg-slate-800 border-white/10" value={loanInput.principalAmount} onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})} /></div>
                      <div className="space-y-2"><Label>Currency</Label><Select value={loanInput.currency} onValueChange={v => setLoanInput({...loanInput, currency: v})}><SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="AED">AED</SelectItem><SelectItem value="EUR">EUR</SelectItem></SelectContent></Select></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Rate (%)</Label><Input type="number" step="0.01" className="bg-slate-800 border-white/10" value={loanInput.annualInterestRate} onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} /></div>
                      <div className="space-y-2"><Label>Term (Mo)</Label><Input type="number" className="bg-slate-800 border-white/10" value={loanInput.termInMonths} onChange={e => setLoanInput({...loanInput, termInMonths: Number(e.target.value)})} /></div>
                    </div>
                    <div className="space-y-2"><Label>Convention</Label><Select value={loanInput.dayCountConvention} onValueChange={v => setLoanInput({...loanInput, dayCountConvention: v as DayCountConvention})}><SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30/360">30/360 (Standard)</SelectItem><SelectItem value="30/365">30/365</SelectItem><SelectItem value="ACT/360">ACT/360 (Actual/360)</SelectItem><SelectItem value="ACT/365">ACT/365 (Actual/365)</SelectItem></SelectContent></Select></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-white/10 border-dashed border-2 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary"><Calculator className="h-8 w-8" /></div>
                <div>
                  <h3 className="font-bold">Bullet Repayment</h3>
                  <p className="text-xs text-muted-foreground mt-1">Settle full principal at maturity</p>
                </div>
                <div className="flex items-center space-x-2">
                   <Switch checked={loanInput.isBullet} onCheckedChange={(v) => setLoanInput({...loanInput, isBullet: v})} />
                   <Label>Enable Bullet</Label>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drawdowns" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Incremental Exposure</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearDrawdowns} className="text-destructive hover:bg-destructive/10">
                  <Eraser className="h-4 w-4 mr-2" /> Clear All
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/30 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 flex-1 w-full"><Label>Value Date</Label><Input type="date" className="bg-slate-900" value={newDrawdown.date} onChange={e => setNewDrawdown({...newDrawdown, date: e.target.value})} /></div>
                  <div className="space-y-2 flex-1 w-full"><Label>Amount</Label><Input type="number" className="bg-slate-900" value={newDrawdown.amount} onChange={e => setNewDrawdown({...newDrawdown, amount: Number(e.target.value)})} /></div>
                  <Button onClick={handleAddDrawdown} className="bg-primary"><Plus className="h-4 w-4 mr-2" /> Commit Drawdown</Button>
                </div>
                <Table>
                  <TableHeader><TableRow className="border-white/10"><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanInput.drawdowns?.map(d => (
                      <TableRow key={d.id} className="border-white/5 hover:bg-white/5 group">
                        <TableCell className="text-sm font-medium">{d.date}</TableCell>
                        <TableCell className="font-code text-sm text-primary font-bold">{d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setLoanInput(p => ({...p, drawdowns: p.drawdowns?.filter(x => x.id !== d.id)}))}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!loanInput.drawdowns || loanInput.drawdowns.length === 0) && (
                      <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No incremental drawdowns recorded.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Settlement Records</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleClearPayments} className="text-destructive hover:bg-destructive/10">
                  <Eraser className="h-4 w-4 mr-2" /> Clear All
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/30 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 w-24"><Label>Period #</Label><Input type="number" className="bg-slate-900" value={newPayment.periodNumber} onChange={e => setNewPayment({...newPayment, periodNumber: Number(e.target.value)})} /></div>
                  <div className="space-y-2 flex-1"><Label>Principal</Label><Input type="number" className="bg-slate-900" value={newPayment.principal} onChange={e => setNewPayment({...newPayment, principal: Number(e.target.value)})} /></div>
                  <div className="space-y-2 flex-1"><Label>Interest</Label><Input type="number" className="bg-slate-900" value={newPayment.interest} onChange={e => setNewPayment({...newPayment, interest: Number(e.target.value)})} /></div>
                  <Button onClick={handleAddPayment} className="bg-primary"><CreditCard className="h-4 w-4 mr-2" /> Log Payment</Button>
                </div>
                <Table>
                  <TableHeader><TableRow className="border-white/10"><TableHead>Period</TableHead><TableHead>Principal Paid</TableHead><TableHead>Interest Paid</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanInput.manualPayments?.map(p => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5 group">
                        <TableCell className="text-sm font-bold">Month {p.periodNumber}</TableCell>
                        <TableCell className="font-code text-sm text-primary">{p.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="font-code text-sm text-amber-500">{p.interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setLoanInput(prev => ({ ...prev, manualPayments: (prev.manualPayments || []).filter(x => x.id !== p.id) }))}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!loanInput.manualPayments || loanInput.manualPayments.length === 0) && (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic">No manual settlement records found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 pb-6 gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">Amortization Ledger <Badge variant="outline" className="text-[10px]">{loanInput.dayCountConvention}</Badge></CardTitle>
                  <CardDescription>Calendar month-end accruals based on selected day-count basis.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={handleManualCompute}
                    disabled={isComputing}
                    className="bg-blue-600 hover:bg-blue-700 text-white border-none shadow-md"
                  >
                    <PlayCircle className={`h-4 w-4 mr-2 ${isComputing ? 'animate-spin' : ''}`} /> 
                    Compute Accruals
                  </Button>
                  <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-[120px] bg-slate-800 border-white/10"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                  <Button variant="outline" size="sm" onClick={() => downloadCSV(`${loanInput.loanName}.csv`, generateAmortizationCSV(schedule))} className="border-white/10"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader className="bg-slate-900 sticky top-0 z-20 border-white/10">
                      <TableRow>
                        <TableHead className="w-[60px]">Mo.</TableHead>
                        <TableHead>Date (EOM)</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right text-primary">Drawdown</TableHead>
                        <TableHead className="text-right text-amber-500">Accrual</TableHead>
                        <TableHead className="text-right">Paid (P)</TableHead>
                        <TableHead className="text-right">Paid (I)</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchedule.map((row) => (
                        <TableRow key={row.periodNumber} className="border-white/5 hover:bg-white/5 group">
                          <TableCell className="text-xs text-muted-foreground font-bold">{row.periodNumber}</TableCell>
                          <TableCell className="text-xs font-semibold">{row.date}</TableCell>
                          <TableCell className="text-right font-code text-xs text-slate-400">{row.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-code text-xs text-primary">{row.drawdownAmount > 0 ? `+${row.drawdownAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-xs text-amber-500 font-bold">{row.interestAccrual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.principalPaid > 0 ? `-${row.principalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.interestPaid > 0 ? `-${row.interestPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-sm font-bold text-white">{row.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              className="cursor-pointer hover:scale-110 transition-transform text-[9px] uppercase tracking-wider px-2"
                              variant={row.status === 'paid' ? 'default' : row.status === 'unpaid' ? 'destructive' : row.status === 'recalculated' ? 'secondary' : 'outline'}
                              onClick={() => {
                                const nextStatus: Record<LoanStatus, LoanStatus> = {
                                  'projected': 'paid',
                                  'paid': 'unpaid',
                                  'unpaid': 'projected',
                                  'recalculated': 'projected'
                                };
                                const newStatus = nextStatus[row.status] || 'projected';
                                setLoanInput(prev => ({
                                  ...prev,
                                  periodStatuses: { ...(prev.periodStatuses || {}), [row.periodNumber]: newStatus }
                                }));
                              }}
                            >
                              {row.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardContent className="pt-6 space-y-3">
                {auditTrail.length ? auditTrail.map((e, i) => (
                  <div key={i} className="flex gap-4 p-4 border border-white/5 rounded-xl bg-slate-800/20 items-center hover:bg-slate-800/40 transition-colors">
                    <History className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">{e.actionType}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{new Date(e.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{e.details}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/10" />
                  </div>
                )) : <div className="text-center py-16 text-muted-foreground italic text-sm">No audit events logged in this session.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {isImportOpen && (
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogContent className="bg-slate-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Bulk Accrual Import</DialogTitle>
              <DialogDescription>Upload CSV to populate drawdowns and settlements across multiple fiscal years.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div 
                className="py-8 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center space-y-4 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-10 w-10 text-primary" />
                <p className="text-sm font-medium">Click to select CSV file</p>
                <p className="text-[10px] text-muted-foreground">Headers: type, date, amount, period, principal, interest</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                />
              </div>
              <Button variant="outline" className="w-full border-white/5" onClick={handleDownloadTemplate}>
                <FileText className="h-4 w-4 mr-2" /> Download CSV Template
              </Button>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
