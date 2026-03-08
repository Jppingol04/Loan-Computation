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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Table as TableIcon, Download, RefreshCw, CheckCircle2, Sparkles, Plus, Trash2, XCircle, TrendingUp, History, Settings2, Wallet, Calendar as CalendarIcon } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  recalculateProspectively,
  calculateMonthsBetween
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
    startDate: '2024-01-01',
    currency: 'USD',
    isBullet: true,
    drawdowns: [],
    manualPayments: []
  });

  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<AiAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');
  
  // Schedule Filtering
  const [yearFilter, setYearFilter] = useState<string>('all');

  const [newDrawdown, setNewDrawdown] = useState({ date: '', amount: 0 });
  const [maturityDate, setMaturityDate] = useState('');

  const [recalcRate, setRecalcRate] = useState(6.0);
  const [recalcPeriod, setRecalcPeriod] = useState(1);
  const [isRecalcOpen, setIsRecalcOpen] = useState(false);

  // Dynamic computation of schedule whenever loanInput changes
  useEffect(() => {
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
  }, [loanInput]);

  // Derived years for filtering
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    schedule.forEach(p => {
      const year = p.date.split('-')[0];
      years.add(year);
    });
    return Array.from(years).sort();
  }, [schedule]);

  const filteredSchedule = useMemo(() => {
    if (yearFilter === 'all') return schedule;
    return schedule.filter(p => p.date.startsWith(yearFilter));
  }, [schedule, yearFilter]);

  const logAudit = (action: string, details: string, oldVal?: any, newVal?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      actionType: action,
      details,
      oldValue: oldVal,
      newValue: newVal,
      user: 'Internal Auditor'
    };
    setAuditTrail(prev => [entry, ...prev]);
  };

  const handleManualRefresh = () => {
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
    logAudit('Manual Recompute', `Full schedule refreshed for ${loanInput.loanName}.`);
    toast({ title: "Schedule Refreshed", description: "Computed latest data based on current inputs." });
  };

  const toggleStatus = (periodNum: number) => {
    setSchedule(prev => prev.map(p => {
      if (p.periodNumber === periodNum) {
        let nextStatus: any = 'paid';
        if (p.status === 'paid') nextStatus = 'unpaid';
        else if (p.status === 'unpaid') nextStatus = 'projected';
        else nextStatus = 'paid';
        return { ...p, status: nextStatus };
      }
      return p;
    }));
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

  const removeDrawdown = (id: string) => {
    const target = (loanInput.drawdowns || []).find(d => d.id === id);
    setLoanInput({ ...loanInput, drawdowns: (loanInput.drawdowns || []).filter(d => d.id !== id) });
    if (target) logAudit('Drawdown Removed', `Removed drawdown of ${target.amount} from ${target.date}.`);
  };

  const handleApplyRecalculation = () => {
    const updated = recalculateProspectively(schedule, recalcPeriod, recalcRate);
    setSchedule(updated);
    setIsRecalcOpen(false);
    logAudit('Prospective Adjustment', `Applied ${recalcRate}% rate from period ${recalcPeriod}.`);
    toast({ title: "Prospective Adjustment Applied", description: "Future accruals recalculated." });
  };

  const handleMaturityDateChange = (date: string) => {
    setMaturityDate(date);
    if (loanInput.startDate && date) {
      const months = calculateMonthsBetween(loanInput.startDate, date);
      if (months > 0) {
        setLoanInput(prev => ({ ...prev, termInMonths: months }));
      }
    }
  };

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
        totalPayable: loanInput.principalAmount + (loanInput.drawdowns?.reduce((a,b) => a+b.amount, 0) || 0) + schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0),
      };
      
      const result = await aiPoweredLoanInsights({
        loanSummary: summary,
        amortizationSchedule: schedule.slice(0, 60), // AI prompt limit management
        auditTrail: auditTrail
      });
      setAiInsights(result);
    } catch (err) {
      toast({ variant: "destructive", title: "AI Analysis Error", description: "Could not generate insights." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-600 hover:bg-green-700 cursor-pointer">Paid</Badge>;
      case 'unpaid': return <Badge variant="destructive" className="cursor-pointer">Unpaid</Badge>;
      default: return <Badge variant="outline" className="cursor-pointer">Projected</Badge>;
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
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Indefinite & Bullet Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="border-white/10" onClick={() => downloadCSV(`${loanInput.loanName}_Amortization.csv`, generateAmortizationCSV(schedule))}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button size="sm" onClick={handleAiAnalysis} disabled={isAiLoading} className="shadow-lg shadow-primary/25">
              <Sparkles className={`h-4 w-4 mr-2 ${isAiLoading ? 'animate-spin' : ''}`} />
              Generate Insights
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <p className="text-xs text-muted-foreground uppercase font-semibold">Current Exposure</p>
              </div>
              <p className="text-2xl font-bold font-code">{loanInput.currency} {totalCurrentPrincipal.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Accrued Int.</p>
              </div>
              <p className="text-2xl font-bold font-code text-amber-500">{loanInput.currency} {totalInterestAccrued.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-400" />
                <p className="text-xs text-muted-foreground uppercase font-semibold">Effective Rate</p>
              </div>
              <p className="text-2xl font-bold font-code text-blue-400">{loanInput.annualInterestRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-purple-400" />
                <p className="text-xs text-muted-foreground uppercase font-semibold">Horizon (Months)</p>
              </div>
              <p className="text-2xl font-bold font-code text-purple-400">{loanInput.termInMonths}</p>
            </CardContent>
          </Card>
        </div>

        {aiInsights && (
          <Card className="border-primary/30 bg-primary/10 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center text-primary-foreground"><Sparkles className="h-5 w-5 mr-2" /> Auditor Logic Analysis</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAiInsights(null)} className="hover:bg-primary/20">Dismiss</Button>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6 pb-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-primary/80">Economics Summary</Label>
                <p className="text-sm leading-relaxed text-slate-200">{aiInsights.plainEnglishSummary}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-primary/80">IFRS 9 Audit Notes</Label>
                <p className="text-sm leading-relaxed text-slate-200">{aiInsights.rateChangeImpactExplanation}</p>
                <div className="pt-2">
                  <Badge variant={aiInsights.excessiveInterestFlag ? "destructive" : "secondary"}>
                    {aiInsights.excessiveInterestFlag ? "High Interest Cost Flagged" : "Standard Interest Accrual"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-slate-900 border border-white/5 p-1 mb-8">
            <TabsTrigger value="setup" className="data-[state=active]:bg-primary">Structure</TabsTrigger>
            <TabsTrigger value="drawdowns" className="data-[state=active]:bg-primary">Drawdowns</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary">Schedule</TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-primary">Analysis</TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-6 animate-in fade-in duration-300">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="bg-slate-900/50 border-white/5 md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary"><Settings2 className="h-5 w-5" /> Facility Parameters</CardTitle>
                  <CardDescription>Configure basic economics and multi-year horizons.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Facility Name</Label>
                      <Input 
                        className="bg-slate-800 border-white/10"
                        value={loanInput.loanName} 
                        onChange={e => setLoanInput({...loanInput, loanName: e.target.value})} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input 
                          type="date" 
                          className="bg-slate-800 border-white/10"
                          value={loanInput.startDate} 
                          onChange={e => setLoanInput({...loanInput, startDate: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Maturity Date (Auto-calc term)</Label>
                        <Input 
                          type="date" 
                          className="bg-slate-800 border-white/10"
                          value={maturityDate} 
                          onChange={e => handleMaturityDateChange(e.target.value)} 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                        <Label>Term (Months)</Label>
                        <Input 
                          type="number" 
                          className="bg-slate-800 border-white/10"
                          value={loanInput.termInMonths} 
                          onChange={e => setLoanInput({...loanInput, termInMonths: Math.max(1, Number(e.target.value))})} 
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-8">
                        <Switch 
                          id="bullet-mode" 
                          checked={loanInput.isBullet} 
                          onCheckedChange={checked => setLoanInput({...loanInput, isBullet: checked})}
                        />
                        <Label htmlFor="bullet-mode" className="cursor-pointer">Bullet Maturity</Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={loanInput.currency} onValueChange={v => setLoanInput({...loanInput, currency: v})}>
                          <SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="AED">AED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Initial Principal</Label>
                        <Input 
                          type="number" 
                          className="bg-slate-800 border-white/10 font-code"
                          value={loanInput.principalAmount} 
                          onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Annual Interest Rate (%)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        className="bg-slate-800 border-white/10 font-code"
                        value={loanInput.annualInterestRate} 
                        onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-white/5">
                <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Quick Term Presets</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setLoanInput({...loanInput, termInMonths: 12})} className="justify-start">1 Year (12 Mo)</Button>
                  <Button variant="outline" size="sm" onClick={() => setLoanInput({...loanInput, termInMonths: 36})} className="justify-start">3 Years (36 Mo)</Button>
                  <Button variant="outline" size="sm" onClick={() => setLoanInput({...loanInput, termInMonths: 60})} className="justify-start">5 Years (60 Mo)</Button>
                  <Button variant="outline" size="sm" onClick={() => setLoanInput({...loanInput, termInMonths: 120})} className="justify-start">10 Years (120 Mo)</Button>
                  <Button variant="outline" size="sm" onClick={() => setLoanInput({...loanInput, termInMonths: 240})} className="justify-start font-bold border-primary/30">Long-Term (20 Years)</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drawdowns" className="space-y-4 animate-in fade-in duration-300">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Active Facility Drawdowns</CardTitle>
                <CardDescription>Schedule principal injections. Interest will accrue on the new balance from the drawdown date.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/50 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 flex-1 w-full">
                    <Label>Execution Date</Label>
                    <Input type="date" className="bg-slate-900 border-white/10" value={newDrawdown.date} onChange={e => setNewDrawdown({...newDrawdown, date: e.target.value})} />
                  </div>
                  <div className="space-y-2 flex-1 w-full">
                    <Label>Amount ({loanInput.currency})</Label>
                    <Input type="number" className="bg-slate-900 border-white/10 font-code" value={newDrawdown.amount} onChange={e => setNewDrawdown({...newDrawdown, amount: Number(e.target.value)})} />
                  </div>
                  <Button onClick={handleAddDrawdown} className="w-full md:w-auto"><Plus className="h-4 w-4 mr-2" /> Add to Schedule</Button>
                </div>

                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-800/50">
                      <TableRow>
                        <TableHead>Execution Date</TableHead>
                        <TableHead>Amount ({loanInput.currency})</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loanInput.drawdowns?.length ? loanInput.drawdowns.map(d => (
                        <TableRow key={d.id} className="border-white/5">
                          <TableCell className="font-code text-xs">{d.date}</TableCell>
                          <TableCell className="font-code text-sm font-semibold">{d.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => removeDrawdown(d.id)} className="hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No drawdowns scheduled. Initial principal only.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 animate-in fade-in duration-300">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/5 pb-4 gap-4">
                <div>
                  <CardTitle>Amortization Engine</CardTitle>
                  <CardDescription>Scan yearly projections for long-term facilities.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-slate-800 rounded-md px-2 border border-white/5">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                      <SelectTrigger className="w-[120px] bg-transparent border-0 ring-0 focus:ring-0">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleManualRefresh} className="border-white/10">
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                  </Button>
                  <Dialog open={isRecalcOpen} onOpenChange={setIsRecalcOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="border-white/10">Prospective Adj.</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-white/10 text-white">
                      <DialogHeader><DialogTitle>Prospective Rate Adjustment</DialogTitle></DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>New Annual Rate (%)</Label>
                            <Input type="number" step="0.1" className="bg-slate-800 border-white/10" value={recalcRate} onChange={e => setRecalcRate(Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Effective Month</Label>
                            <Input type="number" className="bg-slate-800 border-white/10" value={recalcPeriod} onChange={e => setRecalcPeriod(Number(e.target.value))} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleApplyRecalculation}>Recalculate Future</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[650px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-900 z-10 border-b border-white/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center">Mo.</TableHead>
                        <TableHead>Accrual Date</TableHead>
                        <TableHead className="text-right">Opening Bal.</TableHead>
                        <TableHead className="text-right text-primary">Drawdown</TableHead>
                        <TableHead className="text-right text-amber-500">Interest</TableHead>
                        <TableHead className="text-right">Pmt (Prin)</TableHead>
                        <TableHead className="text-right">Pmt (Int)</TableHead>
                        <TableHead className="text-right">Closing Bal.</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right pr-6">Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSchedule.map((row) => (
                        <TableRow key={row.periodNumber} className="border-white/5 transition-colors">
                          <TableCell className="font-code text-xs text-center text-muted-foreground">{row.periodNumber}</TableCell>
                          <TableCell className="text-xs font-medium">{row.date}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.openingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs text-primary">{row.drawdownAmount > 0 ? `+${row.drawdownAmount.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right font-code text-xs text-amber-500">{row.interestAccrual.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.principalPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.interestPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-sm font-bold text-slate-100">{row.closingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(row.status)}</TableCell>
                          <TableCell className="text-right pr-6">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(row.periodNumber)}>
                              {row.status === 'paid' ? <XCircle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6 animate-in fade-in duration-300">
             <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-white/5">
                <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Interest Accrual Profile</CardTitle></CardHeader>
                <CardContent className="h-[350px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={schedule.slice(0, 120)}> {/* Limit for chart readability */}
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="periodNumber" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="interestAccrual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-white/5">
                <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exposure Growth (Closing Balances)</CardTitle></CardHeader>
                <CardContent className="h-[350px] pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={schedule.slice(0, 120)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="periodNumber" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.02)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                      <Bar dataKey="closingBalance" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="space-y-4 animate-in fade-in duration-300">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader><CardTitle>Internal Audit Ledger</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {auditTrail.length ? auditTrail.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 p-4 border border-white/5 rounded-xl bg-slate-800/20 items-start">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <History className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold uppercase tracking-tight text-primary">{entry.actionType}</p>
                        <span className="text-[10px] text-muted-foreground font-code">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-300">{entry.details}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-muted-foreground italic border border-dashed border-white/10 rounded-xl">
                    No ledger entries recorded for this session.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      <footer className="py-6 border-t border-white/5 text-center text-[10px] text-muted-foreground uppercase tracking-widest bg-slate-950">
        Engineered for IFRS 9 Compliance & Auditor Oversight
      </footer>
    </div>
  );
}
