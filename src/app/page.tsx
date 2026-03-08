"use client"

import React, { useState, useEffect } from 'react';
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Table as TableIcon, Download, RefreshCw, CheckCircle2, Sparkles, Plus, Trash2, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  recalculateProspectively 
} from '@/lib/loan-calculations';
import { 
  downloadCSV, 
  generateAmortizationCSV 
} from '@/lib/export-utils';
import { aiPoweredLoanInsights, AiAnalysisOutput } from '@/ai/flows/ai-powered-loan-insights';

export default function LoanEngineDashboard() {
  const { toast } = useToast();
  const [loanInput, setLoanInput] = useState<LoanInput>({
    loanName: 'Corporate Facility A',
    principalAmount: 1000000,
    annualInterestRate: 4.2,
    termInMonths: 24,
    startDate: '2025-01-01',
    currency: 'USD',
    drawdowns: [],
    manualPayments: []
  });

  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [aiInsights, setAiInsights] = useState<AiAnalysisOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('setup');

  const [newDrawdown, setNewDrawdown] = useState({ date: '', amount: 0 });

  const [recalcRate, setRecalcRate] = useState(5.0);
  const [recalcPeriod, setRecalcPeriod] = useState(1);
  const [isRecalcOpen, setIsRecalcOpen] = useState(false);

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
      user: 'Internal Auditor'
    };
    setAuditTrail(prev => [entry, ...prev]);
  };

  const handleGenerateSchedule = (showToast = true) => {
    const newSchedule = generateAmortizationSchedule(loanInput);
    setSchedule(newSchedule);
    logAudit('Schedule Updated', `Loan model recomputed for ${loanInput.loanName} starting ${loanInput.startDate}.`);
    if (showToast) toast({ title: "Schedule Recomputed", description: "Bullet repayment model updated." });
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
    toast({ title: "Status Toggled", description: `Period ${periodNum} updated.` });
  };

  const handleAddDrawdown = () => {
    if (!newDrawdown.date || newDrawdown.amount <= 0) return;
    const updatedDrawdowns = [...(loanInput.drawdowns || []), { id: Math.random().toString(36).substr(2, 9), ...newDrawdown }];
    setLoanInput({ ...loanInput, drawdowns: updatedDrawdowns });
    setNewDrawdown({ date: '', amount: 0 });
    toast({ title: "Drawdown Added", description: "Refresh the schedule to apply new principal." });
  };

  const removeDrawdown = (id: string) => {
    setLoanInput({ ...loanInput, drawdowns: (loanInput.drawdowns || []).filter(d => d.id !== id) });
  };

  const handleApplyRecalculation = () => {
    const updated = recalculateProspectively(schedule, recalcPeriod, recalcRate);
    setSchedule(updated);
    setIsRecalcOpen(false);
    logAudit('Rate Adjusted', `Applied prospective rate change to ${recalcRate}% from period ${recalcPeriod}.`);
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
        amortizationSchedule: schedule,
        auditTrail: auditTrail
      });
      setAiInsights(result);
    } catch (err) {
      toast({ variant: "destructive", title: "AI Error", description: "Analysis failed." });
    } finally {
      setIsAiLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-green-600">Paid</Badge>;
      case 'unpaid': return <Badge variant="destructive">Unpaid</Badge>;
      default: return <Badge variant="outline">Projected</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">IFRS LoanGuard (Drawdown Engine)</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV('Amortization.csv', generateAmortizationCSV(schedule))}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button size="sm" onClick={handleAiAnalysis} disabled={isAiLoading}>
              <Sparkles className={`h-4 w-4 mr-2 ${isAiLoading ? 'animate-spin' : ''}`} />
              AI Insights
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-card">
            <TabsTrigger value="setup">Structure</TabsTrigger>
            <TabsTrigger value="drawdowns">Drawdowns</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="accruals">Trends</TabsTrigger>
            <TabsTrigger value="audit">History</TabsTrigger>
          </TabsList>

          {aiInsights && (
            <Card className="mt-6 border-primary/20 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center"><Sparkles className="h-5 w-5 mr-2 text-primary" /> AI Financial Analysis</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setAiInsights(null)}>Dismiss</Button>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Summary</p>
                  <p className="text-xs text-muted-foreground">{aiInsights.plainEnglishSummary}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Impact Explanation</p>
                  <p className="text-xs text-muted-foreground">{aiInsights.rateChangeImpactExplanation}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <TabsContent value="setup" className="pt-4 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="md:col-span-2">
                <CardHeader><CardTitle>Loan Parameters</CardTitle></CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Facility Name</Label>
                      <Input value={loanInput.loanName} onChange={e => setLoanInput({...loanInput, loanName: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={loanInput.startDate} onChange={e => setLoanInput({...loanInput, startDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Currency</Label>
                      <Select value={loanInput.currency} onValueChange={v => setLoanInput({...loanInput, currency: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Initial Principal</Label>
                      <Input type="number" value={loanInput.principalAmount} onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Annual Rate (%)</Label>
                      <Input type="number" step="0.1" value={loanInput.annualInterestRate} onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Term (Months)</Label>
                    <Input type="number" value={loanInput.termInMonths} onChange={e => setLoanInput({...loanInput, termInMonths: Number(e.target.value)})} />
                  </div>
                  <Button onClick={() => handleGenerateSchedule()} className="w-full mt-4">Generate / Refresh Schedule</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Exposure Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Current Commitment</p>
                    <p className="text-2xl font-bold font-code">{loanInput.currency} {(loanInput.principalAmount + (loanInput.drawdowns?.reduce((a,b) => a+b.amount, 0) || 0)).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Total Interest Accrual</p>
                    <p className="text-xl font-code text-primary">{loanInput.currency} {schedule.reduce((acc, curr) => acc + curr.interestAccrual, 0).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drawdowns" className="pt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Planned Drawdowns</CardTitle>
                <CardDescription>Future principal injections into the facility</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end bg-muted/50 p-4 rounded-lg">
                  <div className="space-y-2 flex-1">
                    <Label>Drawdown Date</Label>
                    <Input type="date" value={newDrawdown.date} onChange={e => setNewDrawdown({...newDrawdown, date: e.target.value})} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>Amount</Label>
                    <Input type="number" value={newDrawdown.amount} onChange={e => setNewDrawdown({...newDrawdown, amount: Number(e.target.value)})} />
                  </div>
                  <Button onClick={handleAddDrawdown}><Plus className="h-4 w-4 mr-2" /> Add</Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loanInput.drawdowns?.map(d => (
                      <TableRow key={d.id}>
                        <TableCell>{d.date}</TableCell>
                        <TableCell>{d.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeDrawdown(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule" className="pt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Accrual & Payment Schedule</CardTitle>
                  <CardDescription>Manual bullet repayment model</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleGenerateSchedule()}>
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                  </Button>
                  <Dialog open={isRecalcOpen} onOpenChange={setIsRecalcOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">Prospective Rate Change</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Interest Rate Change</DialogTitle></DialogHeader>
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
                      </div>
                      <DialogFooter>
                        <Button onClick={handleApplyRecalculation}>Recalculate Remaining</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Opening</TableHead>
                        <TableHead className="text-right text-primary">Drawdown</TableHead>
                        <TableHead className="text-right text-amber-500">Interest</TableHead>
                        <TableHead className="text-right">Pmt (Prin)</TableHead>
                        <TableHead className="text-right">Pmt (Int)</TableHead>
                        <TableHead className="text-right">Closing</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Toggle</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((row) => (
                        <TableRow key={row.periodNumber}>
                          <TableCell className="font-code text-xs">{row.periodNumber}</TableCell>
                          <TableCell className="text-xs">{row.date}</TableCell>
                          <TableCell className="text-right text-xs">{row.openingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-xs text-primary">{row.drawdownAmount > 0 ? `+${row.drawdownAmount.toLocaleString()}` : '-'}</TableCell>
                          <TableCell className="text-right text-xs text-amber-500">{row.interestAccrual.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-xs font-semibold">{row.principalPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-xs">{row.interestPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-xs font-bold">{row.closingBalance.toLocaleString()}</TableCell>
                          <TableCell className="text-center">{getStatusBadge(row.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => toggleStatus(row.periodNumber)}>
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

          <TabsContent value="accruals" className="pt-4">
            <Card>
              <CardHeader><CardTitle>Monthly Interest Accrual Trend</CardTitle></CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={schedule}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                    <XAxis dataKey="periodNumber" stroke="#888888" fontSize={10} />
                    <YAxis stroke="#888888" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none' }} />
                    <Bar dataKey="interestAccrual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="pt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {auditTrail.map((entry, idx) => (
                  <div key={idx} className="flex gap-4 p-3 border rounded bg-card/50">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                    <div>
                      <p className="text-xs font-bold">{entry.actionType} - <span className="font-normal text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span></p>
                      <p className="text-xs">{entry.details}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
