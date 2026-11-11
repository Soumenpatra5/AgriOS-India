# Desktop ERP, Marketplace & Printable Reports Plan (Phases 1, 2, 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend desktop web enhancements to Farm Ledger, Marketplace, and Poultry Manager with desktop spreadsheets/grids, provide one-click Excel and printable reports, and prepare the live production site for manual user review, while strictly keeping mobile phone views 100% identical and unchanged.

**Architecture:** Use `useResponsive(768)` in `FarmLedger.jsx`, `MarketplaceHub.jsx`, and `PoultryManager.jsx` to conditionally render desktop-enhanced tables and multi-column grids when screen width $\ge 768\text{px}$. Provide `printReport.js` to format professional farm records for printing/PDF.

**Tech Stack:** React 18, Vite, Lucide React, Vitest.

**Spec:** User directive: "ok do it one by one first 1, then 2 then 3" with persistent constraint: "sudhu dextop ar design taa change hobe mobile phone ar view ta same thakbe".

## Global Constraints

- **Mobile View Invariance:** Screen width $< 768\text{px}$ must render the exact existing mobile JSX layout without touching existing styles.
- **Indic Script Purity:** All Bengali and Hindi strings must pass `npm run check:scripts` with 0 mixed-script errors.
- **Initial JS Bundle Budget:** Total initial JS $\le 492\text{ KB}$ (`npm run check:bundle`).
- **ESLint:** 0 errors (`npm run lint`).
- **Function Limit:** Serverless functions $\le 12$ on Vercel Hobby tier.

## Review Focus

1. **Mobile Isolation:** Mobile viewport (< 768px) must render original stacked cards and buttons without visual regression.
2. **Tabular Data Integrity:** Tables in Farm Ledger and Poultry Manager must correctly format currencies (₹), dates, and numbers.
3. **Print Formatting:** Printable report window must style headers, tables, and totals cleanly without breaking margins.
4. **CSV Export UTF-8 BOM:** Downloaded CSV files must retain Indic characters in Excel without gibberish.

---

## Detailed Task Breakdown

### Task 1: Desktop Spreadsheet & Chart View for Farm Ledger (`FarmLedger.jsx`)
**Files:**
- Modify: `src/pages/FarmLedger.jsx`
- Test: Vitest / `npm run check:scripts`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/FarmLedger.jsx`.
- [x] Retain exact mobile layout if `!isDesktop`.
- [x] If `isDesktop`:
  - Display month navigator and 4 P&L cards (Net Balance, Income, Expense, Net Margin %) at top.
  - Display 2-column layout:
    - Left Column (35%): Spending by category visual bars.
    - Right Column (65%): Full spreadsheet data table with columns (Date, Type [Income/Expense badge], Category, Enterprise, Note, Amount ₹, Actions [Delete]).
- [x] Verify script purity and linting.

---

### Task 2: Responsive E-Commerce Grid for Marketplace (`MarketplaceHub.jsx`)
**Files:**
- Modify: `src/pages/marketplace/MarketplaceHub.jsx`
- Test: Vitest / `npm run check:scripts`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/marketplace/MarketplaceHub.jsx`.
- [x] Retain exact mobile layout if `!isDesktop`.
- [x] If `isDesktop`:
  - Show quick action links in top bar.
  - Category filters in clean wrapping pills.
  - Products grid using 4 columns (`gridTemplateColumns: "repeat(4, 1fr)"` or `repeat(auto-fill, minmax(220px, 1fr))`).
- [x] Verify script purity and linting.

---

### Task 3: Desktop Spreadsheet Table View for Poultry Manager (`PoultryManager.jsx`)
**Files:**
- Modify: `src/pages/livestock/PoultryManager.jsx`
- Test: Vitest / `npm run check:scripts`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/livestock/PoultryManager.jsx`.
- [x] Retain exact mobile layout if `!isDesktop`.
- [x] If `isDesktop`:
  - Flocks tab: Table with columns (Flock Name, Breed, Bird Count, Age in Weeks, Purpose [Layer/Broiler], Actions).
  - Production tab: Table with columns (Date, Flock, Eggs Collected, Mortality, Feed Intake kg, Actions).
  - Events tab: Table with columns (Date, Event Type, Note, Due Date, Actions).
- [x] Verify script purity and linting.

---

### Task 4: Printable Reports & Export CSV Utility (`printReport.js` & Exports)
**Files:**
- Create: `src/utils/printReport.js`
- Create: `src/utils/__tests__/printReport.test.js`
- Modify: `src/pages/livestock/DairyManager.jsx` (Add CSV export & Print Report buttons)
- Modify: `src/pages/livestock/PoultryManager.jsx` (Add CSV export & Print Report buttons)
- Modify: `src/pages/FarmLedger.jsx` (Add Print Report button alongside CSV)

**Step-by-step:**
- [x] Create `src/utils/printReport.js`: generates a clean styled printable window with AgriOS India header, date, title, summary cards, and data table, then triggers `window.print()`.
- [x] Add unit test in `src/utils/__tests__/printReport.test.js`.
- [x] Integrate Export CSV & Print buttons in Dairy, Poultry, and Farm Ledger desktop header bars.
- [x] Verify ESLint and test suite.

---

### Task 5: Verification, Deployment & Manual Review Delivery
**Files:**
- Verification: `npm run check:scripts`, `npm run lint`, `npm run check:bundle`, `npm test`
- Production: Push to `origin/main`, monitor CI and Vercel Deploy, run `npm run test:smoke`

**Step-by-step:**
- [x] Run `npm run check:scripts` (0 errors).
- [x] Run `npm run lint` (0 errors).
- [x] Run `npm run check:bundle` ($\le 492\text{ KB}$).
- [x] Run `npm test` (all tests passing).
- [x] Commit and push to `origin/main`.
- [x] Verify CI and Vercel production deployment.
- [x] Run `npm run test:smoke` (13/13 passed).
- [x] Present comprehensive review summary to user.
