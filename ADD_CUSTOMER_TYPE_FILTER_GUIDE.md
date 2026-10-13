# Add Customer Type Filter to Dashboard Charts

## Objective
Add a **Customer Type Filter** to the "TO RECEIVE" graph/chart on the dashboard so users can view receivable amounts filtered by customer type (Walk-in, Wholesale, Retail, etc.).

---

## Current Architecture

### API Structure
- **File:** `src/app/api/reports/route.js`
- **Current Function:** `getDetailedCustomerBalanceReport()`
- **Current Behavior:** Returns all customers with their closing balances, no filtering

### Frontend Structure
- **File:** `src/app/dashboard/reports/customer-balance-report/page.js`
- **Current State:** Already has category and type filters
- **Chart Location:** The monthly bar chart is likely rendered in the dashboard or a related reports component

---

## Implementation Plan

### Step 1: Enhance the API to Support Customer Type Filtering

**File:** `src/app/api/reports/route.js`

**Change Location:** Line 87 - modify the `customer-balance-report` endpoint call

**Current:**
```javascript
case 'customer-balance-report':
  return await getDetailedCustomerBalanceReport();
```

**New:**
```javascript
case 'customer-balance-report':
  const typeIdFilter = searchParams.get('typeId') ? parseInt(searchParams.get('typeId')) : null;
  const categoryIdFilter = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')) : null;
  return await getDetailedCustomerBalanceReport(typeIdFilter, categoryIdFilter);
```

### Step 2: Update the getDetailedCustomerBalanceReport Function

**Current Function (Lines 103-138):**
```javascript
async function getDetailedCustomerBalanceReport() {
  const customers = await prisma.customer.findMany({
    include: {
      customer_category: true,
      customer_type: true,
      city: true,
      ledger: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { created_at: true }
      }
    },
    orderBy: { cus_name: 'asc' }
  });
  // ... rest of function
}
```

**Updated Function:**
```javascript
async function getDetailedCustomerBalanceReport(typeId = null, categoryId = null) {
  // Build where clause for filtering
  const whereClause = {};
  
  if (typeId) {
    whereClause.cus_type = typeId;
  }
  
  if (categoryId) {
    whereClause.cus_category = categoryId;
  }

  const customers = await prisma.customer.findMany({
    where: whereClause,  // Add filtering
    include: {
      customer_category: true,
      customer_type: true,
      city: true,
      ledger: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: { created_at: true }
      }
    },
    orderBy: { cus_name: 'asc' }
  });

  // Calculate summary
  const summary = {
    totalCustomers: customers.length,
    totalBalance: customers.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0),
    receivable: customers.reduce((sum, c) => parseFloat(c.cus_balance) > 0 ? sum + parseFloat(c.cus_balance) : sum, 0),
    payable: customers.reduce((sum, c) => parseFloat(c.cus_balance) < 0 ? sum + Math.abs(parseFloat(c.cus_balance)) : sum, 0)
  };

  return NextResponse.json({
    customers: customers.map(c => ({
      ...c,
      last_activity: c.ledger && c.ledger.length > 0 ? c.ledger[0].created_at : null
    })),
    summary
  });
}
```

### Step 3: Update Frontend to Add Filter Dropdown

**File:** `src/app/dashboard/reports/customer-balance-report/page.js`

**Location:** Around line 75-80 where the `fetchData` function makes the API call

**Current:**
```javascript
const fetchData = async () => {
  try {
    setLoading(true);
    const [reportRes, typesRes, categoriesRes] = await Promise.all([
      fetch('/api/reports?type=customer-balance-report'),
      fetch('/api/customer-types'),
      fetch('/api/customer-category')
    ]);
    // ...
  }
};
```

**Updated:**
```javascript
const fetchData = async () => {
  try {
    setLoading(true);
    
    // Build query params
    const params = new URLSearchParams('type=customer-balance-report');
    if (selectedType && selectedType !== 'ALL') {
      params.append('typeId', selectedType);
    }
    if (selectedCategory && selectedCategory !== '') {
      params.append('categoryId', selectedCategory);
    }
    
    const [reportRes, typesRes, categoriesRes] = await Promise.all([
      fetch(`/api/reports?${params.toString()}`),
      fetch('/api/customer-types'),
      fetch('/api/customer-category')
    ]);
    // ...
  }
};
```

