import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


// Helper to parse dates in Pakistan Standard Time (UTC+5)
function parseLocalDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return null;
  const tzOffset = '+05:00';
  return {
    gte: new Date(`${startDateStr}T00:00:00.000${tzOffset}`),
    lte: new Date(`${endDateStr}T23:59:59.999${tzOffset}`)
  };
}


// GET - Fetch different types of reports
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const customerId = searchParams.get('customerId') ? parseInt(searchParams.get('customerId')) : null;

    switch (reportType) {
      case 'sales-by-date':
        return await getSalesByDateReport(startDate, endDate);

      case 'sales-by-customer':
        return await getSalesByCustomerReport(startDate, endDate);

      case 'customers-balance':
        return await getCustomersBalanceReport();

      case 'customer-ledger':
        return await getCustomerLedgerReport(customerId, startDate, endDate);

      case 'purchases-by-date':
        return await getPurchasesByDateReport(startDate, endDate);

      case 'purchases-by-supplier':
        return await getPurchasesBySupplierReport(startDate, endDate);

      case 'expenses-by-date':
        return await getExpensesByDateReport(startDate, endDate);

      case 'cash-report':
        return await getCashReport(startDate, endDate);

      case 'bank-report':
        return await getBankReport(startDate, endDate);

      case 'order-report':
        return await getOrderReport(startDate, endDate);

      case 'stock-report':
        return await getStockReport();

      case 'sale-report':
        return await getSaleReport(startDate, endDate);

      case 'profit-report':
        return await getProfitReport(startDate, endDate);

      case 'purchase-report':
        return await getPurchaseReport(startDate, endDate);

      case 'balance-sheet':
        return await getBalanceSheet();

      case 'supplier-ledger':
        const supplierId = searchParams.get('supplierId') ? parseInt(searchParams.get('supplierId')) : null;
        return await getCustomerLedgerReport(supplierId, startDate, endDate, true);

      case 'rebate-report':
        const rebateSupplierId = searchParams.get('supplierId') ? parseInt(searchParams.get('supplierId')) : null;
        return await getRebateReport(rebateSupplierId, startDate, endDate);

      case 'customer-balance-report':
        return await getDetailedCustomerBalanceReport();

      case 'item-sale-report':
        const proId = searchParams.get('proId') ? parseInt(searchParams.get('proId')) : null;
        return await getItemSaleReport(startDate, endDate, proId);

      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}

// Detailed Customers Balance Report with Last Activity
async function getDetailedCustomerBalanceReport() {
  const customers = await prisma.customer.findMany({
    include: {
      customer_category: true,
      customer_type: true,
      city: true,
      ledger: {
        orderBy: {
          created_at: 'desc'
        },
        take: 1,
        select: {
          created_at: true
        }
      }
    },
    orderBy: {
      cus_name: 'asc'
    }
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

// Sales Report by Date Range
async function getSalesByDateReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      sale_details: {
        include: {
          product: {
            include: {
              category: true,
              sub_category: true
            }
          }
        }
      },
      loader: true,
      updated_by_user: {
        select: {
          full_name: true,
          role: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Calculate summary
  const summary = {
    totalSales: sales.length,
    totalAmount: sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0),
    totalDiscount: sales.reduce((sum, s) => sum + parseFloat(s.discount), 0),
    totalShipping: sales.reduce((sum, s) => sum + parseFloat(s.shipping_amount || 0), 0),
    totalPayment: sales.reduce((sum, s) => sum + parseFloat(s.payment), 0),
    netTotal: sales.reduce((sum, s) =>
      sum + parseFloat(s.total_amount) - parseFloat(s.discount) + parseFloat(s.shipping_amount || 0), 0
    )
  };

  return NextResponse.json({ sales, summary });
}

// Sales Report by Customer
async function getSalesByCustomerReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      sale_details: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Group by customer
  const customerSales = {};

  sales.forEach(sale => {
    const cusId = sale.cus_id;
    if (!customerSales[cusId]) {
      customerSales[cusId] = {
        customer: sale.customer,
        sales: [],
        totalAmount: 0,
        totalDiscount: 0,
        totalShipping: 0,
        totalPayment: 0,
        netTotal: 0,
        salesCount: 0
      };
    }

    customerSales[cusId].sales.push(sale);
    customerSales[cusId].totalAmount += parseFloat(sale.total_amount);
    customerSales[cusId].totalDiscount += parseFloat(sale.discount);
    customerSales[cusId].totalShipping += parseFloat(sale.shipping_amount || 0);
    customerSales[cusId].totalPayment += parseFloat(sale.payment);
    customerSales[cusId].netTotal += parseFloat(sale.total_amount) - parseFloat(sale.discount) + parseFloat(sale.shipping_amount || 0);
    customerSales[cusId].salesCount++;
  });

  const reportData = Object.values(customerSales);

  // Calculate overall summary
  const summary = {
    totalCustomers: reportData.length,
    totalSales: sales.length,
    totalAmount: reportData.reduce((sum, c) => sum + c.totalAmount, 0),
    totalDiscount: reportData.reduce((sum, c) => sum + c.totalDiscount, 0),
    totalShipping: reportData.reduce((sum, c) => sum + c.totalShipping, 0),
    totalPayment: reportData.reduce((sum, c) => sum + c.totalPayment, 0),
    netTotal: reportData.reduce((sum, c) => sum + c.netTotal, 0)
  };

  return NextResponse.json({ customerSales: reportData, summary });
}

// Customers Balance Report
async function getCustomersBalanceReport() {
  const customers = await prisma.customer.findMany({
    include: {
      customer_category: true,
      customer_type: true,
      city: true
    },
    orderBy: {
      cus_name: 'asc'
    }
  });

  // Calculate summary
  const summary = {
    totalCustomers: customers.length,
    totalBalance: customers.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0),
    creditBalance: customers.reduce((sum, c) => parseFloat(c.cus_balance) > 0 ? sum + parseFloat(c.cus_balance) : sum, 0),
    debitBalance: customers.reduce((sum, c) => parseFloat(c.cus_balance) < 0 ? sum + Math.abs(parseFloat(c.cus_balance)) : sum, 0)
  };

  return NextResponse.json({ customers, summary });
}

// Customer Ledger Report
async function getCustomerLedgerReport(customerId, startDate, endDate, isSupplier = false) {
  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
  }

  const whereClause = { cus_id: customerId };

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const [customer, ledgerEntries] = await Promise.all([
    prisma.customer.findUnique({
      where: { cus_id: customerId },
      include: {
        customer_category: true,
        customer_type: true,
        city: true
      }
    }),
    prisma.ledger.findMany({
      where: whereClause,
      include: {
        updated_by_user: {
          select: {
            full_name: true,
            role: true
          }
        }
      },
      orderBy: [
        { created_at: 'asc' },
        { l_id: 'asc' }
      ]
    })
  ]);

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Calculate summary
  const summary = {
    totalEntries: ledgerEntries.length,
    totalDebit: ledgerEntries.reduce((sum, l) => sum + parseFloat(l.debit_amount), 0),
    totalCredit: ledgerEntries.reduce((sum, l) => sum + parseFloat(l.credit_amount), 0),
    totalPayments: ledgerEntries.reduce((sum, l) => sum + parseFloat(l.payments), 0),
    openingBalance: ledgerEntries.length > 0 ? parseFloat(ledgerEntries[0].opening_balance) : parseFloat(customer.cus_balance),
    closingBalance: ledgerEntries.length > 0 ? parseFloat(ledgerEntries[ledgerEntries.length - 1].closing_balance) : parseFloat(customer.cus_balance)
  };

  const responseData = { ledgerEntries, summary };
  if (isSupplier) {
    responseData.supplier = customer;
  } else {
    responseData.customer = customer;
  }
  return NextResponse.json(responseData);
}

