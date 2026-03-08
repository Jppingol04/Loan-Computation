# **App Name**: IFRS LoanGuard

## Core Features:

- Loan Initialization & Amortization Generation: Allows users to input loan parameters, provides live computed previews, and upon submission, generates the full IFRS 9 EIR amortization schedule stored in Firestore. Includes robust input validation.
- Dynamic Rate Recalculation (IFRS 9): Enables the application of mid-life interest rate changes using a modal interface, performing prospective recalculation of the amortization schedule per IFRS 9 guidelines, preserving historical periods, and storing updates in Firestore.
- Monthly Accrual Tracking & Visualization: Displays detailed monthly accruals, carrying amounts, EIR rates, and cumulative interest. Includes a visual bar chart for interest accrual trends and outlines journal entry mappings.
- Odoo-Compatible Journal Entry Generation: Generates double-entry journal entries for each accrual and payment period, including account mappings for direct integration or reconciliation with Odoo ERP.
- Comprehensive Audit Logging: Automatically logs all critical user actions and system events, including timestamp, action type, details, old and new values, and user, storing an immutable audit trail in Firestore for compliance.
- Multi-format Data Export: Provides export functionalities to generate multi-sheet Excel (.xlsx) workbooks (Amortization Schedule, Loan Summary, Journal Entries, Audit Trail) and Odoo-compatible CSV files for direct import.
- AI-Powered Loan Insights: Utilizes Genkit to provide plain-English summaries of loan economics, flag conditions like excessive total interest, suggest early repayment benefits, and explain rate change impacts in auditor-friendly language, acting as a smart analytical tool.

## Style Guidelines:

- Background color: Dark slate blue (#0B1120) for a professional and modern aesthetic in a dark theme.
- Primary interactive color: Vibrant blue (#3B82F6) for accents, active states, and calls to action, providing strong contrast against the dark background.
- Secondary surface color: Slightly lighter slate (#111827) for cards, dialogs, and panels to create hierarchy and depth.
- Status badge colors: Green (#28A745) for 'paid', gray (#6C757D) for 'projected', and amber (#FFC107) for 'recalculated' to visually denote status in a clear, accessible manner.
- Body and headline font: 'Inter' (sans-serif) for its modern, objective, and neutral appearance, ensuring readability for textual content.
- Numerical font: 'Source Code Pro' (monospace) for all numerical values, ensuring precise alignment and clear differentiation of financial figures.
- Use a consistent set of professional, minimalist icons (e.g., Lucide) as provided by ShadCN UI, maintaining visual coherence.
- Dark theme application-wide with a sticky header displaying the app title 'IFRS 9 Loan Accrual Engine' and accessible export buttons. Employ a tab-based navigation for primary application sections: Loan Setup, Amortization, Monthly Accrual, Journal Entries, Audit Trail.
- Responsive design ensuring optimal viewing and functionality across desktop and tablet devices. Utilize ShadCN UI components (Card, Button, Input, Select, Dialog, Table, Badge, Tabs, Toast) for a consistent and modern interface.
- Incorporate subtle hover states for interactive table rows and buttons, along with smooth transitions to enhance user feedback. Implement toast notifications for successful actions (e.g., export, rate changes, period marked paid) to provide timely user communication.