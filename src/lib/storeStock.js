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
    // If creation fails (permissions), log and continue; callers will handle fallbacks
    console.warn('ensureStoreStocksTable: could not ensure table exists:', e.message);
  }
}

/**
 * Get or create store stock entry for a product
 */
export async function getOrCreateStoreStock(storeId, productId, updatedBy = null, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure storeId and productId are integers
  const storeIdInt = parseInt(storeId);
  const productIdInt = parseInt(productId);

  try {
    const useDelegate = !!prisma.storeStock;
    let storeStock;
    if (useDelegate) {
      try {
        storeStock = await prisma.storeStock.findUnique({
          where: {
            store_id_pro_id: {
              store_id: storeIdInt,
              pro_id: productIdInt
            }
          }
        });
      } catch (e) {
        if (e.code === 'P2021') {
          await ensureStoreStocksTable(prisma);
        } else {
          throw e;
        }
      }
    }

    if (!storeStock) {
      const rows = await prisma.$queryRaw`SELECT * FROM store_stocks WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} LIMIT 1`;
      storeStock = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    }

    if (!storeStock) {
      if (useDelegate) {
        try {
          storeStock = await prisma.storeStock.upsert({
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
            await ensureStoreStocksTable(prisma);
          } else {
            throw e;
          }
        }
      }

      if (!storeStock) {
        await prisma.$executeRaw`INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by) VALUES (${storeIdInt}, ${productIdInt}, 0.00, 0.00, 1000.00, ${updatedBy}) ON DUPLICATE KEY UPDATE store_stock_id = store_stock_id`;
        const rows2 = await prisma.$queryRaw`SELECT * FROM store_stocks WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} LIMIT 1`;
        storeStock = Array.isArray(rows2) && rows2.length > 0 ? rows2[0] : null;
      }
    }

    return storeStock;
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Update store stock quantity
 */
export async function updateStoreStock(storeId, productId, quantityChange, operation = 'increment', updatedBy = null, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure storeId and productId are integers
  const storeIdInt = parseInt(storeId);
  const productIdInt = parseInt(productId);

  try {
    const storeStock = await getOrCreateStoreStock(storeIdInt, productIdInt, updatedBy, prisma);

    const updateData = {
      updated_by: updatedBy,
      updated_at: new Date()
    };

    if (operation === 'increment') {
      updateData.stock_quantity = {
        increment: quantityChange
      };
    } else if (operation === 'decrement') {
      updateData.stock_quantity = {
        decrement: quantityChange
      };
    } else if (operation === 'set') {
      updateData.stock_quantity = quantityChange;
    }

    if (prisma.storeStock) {
      try {
        return await prisma.storeStock.update({
          where: {
            store_id_pro_id: {
              store_id: storeIdInt,
              pro_id: productIdInt
            }
          },
          data: updateData
        });
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(prisma);
        // Fall through to raw SQL
      }
    }

    // Raw SQL fallback
    if (operation === 'increment') {
      await prisma.$executeRaw`UPDATE store_stocks SET stock_quantity = stock_quantity + ${quantityChange}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
    } else if (operation === 'decrement') {
      await prisma.$executeRaw`UPDATE store_stocks SET stock_quantity = stock_quantity - ${quantityChange}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
    } else {
      await prisma.$executeRaw`UPDATE store_stocks SET stock_quantity = ${quantityChange}, updated_by = ${updatedBy}, updated_at = NOW() WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt}`;
    }
    const rows = await prisma.$queryRaw`SELECT * FROM store_stocks WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} LIMIT 1`;
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Get current stock for a product in a store
 */
export async function getStoreStock(storeId, productId, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure storeId and productId are integers
  const storeIdInt = parseInt(storeId);
  const productIdInt = parseInt(productId);

  try {
    if (prisma.storeStock) {
      try {
        const storeStock = await prisma.storeStock.findUnique({
          where: {
            store_id_pro_id: {
              store_id: storeIdInt,
              pro_id: productIdInt
            }
          }
        });
        return storeStock ? storeStock.stock_quantity : 0;
      } catch (e) {
        if (e.code !== 'P2021') throw e;
        await ensureStoreStocksTable(prisma);
        // Try again after table creation
        try {
          const storeStock = await prisma.storeStock.findUnique({
            where: {
              store_id_pro_id: {
                store_id: storeIdInt,
                pro_id: productIdInt
              }
            }
          });
          return storeStock ? storeStock.stock_quantity : 0;
        } catch (retryError) {
          return 0;
        }
      }
    } else {
      // Fallback to raw SQL
      try {
        const rows = await prisma.$queryRaw`
          SELECT stock_quantity 
          FROM store_stocks 
          WHERE store_id = ${storeIdInt} AND pro_id = ${productIdInt} 
          LIMIT 1
        `;
        return Array.isArray(rows) && rows.length > 0 ? Number(rows[0].stock_quantity) : 0;
      } catch (e) {
        // If table doesn't exist, try to create and return 0
        if (e.code === 'P2010') {
          await ensureStoreStocksTable(prisma);
          return 0;
        }
        throw e;
      }
    }
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Get all store stocks for a product across all stores
 */
export async function getProductStocksAcrossStores(productId, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure productId is an integer
  const productIdInt = parseInt(productId);

  try {
    if (prisma.storeStock) {
      try {
        return await prisma.storeStock.findMany({
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
        await ensureStoreStocksTable(prisma);
        return [];
      }
    } else {
      // Fallback to raw SQL
      const rows = await prisma.$queryRaw`
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
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Get all products and their stocks for a specific store
 */
export async function getStoreStockSummary(storeId, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure storeId is an integer
  const storeIdInt = parseInt(storeId);

  try {
    // Check if storeStock model exists, otherwise use raw SQL
    if (prisma.storeStock) {
      try {
        return await prisma.storeStock.findMany({
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
        await ensureStoreStocksTable(prisma);
        return [];
      }
    } else {
      // Fallback to raw SQL if model not available
      try {
        const rows = await prisma.$queryRaw`
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

        // Transform raw SQL results to match expected format
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
          await ensureStoreStocksTable(prisma);
          return [];
        }
        throw e;
      }
    }
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
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
  const prisma = prismaClient ?? getPrismaClient();

  // Ensure storeId is an integer
  const storeIdInt = parseInt(storeId);

  try {
    if (prisma.storeStock) {
      try {
        return await prisma.storeStock.findMany({
          where: {
            store_id: storeIdInt,
            stock_quantity: {
              lte: prisma.storeStock.fields.min_stock
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
        await ensureStoreStocksTable(prisma);
        return [];
      }
    } else {
      // Fallback to raw SQL
      try {
        const rows = await prisma.$queryRaw`
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
          await ensureStoreStocksTable(prisma);
          return [];
        }
        throw e;
      }
    }
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}

/**
 * Transfer stock between stores
 */
export async function transferStock(fromStoreId, toStoreId, productId, quantity, updatedBy = null, prismaClient = null) {
  const prisma = prismaClient ?? getPrismaClient();

  try {
    return await prisma.$transaction(async (tx) => {
      // Decrease stock in source store
      await updateStoreStock(fromStoreId, productId, quantity, 'decrement', updatedBy);

      // Increase stock in destination store
      await updateStoreStock(toStoreId, productId, quantity, 'increment', updatedBy);

      return {
        success: true,
        message: `Transferred ${quantity} units of product ${productId} from store ${fromStoreId} to store ${toStoreId}`
      };
    });
  } finally {
    // Don't disconnect if using shared instance
    if (prismaClient && prismaClient !== prisma) {
      await prisma.$disconnect();
    }
  }
}