// Purchase Report by Date Range
async function getPurchasesByDateReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      purchase_details: {
        include: {
          product: {
            include: {
              category: true,
              sub_category: true
            }
          }
        }
      },
      updated_by_user: {
        select: {
          full_name: true,
          role: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Calculate summary
  const summary = {
    totalPurchases: purchases.length,
    totalAmount: purchases.reduce((sum, p) => sum + parseFloat(p.total_amount), 0),
    totalUnloading: purchases.reduce((sum, p) => sum + parseFloat(p.unloading_amount), 0),
    totalFare: purchases.reduce((sum, p) => sum + parseFloat(p.fare_amount), 0),
    totalDiscount: purchases.reduce((sum, p) => sum + parseFloat(p.discount), 0),
    netTotal: purchases.reduce((sum, p) => sum + parseFloat(p.net_total), 0),
    totalPayment: purchases.reduce((sum, p) => sum + parseFloat(p.payment), 0)
  };

  return NextResponse.json({ purchases, summary });
}

// Purchase Report by Supplier
async function getPurchasesBySupplierReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      purchase_details: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Group by supplier (customer)
  const supplierPurchases = {};

  purchases.forEach(purchase => {
    const cusId = purchase.cus_id;
    if (!supplierPurchases[cusId]) {
      supplierPurchases[cusId] = {
        supplier: purchase.customer,
        purchases: [],
        totalAmount: 0,
        totalUnloading: 0,
        totalFare: 0,
        totalDiscount: 0,
        netTotal: 0,
        totalPayment: 0,
        purchasesCount: 0
      };
    }

    supplierPurchases[cusId].purchases.push(purchase);
    supplierPurchases[cusId].totalAmount += parseFloat(purchase.total_amount);
    supplierPurchases[cusId].totalUnloading += parseFloat(purchase.unloading_amount);
    supplierPurchases[cusId].totalFare += parseFloat(purchase.fare_amount);
    supplierPurchases[cusId].totalDiscount += parseFloat(purchase.discount);
    supplierPurchases[cusId].netTotal += parseFloat(purchase.net_total);
    supplierPurchases[cusId].totalPayment += parseFloat(purchase.payment);
    supplierPurchases[cusId].purchasesCount++;
  });

  const reportData = Object.values(supplierPurchases);

  // Calculate overall summary
  const summary = {
    totalSuppliers: reportData.length,
    totalPurchases: purchases.length,
    totalAmount: reportData.reduce((sum, s) => sum + s.totalAmount, 0),
    totalUnloading: reportData.reduce((sum, s) => sum + s.totalUnloading, 0),
    totalFare: reportData.reduce((sum, s) => sum + s.totalFare, 0),
    totalDiscount: reportData.reduce((sum, s) => sum + s.totalDiscount, 0),
    netTotal: reportData.reduce((sum, s) => sum + s.netTotal, 0),
    totalPayment: reportData.reduce((sum, s) => sum + s.totalPayment, 0)
  };

  return NextResponse.json({ supplierPurchases: reportData, summary });
}

