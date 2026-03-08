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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calculator, Table as TableIcon, TrendingDown, BookOpen, History, Download, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  calculateMonthlyPayment,
  recalculateProspectively 
} from '@/lib/loan-calculations';
import { 
  downloadCSV, 
  generateAmortizationCSV, 
  generateOdooJournalCSV 
} from '@/lib/export-utils';
import { aiPoweredLoanInsights, AiAnalysisOutput } from '@/ai/flows/ai-powered-loan-insights';

export default function LoanEngineDashboard() {
  const { toast } = useToast();
  const [loanInput, setLoanInput] = useState<LoanInput>({
    loanName: 'Auto Loan Sample',
    principalAmount: 50000,
    annualInterestRate: 5.5,
    termInMonths: 60,
    startDate: new Date().toISOString().split('T')[0],
    currency: 'AED'
  });

  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<AiAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');

  // Prospective Recalculation Modal State
  const [recalcRate, setRecalcRate] = useState(6.5);
  const [recalcPeriod, setRecalcPeriod] = useState(12);
  const [recalcReason, setRecalcReason] = useState('Market rate adjustment');
  const [isRecalcOpen, setIsRecalcOpen] = useState(false);

  // Live preview computations
  const livePayment = useMemo(() => {
    return calculateMonthlyPayment(loanInput.principalAmount, loanInput.annualInterestRate, loanInput.termInMonths);
  }, [loanInput]);

  const totalInterest = useMemo(() => {
    return Number((livePayment * loanInput.termInMonths - loanInput.principalAmount).toFixed(2));
  }, [livePayment, loanInput]);

  useEffect(() => {
    handleGenerateSchedule(false);
  }, []);

  const logAudit = (action: string, details: string, oldVal?: any, newVal?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      actionType: action,
      details,
      oldValue: oldVal,
      newValue: newVal,
      user: 'Current User'
    };
    setAuditTrail(prev => [entry, ...prev]);
  };

  const handleGenerateSchedule = (showToast = true) => {
    if (loanInput.principalAmount <= 0 || loanInput.annualInterestRate < 0 || loanInput.termInMonths < 1) {
      toast({ variant: "destructive", title: "Validation Error", description: "Please check your input values." });
      return;
    }
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
    logAudit('Schedule Generated', `New loan '${loanInput.loanName}' created with ${loanInput.principalAmount} ${loanInput.currency} principal.`);
    if (showToast) toast({ title: "Success", description: "Amortization schedule generated successfully." });
  };

  const handleMarkPaid = (periodNum: number) => {
    setSchedule(prev => prev.map(p => p.periodNumber === periodNum ? { ...p, status: 'paid' } : p));
    toast({ title: "Payment Recorded", description: `Period ${periodNum} marked as paid.` });
    logAudit('Period Marked Paid', `Period ${periodNum} of loan '${loanInput.loanName}' status updated to paid.`);
  };

  const handleApplyRecalculation = () => {
    const updated = recalculateProspectively(schedule, recalcPeriod, recalcRate);
    const oldRate = loanInput.annualInterestRate;
    setSchedule(updated);
    setIsRecalcOpen(false);
    toast({ title: "Recalculation Applied", description: `Prospective rate of ${recalcRate}% applied from period ${recalcPeriod}.` });
    logAudit('Interest Rate Change', `Prospective recalculation applied from period ${recalcPeriod}.`, { rate: oldRate }, { rate: recalcRate, remainingBalanceAtChange: updated[recalcPeriod - 1].openingBalance });
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
        monthlyPayment: livePayment,
        totalInterest: schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0),
        totalPayable: loanInput.principalAmount + schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0),
      };
      
      const result = await aiPoweredLoanInsights({
        loanSummary: summary,
        amortizationSchedule: schedule,
        auditTrail: auditTrail
      });
      setAiInsights(result);
      logAudit('AI Analysis', 'Generated smart insights for loan economics.');
    } catch (err) {
      toast({ variant: "destructive", title: "AI Error", description: "Failed to fetch AI insights." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
      case 'recalculated': return <Badge className="bg-amber-500 hover:bg-amber-600">Recalculated</Badge>;
      default: return <Badge variant="secondary">Projected</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold font-headline tracking-tight">IFRS 9 Loan Accrual Engine</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              downloadCSV(`${loanInput.loanName}_Amortization.csv`, generateAmortizationCSV(schedule));
              logAudit('Excel Export', 'Generated amortization schedule CSV.');
              toast({ title: "Export Started", description: "Downloading Amortization Schedule..." });
            }}>
              <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              downloadCSV(`${loanInput.loanName}_Odoo_Import.csv`, generateOdooJournalCSV(schedule, loanInput.loanName));
              logAudit('Odoo CSV Export', 'Generated Odoo-compatible journal entries.');
              toast({ title: "Export Started", description: "Downloading Odoo Journal CSV..." });
            }}>
              <BookOpen className="h-4 w-4 mr-2" /> Odoo CSV
            </Button>
            <Button size="sm" onClick={handleAiAnalysis} disabled={isAiLoading}>
              <Sparkles className={`h-4 w-4 mr-2 ${isAiLoading ? 'animate-spin' : ''}`} />
              {isAiLoading ? 'Analyzing...' : 'AI Insights'}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-6">
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-card">
            <TabsTrigger value="setup"><Calculator className="h-4 w-4 mr-2" />Loan Setup</TabsTrigger>
            <TabsTrigger value="amortization"><TableIcon className="h-4 w-4 mr-2" />Amortization</TabsTrigger>
            <TabsTrigger value="accrual"><TrendingDown className="h-4 w-4 mr-2" />Accruals</TabsTrigger>
            <TabsTrigger value="journals"><BookOpen className="h-4 w-4 mr-2" />Journal Entries</TabsTrigger>
            <TabsTrigger value="audit"><History className="h-4 w-4 mr-2" />Audit Trail</TabsTrigger>
          </TabsList>

          {/* AI Insights Panel (Floating condition) */}
          {aiInsights && (
            <Card className="mt-6 border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center"><Sparkles className="h-5 w-5 mr-2 text-primary" /> AI Financial Analysis</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setAiInsights(null)}>Dismiss</Button>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Plain-English Summary</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiInsights.plainEnglishSummary}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Auditor Impact Explanation</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{aiInsights.rateChangeImpactExplanation}</p>
                </div>
                <div className="flex items-center gap-2 p-3 bg-card rounded-lg border">
                  {aiInsights.excessiveInterestFlag ? (
                    <AlertCircle className="text-amber-500 h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="text-green-500 h-5 w-5" />
                  )}
                  <span className="text-xs font-semibold">
                    {aiInsights.excessiveInterestFlag ? 'High Interest Alert: Total interest > 30% of principal' : 'Interest levels within standard thresholds'}
                  </span>
                </div>
                <div className="p-3 bg-card rounded-lg border">
                  <p className="text-xs font-semibold mb-1">Repayment Strategy</p>
                  <p className="text-[10px] text-muted-foreground">{aiInsights.earlyRepaymentSuggestion}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value="setup" className="space-y-6 pt-4">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Initialize New Loan</CardTitle>
                  <CardDescription>Input loan parameters to generate IFRS 9 EIR schedule</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="loanName">Loan Name/Reference</Label>
                      <Input id="loanName" value={loanInput.loanName} onChange={e => setLoanInput({...loanInput, loanName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select value={loanInput.currency} onValueChange={v => setLoanInput({...loanInput, currency: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AED">AED - Emirati Dirham</SelectItem>
                          <SelectItem value="USD">USD - US Dollar</SelectItem>
                          <SelectItem value="EUR">EUR - Euro</SelectItem>
                          <SelectItem value="GBP">GBP - British Pound</SelectItem>
                          <SelectItem value="PHP">PHP - Philippine Peso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="principal">Principal Amount</Label>
                      <Input id="principal" type="number" value={loanInput.principalAmount} onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate">Annual Interest Rate (%)</Label>
                      <Input id="rate" type="number" step="0.01" value={loanInput.annualInterestRate} onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="term">Term (Months)</Label>
                      <Input id="term" type="number" value={loanInput.termInMonths} onChange={e => setLoanInput({...loanInput, termInMonths: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={loanInput.startDate} onChange={e => setLoanInput({...loanInput, startDate: e.target.value})} />
                  </div>
                  <Button className="w-full mt-4" onClick={() => handleGenerateSchedule()}>
                    Generate Amortization Schedule
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Computation Preview</CardTitle>
                  <CardDescription>Real-time projection based on current inputs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Calculated Monthly Payment</p>
                    <p className="text-3xl font-bold font-code">{loanInput.currency} {livePayment.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Interest</p>
                      <p className="text-sm font-code">{loanInput.currency} {totalInterest.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">Total Payable</p>
                      <p className="text-sm font-code">{loanInput.currency} {(loanInput.principalAmount + totalInterest).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-dashed">
                    <p className="text-[10px] text-muted-foreground leading-tight italic">
                      * Uses Effective Interest Rate (EIR) method. Periodic payments are calculated using standard annuity formula.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="amortization" className="pt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Amortization Schedule</CardTitle>
                  <CardDescription>EIR Method - Amortized Cost per IFRS 9</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Dialog open={isRecalcOpen} onOpenChange={setIsRecalcOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" /> Prospective Rate Change</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Interest Rate Change</DialogTitle>
                        <DialogDescription>Apply prospective recalculation from a specific period as per IFRS 9 guidelines.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>New Annual Rate (%)</Label>
                            <Input type="number" step="0.1" value={recalcRate} onChange={e => setRecalcRate(Number(e.target.value))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Effective Period</Label>
                            <Input type="number" value={recalcPeriod} onChange={e => setRecalcPeriod(Number(e.target.value))} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Reason for Change (Auditor Review)</Label>
                          <Textarea value={recalcReason} onChange={e => setRecalcReason(e.target.value)} placeholder="e.g., Central bank rate adjustment..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRecalcOpen(false)}>Cancel</Button>
                        <Button onClick={handleApplyRecalculation}>Recalculate Remaining Periods</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] w-full border rounded-md">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Opening Balance</TableHead>
                        <TableHead className="text-right">Interest</TableHead>
                        <TableHead className="text-right">Principal</TableHead>
                        <TableHead className="text-right">Total Payment</TableHead>
                        <TableHead className="text-right">Closing Balance</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((row) => (
                        <TableRow key={row.periodNumber} className="hover:bg-muted/30">
                          <TableCell className="text-center font-code">{row.periodNumber}</TableCell>
                          <TableCell className="font-code text-xs">{row.date}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.openingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs text-primary">{row.interestAccrual.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.principalPortion.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs font-semibold">{row.totalPayment.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-code text-xs">{row.closingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(row.status)}</TableCell>
                          <TableCell className="text-right">
                            {row.status !== 'paid' && (
                              <Button variant="ghost" size="icon" onClick={() => handleMarkPaid(row.periodNumber)}>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accrual" className="pt-4 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Interest Accrual Trend</CardTitle>
                  <CardDescription>Monthly interest expense (EIR) over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={schedule}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                        <XAxis 
                          dataKey="periodNumber" 
                          stroke="#64748b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          interval={Math.floor(schedule.length / 10)}
                        />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #1e293b' }}
                          labelStyle={{ color: '#94a3b8' }}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Bar dataKey="interestAccrual" radius={[4, 4, 0, 0]}>
                          {schedule.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.status === 'recalculated' ? '#f59e0b' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Accrual Accounts</CardTitle>
                  <CardDescription>Odoo ERP Mapping Reference</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 border rounded bg-card/50">
                      <div>
                        <p className="text-xs font-semibold">1010 Bank</p>
                        <p className="text-[10px] text-muted-foreground">Asset Account</p>
                      </div>
                      <Badge variant="outline">Credit (Pmt)</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded bg-card/50">
                      <div>
                        <p className="text-xs font-semibold">2200 Loan Payable</p>
                        <p className="text-[10px] text-muted-foreground">Liability Account</p>
                      </div>
                      <Badge variant="outline">Debit (Principal)</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded bg-card/50">
                      <div>
                        <p className="text-xs font-semibold">2310 Interest Payable</p>
                        <p className="text-[10px] text-muted-foreground">Liability Account</p>
                      </div>
                      <Badge variant="outline">Cr (Acc) / Dr (Set)</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded bg-card/50">
                      <div>
                        <p className="text-xs font-semibold">6110 Interest Expense</p>
                        <p className="text-[10px] text-muted-foreground">Expense Account</p>
                      </div>
                      <Badge variant="outline">Debit (Accrual)</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="journals" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Double-Entry Journal Table</CardTitle>
                <CardDescription>Accounting entries generated for current loan schedule</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px] w-full border rounded-md">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.slice(0, 100).map((row, idx) => (
                        <React.Fragment key={idx}>
                          {/* Accrual Set */}
                          <TableRow className="border-b-0 hover:bg-muted/20">
                            <TableCell className="font-code text-[10px]">{row.date}</TableCell>
                            <TableCell className="text-[10px]">ACC-{row.periodNumber}</TableCell>
                            <TableCell className="font-code text-[10px]">6110</TableCell>
                            <TableCell className="text-[10px]">Interest Expense</TableCell>
                            <TableCell className="text-right font-code text-[10px] text-green-500">{row.interestAccrual.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-code text-[10px]">0.00</TableCell>
                          </TableRow>
                          <TableRow className="border-b bg-muted/5 hover:bg-muted/20">
                            <TableCell className="font-code text-[10px]">{row.date}</TableCell>
                            <TableCell className="text-[10px]">ACC-{row.periodNumber}</TableCell>
                            <TableCell className="font-code text-[10px]">2310</TableCell>
                            <TableCell className="text-[10px]">Interest Payable</TableCell>
                            <TableCell className="text-right font-code text-[10px]">0.00</TableCell>
                            <TableCell className="text-right font-code text-[10px] text-red-500">{row.interestAccrual.toFixed(2)}</TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Audit Trail</CardTitle>
                <CardDescription>Immutable log of all financial and system actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditTrail.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 p-4 border rounded-lg bg-card/40">
                    <div className="flex-shrink-0 pt-1">
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">{entry.actionType}</Badge>
                        <span className="text-[10px] font-code text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.details}</p>
                      {entry.newValue && (
                        <div className="mt-2 text-[10px] font-code p-2 bg-muted rounded border space-y-1">
                          {entry.oldValue && <p className="text-red-400">OLD: {JSON.stringify(entry.oldValue)}</p>}
                          <p className="text-green-400">NEW: {JSON.stringify(entry.newValue)}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">Action performed by: {entry.user}</p>
                    </div>
                  </div>
                ))}
                {auditTrail.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No audit entries recorded yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="py-4 border-t bg-card/50">
        <div className="container mx-auto px-4 text-center text-[10px] text-muted-foreground">
          &copy; {new Date().getFullYear()} IFRS LoanGuard Accrual Engine. All computations per IFRS 9 Amortized Cost requirements.
        </div>
      </footer>
    </div>
  );
}
