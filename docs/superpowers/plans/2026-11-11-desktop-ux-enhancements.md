# Desktop UX Enhancements Implementation Plan (Option 1 & Option 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance AgriOS India's desktop web experience with responsive multi-column layouts, 2-column AI workspace, spreadsheet/table views for livestock ERP, and a `Ctrl+K` Command Palette, while strictly preserving 100% of the mobile PWA view.

**Architecture:** Utilize `useResponsive(768)` to dynamically branch desktop layouts ($\ge 768\text{px}$) from mobile layouts ($< 768\text{px}$). Desktop features include multi-column dashboard grid in `Home.jsx`, side-by-side conversation sidebar in `AIChat.jsx`, structured spreadsheet tables in `DairyManager.jsx`, and a keyboard-driven `DesktopCommandPalette.jsx` in `DesktopHeader.jsx`.

**Tech Stack:** React 18, Vite, Lucide React, Vitest.

**Spec:** User directive: "ok do it 1 option and then 2" with constraint "sudhu dextop ar design taa change hobe mobile phone ar view ta same thakbe".

## Global Constraints

- **Mobile View Isolation:** Every screen modified MUST check `if (!isDesktop)` or conditionally render mobile JSX without changing classes or existing mobile styles.
- **Indic Script Purity:** Zero mixed-script strings; `npm run check:scripts` must pass with 0 errors.
- **Bundle Budget:** Initial JS bundle $\le 492\text{ KB}$ (`npm run check:bundle`).
- **Code Quality:** ESLint must pass with 0 errors (`npm run lint`).
- **Function Limit:** Serverless functions $\le 12$ on Vercel Hobby tier.

## Review Focus

1. **Mobile Experience Invariance:** Mobile viewport (< 768px) must render exact same markup, cards, bottom nav, and padding.
2. **Keyboard Accessibility (`Ctrl+K` / `Esc` / Arrows):** Command palette must open on `Ctrl+K` / `Cmd+K`, trap focus, navigate with ArrowUp/Down, submit on Enter, and dismiss cleanly on Esc.
3. **Empty & Error States in Desktop Tables:** Tables in `DairyManager` must handle 0 records gracefully with empty hints.
4. **Desktop AI Chat Responsiveness:** Conversation history sidebar in `AIChat` must update live when new messages/conversations are created or deleted.
5. **No SSR/Hydration Flashes:** Media queries must resolve safely with default fallbacks.

---

## Detailed Task Breakdown

### Task 1: Command Palette Component & Keyboard Hook (Option 2 Core)
**Files:**
- Create: `src/navigation/DesktopCommandPalette.jsx`
- Create: `src/navigation/__tests__/DesktopCommandPalette.test.js`
- Modify: `src/navigation/DesktopHeader.jsx`

**Step-by-step:**
- [x] Create `src/navigation/DesktopCommandPalette.jsx`:
  - Backdrop modal with blur and dark overlay.
  - Search input with auto-focus.
  - Search algorithm across quick actions, navigation screens, and AI specialists.
  - Keyboard handlers: `Escape` closes, `ArrowDown`/`ArrowUp` navigates list, `Enter` executes action.
  - Multilingual items (English, Hindi, Bengali) with clean category headers ("Navigation", "AI Specialists", "Quick Actions").
- [x] Write unit test in `src/navigation/__tests__/DesktopCommandPalette.test.js` (5/5 tests passing).
- [x] Connect `DesktopHeader.jsx` to open the modal on click or global `keydown` (`Ctrl+K` / `Cmd+K`).
- [x] Verify ESLint and test suite.

---

### Task 2: Multi-Column Dashboard Grid for Desktop (`Home.jsx` - Option 1)
**Files:**
- Modify: `src/pages/Home.jsx`
- Test: Vitest / `npm run check:bundle`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/Home.jsx`.
- [x] For `!isDesktop` (mobile): Return existing mobile layout unchanged.
- [x] For `isDesktop`:
  - Render top greeting & weather summary in wide desktop banner.
  - Render 2-column fluid grid (`display: grid, gridTemplateColumns: "1fr 380px", gap: 24`):
    - Left Column: "Today at a glance" (3-4 wide metric cards), "Needs attention" alerts panel, "Quick actions" grid, and "My farm" services grid.
    - Right Column: "Farm Space" collaborative card, "AI Farm Assistant" interactive card, and eligible government schemes.
- [x] Verify script purity (0 errors) and bundle budget.

---

### Task 3: 2-Column AI Workspace for Desktop (`AIChat.jsx` - Option 1)
**Files:**
- Modify: `src/pages/AIChat.jsx`
- Test: Vitest / `npm test`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/AIChat.jsx`.
- [x] For `!isDesktop` (mobile): Return existing single-column mobile view with BottomSheet unchanged.
- [x] For `isDesktop`:
  - Render side-by-side workspace (`height: calc(100vh - 120px)`):
    - Left Sidebar (`width: 320px`, border-right, background `T.surface2`):
      - "+ New Chat" primary button.
      - Session list from `conversationStore.list()` with timestamps, delete icon, and click to switch session.
    - Right Main Area:
      - Clean top app bar with agent info.
      - Chat message stream with KaTeX/Markdown formatting and suggested prompt chips.
      - Persistent bottom input box with microphone voice STT, camera capture, input field, and send button.
- [x] Verify smooth message streaming and empty states.

---

### Task 4: Spreadsheet & Table View for Livestock ERP (`DairyManager.jsx` - Option 1)
**Files:**
- Modify: `src/pages/livestock/DairyManager.jsx`
- Test: Vitest / `npm test`

**Step-by-step:**
- [x] Import `useResponsive` in `src/pages/livestock/DairyManager.jsx`.
- [x] For `!isDesktop` (mobile): Return existing cards layout unchanged.
- [x] For `isDesktop`:
  - Animals tab: Structured table with columns (Tag #, Name, Animal Type, Breed, Lactation Status, Actions).
  - Milk Log tab: Structured table with columns (Date, Morning AM, Evening PM, Total Litres, Rate ₹/L, Total Amount ₹, Actions).
  - Events tab: Structured table with columns (Date, Event Type, Animal, Notes, Actions).
- [x] Verify table styling, hover rows, and deletion modal.

---

### Task 5: Full Verification, Bundle Check & Deployment
**Files:**
- Modify: `package.json` (if needed)
- Script verification: `npm run check:scripts`, `npm run lint`, `npm run check:bundle`, `npm test`

**Step-by-step:**
- [x] Run `npm run check:scripts` to confirm 0 Indic mixed-script errors.
- [x] Run `npm run lint` to confirm 0 ESLint errors.
- [x] Run `npm run check:bundle` to confirm initial JS $\le 492\text{ KB}$ (Achieved: 439.4 KB).
- [x] Run test suite `npm test` (39/39 passing).
- [x] Commit all changes with descriptive conventional commit (`7c40cd6`).
- [x] Push to `origin/main` and verify GitHub Actions CI (`42989146028` passed) and Vercel Deploy (`42989556742` passed).
- [x] Run `npm run test:smoke` to verify live production health (13/13 passed).
