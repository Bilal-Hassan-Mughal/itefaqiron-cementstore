# Labour Charges Test Case - Complete Flow Debugging

## Overview
This document provides a step-by-step test case to verify labour charges are working correctly throughout the system.

## Test Scenario: Create Order with Labour Charges

### Step 1: Create New Order with Labour Charges = 1000
**What to do:**
1. Go to Sales page
2. Select a customer (e.g., "Sample Customer")
3. Select a store
4. Add a product (e.g., "Pure Iron" - qty: 50, rate: 90)
5. **Enter Labour Charges: `1000`** ← KEY STEP
6. Enter Delivery Charges: `500` (optional)
7. Click "Save Bill"

### Step 2: Check Browser Console Logs (F12)

**Look for these logs in order:**

#### A. When you ENTER labour in the form field:
```
🔧 LABOUR FIELD CHANGED: "1000" (type: string)
📝 paymentData.labour updated to: "1000"
```
✅ If you see this → Labour is being captured in the form
❌ If NOT → Problem is in the form input field

#### B. When you CLICK "Save Bill":
```
============================================================
🔧 LABOUR CHARGES DEBUG - BEFORE CREATING SALE DATA:
============================================================
Payment Data: {labour: "1000", ...other fields}
paymentData.labour value: "1000"
paymentData.labour type: string
paymentData.labour is empty/0: false
parseFloat(paymentData.labour) result: 1000
parseFloat(paymentData.labour) || 0 result: 1000
============================================================
```
✅ If you see `1000` → Labour is in paymentData (frontend is working)
❌ If you see empty or `0` → User didn't enter labour value

#### C. After Sale Data Creation:
```
============================================================
🔧 LABOUR CHARGES DEBUG - AFTER CREATING SALE DATA:
============================================================
saleData object keys: [... 'labour_charges' ...]
saleData.labour_charges: 1000
saleData.labour_charges type: number
============================================================
```
✅ If you see `labour_charges: 1000` → Frontend object is correct
❌ If missing → There's a code issue

#### D. Final JSON being sent:
```
🔍 Frontend - Sale data JSON: {
  ...
  "labour_charges": 1000,  ← MUST SEE THIS
  "shipping_amount": 500,
  ...
}
```
✅ If `labour_charges` is in JSON → Frontend is sending correctly
❌ If missing → JSON stringify issue

### Step 3: Check Backend API (Server Console)

After you save, check the **server logs** for:

```
POST /api/sales - Status 200
...
📊 CREATING LEDGER ENTRIES IN DATABASE
   Total entries to create: 2
   Entry 1: Customer=42, Debit=6500, Credit=0, Details=Order - ORDER - Customer Account (Debit)
   Entry 2: Customer=42, Debit=0, Credit=3000, Details=Payment Received - ORDER - Customer Account (Credit)
```

✅ If debit amount = 6500 (6000 total + 500 shipping - no discount) → Backend working
❌ If different → Check backend calculation

### Step 4: Check Database

Run this query in MySQL:
```sql
SELECT sale_id, cus_id, total_amount, labour_charges, shipping_amount, discount
FROM sales 
WHERE sale_id = [YOUR_SALE_ID]
ORDER BY sale_id DESC LIMIT 1;
```

Expected result:
```
| sale_id | cus_id | total_amount | labour_charges | shipping_amount | discount |
|---------|--------|--------------|----------------|-----------------|----------|
| 191     | 42     | 6000         | 1000           | 500             | 500      |
```

✅ If `labour_charges = 1000` → Database saving correctly
❌ If `labour_charges = 0` → Labour not being sent or processed

### Step 5: Load Order Back

1. Click "Load Order"
2. Search and select the order you just created (ID: 191)
3. Check the logs

#### What should happen:

**In console, you should see:**
```
📦 Loaded Order: {sale_id: 191, labour_charges: 1000, ...}
🔍 ORDER DETAILS:
  Labour Charges: 1000
```

**In the form:**
- Labour Charges field should show: **`1000`** (not empty, not 0)

✅ If labour shows `1000` → Full cycle working!
❌ If labour shows `0` or empty → Loading logic is wrong

---

## Debugging Checklist

Use this checklist to identify where the problem is:

- [ ] When I enter labour `1000`, does console show "LABOUR FIELD CHANGED"?
  - YES → Continue to next
  - NO → Problem in form input

- [ ] When I click Save, does "LABOUR CHARGES DEBUG - BEFORE" show `1000`?
  - YES → Continue to next
  - NO → paymentData not being updated (form issue)

- [ ] Does "LABOUR CHARGES DEBUG - AFTER" show `labour_charges: 1000`?
  - YES → Continue to next
  - NO → Object creation issue

- [ ] Does final JSON show `"labour_charges": 1000`?
  - YES → Continue to next
  - NO → JSON stringify stripping it

- [ ] Does database show `labour_charges = 1000`?
  - YES → Continue to next
  - NO → Backend not saving

- [ ] When loading order, does it show labour `1000`?
  - YES → ✅ All working!
  - NO → Loading logic issue

---

## Expected Values Breakdown

**When creating order with:**
- Product: 4500
- Labour: 1000  ← USER ENTERS THIS
- Delivery: 500
- Discount: 500
- Cash: 1000
- Bank: 2000
- Advance: 3000

**Frontend should calculate:**
- `grandTotal = 4500 + 1000 + 500 - 500 = 5500`
- `labour_charges = 1000`
- `totalPaymentReceived = 1000 + 2000 = 3000`
- `totalCashReceived = 1000 + 2000 = 3000` (not including advance)
- `advancePayment = 3000`

**Backend should create ledger:**
- Bill debit entry: 5500 (customer owes)
- Payment credit entry: 6000 (cash+bank+advance)
- Result: Customer balance updated to -500 (over-paid)

---

## How to Share Logs for Debugging

When reporting an issue, please share:

1. **Browser console logs** (F12 → Console → right-click → Save as)
2. **Server console logs** at time of order creation
3. **Database query result** from the SELECT above
4. **What you entered** for each field
5. **What you expected** vs **what you got**

Example:
```
ENTERED:
- Customer: Sample Customer
- Labour: 1000
- Delivery: 500
- Cash: 1000
- Bank: 2000

EXPECTED:
- Database should show labour_charges = 1000

ACTUAL:
- Database shows labour_charges = 0

LOGS:
[paste browser and server logs here]
```
