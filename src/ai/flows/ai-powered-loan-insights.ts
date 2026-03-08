'use server';
/**
 * @fileOverview This file implements a Genkit flow for providing AI-powered loan insights.
 * It analyzes a loan's summary and amortization schedule to provide a plain-English summary,
 * flag excessive interest, suggest early repayment benefits, and explain rate change impacts.
 *
 * - aiPoweredLoanInsights - A function that handles the AI loan analysis process.
 * - AiAnalysisInput - The input type for the aiPoweredLoanInsights function.
 * - AiAnalysisOutput - The return type for the aiPoweredLoanInsights function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input Schema
const LoanSummarySchema = z.object({
  loanName: z.string().describe('The name or reference of the loan.'),
  principalAmount: z.number().describe('The initial principal amount of the loan.'),
  annualInterestRate: z.number().describe('The annual interest rate of the loan.'),
  termInMonths: z.number().describe('The original term of the loan in months.'),
  startDate: z.string().describe('The start date of the loan (ISO format).'),
  currency: z.string().describe('The currency of the loan.'),
  monthlyPayment: z.number().describe('The calculated monthly payment.'),
  totalInterest: z.number().describe('The total interest paid over the life of the loan.'),
  totalPayable: z.number().describe('The total amount payable (principal + interest).'),
});

const AmortizationPeriodSchema = z.object({
  periodNumber: z.number(),
  date: z.string().describe('The end-of-month date for this period (ISO format).'),
  openingBalance: z.number(),
  interestAccrual: z.number(),
  principalPortion: z.number(),
  totalPayment: z.number(),
  closingBalance: z.number(),
  cumulativeInterest: z.number(),
  status: z.enum(['projected', 'paid', 'recalculated']),
});

const AuditEntrySchema = z.object({
  timestamp: z.string().describe('ISO timestamp of the audit entry.'),
  actionType: z.string().describe('Type of action logged (e.g., "Interest Rate Change").'),
  details: z.string().describe('Descriptive text for the action, including reason for change.'),
  oldValue: z.any().optional().describe('Old value before the action. For "Interest Rate Change", this is typically `{ "rate": number }`.'),
  newValue: z.any().optional().describe('New value after the action. For "Interest Rate Change", this is typically `{ "rate": number, "remainingBalanceAtChange": number }`.'),
  user: z.string().optional().describe('User who performed the action.'),
}).passthrough(); // Allows for other fields not explicitly defined in the schema.

const AiAnalysisInputSchema = z.object({
  loanSummary: LoanSummarySchema.describe('Summary details of the loan.'),
  amortizationSchedule: z.array(AmortizationPeriodSchema).describe('The full amortization schedule of the loan.'),
  auditTrail: z.array(AuditEntrySchema).optional().describe('Optional audit trail entries for the loan, particularly for rate changes.'),
});
export type AiAnalysisInput = z.infer<typeof AiAnalysisInputSchema>;

// Output Schema
const AiAnalysisOutputSchema = z.object({
  plainEnglishSummary: z.string().describe('A plain-English summary of the loan economics.'),
  excessiveInterestFlag: z.boolean().describe('True if total interest exceeds 30% of the principal amount, false otherwise.'),
  earlyRepaymentSuggestion: z.string().describe('Suggestions on the benefits of early repayment, if applicable.'),
  rateChangeImpactExplanation: z.string().describe('An auditor-friendly explanation of the impact of any interest rate changes that occurred during the loan term.'),
});
export type AiAnalysisOutput = z.infer<typeof AiAnalysisOutputSchema>;

export async function aiPoweredLoanInsights(input: AiAnalysisInput): Promise<AiAnalysisOutput> {
  return aiPoweredLoanInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'loanAnalysisPrompt',
  input: { schema: AiAnalysisInputSchema },
  output: { schema: AiAnalysisOutputSchema },
  prompt: `You are an expert financial analyst specializing in IFRS 9 accounting and loan amortization. Your task is to analyze the provided loan data and generate insights for a financial analyst.\n\nLoan Summary:\nName: {{{loanSummary.loanName}}}\nPrincipal Amount: {{{loanSummary.principalAmount}}} {{{loanSummary.currency}}}\nAnnual Interest Rate: {{{loanSummary.annualInterestRate}}}%\nTerm: {{{loanSummary.termInMonths}}} months\nStart Date: {{{loanSummary.startDate}}}\nMonthly Payment: {{{loanSummary.monthlyPayment}}} {{{loanSummary.currency}}}\nTotal Interest Paid: {{{loanSummary.totalInterest}}} {{{loanSummary.currency}}}\nTotal Payable: {{{loanSummary.totalPayable}}} {{{loanSummary.currency}}}\n\nAmortization Schedule (first 5 periods for context, full schedule is available if needed):\n{{#each amortizationSchedule}}\n  {{#if @index}}\n    {{#if (lt @index 5)}}\nPeriod {{periodNumber}}: Date={{date}}, Opening Bal={{openingBalance}}, Interest={{interestAccrual}}, Principal={{principalPortion}}, Closing Bal={{closingBalance}}, Cumulative Int={{cumulativeInterest}}\n    {{/if}}\n  {{/if}}\n{{/each}}\n\nAudit Trail for Rate Changes (if any):\n{{#if auditTrail.length}}\n  {{#each auditTrail}}\n    {{#if (eq actionType "Interest Rate Change")}}\n      - Timestamp: {{timestamp}}, Action: {{actionType}}, Details: {{details}}, Old Rate: {{oldValue.rate}}%, New Rate: {{newValue.rate}}%, Remaining Balance at Change: {{newValue.remainingBalanceAtChange}} {{{loanSummary.currency}}}\n    {{/if}}\n  {{/each}}\n{{else}}\n  No audit trail entries provided.\n{{/if}}\n\nBased on the provided information, generate the following:\n\n1.\u00a0\u00a0**plainEnglishSummary**: A concise, plain-English summary of the loan's key economics, highlighting its main characteristics and overall cost.\n2.\u00a0\u00a0**excessiveInterestFlag**: Determine if the total interest paid (loanSummary.totalInterest) is excessive. Consider it excessive if it exceeds 30% of the original principal amount (loanSummary.principalAmount). Set to true if excessive, false otherwise.\n3.\u00a0\u00a0**earlyRepaymentSuggestion**: Provide suggestions on the benefits of early repayment. Analyze the amortization schedule to explain how early repayment could reduce total interest paid, especially if the loan has a long term or high interest accruals in earlier periods. If the total interest is not excessive, still provide general benefits like flexibility and interest savings.\n4.\u00a0\u00a0**rateChangeImpactExplanation**: If there are any "Interest Rate Change" entries in the \`auditTrail\`, explain their financial impact in auditor-friendly language. Describe how the prospective recalculation affected monthly payments, total interest, and the remaining term. If no rate changes occurred, state that clearly, for example, "No interest rate changes were recorded for this loan, therefore no specific rate change impact analysis is required."\n\nEnsure the output strictly adheres to the JSON schema for \`AiAnalysisOutputSchema\`.\n`,
});

const aiPoweredLoanInsightsFlow = ai.defineFlow(
  {
    name: 'aiPoweredLoanInsightsFlow',
    inputSchema: AiAnalysisInputSchema,
    outputSchema: AiAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
