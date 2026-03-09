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
  drawdownAmount: z.number().describe('Amount drawn down in this period.'),
  interestAccrual: z.number(),
  principalPaid: z.number(),
  interestPaid: z.number(),
  closingBalance: z.number(),
  cumulativeInterest: z.number(),
  status: z.enum(['projected', 'paid', 'unpaid', 'recalculated']),
});

const AuditEntrySchema = z.object({
  timestamp: z.string().describe('ISO timestamp of the audit entry.'),
  actionType: z.string().describe('Type of action logged.'),
  details: z.string().describe('Descriptive text for the action.'),
  oldValue: z.any().optional(),
  newValue: z.any().optional(),
  user: z.string().optional(),
}).passthrough();

const AiAnalysisInputSchema = z.object({
  loanSummary: LoanSummarySchema.describe('Summary details of the loan.'),
  amortizationSchedule: z.array(AmortizationPeriodSchema).describe('The full schedule of the loan.'),
  auditTrail: z.array(AuditEntrySchema).optional().describe('Optional audit trail entries.'),
});
export type AiAnalysisInput = z.infer<typeof AiAnalysisInputSchema>;

// Output Schema
const AiAnalysisOutputSchema = z.object({
  plainEnglishSummary: z.string().describe('A plain-English summary of the loan economics.'),
  excessiveInterestFlag: z.boolean().describe('True if total interest exceeds 30% of the principal amount.'),
  earlyRepaymentSuggestion: z.string().describe('Suggestions on the benefits of early repayment.'),
  rateChangeImpactExplanation: z.string().describe('An auditor-friendly explanation of the impact of any interest rate changes.'),
});
export type AiAnalysisOutput = z.infer<typeof AiAnalysisOutputSchema>;

export async function aiPoweredLoanInsights(input: AiAnalysisInput): Promise<AiAnalysisOutput> {
  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    throw new Error(
      'The AI feature is not configured. Please create a .env.local file in the project root and add your Gemini API key, e.g., GEMINI_API_KEY=your_api_key_here. You can obtain a key from Google AI Studio.'
    );
  }
  return aiPoweredLoanInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'loanAnalysisPrompt',
  input: { schema: AiAnalysisInputSchema },
  output: { schema: AiAnalysisOutputSchema },
  prompt: `You are an expert financial analyst specializing in IFRS 9 accounting and bullet/drawdown loan models. Analyze the provided data.

Loan Summary:
Name: {{{loanSummary.loanName}}}
Initial Principal: {{{loanSummary.principalAmount}}} {{{loanSummary.currency}}}
Annual Rate: {{{loanSummary.annualInterestRate}}}%
Term: {{{loanSummary.termInMonths}}} months

Note: This is a DRAWDOWN facility. Principal increases when funds are drawn and typically matures as a bullet payment.

Amortization Schedule Context (first 5 periods):
{{#each amortizationSchedule}}
Period {{periodNumber}}: Drawdown={{drawdownAmount}}, Int Accrual={{interestAccrual}}, Bal={{closingBalance}}
{{/each}}

Based on this:
1. plainEnglishSummary: Explain the facility dynamics, highlighting how drawdowns affect interest.
2. excessiveInterestFlag: Is total interest > 30% of original principal?
3. earlyRepaymentSuggestion: Advise on how settling interest early vs accruing it until maturity affects cost.
4. rateChangeImpactExplanation: Explain any recorded rate changes from the audit trail in auditor-friendly language.`,
});

const aiPoweredLoanInsightsFlow = ai.defineFlow(
  {
    name: 'aiPoweredLoanInsightsFlow',
    inputSchema: AiAnalysisInputSchema,
    outputSchema: AiAnalysisOutputSchema,
  },
  async (input) => {
    // Pass only a subset of the schedule to the AI to save tokens and focus the analysis.
    const analysisInput = {
      ...input,
      amortizationSchedule: input.amortizationSchedule.slice(0, 5),
    };
    const { output } = await prompt(analysisInput);
    return output!;
  }
);

    