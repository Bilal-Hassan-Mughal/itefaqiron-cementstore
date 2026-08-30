/**
 * Ensures a "Cash Account" customer exists (category + row) so it appears in the customer list
 * and sales/purchases can post cash ledger lines.
 *
 * Usage: node scripts/ensure-cash-account.js
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function ensureCashAccount() {
  const allCategories = await prisma.customerCategory.findMany();
  let cashCatId = null;
  for (const cat of allCategories) {
    const lower = (cat.cus_cat_title || '').toLowerCase();
    if (lower.includes('cash') && lower.includes('account')) {
      cashCatId = cat.cus_cat_id;
      break;
    }
  }
  if (!cashCatId) {
    const createdCat = await prisma.customerCategory.create({
      data: { cus_cat_title: 'Cash Account' }
    });
    cashCatId = createdCat.cus_cat_id;
    console.log('Created category:', createdCat.cus_cat_title, 'id=', cashCatId);
  } else {
    console.log('Using existing Cash-style category id=', cashCatId);
  }

  const existing = await prisma.customer.findFirst({ where: { cus_category: cashCatId } });
  if (existing) {
    console.log('Cash Account customer already exists:', {
      cus_id: existing.cus_id,
      cus_name: existing.cus_name
    });
    return existing;
  }

  const allTypes = await prisma.customerType.findMany();
  let cashType = allTypes.find(t => (t.cus_type_title || '').toLowerCase().includes('cash'));
  if (!cashType) {
    cashType = await prisma.customerType.create({ data: { cus_type_title: 'Cash' } });
    console.log('Created customer type:', cashType.cus_type_title, 'id=', cashType.cus_type_id);
  }

  const aCity = await prisma.city.findFirst();
  const created = await prisma.customer.create({
    data: {
      cus_name: 'Cash Account',
      cus_phone_no: '0000000000',
      cus_address: 'Main Office',
      cus_balance: 0,
      cus_type: cashType.cus_type_id,
      cus_category: cashCatId,
      city_id: aCity ? aCity.city_id : null
    }
  });
  console.log('Created Cash Account customer:', {
    cus_id: created.cus_id,
    cus_name: created.cus_name
  });
  return created;
}

ensureCashAccount()
  .then(() => console.log('Done.'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
