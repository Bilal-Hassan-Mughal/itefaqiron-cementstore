import prisma from './src/lib/prisma.js';

async function debugLedgerSetup() {
  try {
    console.log('🔍 Checking Ledger Setup...\n');

    // Check categories
    const allCategories = await prisma.customerCategory.findMany();
    console.log('📊 All Customer Categories:');
    allCategories.forEach(c => {
      console.log(`  - ${c.cus_cat_id}: ${c.cus_cat_title}`);
    });

    // Find special account categories
    console.log('\n🔍 Looking for special account categories...');
    const categoryMap = {};
    allCategories.forEach(cat => {
      const lowerTitle = cat.cus_cat_title.toLowerCase();
      if (lowerTitle.includes('cash') && lowerTitle.includes('account')) {
        categoryMap['Cash Account'] = cat.cus_cat_id;
      } else if (lowerTitle.includes('bank') && lowerTitle.includes('account')) {
        categoryMap['Bank Account'] = cat.cus_cat_id;
      } else if (lowerTitle.includes('sundry') && lowerTitle.includes('creditor')) {
        categoryMap['Sundry Creditors'] = cat.cus_cat_id;
      } else if (lowerTitle.includes('sundry') && lowerTitle.includes('debtor')) {
        categoryMap['Sundry Debtors'] = cat.cus_cat_id;
      }
    });

    console.log('📍 Special Account Categories Found:', categoryMap);

    // Find special accounts
    console.log('\n💼 Looking for special accounts...');
    const specialAccounts = await prisma.customer.findMany({
      where: {
        cus_category: {
          in: Object.values(categoryMap)
        }
      }
    });

    console.log(`Found ${specialAccounts.length} special accounts:`);
    specialAccounts.forEach(acc => {
      const category = Object.entries(categoryMap).find(([_, id]) => id === acc.cus_category);
      console.log(`  - ${acc.cus_id}: ${acc.cus_name} (Category: ${category ? category[0] : 'Unknown'}, Balance: ${acc.cus_balance})`);
    });

    // Check recent ledger entries
    console.log('\n📝 Recent Ledger Entries:');
    const recentLedger = await prisma.ledger.findMany({
      take: 10,
      orderBy: { ledger_id: 'desc' },
      include: {
        customer: { select: { cus_id: true, cus_name: true } }
      }
    });

    if (recentLedger.length === 0) {
      console.log('  ⚠️ No ledger entries found!');
    } else {
      recentLedger.forEach(entry => {
        console.log(`  - ID=${entry.ledger_id}, Bill=${entry.bill_no}, Customer=${entry.customer?.cus_name}, Debit=${entry.debit_amount}, Credit=${entry.credit_amount}, Balance=${entry.closing_balance}`);
      })
    }

    // Check recent sales
    console.log('\n📦 Recent Sales:');
    const recentSales = await prisma.sale.findMany({
      take: 5,
      orderBy: { sale_id: 'desc' },
      include: { customer: { select: { cus_id: true, cus_name: true, cus_balance: true } } }
    });

    recentSales.forEach(sale => {
      console.log(`  - ID=${sale.sale_id}, Customer=${sale.customer.cus_name}, Balance=${sale.customer.cus_balance}, Bill_Type=${sale.bill_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLedgerSetup();
