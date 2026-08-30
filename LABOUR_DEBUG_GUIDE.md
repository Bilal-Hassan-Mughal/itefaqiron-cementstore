#!/usr/bin/env node

/**
 * Labour Charges Debugging Guide
 * Help trace why labour charges aren't being saved
 */

console.log(`
═══════════════════════════════════════════════════════════════════════════════
🔍 LABOUR CHARGES DEBUG GUIDE
═══════════════════════════════════════════════════════════════════════════════

ISSUE: You enter 1000 in labour field, but API returns labour_charges: 0

TROUBLESHOOTING STEPS:
═══════════════════════════════════════════════════════════════════════════════

STEP 1: Check Browser Console When Creating an Order
────────────────────────────────────────────────────────────────────────────────
When you enter labour charges and hit SAVE, look for these logs:

  ✅ YOU SHOULD SEE:
    🎯 LABOUR FIELD CHANGE EVENT: e.target.value = 1000
    💾 State: 1000  (shown next to labour field)
    🎨 LABOUR FIELD RENDER - paymentData.labour: 1000 parsed as: 1000
    🔍 DEBUG: labourChargesValue: 1000 from paymentData.labour: 1000
    ✅ Labour charges in saleData: 1000
    🔍 Frontend - Sale data JSON:
      {
        ...
        "labour_charges": 1000
        ...
      }
    🔍 API RECEIVED labour_charges: 1000 (type: number)


STEP 2: If You DON'T See The Above Logs
────────────────────────────────────────────────────────────────────────────────
If you don't see "LABOUR FIELD CHANGE EVENT" when typing:
  → The onChange handler is NOT firing
  → Possible cause: Form is not in focus or field is disabled

If you see CHANGE EVENT but "State: (empty)" next to field:
  → handlePaymentDataChange is not updating state
  → Possible cause: State management issue

If "State: 1000" beside field but saleData.labour_charges is 0:
  → The problem is between state and saleData
  → Check if labourChargesValue is being calculated incorrectly


STEP 3: API Debugging
────────────────────────────────────────────────────────────────────────────────
Look at server console for:
  🔍 API RECEIVED labour_charges: [value]

If it shows 0 or undefined but frontend sent 1000:
  → API is not receiving the correct value
  → Check Network tab (F12 → Network) to see actual request body

If it shows 1000 but saved as 0:
  → Issue is in database save logic


STEP 4: Network Inspection
────────────────────────────────────────────────────────────────────────────────
1. Open DevTools (F12)
2. Go to Network tab
3. Create an order with labour charges = 1000
4. Look for POST to /api/sales
5. Click it and check Request body to see if labour_charges is there

Expected Request body:
{
  ...
  "labour_charges": 1000,
  ...
}


═══════════════════════════════════════════════════════════════════════════════
RECENT CHANGES MADE TO FIX THIS ISSUE:
═══════════════════════════════════════════════════════════════════════════════

1. ✅ DATABASE SCHEMA FIX:
   - Changed labour_charges from DECIMAL(10,2) to DOUBLE
   - Changed shipping_amount from DECIMAL to DOUBLE
   - This fixes API response returning 'object' instead of 'number'
   - Status: COMPLETED AND VERIFIED

2. ✅ ADDED CONSOLE LOGGING:
   - Added "💾 State: [value]" display next to labour field
   - Added "🎯 LABOUR FIELD CHANGE EVENT" log when typing
   - Added "🔍 API RECEIVED labour_charges" log in API
   - Status: READY FOR TESTING


═══════════════════════════════════════════════════════════════════════════════
NEXT STEPS:
═══════════════════════════════════════════════════════════════════════════════

1. Reload the app (http://localhost:3000)
2. Go to Sales > New Order
3. Enter an order with labour charges = 1000
4. Check browser console and look for the logs listed in STEP 1
5. Tell me which logs you see and which you don't
6. This will help identify exactly where the issue is


═══════════════════════════════════════════════════════════════════════════════

`);
