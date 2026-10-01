# HR & Employee System (professional module)

All HR code lives under `src/app/dashboard/hr/` plus HR APIs. Other modules (sales, purchases, etc.) are not modified except cash/bank postings from employee money flows.

## System map

```
HR Hub (page.js)
  └── HrActiveModule + HrModuleLayout
        ├── Employee Register     → account opening + ledger sync
        ├── Attendance Sheet      → payroll inputs
        ├── Salary Sheet          → monthly calc
        ├── Salary Clearance      → pay + ledger + A5 receipt
        ├── Salary Receipt        → re-print A5
        ├── Salary Advance        → cash/bank out + ledger debit
        ├── Employee Ledger       → running balance (general-ledger style)
        └── Receive Payment       → cash/bank in + ledger credit
```

## Shared building blocks

| Piece | Path |
|--------|------|
| Layout wrapper | `components/layout/HrModuleLayout.js` |
| Stat cards | `components/shared/HrStatCard.js` |
| Form sections | `components/shared/HrFormSectionCard.js` |
| Balance chip | `components/shared/EmployeeBalanceChip.js` |
| Field styles | `components/shared/hrUiShared.js` |
| Register form | `components/employees/*` |
| Employee list hook | `hooks/useHrEmployees.js` |
| Dropdown hook | `hooks/useHrEmployeeOptions.js` |
| Cross-tab refresh | `context/HrRefreshContext.js` |
| Ledger engine | `@/lib/employee-ledger.js` |
| A5 receipt spec | `lib/salary-receipt-a5-spec.js` |
| Balance copy (UI) | `lib/hr-employee-balance-copy.js` |
| Clearance plain copy | `lib/hr-clearance-plain-summary.js` |
| Pay salary list | `components/salary/SalaryClearancePanel.js` (cards — not the wide sheet table) |
| Pay salary dialog | `components/salary/SalaryClearanceDialog.js` (+ Summary, Adjustments, Payment) |

## Employee account

1. **Register** — `opening_balance` on `employees` + `OPENING` in `employee_ledger`.
2. **Sign** — Positive closing = employee owes; negative = company owes.
3. **Flows** — Advance (debit), receive (credit), clearance (recovery + pay), payroll entries.
4. **UI** — Register list shows opening + live `ledger_balance`; links to ledger tab.

## Performance (fast fetch & save)

- **Register save:** optimistic row update; no full list refetch (`invalidateEmployeeRegisterSave`).
- **Attendance save:** bulk prefetch + `deleteMany` / `createMany` / parallel updates (not one query per cell).
- **Attendance load:** 50 employees per page; scroll to load more.
- **Dropdowns:** `register&dropdown=true` — small payload.

## Performance (lazy load)

- **Register tab:** `/api/employees?register=true&limit=40&offset=0` + `stats=true` (header cards without full list). Scroll table → next page.
- **Dropdowns (advance / receive):** `register=true&dropdown=true` — minimal fields only.
- **Ledger tab:** `employee-ledger?summary=true&limit=40` + `stats=true`; transactions default `limit=200` with scroll load-more.
- **Tabs:** `HrActiveModule` code-splits each HR module; requests use `cache: 'no-store'` and abort on filter change.
- **Salary / payroll:** one `payroll?calculate=true` call per month (removed duplicate full `/api/employees` fetch).

Legacy: omit `limit` on register or summary → full JSON array (unchanged for any external callers).

## Refresh (no full page reload)

- `invalidateEmployeeData()` — register, ledger, payroll, attendance, advances
- `invalidatePayrollFlow()` — salary, clearance, advances
- `invalidateMoneyFromEmployee()` — receive, receipts, ledger

## Phase status

### Done

- [x] Professional register form (full-width fields, sections)
- [x] Register list + stats + ledger link
- [x] Optimistic save + background refresh
- [x] Opening → ledger API sync
- [x] `useHrEmployeeOptions` for money tabs (register API + balances)
- [x] Salary advance & receive — `HrStatCard`, `HrFormSectionCard`, ledger links
- [x] Salary clearance — **plain-language “Pay salary” dialog** (component-based, no ledger jargon), optional adjustments accordion, auto A5 receipt
- [x] A5 bilingual salary receipt (print / PDF / WhatsApp)
- [x] Hub header on all modules (including employee ledger)
- [x] `HrModuleLayout` on every tab

### UX principle (clearance & money tabs)

Use **shop-owner language**: “Pay salary”, “Ready to pay”, “Old advance / balance”, “Total to pay now” — not ledger formulas, signed balances, or “clearance” in primary actions.

### Follow-up (optional)

- [ ] Extract `salary-payslip-render.js` from `SalaryTab.js`
- [ ] Split `EmployeeLedgerTab.js` into subcomponents

## Salary clearance → A5 receipt

After **Confirm & pay salary**, the app opens the A5 preview automatically. User can **Print A5**, **Download PDF**, or **WhatsApp**. Spec: `lib/salary-receipt-a5-spec.js`.
