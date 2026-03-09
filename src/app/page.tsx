
"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collection, doc, writeBatch, serverTimestamp, getDocs, deleteDoc, query, where } from 'firebase/firestore';
import { signInAnonymously, signOut } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { useAuth, useCollection, useDoc, useFirebase, useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { SidebarProvider, Sidebar, SidebarInset, SidebarHeader, SidebarContent, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuAction } from '@/components/ui/sidebar';
import { AreaChart, BarChart, Area, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend } from "@/components/ui/chart";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, Table as TableIcon, RefreshCw, Sparkles, Plus, Trash2, TrendingUp, History, Settings2, Wallet, Upload, CreditCard, FileSpreadsheet, FileText, Lightbulb, AlertTriangle, LogIn, LogOut, FilePlus, Save, Landmark, LayoutDashboard } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Papa from 'papaparse';
import { 
  LoanInput, 
  AmortizationPeriod, 
  generateAmortizationSchedule, 
  LoanStatus,
  Drawdown,
  ManualPayment,
  InterestRateChange,
  DayCountConvention
} from '@/lib/loan-calculations';
import { 
  downloadCSV, 
  generateAmortizationCSV,
  exportToExcel
} from '@/lib/export-utils';
import { aiPoweredLoanInsights, AiAnalysisInput, AiAnalysisOutput } from '@/ai/flows/ai-powered-loan-insights';

const BLANK_LOAN: LoanInput = {
  loanName: 'New Loan Facility',
  principalAmount: 0,
  annualInterestRate: 5.8,
  termInMonths: 24,
  startDate: '2026-01-01',
  currency: 'USD',
  dayCountConvention: 'ACT/365',
  isBullet: true,
  drawdowns: [],
  manualPayments: [],
  rateChanges: [],
  periodStatuses: {}
};