// Expense Report by Date Range
async function getExpensesByDateReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const expenses = await prisma.expense.findMany({
    where: whereClause,
    include: {
      expense_title: true,
      updated_by_user: {
        select: {
          full_name: true,
          role: true
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Group by expense type
  const expensesByType = {};

  expenses.forEach(expense => {
    const typeId = expense.exp_type;
    const typeName = expense.expense_title?.title || 'Unknown';

    if (!expensesByType[typeId]) {
      expensesByType[typeId] = {
        expenseType: typeName,
        expenses: [],
        totalAmount: 0,
        count: 0
      };
    }

    expensesByType[typeId].expenses.push(expense);
    expensesByType[typeId].totalAmount += parseFloat(expense.exp_amount);
    expensesByType[typeId].count++;
  });

  const reportData = Object.values(expensesByType);

  // Calculate summary
  const summary = {
    totalExpenses: expenses.length,
    totalAmount: expenses.reduce((sum, e) => sum + parseFloat(e.exp_amount), 0),
    totalTypes: reportData.length
  };

  return NextResponse.json({ expenses, expensesByType: reportData, summary });
}

// Cash Report - All cash transactions
async function getCashReport(startDate, endDate) {
  // Find cash categories dynamically
  const cashCategories = await prisma.customerCategory.findMany({
    where: {
      cus_cat_title: { contains: 'cash' }
    }
  });
  const cashCategoryIds = cashCategories.map(c => c.cus_cat_id);

  const dateFilter = (startDate && endDate) ? parseLocalDateRange(startDate, endDate) : null;

  const whereClause = {
    customer: {
      cus_category: { in: cashCategoryIds }
    }
  };

  if (dateFilter) {
    whereClause.created_at = dateFilter;
  }

  const ledgerEntries = await prisma.ledger.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          cus_id: true,
          cus_name: true,
          cus_phone_no: true,
          customer_category: true
        }
      }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  // Re-sort chronologically: created_at ASC → bill_no (numeric) ASC → l_id ASC
  ledgerEntries.sort((a, b) => {
    const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  // Determine exact Opening Balance at start of date range
  let openingBalance = 0;
  if (dateFilter && dateFilter.gte) {
    const lastPriorEntry = await prisma.ledger.findFirst({
      where: {
        customer: { cus_category: { in: cashCategoryIds } },
        created_at: { lt: dateFilter.gte }
      },
      orderBy: [
        { created_at: 'desc' },
        { l_id: 'desc' }
      ]
    });

    if (lastPriorEntry) {
      openingBalance = parseFloat(lastPriorEntry.closing_balance || 0);
    } else if (ledgerEntries.length > 0) {
      openingBalance = parseFloat(ledgerEntries[0].opening_balance || 0);
    }
  } else {
    const firstEntry = await prisma.ledger.findFirst({
      where: { customer: { cus_category: { in: cashCategoryIds } } },
      orderBy: [
        { created_at: 'asc' },
        { l_id: 'asc' }
      ]
    });
    openingBalance = firstEntry ? parseFloat(firstEntry.opening_balance || 0) : 0;
  }

  // Re-calculate running balances for entries in period
  let runningBal = openingBalance;
  if (ledgerEntries.length > 0) {
    for (let i = 0; i < ledgerEntries.length; i++) {
      const e = ledgerEntries[i];
      const debit = parseFloat(e.debit_amount || 0);
      const credit = parseFloat(e.credit_amount || 0);
      e.opening_balance = runningBal;
      runningBal = runningBal + debit - credit;
      e.closing_balance = runningBal;
    }
  }

  // Also get cash sales (exclude ORDER type) for reference
  const salesWhere = { payment_type: 'CASH', bill_type: 'BILL' };
  if (dateFilter) salesWhere.created_at = dateFilter;
  const cashSales = await prisma.sale.findMany({
    where: salesWhere,
    include: { customer: { select: { cus_id: true, cus_name: true, customer_category: true } } },
    orderBy: { created_at: 'asc' }
  });

  // Get cash purchases
  const purchasesWhere = {
    OR: [
      { payment_type: 'CASH' },
      { cash_payment: { gt: 0 } },
      { incity_charges_total: { gt: 0 } },
      { incity_own_labour: { gt: 0 } },
      { incity_own_delivery: { gt: 0 } }
    ]
  };
  if (dateFilter) purchasesWhere.created_at = dateFilter;
  const cashPurchases = await prisma.purchase.findMany({
    where: purchasesWhere,
    include: { customer: { select: { cus_id: true, cus_name: true, customer_category: true } } },
    orderBy: { created_at: 'asc' }
  });

  // Get expenses
  const expensesWhere = {};
  if (dateFilter) expensesWhere.created_at = dateFilter;
  const expenses = await prisma.expense.findMany({
    where: expensesWhere,
    include: { expense_title: true },
    orderBy: { created_at: 'asc' }
  });

  // Exclude memo lines
  const isCashBankMemo = (l) => {
    const det = l.details || '';
    if (!det.includes('no receivable change')) return false;
    const d = parseFloat(l.debit_amount || 0);
    const c = parseFloat(l.credit_amount || 0);
    return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
  };
  const ledgerEntriesForSummary = ledgerEntries.filter((l) => !isCashBankMemo(l));

  const totalLedgerDebit = ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.debit_amount || 0), 0);
  const totalLedgerCredit = ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.credit_amount || 0), 0);

  const summary = {
    openingBalance,
    closingBalance: runningBal,
    totalLedgerEntries: ledgerEntriesForSummary.length,
    totalLedgerDebit,
    totalLedgerCredit,
    totalCashSales: cashSales.reduce((sum, s) => sum + parseFloat(s.payment || 0), 0),
    totalCashPurchases: cashPurchases.reduce((sum, p) => sum + parseFloat(p.cash_payment || (p.payment_type === 'CASH' ? p.payment : 0) || 0), 0),
    totalExpenses: expenses.reduce((sum, e) => sum + parseFloat(e.exp_amount || 0), 0),
    cashIn: totalLedgerDebit,
    cashOut: totalLedgerCredit
  };

  return NextResponse.json({
    ledgerEntries,
    cashSales,
    cashPurchases,
    expenses,
    summary
  });
}