### Step 4: Add useEffect to Refetch on Filter Change

**Location:** Same file, add new useEffect hook

**Add this code:**
```javascript
// Refetch data when filters change
useEffect(() => {
  if (selectedType || selectedCategory) {
    fetchData();
  }
}, [selectedType, selectedCategory]);
```

---

## Testing the Implementation

### Test 1: Basic Filter by Customer Type
1. Navigate to Customer Balance Report
2. Select a Customer Type from dropdown (e.g., "Wholesale")
3. Verify: Only wholesale customers appear in the list
4. Verify: "TO RECEIVE" amount updates to show only wholesale customer balances

### Test 2: Filter by Category
1. Select a category (e.g., "Customer")
2. Verify: Only customers in that category appear
3. Verify: Amount is recalculated

### Test 3: Combined Filters
1. Select both Category and Type
2. Verify: Both filters work together
3. Verify: Amount is calculated based on both filters

### Test 4: Clear Filters
1. Set filters to "ALL"
2. Verify: All customers appear again
3. Verify: Full amount displayed

---

## API Query Examples

### Example 1: Get all customers
```
GET /api/reports?type=customer-balance-report
```

### Example 2: Filter by customer type (wholesale = ID 2)
```
GET /api/reports?type=customer-balance-report&typeId=2
```

### Example 3: Filter by category (customers = ID 3)
```
GET /api/reports?type=customer-balance-report&categoryId=3
```

### Example 4: Filter by both
```
GET /api/reports?type=customer-balance-report&typeId=2&categoryId=3
```

---

## Expected Results After Implementation

### Before
- Dashboard shows "TO RECEIVE: PKR 95,356,228.87" (all customers combined)
- No way to filter by customer type
- Can't see breakdown by customer type

### After
- Dashboard shows "TO RECEIVE: PKR 95,356,228.87" (default)
- **NEW** Dropdown to select customer type
- When you select "Wholesale": Shows only wholesale customer receivables
- When you select "Retail": Shows only retail customer receivables
- Can combine with category filters for more granular views

---

## Data Flow

```
User selects filter
    ↓
Frontend updates state: setSelectedType(value)
    ↓
useEffect triggers (dependency: selectedType)
    ↓
fetchData() is called
    ↓
API URL includes ?typeId=X
    ↓
API filters customers by type
    ↓
API returns filtered customers
    ↓
Frontend recalculates "TO RECEIVE" amount
    ↓
Chart/display updates to show filtered data
```

---

## Important Notes

✅ **Safe Changes:**
- Only adding filter parameters to existing API
- No data is modified, only filtered
- Backward compatible (if no filter param, shows all data like before)

✅ **Performance:**
- Filtering done in database (efficient)
- No client-side calculations needed
- Same API response structure

✅ **User Experience:**
- Dropdown already exists for filters
- No new UI components needed
- Works with existing filters (category + type)

---

## Files to Modify

| File | Change | Lines | Priority |
|------|--------|-------|----------|
| `src/app/api/reports/route.js` | Add typeId/categoryId params | 85-90 | HIGH |
| `src/app/api/reports/route.js` | Update function signature | 103-120 | HIGH |
| `src/app/dashboard/reports/customer-balance-report/page.js` | Update fetchData | 70-90 | HIGH |
| `src/app/dashboard/reports/customer-balance-report/page.js` | Add useEffect hook | (after line 70) | HIGH |

---

## Summary

This implementation will:
- ✅ Add customer type filtering to the API
- ✅ Update frontend to send filter parameters
- ✅ Refetch data when filters change
- ✅ Display filtered receivable amounts
- ✅ Work with existing category filters
- ✅ Maintain backward compatibility

**Result:** Users can now view "TO RECEIVE" amounts filtered by customer type! 🎉