const DashboardTab = ({ schedule, currency }: { schedule: AmortizationPeriod[], currency: string }) => {
  const chartData = useMemo(() => schedule.map(p => ({
    name: `P${p.periodNumber}`,
    "Closing Balance": p.closingBalance,
    "Cumulative Interest": p.cumulativeInterest,
    "Interest Paid": p.interestPaid,
    "Principal Paid": p.principalPaid,
  })), [schedule]);

  const balanceChartConfig = {
    "Closing Balance": { label: "Closing Balance", color: "hsl(var(--primary))" },
    "Cumulative Interest": { label: "Cumulative Interest", color: "hsl(var(--destructive))" },
  };
  
  const paymentChartConfig = {
    "Principal Paid": { label: "Principal", color: "hsl(var(--primary))" },
    "Interest Paid": { label: "Interest", color: "hsl(var(--destructive))" },
  };

  if (schedule.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-white/5 flex items-center justify-center h-96">
        <div className="text-center">
          <LayoutDashboard className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Data to Display</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a schedule to see the dashboard.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="bg-slate-900/50 border-white/5">
        <CardHeader>
          <CardTitle>Balance vs. Accrued Interest</CardTitle>
          <CardDescription>
            Shows the loan's closing balance and total accrued interest over time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={balanceChartConfig} className="h-[300px] w-full">
            <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => (value / 1000).toFixed(0) + 'k'}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <ChartLegend content={<ChartLegend />} />
              <Area
                dataKey="Closing Balance"
                type="natural"
                fill="hsl(var(--primary) / 0.1)"
                stroke="hsl(var(--primary))"
                stackId="a"
              />
              <Area
                dataKey="Cumulative Interest"
                type="natural"
                fill="hsl(var(--destructive) / 0.1)"
                stroke="hsl(var(--destructive))"
                stackId="b"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card className="bg-slate-900/50 border-white/5">
        <CardHeader>
          <CardTitle>Manual Payment Breakdown</CardTitle>
          <CardDescription>
            Shows the principal vs. interest portion of manual payments made.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={paymentChartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
               <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => (value / 1000).toFixed(0) + 'k'}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <ChartLegend content={<ChartLegend />} />
              <Bar dataKey="Principal Paid" stackId="a" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Interest Paid" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};


export default function LoanEngineDashboard() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [loanInput, setLoanInput] = useState<LoanInput>(BLANK_LOAN);
  
  const loansQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'loans'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: loans, isLoading: loansLoading } = useCollection(loansQuery);

  const selectedLoanDoc = useMemoFirebase(() => {
    if (!selectedLoanId || !firestore) return null;
    return doc(firestore, 'loans', selectedLoanId);
  }, [selectedLoanId, firestore]);
  const { data: loanData, isLoading: isLoanDataLoading } = useDoc(selectedLoanDoc);

  const drawdownsQuery = useMemoFirebase(() => selectedLoanId ? collection(firestore, 'loans', selectedLoanId, 'drawdowns') : null, [selectedLoanId]);
  const { data: drawdownsData } = useCollection<Drawdown>(drawdownsQuery);
  
  const paymentsQuery = useMemoFirebase(() => selectedLoanId ? collection(firestore, 'loans', selectedLoanId, 'manualPayments') : null, [selectedLoanId]);
  const { data: paymentsData } = useCollection<ManualPayment>(paymentsQuery);

  const rateChangesQuery = useMemoFirebase(() => selectedLoanId ? collection(firestore, 'loans', selectedLoanId, 'interestRateChanges') : null, [selectedLoanId]);
  const { data: rateChangesData } = useCollection<InterestRateChange>(rateChangesQuery);
  
  const [schedule, setSchedule] = useState<AmortizationPeriod[]>([]);
  const [auditTrail, setAuditTrail] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isComputing, setIsComputing] = useState(false);
  
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [newDrawdown, setNewDrawdown] = useState({ date: '', amount: 0 });
  const [newPayment, setNewPayment] = useState({ periodNumber: 1, principal: 0, interest: 0 });
  const [newRateChange, setNewRateChange] = useState({ effectiveFromPeriod: 1, newAnnualRate: 5.0, reasonForChange: '' });
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const logAudit = useCallback((action: string, details: string) => {
    const entry = {
      timestamp: new Date().toISOString(),
      actionType: action,
      details,
      user: user?.isAnonymous ? 'Anonymous User' : (user?.email || 'Internal Auditor')
    };
    setAuditTrail(prev => [entry, ...prev]);
  }, [user]);

  useEffect(() => {
    if (loanData && selectedLoanId) {
      setLoanInput({
        loanName: loanData.loanName,
        principalAmount: loanData.principalAmount,
        annualInterestRate: loanData.annualInterestRate,
        termInMonths: loanData.termInMonths,
        startDate: loanData.startDate,
        currency: loanData.currency,
        dayCountConvention: loanData.dayCountConvention,
        isBullet: loanData.isBullet,
        drawdowns: drawdownsData || [],
        manualPayments: paymentsData || [],
        rateChanges: rateChangesData || [],
        periodStatuses: loanData.periodStatuses || {},
      });
      logAudit('Loan Loaded', `Loaded "${loanData.loanName}" from database.`);
    } else if (!selectedLoanId) {
      setLoanInput(BLANK_LOAN);
    }
  }, [selectedLoanId, loanData, drawdownsData, paymentsData, rateChangesData, logAudit]);

  const performCalculation = useCallback((input: LoanInput) => {
    setIsComputing(true);
    try {
      const newSchedule = generateAmortizationSchedule(input);
      setSchedule(newSchedule);
      if (input.loanName !== BLANK_LOAN.loanName) {
        logAudit('Schedule Recomputed', `Recalculated accruals for ${input.loanName}.`);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Calculation Error", description: err.message });
    } finally {
      setIsComputing(false);
    }
  }, [toast, logAudit]);

  useEffect(() => {
    performCalculation(loanInput);
  }, [loanInput, performCalculation]);

  const handleAddDrawdown = useCallback(() => {
    if (!newDrawdown.date || newDrawdown.amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Drawdown", description: "Please provide a valid date and amount." });
      return;
    }
    const updatedDrawdowns = [...(loanInput.drawdowns || []), { id: uuidv4(), ...newDrawdown }];
    setLoanInput(prev => ({ ...prev, drawdowns: updatedDrawdowns }));
    setNewDrawdown({ date: '', amount: 0 });
    logAudit('Drawdown Added', `New drawdown of ${newDrawdown.amount} on ${newDrawdown.date}.`);
  }, [newDrawdown, loanInput.drawdowns, logAudit, toast]);

  const handleClearDrawdowns = useCallback(() => {
    setLoanInput(prev => ({ ...prev, drawdowns: [] }));
    logAudit('Drawdowns Cleared', 'All drawdown records were removed.');
  }, [logAudit]);
  
  const handleAddRateChange = useCallback(() => {
    if (newRateChange.effectiveFromPeriod < 1 || newRateChange.newAnnualRate <= 0) {
      toast({ variant: "destructive", title: "Invalid Rate Change", description: "Provide a valid period and rate." });
      return;
    }
    const change: InterestRateChange = {
      id: uuidv4(),
      ...newRateChange
    };
    const updatedRateChanges = [...loanInput.rateChanges, change];
    setLoanInput(prev => ({ ...prev, rateChanges: updatedRateChanges }));
    setNewRateChange({ effectiveFromPeriod: (loanInput.rateChanges.length + 2), newAnnualRate: newRateChange.newAnnualRate, reasonForChange: '' });
    logAudit('Rate Change Added', `Rate changes to ${change.newAnnualRate}% from period ${change.effectiveFromPeriod}.`);
  }, [newRateChange, loanInput.rateChanges, toast, logAudit]);

  const handleAddPayment = useCallback(() => {
    if (newPayment.periodNumber < 1 || (newPayment.principal <= 0 && newPayment.interest <= 0)) {
      toast({ variant: "destructive", title: "Invalid Payment", description: "Provide a valid period and payment amount." });
      return;
    }
    const payment: ManualPayment = {
      id: uuidv4(),
      periodNumber: newPayment.periodNumber,
      principalAmount: newPayment.principal,
      interestAmount: newPayment.interest
    };
    setLoanInput(prev => ({ ...prev, manualPayments: [...(prev.manualPayments || []), payment] }));
    setNewPayment({ periodNumber: 1, principal: 0, interest: 0 });
    logAudit('Payment Recorded', `Payment for Month ${newPayment.periodNumber} recorded.`);
  }, [newPayment, loanInput.manualPayments, toast, logAudit]);

  const handleClearPayments = useCallback(() => {
    setLoanInput(prev => ({ ...prev, manualPayments: [] }));
    logAudit('Payments Cleared', 'All manual settlement records were removed.');
  }, [logAudit]);

  const handleNewLoan = useCallback(() => {
    setSelectedLoanId(null);
    setLoanInput(BLANK_LOAN);
    setAuditTrail([]);
    logAudit("New Loan Created", "Initialized a blank loan facility.");
    toast({ title: "New Loan", description: "New blank loan facility ready for setup." });
  }, [logAudit, toast]);
  
  const handleSaveLoan = useCallback(async () => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not Signed In', description: 'You must sign in to save loans.' });
      return;
    }
    if (!loanInput.loanName) {
      toast({ variant: 'destructive', title: 'Cannot Save', description: 'Loan name is required.' });
      return;
    }
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      
      const loanId = selectedLoanId || uuidv4();
      const loanRef = doc(firestore, 'loans', loanId);

      const loanDocData = {
        userId: user.uid,
        updatedAt: serverTimestamp(),
        loanName: loanInput.loanName,
        principalAmount: loanInput.principalAmount,
        annualInterestRate: loanInput.annualInterestRate,
        termInMonths: loanInput.termInMonths,
        startDate: loanInput.startDate,
        currency: loanInput.currency,
        dayCountConvention: loanInput.dayCountConvention,
        isBullet: loanInput.isBullet,
        periodStatuses: loanInput.periodStatuses || {},
      };
      
      if (!selectedLoanId) {
        batch.set(loanRef, { ...loanDocData, createdAt: serverTimestamp() });
      } else {
        batch.update(loanRef, loanDocData);
      }

      // Sync subcollections
      const collectionsToSync = [
        { name: 'drawdowns', data: loanInput.drawdowns },
        { name: 'manualPayments', data: loanInput.manualPayments },
        { name: 'interestRateChanges', data: loanInput.rateChanges },
      ];

      for (const { name, data } of collectionsToSync) {
        const subCollectionRef = collection(firestore, 'loans', loanId, name);
        const existingDocsSnapshot = await getDocs(subCollectionRef);
        existingDocsSnapshot.forEach(doc => batch.delete(doc.ref));
        data.forEach(item => {
          const itemRef = doc(subCollectionRef, item.id);
          batch.set(itemRef, { ...item, userId: user.uid });
        });
      }

      await batch.commit();

      if (!selectedLoanId) {
        setSelectedLoanId(loanId);
      }

      toast({ title: 'Loan Saved', description: `"${loanInput.loanName}" has been saved successfully.` });
      logAudit('Loan Saved', `Saved "${loanInput.loanName}" to database.`);
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
      logAudit('Save Failed', `Error: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [user, firestore, loanInput, selectedLoanId, toast, logAudit]);

  const handleDeleteLoan = useCallback(async (loanId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this loan?")) return;

    try {
      const collectionsToDelete = ['drawdowns', 'manualPayments', 'interestRateChanges', 'auditTrail', 'journalEntries', 'schedule'];
      for (const sub of collectionsToDelete) {
        const subCollectionRef = collection(firestore, 'loans', loanId, sub);
        const snapshot = await getDocs(subCollectionRef);
        snapshot.forEach(async (doc) => {
          await deleteDoc(doc.ref);
        });
      }
      await deleteDoc(doc(firestore, 'loans', loanId));

      toast({ title: 'Loan Deleted', description: 'The loan has been permanently removed.' });
      if (selectedLoanId === loanId) {
        handleNewLoan();
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  }, [firestore, toast, handleNewLoan, selectedLoanId]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
          const normalizedDate = rawDate; // Assuming dates are correctly formatted

          if (type === 'drawdown' && normalizedDate && amount > 0) {
            importedDrawdowns.push({ id: uuidv4(), date: normalizedDate, amount });
          } else if (type === 'payment' && (principal > 0 || interest > 0)) {
            importedPayments.push({ id: uuidv4(), periodNumber: period, principalAmount: principal, interestAmount: interest });
          }
        });

        if (importedDrawdowns.length === 0 && importedPayments.length === 0) {
          toast({ variant: "destructive", title: "Import Failed", description: "No valid drawdown or payment records found in CSV." });
          return;
        }

        setLoanInput(prev => ({
          ...prev,
          drawdowns: [...prev.drawdowns, ...importedDrawdowns],
          manualPayments: [...prev.manualPayments, ...importedPayments]
        }));
        
        setIsImportOpen(false);
        toast({ title: "Import Successful", description: `Loaded ${importedDrawdowns.length} drawdowns and ${importedPayments.length} payments. Schedule updated.` });
        logAudit('Bulk Import', `Imported ${importedDrawdowns.length} drawdowns and ${importedPayments.length} payments from CSV.`);
      },
      error: (err) => {
        toast({ variant: "destructive", title: "Import Error", description: err.message });
      }
    });
    if (e.target) e.target.value = '';
  }, [toast, logAudit]);
  
  const handleExportExcel = useCallback(() => {
    logAudit('Excel Export', `Workbook exported for "${loanInput.loanName}".`);
    exportToExcel(schedule, loanInput, auditTrail);
  }, [logAudit, schedule, loanInput, auditTrail]);
  
  const handleAiAnalysis = useCallback(async () => {
    if (schedule.length === 0) {
      toast({ variant: "destructive", title: "Cannot Analyze", description: "A schedule must be generated first." });
      return;
    }
    setIsAnalyzing(true);
    setAiAnalysis(null);
    logAudit('AI Analysis', 'Started AI-powered analysis.');
    try {
      const finalPeriod = schedule[schedule.length-1];
      const analysisInput: AiAnalysisInput = {
        loanSummary: {
          loanName: loanInput.loanName,
          principalAmount: loanInput.principalAmount,
          annualInterestRate: loanInput.annualInterestRate,
          termInMonths: loanInput.termInMonths,
          startDate: loanInput.startDate,
          currency: loanInput.currency,
          monthlyPayment: 0, // Placeholder, as it's a drawdown facility
          totalInterest: finalPeriod.cumulativeInterest,
          totalPayable: finalPeriod.closingBalance + finalPeriod.cumulativeInterest,
        },
        amortizationSchedule: schedule.map(p => ({
          periodNumber: p.periodNumber,
          date: p.date,
          openingBalance: p.openingBalance,
          drawdownAmount: p.drawdownAmount,
          interestAccrual: p.interestAccrual,
          principalPaid: p.principalPaid,
          interestPaid: p.interestPaid,
          closingBalance: p.closingBalance,
          cumulativeInterest: p.cumulativeInterest,
          status: p.status,
        })),
        auditTrail: auditTrail.slice(0, 10), // Send recent audit trail
      };

      const result = await aiPoweredLoanInsights(analysisInput);
      setAiAnalysis(result);
      logAudit('AI Analysis Complete', 'Successfully received AI insights.');
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "AI Analysis Failed", description: e.message });
      logAudit('AI Analysis Failed', `Error: ${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [schedule, loanInput, auditTrail, toast, logAudit]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    schedule.forEach(p => years.add(p.date.split('-')[0]));
    return Array.from(years).sort();
  }, [schedule]);

  const filteredSchedule = useMemo(() => {
    if (yearFilter === 'all') return schedule;
    return schedule.filter(p => p.date.startsWith(yearFilter));
  }, [schedule, yearFilter]);

  const { totalPrincipalOnly, totalCurrentExposure, totalInterestAccrued } = useMemo(() => {
    if (schedule.length === 0) {
      return { totalPrincipalOnly: 0, totalCurrentExposure: 0, totalInterestAccrued: 0 };
    }
    const finalPeriod = schedule[schedule.length - 1];
    const totalPrincipal = loanInput.principalAmount + loanInput.drawdowns.reduce((s,d) => s + d.amount, 0);
    const principalPaid = loanInput.manualPayments.reduce((s,p) => s + p.principalAmount, 0);
    return {
      totalPrincipalOnly: totalPrincipal - principalPaid,
      totalCurrentExposure: finalPeriod.closingBalance,
      totalInterestAccrued: finalPeriod.cumulativeInterest,
    };
  }, [schedule, loanInput]);

  return (
    <SidebarProvider>
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 font-body">
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">LoanGuard <span className="text-primary">EIR</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">IFRS 9 ACCRUAL ENGINE</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isUserLoading ? <Skeleton className="h-8 w-24" /> : (
              user ? (
                <>
                  <span className="text-xs hidden md:inline">Welcome, {user.isAnonymous ? 'Anonymous User' : user.email}</span>
                  <Button variant="ghost" size="sm" onClick={() => signOut(auth)}><LogOut className="h-4 w-4 mr-2" />Sign Out</Button>
                </>
              ) : (
                <Button variant="outline" size="sm" onClick={() => signInAnonymously(auth)}><LogIn className="h-4 w-4 mr-2" />Sign In Anonymously</Button>
              )
            )}
            <Button variant="outline" size="sm" className="border-white/10" onClick={() => setIsImportOpen(true)}><Upload className="h-4 w-4 mr-2" /> Bulk Import</Button>
            <Button size="sm" onClick={handleExportExcel} className="shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90"><FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel</Button>
          </div>
        </div>
      </header>

    <div className="flex flex-1">
    <Sidebar>
      <SidebarHeader>
        <h2 className="font-semibold text-lg p-2">Loan Facilities</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleNewLoan}><FilePlus /> New Loan</SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSaveLoan} disabled={!user || isSaving}><Save/> {isSaving ? 'Saving...' : 'Save Current Loan'}</SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="mt-4 p-2 text-sm font-medium text-muted-foreground">Saved Loans</div>
        <SidebarMenu>
          {loansLoading ? (
            <div className="p-2 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            loans?.map(loan => (
              <SidebarMenuItem key={loan.id}>
                <SidebarMenuButton isActive={loan.id === selectedLoanId} onClick={() => setSelectedLoanId(loan.id)}>
                  <Landmark />
                  <span>{loan.loanName}</span>
                </SidebarMenuButton>
                 <SidebarMenuAction onClick={() => handleDeleteLoan(loan.id)}><Trash2 className="text-destructive" /></SidebarMenuAction>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <main className="flex-1 container mx-auto p-4 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><CreditCard className="h-4 w-4 text-emerald-400" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Principal</p></div>
              <p className="text-2xl font-bold font-code text-emerald-400">{loanInput.currency} {totalPrincipalOnly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><Wallet className="h-4 w-4 text-primary" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gross Exposure</p></div>
              <p className="text-2xl font-bold font-code">{totalCurrentExposure === null ? '—' : `${loanInput.currency} ${totalCurrentExposure.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-white/5 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Accrued Interest</p></div>
              <p className="text-2xl font-bold font-code text-amber-500">{totalInterestAccrued === null ? '—' : `${loanInput.currency} ${totalInterestAccrued.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
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
              <div className="flex items-center gap-2 mb-2"><History className="h-4 w-4 text-purple-400" /><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Basis</p></div>
              <p className="text-2xl font-bold font-code text-purple-400">{loanInput.dayCountConvention}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-fit bg-slate-900 border border-white/5 p-1 mb-8 rounded-xl overflow-x-auto">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><LayoutDashboard />Dashboard</TabsTrigger>
            <TabsTrigger value="setup" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><Settings2 />Setup</TabsTrigger>
            <TabsTrigger value="drawdowns" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><TrendingUp />Drawdowns</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><Wallet />Payments</TabsTrigger>
            <TabsTrigger value="rateChanges" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><History />Rate Changes</TabsTrigger>
            <TabsTrigger value="schedule" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><TableIcon />Ledger (EOM)</TabsTrigger>
            <TabsTrigger value="audit" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2"><FileText />Audit</TabsTrigger>
            <TabsTrigger value="ai" className="data-[state=active]:bg-primary rounded-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI Insights
            </TabsTrigger>
          </TabsList>
            
          <TabsContent value="dashboard">
            <DashboardTab schedule={schedule} currency={loanInput.currency} />
          </TabsContent>
            
          <TabsContent value="setup" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="md:col-span-2 bg-slate-900/50 border-white/5">
                <CardHeader><CardTitle className="text-primary flex items-center gap-2"><Settings2 className="h-5 w-5" /> Facility Parameters</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="space-y-2"><Label>Facility Reference</Label>
                      <Input className="bg-slate-800 border-white/10" value={loanInput.loanName} 
                        onChange={e => setLoanInput({...loanInput, loanName: e.target.value})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Base Principal</Label>
                        <Input type="number" className="bg-slate-800 border-white/10" value={loanInput.principalAmount}
                          onChange={e => setLoanInput({...loanInput, principalAmount: Number(e.target.value)})}
                        />
                      </div>
                      <div className="space-y-2"><Label>Currency</Label>
                        <Select value={loanInput.currency} onValueChange={(v: string) => setLoanInput(p => ({...p, currency: v}))}>
                          <SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="AED">AED</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                            <SelectItem value="PHP">PHP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Base Rate (%)</Label>
                        <Input type="number" step="0.01" className="bg-slate-800 border-white/10" value={loanInput.annualInterestRate}
                          onChange={e => setLoanInput({...loanInput, annualInterestRate: Number(e.target.value)})} 
                        />
                      </div>
                      <div className="space-y-2"><Label>Term (Mo)</Label>
                        <Input type="number" className="bg-slate-800 border-white/10" value={loanInput.termInMonths}
                          onChange={e => setLoanInput({...loanInput, termInMonths: Number(e.target.value)})} 
                        />
                      </div>
                    </div>
                    <div className="space-y-2"><Label>Convention</Label>
                      <Select value={loanInput.dayCountConvention} onValueChange={(v: DayCountConvention) => setLoanInput(p => ({...p, dayCountConvention: v}))}>
                        <SelectTrigger className="bg-slate-800 border-white/10"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30/360">30/360</SelectItem>
                          <SelectItem value="30/365">30/365</SelectItem>
                          <SelectItem value="ACT/360">ACT/360</SelectItem>
                          <SelectItem value="ACT/365">ACT/365</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-white/10 border-dashed border-2 flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary"><Calculator className="h-8 w-8" /></div>
                <div>
                  <h3 className="font-bold">Bullet Repayment</h3>
                  <p className="text-xs text-muted-foreground mt-1">Settles full balance at maturity</p>
                </div>
                <div className="flex items-center space-x-2">
                   <Switch checked={loanInput.isBullet} onCheckedChange={(v) => setLoanInput(p => ({...p, isBullet: v}))} />
                   <Label>Enabled</Label>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drawdowns" className="space-y-4">
             <Card className="bg-slate-900/50 border-white/5">
                <CardHeader>
                    <CardTitle>Incremental Drawdowns</CardTitle>
                    <CardDescription>Record funds drawn down from the facility. The schedule will recalculate interest based on the new balance from the drawdown date.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/30 p-6 rounded-xl border border-white/5">
                        <div className="space-y-2 flex-1"><Label>Drawdown Date</Label><Input type="date" className="bg-slate-900" value={newDrawdown.date} onChange={e => setNewDrawdown({...newDrawdown, date: e.target.value})} /></div>
                        <div className="space-y-2 flex-1"><Label>Amount</Label><Input type="number" className="bg-slate-900" value={newDrawdown.amount} onChange={e => setNewDrawdown({...newDrawdown, amount: Number(e.target.value)})} /></div>
                        <Button onClick={handleAddDrawdown} className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Drawdown</Button>
                    </div>
                     <div className="flex justify-end">
                        <Button variant="destructive" size="sm" onClick={handleClearDrawdowns}><Trash2 className="h-4 w-4 mr-2" />Clear All Drawdowns</Button>
                    </div>
                    <Table>
                        <TableHeader><TableRow className="border-white/10"><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loanInput.drawdowns?.map(d => (
                            <TableRow key={d.id} className="border-white/5 hover:bg-white/5 group">
                                <TableCell>{d.date}</TableCell>
                                <TableCell className="font-code">{loanInput.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => setLoanInput(p => ({...p, drawdowns: p.drawdowns?.filter(x => x.id !== d.id)}))}>
                                    <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                                </Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
                <CardHeader>
                <CardTitle>Manual Settlements</CardTitle>
                <CardDescription>Record manual principal or interest payments. This allows for flexible repayment scenarios outside of a fixed schedule.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/30 p-6 rounded-xl border border-white/5">
                        <div className="space-y-2 w-32"><Label>Period</Label><Input type="number" className="bg-slate-900" value={newPayment.periodNumber} onChange={e => setNewPayment({...newPayment, periodNumber: Number(e.target.value)})} /></div>
                        <div className="space-y-2 flex-1"><Label>Principal Amount</Label><Input type="number" className="bg-slate-900" value={newPayment.principal} onChange={e => setNewPayment({...newPayment, principal: Number(e.target.value)})} /></div>
                        <div className="space-y-2 flex-1"><Label>Interest Amount</Label><Input type="number" className="bg-slate-900" value={newPayment.interest} onChange={e => setNewPayment({...newPayment, interest: Number(e.target.value)})} /></div>
                        <Button onClick={handleAddPayment} className="bg-primary"><Plus className="h-4 w-4 mr-2" />Add Payment</Button>
                    </div>
                    <div className="flex justify-end">
                        <Button variant="destructive" size="sm" onClick={handleClearPayments}><Trash2 className="h-4 w-4 mr-2" />Clear All Payments</Button>
                    </div>
                    <Table>
                        <TableHeader><TableRow className="border-white/10"><TableHead>Period</TableHead><TableHead>Principal Paid</TableHead><TableHead>Interest Paid</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loanInput.manualPayments?.map(p => (
                            <TableRow key={p.id} className="border-white/5 hover:bg-white/5 group">
                                <TableCell>Month {p.periodNumber}</TableCell>
                                <TableCell className="font-code">{loanInput.currency} {p.principalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="font-code">{loanInput.currency} {p.interestAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => setLoanInput(prev => ({...prev, manualPayments: prev.manualPayments?.filter(x => x.id !== p.id)}))}>
                                    <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                                </Button>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rateChanges" className="space-y-4">
            <Card className="bg-slate-900/50 border-white/5">
              <CardHeader>
                <CardTitle>Prospective Interest Rate Changes</CardTitle>
                 <CardDescription>Define future rate changes. The engine will recalculate the schedule from the effective period onwards.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-800/30 p-6 rounded-xl border border-white/5">
                  <div className="space-y-2 w-28"><Label>Effective Period</Label><Input type="number" className="bg-slate-900" value={newRateChange.effectiveFromPeriod} onChange={e => setNewRateChange({...newRateChange, effectiveFromPeriod: Number(e.target.value)})} /></div>
                  <div className="space-y-2 w-32"><Label>New Rate (%)</Label><Input type="number" step="0.01" className="bg-slate-900" value={newRateChange.newAnnualRate} onChange={e => setNewRateChange({...newRateChange, newAnnualRate: Number(e.target.value)})} /></div>
                  <div className="space-y-2 flex-1"><Label>Reason for Change</Label><Input className="bg-slate-900" value={newRateChange.reasonForChange} onChange={e => setNewRateChange({...newRateChange, reasonForChange: e.target.value})} placeholder="e.g. Central bank rate hike" /></div>
                  <Button onClick={handleAddRateChange} className="bg-primary"><Plus className="h-4 w-4 mr-2" /> Add Rate Change</Button>
                </div>
                <Table>
                  <TableHeader><TableRow className="border-white/10"><TableHead>Effective Period</TableHead><TableHead>New Annual Rate</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {loanInput.rateChanges?.map(rc => (
                      <TableRow key={rc.id} className="border-white/5 hover:bg-white/5 group">
                        <TableCell className="text-sm font-medium">Month {rc.effectiveFromPeriod}</TableCell>
                        <TableCell className="font-code text-sm text-blue-400 font-bold">{rc.newAnnualRate.toFixed(2)}%</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{rc.reasonForChange}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => setLoanInput(p => ({...p, rateChanges: p.rateChanges?.filter(x => x.id !== rc.id)}))}>
                            <Trash2 className="h-4 w-4 text-destructive opacity-50 group-hover:opacity-100" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card className="bg-slate-900/50 border-white/5">
                <CardHeader className="flex-row items-center justify-between">
                    <div>
                        <CardTitle>Amortization Ledger</CardTitle>
                        <CardDescription>The detailed end-of-month (EOM) amortization schedule based on the effective interest rate (EIR) method.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                        <Select value={yearFilter} onValueChange={setYearFilter}>
                            <SelectTrigger className="w-48 bg-slate-800 border-white/10"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Years</SelectItem>
                                {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" className="border-white/10" onClick={() => downloadCSV(`${loanInput.loanName}_schedule.csv`, generateAmortizationCSV(schedule))}>
                            <FileText className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px]">
                        <Table>
                        <TableHeader className="sticky top-0 bg-slate-900 z-10">
                            <TableRow className="border-b border-white/10">
                            <TableHead>Period</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Opening Bal</TableHead>
                            <TableHead>Drawdown</TableHead>
                            <TableHead>Interest Accrual</TableHead>
                            <TableHead>Principal Paid</TableHead>
                            <TableHead>Interest Paid</TableHead>
                            <TableHead>Closing Bal</TableHead>
                            <TableHead>Cum. Interest</TableHead>
                            <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSchedule.map(p => (
                            <TableRow key={p.periodNumber} className="border-b border-white/5 hover:bg-white/5">
                                <TableCell>{p.periodNumber}</TableCell>
                                <TableCell>{p.date}</TableCell>
                                <TableCell className="font-code text-right">{p.openingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="font-code text-right text-emerald-400">{p.drawdownAmount > 0 ? p.drawdownAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</TableCell>
                                <TableCell className="font-code text-right text-amber-400">{p.interestAccrual.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="font-code text-right text-red-400">{p.principalPaid > 0 ? p.principalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</TableCell>
                                <TableCell className="font-code text-right text-red-400">{p.interestPaid > 0 ? p.interestPaid.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}</TableCell>
                                <TableCell className="font-code text-right">{p.closingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell className="font-code text-right">{p.cumulativeInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                                <TableCell>
                                    <Badge variant={p.status === 'paid' ? 'default' : 'outline'} className={p.status === 'paid' ? 'bg-emerald-600' : 'border-white/20'}>{p.status}</Badge>
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="audit">
            <Card className="bg-slate-900/50 border-white/5">
                <CardHeader>
                    <CardTitle>Audit Trail</CardTitle>
                    <CardDescription>An immutable log of all actions performed during this session.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-slate-900 z-10"><TableRow className="border-white/10"><TableHead>Timestamp</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {auditTrail.map((entry, index) => (
                            <TableRow key={index} className="border-white/5">
                            <TableCell className="text-xs text-muted-foreground">{entry.timestamp}</TableCell>
                            <TableCell className="font-medium">{entry.actionType}</TableCell>
                            <TableCell>{entry.details}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{entry.user}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ai">
            <Card className="bg-slate-900/50 border-white/5">
                <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                    <CardTitle>AI-Powered Analysis</CardTitle>
                    <CardDescription>Generates a financial summary and highlights key metrics using a Large Language Model.</CardDescription>
                    </div>
                    <Button onClick={handleAiAnalysis} disabled={isAnalyzing || schedule.length === 0}>
                    {isAnalyzing ? "Analyzing..." : "Run AI Analysis"} <Sparkles className="h-4 w-4 ml-2" />
                    </Button>
                </div>
                </CardHeader>
                <CardContent>
                {isAnalyzing ? (
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <div className="grid grid-cols-2 gap-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    </div>
                ) : aiAnalysis ? (
                    <div className="space-y-6">
                        <Alert>
                            <Lightbulb className="h-4 w-4" />
                            <AlertTitle>Plain English Summary</AlertTitle>
                            <AlertDescription>{aiAnalysis.plainEnglishSummary}</AlertDescription>
                        </Alert>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Alert variant={aiAnalysis.excessiveInterestFlag ? "destructive" : "default"}>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Excessive Interest</AlertTitle>
                            <AlertDescription>{aiAnalysis.excessiveInterestFlag ? "Yes" : "No"}. Total interest is more than 30% of principal.</AlertDescription>
                            </Alert>
                            <Alert>
                            <Lightbulb className="h-4 w-4" />
                            <AlertTitle>Early Repayment</AlertTitle>
                            <AlertDescription>{aiAnalysis.earlyRepaymentSuggestion}</AlertDescription>
                            </Alert>
                        </div>
                         <Alert>
                            <Lightbulb className="h-4 w-4" />
                            <AlertTitle>Rate Change Impact</AlertTitle>
                            <AlertDescription>{aiAnalysis.rateChangeImpactExplanation || "No rate changes detected or explanation available."}</AlertDescription>
                        </Alert>
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <Sparkles className="mx-auto h-12 w-12" />
                        <p className="mt-4">Run AI analysis to get insights on your loan.</p>
                    </div>
                )}
                </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>

      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border">
            <DialogHeader>
            <DialogTitle>Bulk Import</DialogTitle>
            <DialogDescription>
                Upload a CSV file with drawdown or payment data. The file must contain columns: `type` ('drawdown' or 'payment'), `date` (YYYY-MM-DD for drawdowns), `amount` (for drawdowns), `period` (for payments), `principal`, `interest`.
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
            <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} />
            </div>
        </DialogContent>
      </Dialog>

    </SidebarInset>
    </div>
    </div>
    </SidebarProvider>
  );
}
