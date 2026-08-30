import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

export const maxDuration = 300; // Vercel Hobby plan max (300s). Frontend batches requests in chunks of 100.

// Conflict resolution strategies:
// 'skip': Ignore rows that have existing primary key IDs in database
// 'overwrite': Update existing records with the new values
// 'error': Fail the row if ID already exists

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      type, // 'customerType', 'customerCategory', 'city', 'customer', 'categories', 'subCategory', 'product', 'ledger', 'expenseTitle', 'expense'
      data, // Array of records
      conflictResolution = 'skip',
      autoCreateDependencies = true,
      rollbackOnError = false
    } = body;

    if (!type || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Type and data array are required' }, { status: 400 });
    }

    console.log(`📥 Import requested for type "${type}" with ${data.length} records. Conflict resolution: ${conflictResolution}`);

    // Track statistics
    const stats = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Cache maps to avoid redundant database calls for dependencies
    const categoryCache = new Map();
    const typeCache = new Map();
    const cityCache = new Map();
    const prodCategoryCache = new Map();
    const prodSubCategoryCache = new Map();
    const expenseTitleCache = new Map();
    const customerCache = new Map();
    const customerIds = new Set();
    const productCache = new Map();
    const storeCache = new Map();

    // Helper functions for dependency resolution
    async function resolveCustomerCategory(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const title = String(val).trim();
      const cacheKey = title.toLowerCase();
      if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey);

      let record = await tx.customerCategory.findFirst({
        where: { cus_cat_title: { equals: title } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('customerCategory', 'cus_cat_id', tx);
        record = await tx.customerCategory.create({
          data: { cus_cat_id: nextId, cus_cat_title: title }
        });
      }

      if (record) {
        categoryCache.set(cacheKey, record.cus_cat_id);
        return record.cus_cat_id;
      }
      return null;
    }

    async function resolveCustomerType(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const title = String(val).trim();
      const cacheKey = title.toLowerCase();
      if (typeCache.has(cacheKey)) return typeCache.get(cacheKey);

      let record = await tx.customerType.findFirst({
        where: { cus_type_title: { equals: title } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('customerType', 'cus_type_id', tx);
        record = await tx.customerType.create({
          data: { cus_type_id: nextId, cus_type_title: title }
        });
      }

      if (record) {
        typeCache.set(cacheKey, record.cus_type_id);
        return record.cus_type_id;
      }
      return null;
    }

    async function resolveCity(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const title = String(val).trim();
      const cacheKey = title.toLowerCase();
      if (cityCache.has(cacheKey)) return cityCache.get(cacheKey);

      let record = await tx.city.findFirst({
        where: { city_name: { equals: title } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('city', 'city_id', tx);
        record = await tx.city.create({
          data: { city_id: nextId, city_name: title }
        });
      }

      if (record) {
        cityCache.set(cacheKey, record.city_id);
        return record.city_id;
      }
      return null;
    }

    async function resolveProductCategory(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const name = String(val).trim();
      const cacheKey = name.toLowerCase();
      if (prodCategoryCache.has(cacheKey)) return prodCategoryCache.get(cacheKey);

      let record = await tx.categories.findFirst({
        where: { cat_name: { equals: name } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('categories', 'cat_id', tx);
        const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'CAT' + nextId;
        record = await tx.categories.create({
          data: { cat_id: nextId, cat_name: name, cat_code: code }
        });
      }

      if (record) {
        prodCategoryCache.set(cacheKey, record.cat_id);
        return record.cat_id;
      }
      return null;
    }

    async function resolveProductSubCategory(val, catId, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const name = String(val).trim();
      const cacheKey = `${catId}_${name.toLowerCase()}`;
      if (prodSubCategoryCache.has(cacheKey)) return prodSubCategoryCache.get(cacheKey);

      let record = await tx.subCategory.findFirst({
        where: { sub_cat_name: { equals: name }, cat_id: catId }
      });

      if (!record && autoCreateDependencies && catId) {
        const nextId = await getNextId('subCategory', 'sub_cat_id', tx);
        const code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10) || 'SUB' + nextId;
        record = await tx.subCategory.create({
          data: { sub_cat_id: nextId, cat_id: catId, sub_cat_name: name, sub_cat_code: code }
        });
      }

      if (record) {
        prodSubCategoryCache.set(cacheKey, record.sub_cat_id);
        return record.sub_cat_id;
      }
      return null;
    }

    async function resolveExpenseTitle(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const title = String(val).trim();
      const cacheKey = title.toLowerCase();
      if (expenseTitleCache.has(cacheKey)) return expenseTitleCache.get(cacheKey);

      let record = await tx.expenseTitle.findFirst({
        where: { title: { equals: title } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('expenseTitle', 'id', tx);
        record = await tx.expenseTitle.create({
          data: { id: nextId, title }
        });
      }

      if (record) {
        expenseTitleCache.set(cacheKey, record.id);
        return record.id;
      }
      return null;
    }

    async function resolveCustomer(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const name = String(val).trim();
      const cacheKey = name.toLowerCase();
      if (customerCache.has(cacheKey)) return customerCache.get(cacheKey);

      const record = await tx.customer.findFirst({
        where: { cus_name: { equals: name } },
        select: { cus_id: true }
      });

      if (record) {
        customerCache.set(cacheKey, record.cus_id);
        return record.cus_id;
      }
      return null;
    }

    async function resolveStore(val, tx) {
      if (!val) return null;
      if (Number.isInteger(Number(val)) && !isNaN(parseInt(val))) {
        return parseInt(val);
      }
      const name = String(val).trim();
      const cacheKey = name.toLowerCase();
      if (storeCache.has(cacheKey)) return storeCache.get(cacheKey);

      let record = await tx.store.findFirst({
        where: { store_name: { equals: name } }
      });

      if (!record && autoCreateDependencies) {
        const nextId = await getNextId('store', 'storeid', tx);
        record = await tx.store.create({
          data: { storeid: nextId, store_name: name, store_address: 'Created on import' }
        });
      }

      if (record) {
        storeCache.set(cacheKey, record.storeid);
        return record.storeid;
      }
      return null;
    }

    const processImport = async (tx) => {
      // Pre-populate cache maps to speed up validation checks
      console.log('⚡ Pre-populating cache maps...');
      try {
        const cats = await tx.customerCategory.findMany({ select: { cus_cat_id: true, cus_cat_title: true } });
        cats.forEach(c => categoryCache.set(c.cus_cat_title.trim().toLowerCase(), c.cus_cat_id));
        
        const types = await tx.customerType.findMany({ select: { cus_type_id: true, cus_type_title: true } });
        types.forEach(t => typeCache.set(t.cus_type_title.trim().toLowerCase(), t.cus_type_id));
        
        const cities = await tx.city.findMany({ select: { city_id: true, city_name: true } });
        cities.forEach(c => cityCache.set(c.city_name.trim().toLowerCase(), c.city_id));
        
        const prodCats = await tx.categories.findMany({ select: { cat_id: true, cat_name: true } });
        prodCats.forEach(c => prodCategoryCache.set(c.cat_name.trim().toLowerCase(), c.cat_id));
        
        const prodSubCats = await tx.subCategory.findMany({ select: { sub_cat_id: true, cat_id: true, sub_cat_name: true } });
        prodSubCats.forEach(s => prodSubCategoryCache.set(`${s.cat_id}_${s.sub_cat_name.trim().toLowerCase()}`, s.sub_cat_id));
        
        const expTitles = await tx.expenseTitle.findMany({ select: { id: true, title: true } });
        expTitles.forEach(e => expenseTitleCache.set(e.title.trim().toLowerCase(), e.id));
        
        const customers = await tx.customer.findMany({ select: { cus_id: true, cus_name: true } });
        customers.forEach(c => {
          customerCache.set(c.cus_name.trim().toLowerCase(), c.cus_id);
          customerIds.add(c.cus_id);
        });

        const products = await tx.product.findMany({ select: { pro_id: true, pro_title: true, cat_id: true, sub_cat_id: true } });
        products.forEach(p => productCache.set(`${p.cat_id}_${p.sub_cat_id}_${p.pro_title.trim().toLowerCase()}`, p.pro_id));

        const stores = await tx.store.findMany({ select: { storeid: true, store_name: true } });
        stores.forEach(s => storeCache.set(s.store_name.trim().toLowerCase(), s.storeid));
        
        console.log(`⚡ Pre-populated caches: ${customerCache.size} customers, ${cityCache.size} cities, ${categoryCache.size} categories, ${productCache.size} products, ${storeCache.size} stores.`);
      } catch (err) {
        console.warn('⚠️ Cache pre-population failed, falling back to lazy loading:', err.message);
      }

      for (let idx = 0; idx < data.length; idx++) {
        const row = data[idx];
        const rowNum = idx + 1;

        try {
          // ==========================================
          // 1. CUSTOMER TYPE IMPORT
          // ==========================================
          if (type === 'customerType') {
            const title = String(row.cus_type_title || '').trim();
            if (!title) throw new Error('Customer type title is required');

            let id = row.cus_type_id ? parseInt(row.cus_type_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.customerType.findUnique({ where: { cus_type_id: id } });
            } else {
              existing = await tx.customerType.findFirst({ where: { cus_type_title: title } });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Customer type already exists (ID: ${existing.cus_type_id}, Title: ${existing.cus_type_title})`);
              } else { // overwrite
                await tx.customerType.update({
                  where: { cus_type_id: existing.cus_type_id },
                  data: { cus_type_title: title }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('customerType', 'cus_type_id', tx);
              await tx.customerType.create({
                data: { cus_type_id: id, cus_type_title: title }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 2. CUSTOMER CATEGORY IMPORT
          // ==========================================
          else if (type === 'customerCategory') {
            const title = String(row.cus_cat_title || '').trim();
            if (!title) throw new Error('Customer category title is required');

            let id = row.cus_cat_id ? parseInt(row.cus_cat_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.customerCategory.findUnique({ where: { cus_cat_id: id } });
            } else {
              existing = await tx.customerCategory.findFirst({ where: { cus_cat_title: title } });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Customer category already exists (ID: ${existing.cus_cat_id}, Title: ${existing.cus_cat_title})`);
              } else { // overwrite
                await tx.customerCategory.update({
                  where: { cus_cat_id: existing.cus_cat_id },
                  data: { cus_cat_title: title }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('customerCategory', 'cus_cat_id', tx);
              await tx.customerCategory.create({
                data: { cus_cat_id: id, cus_cat_title: title }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 3. CITY IMPORT
          // ==========================================
          else if (type === 'city') {
            const name = String(row.city_name || '').trim();
            if (!name) throw new Error('City name is required');

            let id = row.city_id ? parseInt(row.city_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.city.findUnique({ where: { city_id: id } });
            } else {
              existing = await tx.city.findFirst({ where: { city_name: name } });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`City already exists (ID: ${existing.city_id}, Name: ${existing.city_name})`);
              } else { // overwrite
                await tx.city.update({
                  where: { city_id: existing.city_id },
                  data: { city_name: name }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('city', 'city_id', tx);
              await tx.city.create({
                data: { city_id: id, city_name: name }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 4. CUSTOMER ACCOUNT IMPORT
          // ==========================================
          else if (type === 'customer') {
            const name = String(row.cus_name || '').trim();
            if (!name) throw new Error('Customer name is required');

            let id = row.cus_id ? parseInt(row.cus_id) : null;
            let existing = null;
            let exists = false;

            if (id) {
              if (customerIds.has(id)) {
                exists = true;
              } else {
                existing = await tx.customer.findUnique({ where: { cus_id: id } });
                if (existing) {
                  exists = true;
                  customerIds.add(id);
                  customerCache.set(name.toLowerCase(), id);
                }
              }
            } else {
              const cachedId = customerCache.get(name.toLowerCase());
              if (cachedId) {
                exists = true;
                id = cachedId;
              } else {
                existing = await tx.customer.findFirst({ where: { cus_name: name } });
                if (existing) {
                  exists = true;
                  id = existing.cus_id;
                  customerIds.add(id);
                  customerCache.set(name.toLowerCase(), id);
                }
              }
            }

            if (exists) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Customer already exists (ID: ${id}, Name: ${name})`);
              } else { // overwrite
                if (!existing) {
                  existing = await tx.customer.findUnique({ where: { cus_id: id } });
                }
              }
            }

            const catId = await resolveCustomerCategory(row.cus_category, tx);
            if (!catId) throw new Error(`Could not resolve customer category: ${row.cus_category}`);

            const typeId = await resolveCustomerType(row.cus_type, tx);
            if (!typeId) throw new Error(`Could not resolve customer type: ${row.cus_type}`);

            const cityId = await resolveCity(row.city_id, tx);

            const dataObj = {
              cus_name: name,
              cus_category: catId,
              cus_type: typeId,
              city_id: cityId,
              cus_phone_no: String(row.cus_phone_no || '0000000000').trim(),
              cus_phone_no2: row.cus_phone_no2 ? String(row.cus_phone_no2).trim() : null,
              cus_address: String(row.cus_address || 'Main Office').trim(),
              cus_reference: row.cus_reference ? String(row.cus_reference).trim() : null,
              cus_account_info: row.cus_account_info ? String(row.cus_account_info).trim() : null,
              other: row.other ? String(row.other).trim() : null,
              cus_balance: parseFloat(row.cus_balance || 0),
              CNIC: row.CNIC ? String(row.CNIC).trim() : null,
              NTN_NO: row.NTN_NO ? String(row.NTN_NO).trim() : null,
              name_urdu: row.name_urdu ? String(row.name_urdu).trim() : null,
            };

            if (existing) {
              await tx.customer.update({
                where: { cus_id: existing.cus_id },
                data: {
                  ...dataObj,
                  cus_balance: existing.cus_balance // Keep existing balance
                }
              });
              stats.updated++;
            } else {
              if (!id) id = await getNextId('customer', 'cus_id', tx);
              await tx.customer.create({
                data: {
                  cus_id: id,
                  ...dataObj
                }
              });
              customerCache.set(name.toLowerCase(), id); // Cache the newly created record
              customerIds.add(id); // Keep the IDs cache updated as well
              stats.created++;
            }
          }

          // ==========================================
          // 5. CUSTOMER LEDGER IMPORT
          // ==========================================
          else if (type === 'ledger') {
            const cusId = await resolveCustomer(row.cus_id, tx);
            if (!cusId) throw new Error(`Could not resolve customer account: ${row.cus_id}`);

            let id = row.l_id ? parseInt(row.l_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.ledger.findUnique({ where: { l_id: id } });
            }

            let trnxVal = row.trnx_type;
            const allowedTrnxs = ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'PURCHASE', 'CASH_PAYMENT', 'BANK_PAYMENT', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'REBATE', 'CREDIT', 'DEBIT'];
            
            // Auto-convert numeric/integer transaction types (e.g. 7) to corresponding enum strings
            if (trnxVal !== undefined && trnxVal !== null && !isNaN(parseInt(trnxVal)) && String(trnxVal).trim() !== '') {
              const numericVal = parseInt(trnxVal);
              if (numericVal >= 1 && numericVal <= allowedTrnxs.length) {
                // 1-based index mapping (e.g. 1 -> CASH, 7 -> SALE)
                trnxVal = allowedTrnxs[numericVal - 1];
              } else if (numericVal >= 0 && numericVal < allowedTrnxs.length) {
                // 0-based index fallback
                trnxVal = allowedTrnxs[numericVal];
              }
            }

            const trnx = String(trnxVal || 'CASH').toUpperCase();
            if (!allowedTrnxs.includes(trnx)) {
              throw new Error(`Invalid transaction type: ${trnx}. Must be one of: ${allowedTrnxs.join(', ')}`);
            }

            const debit = parseFloat(row.debit_amount || 0);
            const credit = parseFloat(row.credit_amount || 0);
            const openBal = parseFloat(row.opening_balance || 0);
            const closeBal = parseFloat(row.closing_balance || (openBal + debit - credit));

            const dataObj = {
              cus_id: cusId,
              opening_balance: openBal,
              debit_amount: debit,
              credit_amount: credit,
              closing_balance: closeBal,
              bill_no: row.bill_no ? String(row.bill_no).trim() : null,
              trnx_type: trnx,
              details: row.details ? String(row.details).trim() : null,
              payments: parseFloat(row.payments || credit || 0),
              cash_payment: parseFloat(row.cash_payment || (trnx.includes('CASH') ? (credit || debit) : 0)),
              bank_payment: parseFloat(row.bank_payment || (trnx.includes('BANK') ? (credit || debit) : 0)),
              ledger_type: row.ledger_type ? String(row.ledger_type).trim() : null,
              created_at: row.created_at ? new Date(row.created_at) : new Date(),
            };

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Ledger entry already exists (ID: ${existing.l_id})`);
              } else { // overwrite
                await tx.ledger.update({
                  where: { l_id: existing.l_id },
                  data: dataObj
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('ledger', 'l_id', tx);
              await tx.ledger.create({
                data: {
                  l_id: id,
                  ...dataObj
                }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 6. PRODUCT CATEGORY IMPORT
          // ==========================================
          else if (type === 'categories') {
            const name = String(row.cat_name || '').trim();
            if (!name) throw new Error('Category name is required');

            let code = String(row.cat_code || '').trim().toUpperCase();
            if (!code) code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);

            let id = row.cat_id ? parseInt(row.cat_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.categories.findUnique({ where: { cat_id: id } });
            } else {
              existing = await tx.categories.findFirst({
                where: { OR: [{ cat_name: name }, { cat_code: code }] }
              });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Product category already exists (ID: ${existing.cat_id}, Name: ${existing.cat_name})`);
              } else { // overwrite
                await tx.categories.update({
                  where: { cat_id: existing.cat_id },
                  data: { cat_name: name, cat_code: code }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('categories', 'cat_id', tx);
              await tx.categories.create({
                data: { cat_id: id, cat_name: name, cat_code: code }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 7. PRODUCT SUB CATEGORY IMPORT
          // ==========================================
          else if (type === 'subCategory') {
            const name = String(row.sub_cat_name || '').trim();
            if (!name) throw new Error('Sub category name is required');

            const catId = await resolveProductCategory(row.cat_id, tx);
            if (!catId) throw new Error(`Could not resolve product category: ${row.cat_id}`);

            let code = String(row.sub_cat_code || '').trim().toUpperCase();
            if (!code) code = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10);

            let id = row.sub_cat_id ? parseInt(row.sub_cat_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.subCategory.findUnique({ where: { sub_cat_id: id } });
            } else {
              existing = await tx.subCategory.findFirst({
                where: { OR: [{ sub_cat_code: code }, { sub_cat_name: name, cat_id: catId }] }
              });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Product subcategory already exists (ID: ${existing.sub_cat_id}, Name: ${existing.sub_cat_name})`);
              } else { // overwrite
                await tx.subCategory.update({
                  where: { sub_cat_id: existing.sub_cat_id },
                  data: { sub_cat_name: name, sub_cat_code: code, cat_id: catId }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('subCategory', 'sub_cat_id', tx);
              await tx.subCategory.create({
                data: { sub_cat_id: id, cat_id: catId, sub_cat_name: name, sub_cat_code: code }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 8. PRODUCT IMPORT
          // ==========================================
          else if (type === 'product') {
            const title = String(row.pro_title || '').trim();
            if (!title) throw new Error('Product title is required');

            const catId = await resolveProductCategory(row.cat_id, tx);
            if (!catId) throw new Error(`Could not resolve category: ${row.cat_id}`);

            const subCatId = await resolveProductSubCategory(row.sub_cat_id, catId, tx);
            if (!subCatId) throw new Error(`Could not resolve subcategory: ${row.sub_cat_id}`);

            const storeId = await resolveStore(row.store_id, tx);

            let id = row.pro_id ? parseInt(row.pro_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.product.findUnique({ where: { pro_id: id } });
            } else {
              existing = await tx.product.findFirst({ where: { pro_title: title, cat_id: catId, sub_cat_id: subCatId } });
            }

            const dataObj = {
              cat_id: catId,
              sub_cat_id: subCatId,
              pro_title: title,
              pro_description: String(row.pro_description || '').trim(),
              pro_cost_price: parseFloat(row.pro_cost_price || 0),
              pro_sale_price: parseFloat(row.pro_sale_price || 0),
              pro_baser_price: parseFloat(row.pro_baser_price || row.pro_cost_price || 0),
              pro_crate: parseFloat(row.pro_crate || 0),
              pro_stock_qnty: parseFloat(row.pro_stock_qnty || 0),
              low_stock_quantity: row.low_stock_quantity ? parseInt(row.low_stock_quantity) : 10,
              pro_unit: String(row.pro_unit || 'pcs').trim(),
              pro_packing: row.pro_packing ? String(row.pro_packing).trim() : null
            };

            // Local helper to ensure store stocks exist for the product
            const ensureStoreStocks = async (productId, stockQuantity) => {
              let primaryStore = null;
              if (storeId) {
                primaryStore = await tx.store.findUnique({ where: { storeid: storeId } });
              }
              if (!primaryStore) {
                primaryStore = await tx.store.findFirst({ orderBy: { storeid: 'asc' } });
              }
              if (!primaryStore) {
                const nextStoreId = await getNextId('store', 'storeid', tx);
                primaryStore = await tx.store.create({
                  data: {
                    storeid: nextStoreId,
                    store_name: 'Main Store',
                    store_address: 'Default Location'
                  }
                });
              }

              const allStores = await tx.store.findMany();
              for (const s of allStores) {
                const qty = s.storeid === primaryStore.storeid ? stockQuantity : 0;
                await tx.storeStock.upsert({
                  where: {
                    store_id_pro_id: {
                      store_id: s.storeid,
                      pro_id: productId
                    }
                  },
                  create: {
                    store_id: s.storeid,
                    pro_id: productId,
                    stock_quantity: qty,
                    min_stock: 0,
                    max_stock: 1000
                  },
                  update: {
                    ...(conflictResolution === 'overwrite' && s.storeid === primaryStore.storeid ? { stock_quantity: qty } : {})
                  }
                });
              }
            };

            if (existing) {
              if (conflictResolution === 'skip') {
                // Ensure StoreStock entries are still created/verified if they are missing
                await ensureStoreStocks(existing.pro_id, dataObj.pro_stock_qnty);
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Product already exists (ID: ${existing.pro_id}, Title: ${existing.pro_title})`);
              } else { // overwrite
                await tx.product.update({
                  where: { pro_id: existing.pro_id },
                  data: dataObj
                });
                await ensureStoreStocks(existing.pro_id, dataObj.pro_stock_qnty);
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('product', 'pro_id', tx);
              await tx.product.create({
                data: {
                  pro_id: id,
                  ...dataObj
                }
              });
              await ensureStoreStocks(id, dataObj.pro_stock_qnty);
              stats.created++;
            }
          }

          // ==========================================
          // 9. EXPENSE TITLE IMPORT
          // ==========================================
          else if (type === 'expenseTitle') {
            const title = String(row.title || '').trim();
            if (!title) throw new Error('Expense title is required');

            let id = row.id ? parseInt(row.id) : null;
            let existing = null;
            if (id) {
              existing = await tx.expenseTitle.findUnique({ where: { id } });
            } else {
              existing = await tx.expenseTitle.findUnique({ where: { title } });
            }

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Expense title already exists (ID: ${existing.id}, Title: ${existing.title})`);
              } else { // overwrite
                await tx.expenseTitle.update({
                  where: { id: existing.id },
                  data: { title }
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('expenseTitle', 'id', tx);
              await tx.expenseTitle.create({
                data: { id, title }
              });
              stats.created++;
            }
          }

          // ==========================================
          // 10. EXPENSE IMPORT
          // ==========================================
          else if (type === 'expense') {
            const title = String(row.exp_title || '').trim();
            if (!title) throw new Error('Expense title/description is required');

            const expTypeId = await resolveExpenseTitle(row.exp_type, tx);
            if (!expTypeId) throw new Error(`Could not resolve expense type/title: ${row.exp_type}`);

            const paidFromId = await resolveCustomer(row.paid_from_account_id, tx);
            const bankAccId = await resolveCustomer(row.bank_account_id, tx);

            let id = row.exp_id ? parseInt(row.exp_id) : null;
            let existing = null;
            if (id) {
              existing = await tx.expense.findUnique({ where: { exp_id: id } });
            }

            const dataObj = {
              exp_title: title,
              exp_type: expTypeId,
              exp_detail: row.exp_detail ? String(row.exp_detail).trim() : null,
              exp_amount: parseFloat(row.exp_amount || 0),
              is_paid: row.is_paid === true || String(row.is_paid).toLowerCase() === 'true' || String(row.is_paid).toLowerCase() === 'yes',
              paid_from_account_id: paidFromId,
              cash_amount: parseFloat(row.cash_amount || 0),
              bank_account_id: bankAccId,
              bank_amount: parseFloat(row.bank_amount || 0),
              payment_date: row.payment_date ? new Date(row.payment_date) : null,
              payment_reference: row.payment_reference ? String(row.payment_reference).trim() : null,
            };

            if (existing) {
              if (conflictResolution === 'skip') {
                stats.skipped++;
                stats.success++;
                continue;
              } else if (conflictResolution === 'error') {
                throw new Error(`Expense already exists (ID: ${existing.exp_id})`);
              } else { // overwrite
                await tx.expense.update({
                  where: { exp_id: existing.exp_id },
                  data: dataObj
                });
                stats.updated++;
              }
            } else {
              if (!id) id = await getNextId('expense', 'exp_id', tx);
              await tx.expense.create({
                data: {
                  exp_id: id,
                  ...dataObj
                }
              });
              stats.created++;
            }
          }

          stats.success++;
        } catch (rowError) {
          stats.failed++;
          stats.errors.push({
            row: rowNum,
            data: row,
            error: rowError.message
          });

          if (rollbackOnError) {
            throw rowError; // Triggers transaction rollback
          }
        }
      }
    };

    if (rollbackOnError) {
      await prisma.$transaction(processImport, { timeout: 300000 }); // Increase transaction timeout to 5 minutes (300,000 ms)
    } else {
      // Execute in non-rollback context
      await processImport(prisma);
    }

    console.log(`📊 Import finished for type "${type}". Success: ${stats.success}, Failed: ${stats.failed}`);
    return NextResponse.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Excel Import error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Bulk import failed.'
    }, { status: 500 });
  }
}
