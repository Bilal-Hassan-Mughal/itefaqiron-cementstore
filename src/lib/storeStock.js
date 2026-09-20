// Store Stock Management Helper Functions
// These functions handle multi-store stock operations

import prisma from './prisma';

const getPrismaClient = () => prisma;

// Ensure the store_stocks table exists (for environments where migrations weren't applied)
async function ensureStoreStocksTable(prismaClient) {
  try {
    await prismaClient.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS store_stocks (
        store_stock_id INT NOT NULL AUTO_INCREMENT,
        store_id INT NOT NULL,
        pro_id INT NOT NULL,
        stock_quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        min_stock DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        max_stock DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        updated_by INT NULL,
        UNIQUE KEY store_id_pro_id (store_id, pro_id),
        PRIMARY KEY (store_stock_id)
      ) ENGINE=InnoDB;
    `);
  } catch (e) {
    console.warn('ensureStoreStocksTable: could not ensure table exists:', e.message);
  }
}

/**
 * Get or create store stock entry for a product
 */
export async function getOrCreateStoreStock(storeId, productId, updatedBy = null, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);
  const productIdInt = parseInt(productId, 10);

  if (isNaN(storeIdInt) || isNaN(productIdInt)) return null;

  try {
    let storeStock = null;
    if (db.storeStock) {
      try {
        storeStock = await db.storeStock.findUnique({
          where: {
            store_id_pro_id: {
              store_id: storeIdInt,
              pro_id: productIdInt
            }
          }
        });
      } catch (e) {
        if (e.code === 'P2021') {
          await ensureStoreStocksTable(db);
        } else {
          throw e;
        }
      }
    }

    if (!storeStock) {
      const rows = await db.$queryRaw`SELECT * FROM store_stocks WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} LIMIT 1`;
      storeStock = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    if (!storeStock) {
      if (db.storeStock) {
        try {
          storeStock = await db.storeStock.upsert({
            where: {
              store_id_pro_id: {
                store_id: storeIdInt,
                pro_id: productIdInt
              }
            },
            create: {
              store_id: storeIdInt,
              pro_id: productIdInt,
              stock_quantity: 0,
              min_stock: 0,
              max_stock: 1000,
              updated_by: updatedBy
            },
            update: {}
          });
        } catch (e) {
          if (e.code === 'P2021') {
            await ensureStoreStocksTable(db);
          } else {
            throw e;
          }
        }
      }

      if (!storeStock) {
        await db.$executeRaw`INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by) VALUES (${storeIdInt}, ${productIdInt}, 0.00, 0.00, 1000.00, ${updatedBy}) ON DUPLICATE KEY UPDATE store_stock_id = store_stock_id`;
        const rows2 = await db.$queryRaw`SELECT * FROM store_stocks WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} LIMIT 1`;
        storeStock = Array.isArray(rows2) && rows2.length > 0 ? rows2[0] : null;
      }
    }

    return storeStock;
  } catch (err) {
    console.error('getOrCreateStoreStock error:', err);
    return null;
  }
}

/**
 * Update store stock quantity instantly using single-query ON DUPLICATE KEY UPDATE
 */
export async function updateStoreStock(storeId, productId, quantityChange, operation = 'increment', updatedBy = null, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);
  const productIdInt = parseInt(productId, 10);
  const qty = parseFloat(quantityChange || 0);

  if (isNaN(storeIdInt) || isNaN(productIdInt) || isNaN(qty)) return null;

  try {
    if (operation === 'increment') {
      await db.$executeRaw`
        INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by, created_at, updated_at)
        VALUES (${storeIdInt}, ${productIdInt}, ${qty}, 0.00, 1000.00, ${updatedBy}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + ${qty}, updated_at = NOW(), updated_by = ${updatedBy}
      `;
    } else if (operation === 'decrement') {
      await db.$executeRaw`
        INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by, created_at, updated_at)
        VALUES (${storeIdInt}, ${productIdInt}, ${-qty}, 0.00, 1000.00, ${updatedBy}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity - ${qty}, updated_at = NOW(), updated_by = ${updatedBy}
      `;
    } else {
      await db.$executeRaw`
        INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by, created_at, updated_at)
        VALUES (${storeIdInt}, ${productIdInt}, ${qty}, 0.00, 1000.00, ${updatedBy}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE stock_quantity = ${qty}, updated_at = NOW(), updated_by = ${updatedBy}
      `;
    }
    return true;
  } catch (e) {
    if (e.code === 'P2010' || e.message?.includes("doesn't exist")) {
      await ensureStoreStocksTable(db);
      try {
        if (operation === 'increment') {
          await db.$executeRaw`UPDATE store_stocks SET stock_quantity = stock_quantity + ${qty}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
        } else if (operation === 'decrement') {
          await db.$executeRaw`UPDATE store_stocks SET stock_quantity = stock_quantity - ${qty}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
        } else {
          await db.$executeRaw`UPDATE store_stocks SET stock_quantity = ${qty}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
        }
        return true;
      } catch (err2) {
        console.error('updateStoreStock fallback error:', err2);
      }
    }
    return null;
  }
}

