# Smart Loan Planner

A frontend-only loan repayment simulator that helps users compare multiple loan strategies, model prepayments, and export detailed amortization schedules. Built entirely in the browser with no backend required.

## Overview

Smart Loan Planner enables borrowers to:
- Create and manage multiple loan scenarios simultaneously
- Model complex prepayment strategies (extra monthly payments, annual bonuses, lump-sum payments)
- View detailed amortization schedules broken down by month and year
- Compare scenarios side-by-side to evaluate which strategy saves the most interest
- Export comprehensive workbooks with summaries, schedules, and comparisons
- Switch between light and dark themes for comfortable viewing
- Persist all data locally in the browser (no account needed)

## How It Works

### Core Workflow

1. **Create a Scenario**: Enter loan parameters (principal amount, annual interest rate, tenure, and payment frequency)
2. **Add Extra Payments**: Model additional strategies like monthly extra payments, annual bonuses, or specific lump-sum prepayments
3. **View Calculations**: Instantly see the monthly/yearly breakdown, total interest, payoff timeline, and interest saved
4. **Compare Strategies**: Side-by-side comparison shows which scenario saves the most interest
5. **Export Results**: Download an Excel workbook with detailed schedules for records or further analysis

### Data Persistence

All scenarios and preferences are automatically saved to your browser's local storage. Data survives browser restarts but is specific to your browser/device. Clearing browser storage will erase all saved data.

### Light/Dark Mode

Toggle between light and dark themes using the button in the header. Your preference is saved automatically.

## Calculation Details

### EMI Calculation

The Equated Monthly Installment (EMI) is the fixed payment amount calculated using the standard amortization formula:

```
EMI = P × [r(1+r)^n] / [(1+r)^n - 1]

Where:
  P = Principal (loan amount)
  r = Monthly interest rate (annual rate / 100 / 12)
  n = Total number of payments
```

For different payment frequencies (weekly, biweekly), the formula adapts the number of periods and interest rate accordingly.

### Custom EMI

If you specify a custom EMI amount (higher than the calculated standard EMI), that custom amount becomes the payment for the entire loan term, resulting in faster payoff and lower total interest.

### Amortization Schedule

For each payment, the calculation follows:

1. **Interest for the period** = Opening Balance × Monthly Interest Rate
2. **Principal reduction** = Payment Amount - Interest
3. **Closing Balance** = Opening Balance - Principal Reduction
4. **Extra Payments**: Monthly extra payments and annual bonuses are applied directly to principal
5. **Lump-Sum Payments**: One-time prepayments at specific months reduce the balance and shorten the loan term

The schedule continues until the loan is fully repaid or a lump-sum brings the balance to zero.

### Payoff Duration

The payoff time is calculated as the number of complete years and remaining months from loan start to the final payment. For example, if you make your last payment 20 years and 3 months from the start, the payoff shows as **20y 3m**.

### Interest Saved

Total interest saved is calculated by comparing the base EMI scenario (with no extra payments) to the current scenario. The difference represents how much interest you save through extra payments and prepayments.

### Year-Wise Summaries

Annual summaries aggregate:
- Number of payments made in that year
- Opening and closing balance
- Total principal paid
- Total interest paid
- Total payments made

## Features

### Multiple Scenarios

Create as many loan scenarios as needed. Each scenario is independent and can be duplicated for easy "what-if" testing. Scenarios appear in the left sidebar for quick switching.

### Extra Payment Options

- **Monthly Extra**: Fixed extra payment added each month
- **Annual Extra EMI**: Fixed bonus payment (e.g., after receiving annual bonus) applied once per year
- **Annual EMI Increase**: Incrementally increase your EMI by a percentage each year, starting from a specified year
- **Lump-Sum Prepayments**: Model specific one-time payments on specific months with custom labels

### Charts & Visualizations

- **Balance Trend**: Line chart showing how your loan balance decreases over time
- **Principal vs. Interest**: Stacked bar chart showing the composition of each payment (how much goes to interest vs. principal)

### Comparison Dashboard

View a table comparing all your scenarios side-by-side:
- Principal, interest rate, EMI
- Total interest paid
- Total amount paid
- Payoff timeline

### Excel Export

Export your active scenario as a detailed workbook with:
- **Summary sheet**: Key parameters and payoff details
- **Month-wise sheet**: Complete month-by-month amortization schedule
- **Year-wise sheet**: Aggregated yearly summaries
- **Comparison sheet**: All scenarios side-by-side

## Technology Stack

### Frontend Framework
- **React 19**: Modern UI library with hooks and performance optimizations
- **TypeScript**: Static type checking for reliability and developer experience
- **Vite**: Lightning-fast build tool and development server

### Libraries & Tools
- **Recharts**: Interactive charts for balance trends and principal/interest visualization
- **SheetJS (xlsx)**: Excel workbook generation and export
- **Lucide React**: Icon library for clean, consistent UI icons
- **Vitest**: Unit testing framework for regression testing

### Styling
- **CSS Variables**: Dynamic theme switching (light/dark mode)
- **CSS Grid & Flexbox**: Responsive layout design
- **Custom CSS**: Hand-crafted styles optimized for both themes

### Storage
- **Browser localStorage**: Client-side persistence for scenarios and theme preference
- **No backend**: 100% frontend-only, works offline

### Development
- **TypeScript strict mode**: Type safety throughout the codebase
- **Oxlint**: Fast, JavaScript-based linter
- **Build optimization**: Production builds include minification and code optimization

## Getting Started

### Installation

```bash
npm install
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173/`

### Build for Production

```bash
npm run build
```

Output goes to the `dist/` directory.

### Run Tests

```bash
npm run test
```

Runs regression tests for calculation accuracy.

## Browser Support

Works in all modern browsers that support:
- ES2020 JavaScript
- localStorage API
- CSS variables (custom properties)

## Notes

- All calculations are performed in the browser; no data is sent to any server
- Data is stored locally and persists across sessions within the same browser
- Exporting to Excel requires modern browsers with Blob support
- The app is optimized for desktop and tablet use; mobile responsiveness is supported but may require scrolling for complex scenarios