// Bank Report - All bank transactions
async function getBankReport(startDate, endDate) {
  // Find bank categories dynamically
  const bankCategories = await prisma.customerCategory.findMany({
    where: {
      cus_cat_title: { contains: 'bank' }
    }
  });
  const bankCategoryIds = bankCategories.map(c => c.cus_cat_id);

  const whereClause = {
    customer: {
      cus_category: { in: bankCategoryIds }
    }
  };

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const ledgerEntries = await prisma.ledger.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          cus_id: true,
          cus_name: true,
          cus_phone_no: true,
          customer_category: true
        }
      }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  // Get bank sales
  const salesWhere = {
    payment_type: 'BANK_TRANSFER'
  };

  if (startDate && endDate) {
    salesWhere.created_at = parseLocalDateRange(startDate, endDate);
  }

  const bankSales = await prisma.sale.findMany({
    where: salesWhere,
    include: {
      customer: {
        select: {
          cus_id: true,
          cus_name: true,
          customer_category: true
        }
      }
    },
    orderBy: {
      created_at: 'asc'
    }
  });

  // Get bank purchases
  const purchasesWhere = {
    payment_type: 'BANK_TRANSFER'
  };

  if (startDate && endDate) {
    purchasesWhere.created_at = parseLocalDateRange(startDate, endDate);
  }

  const bankPurchases = await prisma.purchase.findMany({
    where: purchasesWhere,
    include: {
      customer: {
        select: {
          cus_id: true,
          cus_name: true,
          customer_category: true
        }
      }
    },
    orderBy: {
      created_at: 'asc'
    }
  });

  const isBankMemo = (l) => {
    const det = l.details || '';
    if (!det.includes('no receivable change')) return false;
    const d = parseFloat(l.debit_amount || 0);
    const c = parseFloat(l.credit_amount || 0);
    return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
  };
  const ledgerEntriesForSummary = ledgerEntries.filter((l) => !isBankMemo(l));

  // Bank account (asset): debit = deposit (in), credit = withdrawal (out)
  const summary = {
    totalLedgerEntries: ledgerEntriesForSummary.length,
    totalLedgerDebit: ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.debit_amount), 0),
    totalLedgerCredit: ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.credit_amount), 0),
    totalBankSales: bankSales.reduce((sum, s) => sum + parseFloat(s.payment), 0),
    totalBankPurchases: bankPurchases.reduce((sum, p) => sum + parseFloat(p.payment), 0),
    bankIn: ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.debit_amount), 0) + bankSales.reduce((sum, s) => sum + parseFloat(s.payment), 0),
    bankOut: ledgerEntriesForSummary.reduce((sum, l) => sum + parseFloat(l.credit_amount), 0) + bankPurchases.reduce((sum, p) => sum + parseFloat(p.payment), 0)
  };

  return NextResponse.json({
    ledgerEntries,
    bankSales,
    bankPurchases,
    summary
  });
}

// Order Report - All orders/quotations
async function getOrderReport(startDate, endDate) {
  const whereClause = {
    bill_type: 'ORDER'
  };

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const orders = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      sale_details: {
        include: {
          product: true
        }
      },
      loader: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Calculate summary
  const summary = {
    totalOrders: orders.length,
    totalAmount: orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0),
    totalDiscount: orders.reduce((sum, o) => sum + parseFloat(o.discount), 0),
    totalShipping: orders.reduce((sum, o) => sum + parseFloat(o.shipping_amount || 0), 0),
    netTotal: orders.reduce((sum, o) =>
      sum + parseFloat(o.total_amount) - parseFloat(o.discount) + parseFloat(o.shipping_amount || 0), 0
    ),
    pendingPayment: orders.reduce((sum, o) => {
      const netTotal = parseFloat(o.total_amount) - parseFloat(o.discount) + parseFloat(o.shipping_amount || 0);
      return sum + (netTotal - parseFloat(o.payment));
    }, 0)
  };

  return NextResponse.json({ orders, summary });
}

// Stock Report - Current stock levels
async function getStockReport() {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      sub_category: true,
      store_stocks: {
        include: {
          store: true
        }
      }
    },
    orderBy: [
      { category: { cat_name: 'asc' } },
      { pro_title: 'asc' }
    ]
  });

  // Group by category
  const stockByCategory = {};

  products.forEach(product => {
    const catName = product.category?.cat_name || 'Uncategorized';
    const catId = product.cat_id;

    // Calculate total stock from all stores for this product
    const totalStockQty = product.store_stocks?.reduce((sum, storeStock) => {
      return sum + (storeStock.stock_quantity || 0);
    }, 0) || 0;

    if (!stockByCategory[catId]) {
      stockByCategory[catId] = {
        categoryId: catId,
        categoryName: catName,
        products: [],
        totalProducts: 0,
        totalStock: 0,
        totalValue: 0
      };
    }

    // Use actual store stock quantity instead of pro_stock_qnty
    const stockValue = totalStockQty * parseFloat(product.pro_cost_price || 0);

    // Add calculated stock quantity to product object
    const productWithStock = {
      ...product,
      actualStockQty: totalStockQty, // Add calculated stock
      pro_stock_qnty: totalStockQty, // Override with actual stock for compatibility
      stockValue
    };

    stockByCategory[catId].products.push(productWithStock);
    stockByCategory[catId].totalProducts++;
    stockByCategory[catId].totalStock += totalStockQty;
    stockByCategory[catId].totalValue += stockValue;
  });

  const reportData = Object.values(stockByCategory);

  // Calculate summary using actual store stock
  const summary = {
    totalProducts: products.length,
    totalCategories: reportData.length,
    totalStock: products.reduce((sum, p) => {
      const actualStock = p.store_stocks?.reduce((storeSum, ss) => storeSum + (ss.stock_quantity || 0), 0) || 0;
      return sum + actualStock;
    }, 0),
    totalStockValue: products.reduce((sum, p) => {
      const actualStock = p.store_stocks?.reduce((storeSum, ss) => storeSum + (ss.stock_quantity || 0), 0) || 0;
      return sum + (actualStock * parseFloat(p.pro_cost_price || 0));
    }, 0),
    lowStockItems: products.filter(p => {
      const actualStock = p.store_stocks?.reduce((storeSum, ss) => storeSum + (ss.stock_quantity || 0), 0) || 0;
      return actualStock < 10 && actualStock > 0;
    }).length,
    outOfStockItems: products.filter(p => {
      const actualStock = p.store_stocks?.reduce((storeSum, ss) => storeSum + (ss.stock_quantity || 0), 0) || 0;
      return actualStock === 0;
    }).length
  };

  return NextResponse.json({ products, stockByCategory: reportData, summary });
}