/**
 * Bulk update store stock for multiple products in 1 single SQL query
 */
export async function bulkUpdateStoreStock(storeId, items, operation = 'decrement', updatedBy = null, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);
  if (isNaN(storeIdInt) || !Array.isArray(items) || items.length === 0) return true;

  const validItems = items.map(item => ({
    proId: parseInt(item.pro_id, 10),
    qty: parseFloat(item.qnty || 0)
  })).filter(item => !isNaN(item.proId) && !isNaN(item.qty) && item.qty !== 0);

  if (validItems.length === 0) return true;

  const safeUpdatedBy = updatedBy ? parseInt(updatedBy, 10) : null;
  const updatedBySql = Number.isFinite(safeUpdatedBy) ? safeUpdatedBy : 'NULL';

  const valueClauses = validItems.map(item => {
    const change = operation === 'decrement' ? -item.qty : item.qty;
    return `(${storeIdInt}, ${item.proId}, ${change}, 0.00, 1000.00, ${updatedBySql}, NOW(), NOW())`;
  }).join(', ');

  const sql = `
    INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by, created_at, updated_at)
    VALUES ${valueClauses}
    ON DUPLICATE KEY UPDATE 
      stock_quantity = stock_quantity + VALUES(stock_quantity),
      updated_at = NOW(),
      updated_by = VALUES(updated_by)
  `;

  try {
    await db.$executeRawUnsafe(sql);
    return true;
  } catch (e) {
    if (e.code === 'P2010' || e.message?.includes("doesn't exist")) {
      await ensureStoreStocksTable(db);
      try {
        await db.$executeRawUnsafe(sql);
        return true;
      } catch (err2) {
        console.error('bulkUpdateStoreStock error:', err2);
      }
    }
    // Fallback to sequential updates
    for (const item of validItems) {
      await updateStoreStock(storeIdInt, item.proId, item.qty, operation, updatedBy, db);
    }
    return true;
  }
}

/**
 * Get current stock for a product in a store
 */
export async function getStoreStock(storeId, productId, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);
  const productIdInt = parseInt(productId, 10);

  try {
    if (db.storeStock) {
      try {
        const storeStock = await db.storeStock.findUnique({
          where: {
            store_id_pro_id: {
              store_id: storeIdInt,
              pro_id: productIdInt
            }
          }
        });
        return storeStock ? Number(storeStock.stock_quantity) : 0;
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(db);
        try {
          const storeStock = await db.storeStock.findUnique({
            where: {
              store_id_pro_id: {
                store_id: storeIdInt,
                pro_id: productIdInt
              }
            }
          });
          return storeStock ? Number(storeStock.stock_quantity) : 0;
        } catch (retryError) {
          return 0;
        }
      }
    } else {
      try {
        const rows = await db.$queryRaw`
          SELECT stock_quantity 
          FROM store_stocks 
          WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} 
          LIMIT 1
        `;
        return Array.isArray(rows) && rows.length > 0 ? Number(rows[0].stock_quantity) : 0;
      } catch (e) {
        if (e.code === 'P2010') {
          await ensureStoreStocksTable(db);
          return 0;
        }
        throw e;
      }
    }
  } catch (err) {
    return 0;
  }
}

/**
 * Get all store stocks for a product across all stores
 */
export async function getProductStocksAcrossStores(productId, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const productIdInt = parseInt(productId, 10);

  try {
    if (db.storeStock) {
      try {
        return await db.storeStock.findMany({
          where: {
            pro_id: productIdInt
          },
          include: {
            store: {
              select: {
                storeid: true,
                store_name: true,
                store_address: true
              }
            }
          }
        });
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(db);
        return [];
      }
    } else {
      const rows = await db.$queryRaw`
        SELECT 
          ss.*,
          s.storeid,
          s.store_name,
          s.store_address
        FROM store_stocks ss
        INNER JOIN stores s ON ss.store_id = s.storeid
        WHERE ss.pro_id = ${productIdInt}
      `;
      return rows.map(row => ({
        ...row,
        store: {
          storeid: row.storeid,
          store_name: row.store_name,
          store_address: row.store_address
        }
      }));
    }
  } catch (err) {
    return [];
  }
}

