import { prisma } from './prisma';

/**
 * Get the next sequential ID for a given model and primary key field.
 *
 * @param {string} modelName - Prisma model name (camelCase, e.g. 'customerCategory')
 * @param {string} idFieldName - Primary key field name (e.g. 'cus_cat_id')
 * @param {object} [tx] - Active transaction client (optional)
 * @returns {Promise<number>} Next ID value (MAX(id) + 1)
 */
export async function getNextId(modelName, idFieldName, tx = null) {
  const db = tx || prisma;
  const result = await db[modelName].aggregate({
    _max: {
      [idFieldName]: true
    }
  });
  const maxVal = result._max[idFieldName];
  return (maxVal || 0) + 1;
}

export default {
  getNextId
};
