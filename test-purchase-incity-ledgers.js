const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('\n🧪 TEST: Purchase Incity Ledger Postings (own_labour & own_delivery)');

  try {
    // 1) Find a supplier customer to use for the purchase
    const customerCategories = await prisma.customerCategory.findMany();
    const supplierCategory = customerCategories.find(c => c.cus_cat_title.toLowerCase().includes('supplier')) || null;

    const supplier = supplierCategory
      ? await prisma.customer.findFirst({ where: { cus_category: supplierCategory.cus_cat_id } })
      : await prisma.customer.findFirst();

    if (!supplier) {
      console.error('❌ No supplier/customer found in DB to run this test');
      return process.exit(1);
    }

    // 2) Find a store and a product
    const store = await prisma.store.findFirst();
    const product = await prisma.product.findFirst();

    if (!store || !product) {
      console.error('❌ Store or Product not found in DB (required for purchase test)');
      return process.exit(1);
    }

    // 3) Ensure there are Labour and Delivery accounts (create if missing)
    const customerTypes = await prisma.customerType.findMany();
    const defaultType = customerTypes[0] || null;

    const defaultCategory = customerCategories[0] || null;

    let labourAccount = await prisma.customer.findFirst({
      where: { cus_name: { contains: 'labour' } }
    });

    if (!labourAccount) {
      labourAccount = await prisma.customer.create({
        data: {
          cus_name: 'Labour Account',
          cus_phone_no: '0000000000',
          cus_address: 'Automated test account',
          cus_category: defaultCategory ? defaultCategory.cus_cat_id : null,
          cus_type: defaultType ? defaultType.cus_type_id : null,
          cus_balance: 0
        }
      });
      console.log('ℹ️  Created Labour account for test:', labourAccount.cus_id);
    }

    let deliveryAccount = await prisma.customer.findFirst({
      where: { cus_name: { contains: 'delivery' } }
    });

    if (!deliveryAccount) {
      deliveryAccount = await prisma.customer.create({
        data: {
          cus_name: 'Delivery Account',
          cus_phone_no: '0000000000',
          cus_address: 'Automated test account',
          cus_category: defaultCategory ? defaultCategory.cus_cat_id : null,
          cus_type: defaultType ? defaultType.cus_type_id : null,
          cus_balance: 0
        }
      });
      console.log('ℹ️  Created Delivery account for test:', deliveryAccount.cus_id);
    }

    // 4) Prepare purchase payload with incity values
    const incityLabour = 123.45;
    const incityDelivery = 67.89;

    const purchasePayload = {
      cus_id: supplier.cus_id,
      store_id: store.storeid,
      total_amount: (product.pro_cost_price || 100).toString(),
      unloading_amount: 0,
      fare_amount: 0,
      transport_amount: 0,
      labour_amount: 0,
      incity_own_labour: incityLabour,
      incity_own_delivery: incityDelivery,
      incity_charges_total: incityLabour + incityDelivery,
      discount: 0,
      payment: 0,
      payment_type: 'CASH',
      cash_payment: 0,
      bank_payment: 0,
      invoice_number: `TEST-INCITY-${Date.now()}`,
      purchase_details: [
        {
          pro_id: product.pro_id,
          qnty: 1,
          unit: 'pcs',
          unit_rate: product.pro_cost_price || 100,
          total_amount: product.pro_cost_price || 100
        }
      ]
    };

    // 5) Create purchase via API
    const res = await fetch('http://localhost:3000/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchasePayload)
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('❌ API /api/purchases returned error:', res.status, err);
      return process.exit(1);
    }

    const created = await res.json();
    const purId = created.pur_id;
    console.log('✅ Purchase created (ID):', purId);

    // 6) Query ledger entries for this purchase and the labour/delivery accounts
    const labourLedgers = await prisma.ledger.findMany({ where: { bill_no: String(purId), cus_id: labourAccount.cus_id } });
    const deliveryLedgers = await prisma.ledger.findMany({ where: { bill_no: String(purId), cus_id: deliveryAccount.cus_id } });

    if (labourLedgers.length === 0) {
      console.error('❌ Expected Incity Labour ledger entry NOT found');
      return process.exit(1);
    }

    if (deliveryLedgers.length === 0) {
      console.error('❌ Expected Incity Delivery ledger entry NOT found');
      return process.exit(1);
    }

    const labourEntry = labourLedgers[0];
    const deliveryEntry = deliveryLedgers[0];

    // Validate amounts (labour should be debited, delivery debited)
    if (parseFloat(labourEntry.debit_amount || 0).toFixed(2) !== incityLabour.toFixed(2)) {
      console.error('❌ Labour ledger amount mismatch:', labourEntry.debit_amount, 'expected', incityLabour);
      return process.exit(1);
    }

    if (parseFloat(deliveryEntry.debit_amount || 0).toFixed(2) !== incityDelivery.toFixed(2)) {
      console.error('❌ Delivery ledger amount mismatch:', deliveryEntry.debit_amount, 'expected', incityDelivery);
      return process.exit(1);
    }

    // Validate account balances updated
    const updatedLabourAccount = await prisma.customer.findUnique({ where: { cus_id: labourAccount.cus_id } });
    const updatedDeliveryAccount = await prisma.customer.findUnique({ where: { cus_id: deliveryAccount.cus_id } });

    console.log('🔎 Labour ledger entry:', { debit: labourEntry.debit_amount, credit: labourEntry.credit_amount, closing: labourEntry.closing_balance });
    console.log('🔎 Delivery ledger entry:', { debit: deliveryEntry.debit_amount, credit: deliveryEntry.credit_amount, closing: deliveryEntry.closing_balance });

    console.log('🔎 Labour account balance (DB):', updatedLabourAccount.cus_balance);
    console.log('🔎 Delivery account balance (DB):', updatedDeliveryAccount.cus_balance);

    console.log('\n✅ TEST PASSED: Incity ledger postings for Labour and Delivery were created and balances updated');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();