/**
 * Get all products and their stocks for a specific store
 */
export async function getStoreStockSummary(storeId, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);

  try {
    if (db.storeStock) {
      try {
        return await db.storeStock.findMany({
          where: {
            store_id: storeIdInt
          },
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true,
                pro_sale_price: true,
                pro_cost_price: true
              }
            }
          },
          orderBy: {
            product: {
              pro_title: 'asc'
            }
          }
        });
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(db);
        return [];
      }
    } else {
      try {
        const rows = await db.$queryRaw`
          SELECT 
            ss.store_stock_id,
            ss.store_id,
            ss.pro_id,
            ss.stock_quantity,
            ss.min_stock,
            ss.max_stock,
            ss.created_at,
            ss.updated_at,
            ss.updated_by,
            p.pro_id as product_pro_id,
            p.pro_title as product_pro_title,
            p.pro_unit as product_pro_unit,
            p.pro_sale_price as product_pro_sale_price,
            p.pro_cost_price as product_pro_cost_price
          FROM store_stocks ss
          INNER JOIN products p ON ss.pro_id = p.pro_id
          WHERE ss.store_id = ${storeIdInt}
          ORDER BY p.pro_title ASC
        `;

        return rows.map(row => ({
          store_stock_id: row.store_stock_id,
          store_id: row.store_id,
          pro_id: row.pro_id,
          stock_quantity: row.stock_quantity,
          min_stock: row.min_stock,
          max_stock: row.max_stock,
          created_at: row.created_at,
          updated_at: row.updated_at,
          updated_by: row.updated_by,
          product: {
            pro_id: row.product_pro_id,
            pro_title: row.product_pro_title,
            pro_unit: row.product_pro_unit,
            pro_sale_price: row.product_pro_sale_price,
            pro_cost_price: row.product_pro_cost_price
          }
        }));
      } catch (e) {
        if (e.code === 'P2010') {
          await ensureStoreStocksTable(db);
          return [];
        }
        throw e;
      }
    }
  } catch (err) {
    return [];
  }
}

/**
 * Check if store has sufficient stock for a sale
 */
export async function checkStockAvailability(storeId, productId, requiredQuantity) {
  const currentStock = await getStoreStock(storeId, productId);
  return currentStock >= requiredQuantity;
}

/**
 * Get low stock products for a store
 */
export async function getLowStockProducts(storeId, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  const storeIdInt = parseInt(storeId, 10);

  try {
    if (db.storeStock) {
      try {
        return await db.storeStock.findMany({
          where: {
            store_id: storeIdInt,
            stock_quantity: {
              lte: db.storeStock.fields.min_stock
            }
          },
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true
              }
            }
          }
        });
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(db);
        return [];
      }
    } else {
      try {
        const rows = await db.$queryRaw`
          SELECT 
            ss.*,
            p.pro_id as product_pro_id,
            p.pro_title as product_pro_title,
            p.pro_unit as product_pro_unit
          FROM store_stocks ss
          INNER JOIN products p ON ss.pro_id = p.pro_id
          WHERE ss.store_id = ${storeIdInt} AND ss.stock_quantity <= ss.min_stock
        `;
        return rows.map(row => ({
          ...row,
          product: {
            pro_id: row.product_pro_id,
            pro_title: row.product_pro_title,
            pro_unit: row.product_pro_unit
          }
        }));
      } catch (e) {
        if (e.code === 'P2010') {
          await ensureStoreStocksTable(db);
          return [];
        }
        throw e;
      }
    }
  } catch (err) {
    return [];
  }
}

/**
 * Transfer stock between stores
 */
export async function transferStock(fromStoreId, toStoreId, productId, quantity, updatedBy = null, prismaClient = null) {
  const db = prismaClient ?? getPrismaClient();

  return await db.$transaction(async (tx) => {
    await updateStoreStock(fromStoreId, productId, quantity, 'decrement', updatedBy, tx);
    await updateStoreStock(toStoreId, productId, quantity, 'increment', updatedBy, tx);
    return {
      success: true,
      message: `Transferred ${quantity} units of product ${productId} from store ${fromStoreId} to store ${toStoreId}`
    };
  });
}
