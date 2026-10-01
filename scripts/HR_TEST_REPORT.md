# HR E2E Test Report (September fixture)

Automated script: `node scripts/hr-september-e2e-test.js --force`

**Warning:** `--force` deletes **all employees** in branch 1 and creates one test employee.

## Fixture employee

| Field | Value |
|--------|--------|
| Name | HR Test Worker (Sep) |
| Join | 2025-08-01 |
| Basic | Rs 30,000 / month (÷ 30 days) |
| Opening balance | Rs 5,000 (employee owes — ledger debit) |
| Allowed leave | 2 / month |
| Allowed absent | 0 |

## September 2025 attendance

| Mark | Days |
|------|------|
| Present | 1–22 (22 days) |
| Leave | 23–24 (2 days) |
| Absent | 25 (1 day, **excess** — not paid) |
| Unmarked | 26–30 (5 days — **no pay, no deduction**) |

### Expected payroll (September)

- Paid days = 22 present + 2 leave = **24** → gross **Rs 24,000**
- Opening recovery (capped to earned) = **Rs 5,000** → net **Rs 19,000**
- No “full month unpaid” attendance deduction line

## October 2025 (nothing marked)

- Gross / net this month = **Rs 0**
- **Previous balance** (if September not paid) = September **net** (Rs 19,000), **not** gross (Rs 24,000) — fixed in payroll API.

## Extra scenarios (same run)

1. **Advance** Rs 8,000 mid-September → ledger **Rs 13,000** (5k + 8k)
2. September net after advance recovery → **Rs 11,000** (24k − 13k)
3. **Receive** Rs 2,000 → ledger **Rs 11,000** (still owes)
4. September net after receive (recovery capped to ledger) → **Rs 13,000** (24k − 11k)
5. October **previous balance** = **Rs 13,000** (unpaid September net), current month **Rs 0**

## Bugs fixed during this test run

1. **Next-month previous balance** used gross (24k) instead of net after ledger recovery — fixed.
2. **Pending payroll row** + **advance/receive** flows could show wrong “last month unpaid” — now recomputed from live ledger.

## Manual UI checklist

Use the employee created by the script (see console `emp_id=`):

1. **Employee Register** — one row, opening + ledger balance
2. **Attendance** — Sep 2025 marks; Oct empty / unmarked
3. **Salary Sheet** — Sep calc matches table above
4. **Pay Salary** — Sep breakdown; Oct zero pay, prev balance correct
5. **Salary Advance** — (already posted by script) visible in ledger
6. **Receive Payment** — (optional second receipt)
7. **Employee Ledger** — newest first; opening, advance, receipt lines; balance numbers only
8. **Pay September** — then Oct should show **prev = 0** if September cleared

## Re-run

```bash
node scripts/hr-september-e2e-test.js --force
```

Requires dev server at `http://127.0.0.1:3000` and valid `.env` DATABASE_URL.
