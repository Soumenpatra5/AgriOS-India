# Access Roles (RBAC) — M7

## Model

The app is **offline-first and single-user-per-device**, so this is a
**device-local access gate**, not server-enforced multi-user auth. It answers
"who's holding the phone right now": the **Owner** can drop the device into a
restricted role (e.g. hand it to a worker to mark attendance) so sensitive
sections stay hidden. Elevating back to a higher role needs the **Owner PIN**.

> This is the proportionate fix for the audit's M7 ("anyone with the device sees
> every salary and document"). True multi-user roles on shared farm data would
> require a multi-tenant backend the local-first ERP doesn't have — a separate,
> larger project.

### Roles & capability matrix

| Capability | Owner | Manager | Worker |
|---|:--:|:--:|:--:|
| `finance.view` — ledger, P&L, cash flow | ✓ | ✓ | — |
| `team.view` — employee roster/profiles | ✓ | ✓ | ✓ |
| `team.manage` — add/edit/remove employees | ✓ | ✓ | — |
| `salary.view` — wages/salary figures | ✓ | ✓ | — |
| `documents.view` — ID/bank/medical docs | ✓ | ✓ | — |
| `payroll.manage` — payments/advances/bonus | ✓ | ✓ | — |
| `records.delete` — delete farms/employees/ledger | ✓ | — | — |
| `settings.manage` — security/privacy/API keys | ✓ | — | — |

Anything **not** listed is ungated (home, attendance marking, tasks, weather,
mandi prices, AI, diagnostics…) so a worker keeps the day-to-day app. The default
role is **Owner**, so nothing is hidden until someone restricts the device.

## How it's wired

- `src/services/rbac/permissions.js` — roles, the matrix, `can(role, cap)`,
  `requiresPin(...)`. Pure + unit-tested.
- `src/services/rbac/roleService.js` — persists the role; sets/verifies a SHA-256
  hashed Owner PIN; `switchNeedsPin(target)`. Unit-tested.
- `AppStore` exposes `role`, `setRole(role)`, and **`can(cap)`** — gate UI with
  `const { can } = useApp(); {can("salary.view") && <SalaryRow/>}`.
- `src/components/AccessModeCard.jsx` — the switcher (in **Profile**): role chips,
  set/change PIN, PIN-on-elevate.

## Gated

**Finance (`finance.view`)** — Home summary, FarmLedger, Business Dashboard,
P&L Report, Cash Flow (restricted state / hidden).

**Salary (`salary.view`)** — EmployeeDetail (Overview stat + Payments tab),
EmployeeManager (Wages tab, "Wages this month" stat, inline per-day wage).

**Documents (`documents.view`)** — EmployeeDetail Documents tab.

**Team & payroll** — EmployeeManager "Add" (`team.manage`), the "Pay" action
(`payroll.manage`).

**Settings (`settings.manage`)** — API Key Manager / Security / Permissions rows.

**Deletes (`records.delete`)** — employee delete (EmployeeManager), ledger-entry
delete (FarmLedger), farm delete (FarmProfiles).

The reusable `src/components/Restricted.jsx` renders the "limited by access mode"
state for page-level gates. Sensitive tabs/chips are filtered out too, so a
restricted role can't navigate to the gated content.

## Optional further hardening

Lower-risk delete controls (inventory / assets / tasks / CRM contacts) aren't yet
behind `records.delete` — a worker could remove a task or stock item. Each is a
one-line `{can("records.delete") && …}` when wanted. Owner is unaffected
throughout (all `can()` true), so this stays risk-free to extend.
