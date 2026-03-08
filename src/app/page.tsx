"use client"

import React, { useState, useEffect, useMemo } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Table as TableIcon, Download, RefreshCw, Sparkles, Plus, Trash2, TrendingUp, History, Settings2, Wallet, Upload, CreditCard } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  LoanStatus,
  Drawdown,
  ManualPayment
} from '@/lib/loan-calculations';
import { 
  downloadCSV, 
  generateAmortizationCSV 
} from '@/lib/export-utils';
import { aiPoweredLoanInsights, AiAnalysisOutput } from '@/ai/flows/ai-powered-loan-insights';

export default function LoanEngineDashboard() {
  const { toast } = useToast();
  const [loanInput, setLoanInput] = useState<LoanInput>({
    loanName: 'Corporate Multi-Drawdown Facility',
    principalAmount: 1000000,
    annualInterestRate: 6.2,
    termInMonths: 24,
    startDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    isBullet: true,
    drawdowns: [],
    manualPayments: [],
    periodStatuses: {}
  });

  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<AiAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');
  
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [newDrawdown, setNewDrawdown] = useState({ date: '', amount: 0 });
  const [newPayment, setNewPayment] = useState({ periodNumber: 1, principal: 0, interest: 0 });
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Dynamic computation of schedule whenever input changes
  useEffect(() => {
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
  }, [loanInput]);

  const logAudit = (action: string, details: string) => {
    const entry = {
      timestamp: new Date().toISOString(),
      actionType: action,
      details,
      user: 'Internal Auditor'
    };
    setAuditTrail(prev => [entry, ...prev]);
  };

  const refreshSchedule = () => {
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
    toast({ title: "Schedule Refreshed", description: "Ledger re-computed with strict EOM dates." });
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

  const togglePeriodStatus = (periodNumber: number) => {
    const currentStatus = schedule.find(p => p.periodNumber === periodNumber)?.status || 'projected';
    let nextStatus: LoanStatus = 'projected';
    
    if (currentStatus === 'projected') nextStatus = 'paid';
    else if (currentStatus === 'paid') nextStatus = 'unpaid';
    else if (currentStatus === 'unpaid') nextStatus = 'projected';

    setLoanInput(prev => ({
      ...prev,
      periodStatuses: {
        ...(prev.periodStatuses || {}),
        [periodNumber]: nextStatus
      }
    }));
    logAudit('Status Change', `Period ${periodNumber} status updated to ${nextStatus}.`);
  };

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        const data = results.data as any[];
        const importedDrawdowns: Drawdown[] = [];
        const importedPayments: ManualPayment[] = [];

        data.forEach(row => {
          if (row.type === 'drawdown' && row.date && row.amount) {
            importedDrawdowns.push({ id: Math.random().toString(36).substr(2, 9), date: String(row.date), amount: Number(row.amount) });
          } else if (row.type === 'payment' && row.period && (row.principal || row.interest)) {
            importedPayments.push({
              id: Math.random().toString(36).substr(2, 9),
              periodNumber: Number(row.period),
              principalAmount: Number(row.principal || 0),
              interestAmount: Number(row.interest || 0)
            });
          }
        });

        setLoanInput(prev => ({
          ...prev,
          drawdowns: [...(prev.drawdowns || []), ...importedDrawdowns],
          manualPayments: [...(prev.manualPayments || []), ...importedPayments]
        }));

        setIsImportOpen(false);
        toast({ title: "Import Successful", description: `Imported ${importedDrawdowns.length} drawdowns and ${importedPayments.length} payments.` });
        logAudit('Bulk Import', `Imported historical data from CSV.`);
      }
    });
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

  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    try {
      const summary = {
        loanName: loanInput.loanName,
        principalAmount: loanInput.principalAmount,
        annualInterestRate: loanInput.annualInterestRate,
        termInMonths: loanInput.termInMonths,
        startDate: loanInput.startDate,
        currency: loanInput.currency,
        monthlyPayment: 0,
        totalInterest: schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0),
        totalPayable: totalCurrentPrincipal + totalInterestAccrued,
      };
      const result = await aiPoweredLoanInsights({ 
        loanSummary: summary, 
        amortizationSchedule: schedule.slice(0, 60), 
        auditTrail 
      });
      setAiInsights(result);
    } catch (err) {
      toast({ variant: "destructive", title: "AI Analysis Error", description: "Could not generate insights." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const totalCurrentPrincipal = loanInput.principalAmount + (loanInput.drawdowns?.reduce((a,b) => a+b.amount, 0) || 0);
  const totalInterestAccrued = schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LoanGuard <span className="text-primary">IFRS 9</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Asset Accrual Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-white/10"><Upload className="h-4 w-4 mr-2" /> Import Data</Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle>Import Historical Data</DialogTitle>
                  <DialogDescription>Upload a CSV with columns: type (drawdown/payment), date (ISO), amount, period, principal, interest.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center hover:bg-white/5 transition-colors">
                    <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" id="csv-upload" />
                    <label htmlFor="csv-upload" className="cursor-pointer space-y-2">
                      <Upload className="h-8 w-8 mx-auto text-primary" />
                      <p className="text-sm font-medium">Click to select CSV file</p>
                    </label>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" onClick={handleAiAnalysis} disabled={isAiLoading} className="shadow-lg shadow-primary/25">
              <Sparkles className={`h-4 w-4 mr-2 ${isAiLoading ? 'animate-spin' : ''}`} /> AI Insights
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4 text-primary" /><p className="text-xs text-muted-foreground uppercase font-semibold">Current Exposure</p></div>
              <p className="text-2xl font-bold font-code">{loanInput.currency} {totalCurrentPrincipal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" /><p className="text-xs text-muted-foreground uppercase font-semibold">Total Accrued Int.</p></div>
              <p className="text-2xl font-bold font-code text-amber-500">{loanInput.currency} {totalInterestAccrued.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><RefreshCw className="h-4 w-4 text-blue-400" /><p className="text-xs text-muted-foreground uppercase font-semibold">Annual Rate</p></div>
              <p className="text-2xl font-bold font-code text-blue-400">{loanInput.annualInterestRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-purple-400" /><p className="text-xs text-muted-foreground uppercase font-semibold">Facility Term</p></div>
              <p className="text-2xl font-bold font-code text-purple-400">{loanInput.termInMonths} Mo.</p>
            </CardContent>
          </Card>
        </div>

        {aiInsights && (
          <Card className="border-primary/30 bg-primary/10 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center text-primary-foreground"><Sparkles className="h-5 w-5 mr-2" /> AI Auditor Review</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAiInsights(null)}>Dismiss</Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 pb-6 text-sm">
              <div className="space-y-2">
                <p className="font-semibold text-primary-foreground/70 uppercase text-[10px]">Facility Dynamics</p>
                <p>{aiInsights.plainEnglishSummary}</p>
              </div>
              <div className="space-y-2">
                <p className="font-semibold text-primary-foreground/70 uppercase text-[10px]">Audit Commentary</p>
                <p>{aiInsights.rateChangeImpactExplanation}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-slate-900 border border-white/5 p-1 mb-8">
            <TabsTrigger value="setup">Structure</TabsTrigger>
            <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="schedule">Ledger (EOM)</TabsTrigger>
            <TabsTrigger value="analysis">Trends</TabsTrigger>
            <TabsTrigger value="audit">History</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings2 className="h-5 w-5" /> Facility Parameters</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Facility Name</Label><Input className="bg-slate-800 border-white/10" value={loanInput.loanName} onChange={e => setLoanInput({...loanInput, loanName: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Start Date</Label><Input type="date" className="bg-slate-800 border-white/10" value={loanInput.startDate} onChange={e => setLoanInput({...loanInput, startDate: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Term (Months)</Label><Input type="number" className="bg-slate-800 border-white/10" value={loanInput.termInMonths} onChange={e => setLoanInput({...loanInput, termInMonths: Number(e.target.value)})} /></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Currency</Label><Select value={loanInput.currency} onValueChange={v => setLoanInput({...loanInput, currency: v})}><SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Base Principal</Label><Input type="number" className="bg-slate-800 border-white/10" value={loanInput.principalAmount} onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})} /></div>
                  </div>
                  <div className="space-y-2"><Label>Annual Rate (%)</Label><Input type="number" step="0.01" className="bg-slate-800 border-white/10" value={loanInput.annualInterestRate} onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} /></div>
                </div>
                <div className="space-y-2 flex flex-col justify-end pb-1">
                   <div className="flex items-center space-x-2 bg-slate-800/50 p-4 rounded-lg border border-white/5">
                      <Switch id="bullet-mode" checked={loanInput.isBullet} onCheckedChange={c => setLoanInput({...loanInput, isBullet: c})} />
                      <div className="grid gap-0.5">
                        <Label htmlFor="bullet-mode" className="cursor-pointer">Bullet Maturity</Label>
                        <p className="text-[10px] text-muted-foreground">Settle all remaining debt in Month {loanInput.termInMonths}</p>
                      </div>
                   </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="drawdowns" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader><CardTitle>Incremental Drawdowns</CardTitle><CardDescription>Funds injected into the facility over its lifecycle.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/50 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 flex-1 w-full"><Label>Execution Date</Label><Input type="date" className="bg-slate-900" value={newDrawdown.date} onChange={e => setNewDrawdown({...newDrawdown, date: e.target.value})} /></div>
                  <div className="space-y-2 flex-1 w-full"><Label>Amount</Label><Input type="number" className="bg-slate-900" value={newDrawdown.amount} onChange={e => setNewDrawdown({...newDrawdown, amount: Number(e.target.value)})} /></div>
                  <Button onClick={handleAddDrawdown}><Plus className="h-4 w-4 mr-2" /> Add Exposure</Button>
                </div>
                <Table>
                  <TableHeader><TableRow className="border-white/10"><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanInput.drawdowns?.map(d => (
                      <TableRow key={d.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-sm">{d.date}</TableCell>
                        <TableCell className="font-code text-sm font-semibold">{d.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setLoanInput(p => ({...p, drawdowns: p.drawdowns?.filter(x => x.id !== d.id)}))}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-70 hover:opacity-100" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loanInput.drawdowns?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">No historical drawdowns recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader><CardTitle>Payment Ledger</CardTitle><CardDescription>Manually record settlements of principal or interest.</CardDescription></CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/50 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 w-24"><Label>Month #</Label><Input type="number" className="bg-slate-900" value={newPayment.periodNumber} onChange={e => setNewPayment({...newPayment, periodNumber: Number(e.target.value)})} /></div>
                  <div className="space-y-2 flex-1"><Label>Principal Paid</Label><Input type="number" className="bg-slate-900" value={newPayment.principal} onChange={e => setNewPayment({...newPayment, principal: Number(e.target.value)})} /></div>
                  <div className="space-y-2 flex-1"><Label>Interest Paid</Label><Input type="number" className="bg-slate-900" value={newPayment.interest} onChange={e => setNewPayment({...newPayment, interest: Number(e.target.value)})} /></div>
                  <Button onClick={handleAddPayment}><CreditCard className="h-4 w-4 mr-2" /> Log Settlement</Button>
                </div>
                <Table>
                  <TableHeader><TableRow className="border-white/10"><TableHead>Month #</TableHead><TableHead>Principal Paid</TableHead><TableHead>Interest Paid</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanInput.manualPayments?.map(p => (
                      <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-sm font-medium">Month {p.periodNumber}</TableCell>
                        <TableCell className="font-code text-sm text-primary">{p.principalAmount.toLocaleString()}</TableCell>
                        <TableCell className="font-code text-sm text-amber-500">{p.interestAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setLoanInput(prev => ({ ...prev, manualPayments: (prev.manualPayments || []).filter(x => x.id !== p.id) }))}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-70 hover:opacity-100" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {loanInput.manualPayments?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No historical payments recorded.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 pb-4 gap-4">
                <div>
                  <CardTitle>Amortization Ledger</CardTitle>
                  <CardDescription>Calendar month-end accruals and settlement tracking.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-[120px] bg-slate-800 border-white/10"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All Years</SelectItem>{availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
                  <Button variant="outline" size="sm" onClick={refreshSchedule} className="border-white/10"><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadCSV(`${loanInput.loanName}.csv`, generateAmortizationCSV(schedule))} className="border-white/10"><Download className="h-4 w-4 mr-2" /> Export</Button>
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
                        <TableHead className="text-right text-amber-500">Interest</TableHead>
                        <TableHead className="text-right">Settled (P)</TableHead>
                        <TableHead className="text-right">Settled (I)</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchedule.map((row) => (
                        <TableRow key={row.periodNumber} className="border-white/5 hover:bg-white/5 group">
                          <TableCell className="text-xs text-muted-foreground font-medium">{row.periodNumber}</TableCell>
                          <TableCell className="text-xs font-semibold">{row.date}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.openingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs text-primary">{row.drawdownAmount > 0 ? `+${row.drawdownAmount.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-xs text-amber-500">{row.interestAccrual.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.principalPaid > 0 ? `-${row.principalPaid.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.interestPaid > 0 ? `-${row.interestPaid.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-sm font-bold">{row.closingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              className="cursor-pointer hover:scale-105 transition-all text-[10px] uppercase tracking-wider px-2 py-0.5"
                              variant={row.status === 'paid' ? 'default' : row.status === 'unpaid' ? 'destructive' : 'outline'}
                              onClick={() => togglePeriodStatus(row.periodNumber)}
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

          <TabsContent value="analysis" className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-white/5 shadow-xl">
                <CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Monthly Interest Accrual</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={schedule.slice(0, 48)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="periodNumber" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px'}} cursor={{fill: '#1e293b'}} />
                      <Bar dataKey="interestAccrual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-white/5 shadow-xl">
                <CardHeader><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Exposure Trend</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={schedule.slice(0, 48)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="periodNumber" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', fontSize: '10px'}} cursor={{fill: '#1e293b'}} />
                      <Bar dataKey="closingBalance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardContent className="pt-6 space-y-4">
                {auditTrail.length ? auditTrail.map((e, i) => (
                  <div key={i} className="flex gap-4 p-4 border border-white/5 rounded-xl bg-slate-800/20 items-start hover:bg-slate-800/40 transition-colors">
                    <History className="h-4 w-4 text-primary shrink-0 mt-1" />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-xs font-bold uppercase text-primary tracking-wider">{e.actionType}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{new Date(e.timestamp).toLocaleString()}</p>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{e.details}</p>
                    </div>
                  </div>
                )) : <div className="text-center py-16 text-muted-foreground italic text-sm">No historical audit events logged in this session.</div>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