// Sale Report - Detailed sales report
async function getSaleReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      sale_details: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      },
      loader: true
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Group by payment type
  const salesByPayment = {
    CASH: { sales: [], total: 0, count: 0 },
    BANK_TRANSFER: { sales: [], total: 0, count: 0 },
    CHEQUE: { sales: [], total: 0, count: 0 },
    SPLIT: { sales: [], total: 0, count: 0 }
  };

  sales.forEach(sale => {
    let paymentType = sale.payment_type;

    // Handle split payments (when both cash and bank payments exist)
    if ((sale.cash_payment > 0 && sale.bank_payment > 0) || sale.split_payments?.length > 0) {
      paymentType = 'SPLIT';
    }

    if (salesByPayment[paymentType]) {
      salesByPayment[paymentType].sales.push(sale);
      salesByPayment[paymentType].total += parseFloat(sale.total_amount);
      salesByPayment[paymentType].count++;
    }
  });

  // Calculate summary
  const summary = {
    totalSales: sales.length,
    totalAmount: sales.reduce((sum, s) => sum + parseFloat(s.total_amount), 0),
    totalDiscount: sales.reduce((sum, s) => sum + parseFloat(s.discount), 0),
    totalShipping: sales.reduce((sum, s) => sum + parseFloat(s.shipping_amount || 0), 0),
    netTotal: sales.reduce((sum, s) =>
      sum + parseFloat(s.total_amount) - parseFloat(s.discount) + parseFloat(s.shipping_amount || 0), 0
    ),
    totalReceived: sales.reduce((sum, s) => sum + parseFloat(s.payment), 0),
    cashSales: salesByPayment.CASH.total,
    bankSales: salesByPayment.BANK_TRANSFER.total,
    chequeSales: salesByPayment.CHEQUE.total,
    splitSales: salesByPayment.SPLIT.total
  };

  return NextResponse.json({ sales, salesByPayment, summary });
}

// Profit Report - Calculate profit from sales
async function getProfitReport(startDate, endDate) {
  const whereClause = {
    bill_type: 'BILL'
  };

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      sale_details: {
        include: {
          product: {
            include: {
              category: true,
              sub_category: true
            }
          }
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Calculate profit for each sale
  const salesWithProfit = sales.map(sale => {
    let totalCost = 0;
    let totalSale = 0;

    sale.sale_details.forEach(detail => {
      const qnty = parseFloat(detail.qnty || 0);
      const costPrice = parseFloat(detail.product?.pro_cost_price || detail.product?.pro_crate || detail.product?.pro_baser_price || 0);
      const saleAmount = parseFloat(detail.net_total || detail.total_amount || 0);
      totalCost += costPrice * qnty;
      totalSale += saleAmount;
    });

    const profit = totalSale - totalCost - parseFloat(sale.discount || 0);
    const profitMargin = totalSale > 0 ? (profit / totalSale * 100) : 0;

    return {
      ...sale,
      totalCost,
      totalSale,
      profit,
      profitMargin
    };
  });

  // Get expenses for the period
  const expensesWhere = {};
  if (startDate && endDate) {
    expensesWhere.created_at = parseLocalDateRange(startDate, endDate);
  }

  const expenses = await prisma.expense.findMany({
    where: expensesWhere
  });

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.exp_amount), 0);

  // Calculate summary
  const totalSales = salesWithProfit.reduce((sum, s) => sum + s.totalSale, 0);
  const totalCost = salesWithProfit.reduce((sum, s) => sum + s.totalCost, 0);
  const totalDiscount = salesWithProfit.reduce((sum, s) => sum + parseFloat(s.discount), 0);
  const grossProfit = totalSales - totalCost - totalDiscount;
  const netProfit = grossProfit - totalExpenses;

  const summary = {
    totalSales,
    totalCost,
    totalDiscount,
    grossProfit,
    totalExpenses,
    netProfit,
    profitMargin: totalSales > 0 ? (grossProfit / totalSales * 100) : 0,
    netProfitMargin: totalSales > 0 ? (netProfit / totalSales * 100) : 0
  };

  return NextResponse.json({ sales: salesWithProfit, expenses, summary });
}

// Purchase Report - Detailed purchases report
async function getPurchaseReport(startDate, endDate) {
  const whereClause = {};

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    include: {
      customer: {
        include: {
          customer_category: true
        }
      },
      purchase_details: {
        include: {
          product: {
            include: {
              category: true
            }
          }
        }
      }
    },
    orderBy: {
      created_at: 'desc'
    }
  });

  // Group by payment type
  const purchasesByPayment = {
    CASH: { purchases: [], total: 0, count: 0 },
    BANK_TRANSFER: { purchases: [], total: 0, count: 0 },
    CHEQUE: { purchases: [], total: 0, count: 0 },
    ON_CREDIT: { purchases: [], total: 0, count: 0 },
    SPLIT: { purchases: [], total: 0, count: 0 }
  };

  purchases.forEach(purchase => {
    const paymentType = purchase.payment_type;
    if (purchasesByPayment[paymentType]) {
      purchasesByPayment[paymentType].purchases.push(purchase);
      purchasesByPayment[paymentType].total += parseFloat(purchase.net_total);
      purchasesByPayment[paymentType].count++;
    }
  });

  // Calculate summary
  const summary = {
    totalPurchases: purchases.length,
    totalAmount: purchases.reduce((sum, p) => sum + parseFloat(p.total_amount), 0),
    totalUnloading: purchases.reduce((sum, p) => sum + parseFloat(p.unloading_amount), 0),
    totalFare: purchases.reduce((sum, p) => sum + parseFloat(p.fare_amount), 0),
    totalDiscount: purchases.reduce((sum, p) => sum + parseFloat(p.discount), 0),
    netTotal: purchases.reduce((sum, p) => sum + parseFloat(p.net_total), 0),
    totalPaid: purchases.reduce((sum, p) => sum + parseFloat(p.payment), 0),
    cashPurchases: purchasesByPayment.CASH.total,
    bankPurchases: purchasesByPayment.BANK_TRANSFER.total,
    creditPurchases: purchasesByPayment.ON_CREDIT.total
  };

  return NextResponse.json({ purchases, purchasesByPayment, summary });
}

// Balance Sheet - Overall financial position
async function getBalanceSheet() {
  // Get all customers with their balances
  const customers = await prisma.customer.findMany({
    include: {
      customer_category: true
    },
    orderBy: {
      cus_name: 'asc'
    }
  });

  // Calculate receivables and payables
  const receivables = customers.filter(c => parseFloat(c.cus_balance) > 0);
  const payables = customers.filter(c => parseFloat(c.cus_balance) < 0);

  // Get stock value
  const products = await prisma.product.findMany();
  const stockValue = products.reduce((sum, p) => sum + (p.pro_stock_qnty * parseFloat(p.pro_cost_price)), 0);

  // Get total sales
  const totalSales = await prisma.sale.aggregate({
    _sum: {
      total_amount: true,
      payment: true
    }
  });

  // Get total purchases
  const totalPurchases = await prisma.purchase.aggregate({
    _sum: {
      net_total: true,
      payment: true
    }
  });

  // Get total expenses
  const totalExpenses = await prisma.expense.aggregate({
    _sum: {
      exp_amount: true
    }
  });

  const summary = {
    // Assets
    totalReceivables: receivables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0),
    receivablesCount: receivables.length,
    stockValue,
    totalAssets: receivables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0) + stockValue,

    // Liabilities
    totalPayables: Math.abs(payables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0)),
    payablesCount: payables.length,
    totalLiabilities: Math.abs(payables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0)),

    // Income Statement
    totalSalesAmount: parseFloat(totalSales._sum.total_amount || 0),
    totalSalesReceived: parseFloat(totalSales._sum.payment || 0),
    totalPurchaseAmount: parseFloat(totalPurchases._sum.net_total || 0),
    totalPurchasePaid: parseFloat(totalPurchases._sum.payment || 0),
    totalExpensesAmount: parseFloat(totalExpenses._sum.exp_amount || 0),

    // Net Worth
    netWorth: (receivables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0) + stockValue) -
      Math.abs(payables.reduce((sum, c) => sum + parseFloat(c.cus_balance), 0))
  };

  return NextResponse.json({ receivables, payables, products, summary });
}

// Rebate Report - Detailed products purchased from a supplier
async function getRebateReport(supplierId, startDate, endDate) {
  if (!supplierId) {
    return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 });
  }

  const whereClause = {
    cus_id: supplierId,
  };

  if (startDate && endDate) {
    whereClause.created_at = parseLocalDateRange(startDate, endDate);
  }

  const [supplier, purchases] = await Promise.all([
    prisma.customer.findUnique({
      where: { cus_id: supplierId },
      include: {
        customer_category: true
      }
    }),
    prisma.purchase.findMany({
      where: whereClause,
      include: {
        purchase_details: {
          include: {
            product: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    })
  ]);

  if (!supplier) {
    return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }

  // Aggregate by product
  const productSummary = {};
  purchases.forEach(purchase => {
    purchase.purchase_details.forEach(detail => {
      const proId = detail.pro_id;
      if (!productSummary[proId]) {
        productSummary[proId] = {
          pro_id: proId,
          pro_title: detail.product?.pro_title || 'N/A',
          total_quantity: 0,
          total_amount: 0,
          purchase_count: 0,
          unit: detail.unit
        };
      }
      productSummary[proId].total_quantity += parseFloat(detail.qnty);
      productSummary[proId].total_amount += parseFloat(detail.net_total);
      productSummary[proId].purchase_count++;
    });
  });

  const products = Object.values(productSummary).map(p => ({
    ...p,
    avg_rate: p.total_quantity > 0 ? p.total_amount / p.total_quantity : 0
  }));

  const summary = {
    totalQuantity: products.reduce((sum, p) => sum + p.total_quantity, 0),
    totalAmount: products.reduce((sum, p) => sum + p.total_amount, 0),
    productCount: products.length,
    purchaseCount: purchases.length,
    supplierName: supplier.cus_name
  };

  return NextResponse.json({ supplier, products, summary });
}

// Item Sale Report — product accounts style with running balance
async function getItemSaleReport(startDate, endDate, proId) {
  const products = await prisma.product.findMany({
    select: { pro_id: true, pro_title: true, pro_stock_qnty: true },
    orderBy: { pro_title: 'asc' }
  });

  if (!proId) {
    return NextResponse.json({ products, details: [] });
  }

  const product = await prisma.product.findUnique({
    where: { pro_id: proId },
    select: { pro_id: true, pro_title: true, pro_stock_qnty: true }
  });

  const dateFilter = startDate && endDate ? parseLocalDateRange(startDate, endDate) : undefined;

  // Identify purchase IDs that are actually "purchase returns stored in purchases table"
  // (no schema flag — identified via ledger entry details containing 'Purchase Return to')
  const returnLedgerEntries = await prisma.ledger.findMany({
    where: { details: { contains: 'Purchase Return to' } },
    select: { bill_no: true },
    distinct: ['bill_no']
  });
  const returnPurIds = new Set(returnLedgerEntries.map(e => parseInt(e.bill_no)).filter(n => !isNaN(n)));

  // Fetch all 5 transaction types in parallel (including Stock Adjustments)
  // bill_type enum values: BILL (confirmed sale), ORDER (order/sale)
  const [allPurchaseDetails, purchaseReturns, sales, saleReturns, stockAdjustments] = await Promise.all([
    // All purchase details for this product in date range
    prisma.purchaseDetail.findMany({
      where: {
        pro_id: proId,
        ...(dateFilter ? { purchase: { created_at: dateFilter } } : {})
      },
      include: { purchase: { include: { customer: true } } }
    }),
    // Purchase Returns from purchase_returns table
    prisma.purchaseReturnDetail.findMany({
      where: {
        pro_id: proId,
        ...(dateFilter ? { purchase_return: { return_date: dateFilter } } : {})
      },
      include: { purchase_return: { include: { purchase: { include: { customer: true } } } } }
    }),
    // Sales (BILL only — exclude ORDER type)
    prisma.saleDetail.findMany({
      where: {
        pro_id: proId,
        sale: {
          bill_type: 'BILL',
          ...(dateFilter ? { created_at: dateFilter } : {})
        }
      },
      include: { sale: { include: { customer: true } } }
    }),
    // Sale Returns — stored in SaleReturnDetail, not SaleDetail
    prisma.saleReturnDetail.findMany({
      where: {
        pro_id: proId,
        ...(dateFilter ? { sale_return: { created_at: dateFilter } } : {})
      },
      include: { sale_return: { include: { customer: true } } }
    }),
    // Stock Adjustments
    prisma.stockAdjustment.findMany({
      where: {
        pro_id: proId,
        ...(dateFilter ? { created_at: dateFilter } : {})
      },
      include: {
        store: true,
        updated_by_user: true
      }
    })
  ]);

  // Split purchase details into regular purchases vs returns-stored-as-purchases
  const purchases = allPurchaseDetails.filter(d => !returnPurIds.has(d.pur_id));
  const purchaseReturnsFromPurTable = allPurchaseDetails.filter(d => returnPurIds.has(d.pur_id));

  // Build unified rows
  const rows = [];

  purchases.forEach(d => {
    rows.push({
      date: d.purchase?.created_at,
      type: 'PURCHASE',
      refId: d.pur_id,
      accountTitle: d.purchase?.customer?.cus_name || '',
      billNo: d.purchase?.invoice_number ? `INV-${d.purchase.invoice_number}` : `PUR-${d.pur_id}`,
      purchaseQty: parseFloat(d.qnty || 0),
      purchaseReturnQty: 0,
      saleQty: 0,
      orderQty: 0,
      saleReturnQty: 0,
      adjustmentQty: 0,
      amount: parseFloat(d.net_total || 0),
    });
  });

  // Purchase returns from purchase_returns table (PR-xxx)
  purchaseReturns.forEach(d => {
    rows.push({
      date: d.purchase_return?.return_date,
      type: 'PURCHASE_RETURN',
      refId: d.purchase_return?.id,
      accountTitle: d.purchase_return?.purchase?.customer?.cus_name || '',
      billNo: `PR-${d.purchase_return?.id}`,
      purchaseQty: 0,
      purchaseReturnQty: parseFloat(d.return_quantity || 0),
      saleQty: 0,
      orderQty: 0,
      saleReturnQty: 0,
      adjustmentQty: 0,
      amount: parseFloat(d.return_amount || 0),
    });
  });

  // Purchase returns stored in purchases table (identified via ledger)
  purchaseReturnsFromPurTable.forEach(d => {
    rows.push({
      date: d.purchase?.created_at,
      type: 'PURCHASE_RETURN',
      subType: 'PURCHASE_RETURN_AS_PURCHASE', // stored in purchases table, not purchase_returns
      refId: d.pur_id,
      accountTitle: d.purchase?.customer?.cus_name || '',
      billNo: `PUR-${d.pur_id}`,
      purchaseQty: 0,
      purchaseReturnQty: parseFloat(d.qnty || 0),
      saleQty: 0,
      orderQty: 0,
      saleReturnQty: 0,
      adjustmentQty: 0,
      amount: parseFloat(d.net_total || 0),
    });
  });

  // Sale column qty: BILL (confirmed) only; ORDER lines keep stock via orderQty (not shown in Sale col)
  sales.forEach(d => {
    const bt = d.sale?.bill_type;
    const q = parseFloat(d.qnty || 0);
    const isBill = bt === 'BILL';
    rows.push({
      date: d.sale?.created_at,
      type: 'SALE',
      refId: d.sale?.sale_id,
      accountTitle: d.sale?.customer?.cus_name || '',
      billNo: `Bill-${d.sale?.sale_id}`,
      purchaseQty: 0,
      purchaseReturnQty: 0,
      saleQty: isBill ? q : 0,
      orderQty: isBill ? 0 : q,
      saleReturnQty: 0,
      adjustmentQty: 0,
      amount: parseFloat(d.net_total || 0),
    });
  });

  // SaleReturnDetail uses sale_return relation
  saleReturns.forEach(d => {
    rows.push({
      date: d.sale_return?.created_at,
      type: 'SALE_RETURN',
      refId: d.sale_return?.return_id,
      accountTitle: d.sale_return?.customer?.cus_name || '',
      billNo: `SR-${d.sale_return?.return_id}`,
      purchaseQty: 0,
      purchaseReturnQty: 0,
      saleQty: 0,
      orderQty: 0,
      saleReturnQty: parseFloat(d.qnty || 0),
      adjustmentQty: 0,
      amount: parseFloat(d.net_total || 0),
    });
  });

  // Stock Adjustments
  stockAdjustments.forEach(d => {
    rows.push({
      date: d.created_at,
      type: 'ADJUSTMENT',
      refId: d.adjustment_id,
      accountTitle: `Stock Adjustment - ${d.store?.store_name || 'Store'}`,
      billNo: `ADJ-${d.adjustment_id}`,
      purchaseQty: 0,
      purchaseReturnQty: 0,
      saleQty: 0,
      orderQty: 0,
      saleReturnQty: 0,
      adjustmentQty: parseFloat(d.quantity || 0),
      amount: 0,
    });
  });

  // Sort by date ascending
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate CORRECT current stock and opening stock.
  // Strategy: Get current stock from the sum of all store stocks,
  // then calculate opening stock backwards from it using transaction details since startDate.
  const storeStocks = await prisma.storeStock.findMany({
    where: { pro_id: proId }
  });
  const currentStock = storeStocks.reduce((sum, ss) => sum + parseFloat(ss.stock_quantity || 0), 0);

  let openingStock = 0;

  const afterDateStart = new Date(startDate ? `${startDate}T00:00:00.000+05:00` : '1970-01-01T00:00:00.000+05:00');
  const [aggAllPur, aggPurRet, aggSale, aggSaleRet, returnLedgerAfter, aggAdjustment] = await Promise.all([
    prisma.purchaseDetail.aggregate({
      where: { pro_id: proId, purchase: { created_at: { gte: afterDateStart } } },
      _sum: { qnty: true }
    }),
    prisma.purchaseReturnDetail.aggregate({
      where: { pro_id: proId, purchase_return: { return_date: { gte: afterDateStart } } },
      _sum: { return_quantity: true }
    }),
    prisma.saleDetail.aggregate({
      where: { pro_id: proId, sale: { bill_type: 'BILL', created_at: { gte: afterDateStart } } },
      _sum: { qnty: true }
    }),
    prisma.saleReturnDetail.aggregate({
      where: { pro_id: proId, sale_return: { created_at: { gte: afterDateStart } } },
      _sum: { qnty: true }
    }),
    prisma.purchaseDetail.aggregate({
      where: { pro_id: proId, pur_id: { in: returnPurIds.size > 0 ? [...returnPurIds] : [] }, purchase: { created_at: { gte: afterDateStart } } },
      _sum: { qnty: true }
    }),
    prisma.stockAdjustment.aggregate({
      where: { pro_id: proId, created_at: { gte: afterDateStart } },
      _sum: { quantity: true }
    }),
  ]);

  const purRetFromPurTable = parseFloat(returnLedgerAfter._sum.qnty || 0);
  const realPurchases = parseFloat(aggAllPur._sum.qnty || 0) - purRetFromPurTable;
  const adjustmentTotal = parseFloat(aggAdjustment._sum.quantity || 0);
  
  const netChange = realPurchases
    - parseFloat(aggPurRet._sum.return_quantity || 0)
    - purRetFromPurTable
    - parseFloat(aggSale._sum.qnty || 0)
    + parseFloat(aggSaleRet._sum.qnty || 0)
    + adjustmentTotal;
    
  openingStock = currentStock - netChange;

  let totalPurchases = 0, totalPurchaseReturns = 0, totalSales = 0, totalSaleReturns = 0, totalAdjustments = 0;
  rows.forEach(r => {
    totalPurchases += r.purchaseQty;
    totalPurchaseReturns += r.purchaseReturnQty;
    totalSales += r.saleQty;
    totalSaleReturns += r.saleReturnQty;
    totalAdjustments += r.adjustmentQty || 0;
  });

  // Attach preStock and updatedStock to each row
  let running = openingStock;
  const finalRows = rows.map(r => {
    const preStock = running;
    const outSale = r.saleQty || 0;
    running = running + r.purchaseQty - r.purchaseReturnQty - outSale + r.saleReturnQty + (r.adjustmentQty || 0);
    return { ...r, preStock, updatedStock: running };
  });

  return NextResponse.json({
    products,
    details: finalRows,
    openingStock,
    currentStock,
    product,
    totalPurchases,
    totalPurchaseReturns,
    totalSales,
    totalSaleReturns,
    totalAdjustments,
  });
}
