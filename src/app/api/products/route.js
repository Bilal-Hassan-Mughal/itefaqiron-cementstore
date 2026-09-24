import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { updateStoreStock } from '@/lib/storeStock';
import { resolveBranchId, mergeBranchWhere, withBranchData } from '@/lib/branch-server';
import { initBranchScope } from '@/lib/branch-server';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ========================================
// GET — Get all products with relational data
// ========================================
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const branchId = resolveBranchId(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const categoryId = searchParams.get('categoryId') ? parseInt(searchParams.get('categoryId')) : null;
    const subCategoryId = searchParams.get('subCategoryId') ? parseInt(searchParams.get('subCategoryId')) : null;

    if (id) {
      // Get single product
      const product = await prisma.product.findFirst({
        where: { pro_id: id, branch_id: branchId },
        include: {
          category: {
            select: {
              cat_id: true,
              cat_name: true,
              cat_code: true
            }
          },
          sub_category: {
            select: {
              sub_cat_id: true,
              sub_cat_name: true,
              sub_cat_code: true
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              role: true
            }
          }
        },
      });

      if (!product) return errorResponse('Product not found', 404);
      return NextResponse.json(product);
    }

    // Build where clause for filtering
    let whereClause = mergeBranchWhere(branchId, {});
    if (categoryId) whereClause.cat_id = categoryId;
    if (subCategoryId) whereClause.sub_cat_id = subCategoryId;

    // Get all products with relational data
    const isDropdown = searchParams.get('dropdown') === 'true' || searchParams.get('minimal') === 'true';
    if (isDropdown) {
      const skipStoreStocks = searchParams.get('noStoreStock') === 'true';
      const dropdownSelect = {
        pro_id: true,
        pro_title: true,
        pro_cost_price: true,
        pro_sale_price: true,
        pro_baser_price: true,
        pro_crate: true,
        pro_unit: true,
        pro_packing: true,
        pro_stock_qnty: true,
        ...(skipStoreStocks
          ? {}
          : {
              store_stocks: {
                select: {
                  store_id: true,
                  stock_quantity: true
                }
              }
            })
      };
      const products = await prisma.product.findMany({
        where: whereClause,
        select: dropdownSelect,
        orderBy: { created_at: 'desc' }
      });
      return NextResponse.json(products);
    }

    try {
      const products = await prisma.product.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              cat_id: true,
              cat_name: true,
              cat_code: true
            }
          },
          sub_category: {
            select: {
              sub_cat_id: true,
              sub_cat_name: true,
              sub_cat_code: true
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              role: true
            }
          },
          store_stocks: {
            select: {
              store_id: true,
              stock_quantity: true
            }
          }
        },
        orderBy: { created_at: 'desc' },
      });

      return NextResponse.json(products);
    } catch (includeError) {
      console.error('❌ Error with include:', includeError);
      // Fallback to simple query
      const products = await prisma.product.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(products);
    }
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    return NextResponse.json([]);
  }
}

// ========================================
// POST — Create a new product
// ========================================
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const branchId = resolveBranchId(request);
    console.log('✅ POST method called');
    
    const body = await request.json();
    console.log('✅ Request body received');
    
    // Simple validation
    if (!body.pro_title?.trim()) return errorResponse('Product title is required');
    
    // Get or create user
    let user = await prisma.users.findFirst();
    if (!user) {
      user = await prisma.users.create({
        data: {
          email: 'admin@example.com',
          full_name: 'System Administrator',
          password: 'hashedpassword',
          role: 'ADMIN',
          is_verified: true,
          status: 'ACTIVE'
        }
      });
    }

    // Validation for required fields
    if (!body.cat_id) return errorResponse('Category is required');
    if (!body.sub_cat_id) return errorResponse('Subcategory is required');
    if (!body.pro_title || !body.pro_title.trim()) return errorResponse('Product title is required');

    // Verify category and subcategory exist
    const category = await prisma.categories.findUnique({
      where: { cat_id: parseInt(body.cat_id) }
    });
    if (!category) return errorResponse('Invalid category selected');

    const subcategory = await prisma.subCategory.findUnique({
      where: { sub_cat_id: parseInt(body.sub_cat_id) }
    });
    if (!subcategory) return errorResponse('Invalid subcategory selected');

    // Verify subcategory belongs to the selected category
    if (subcategory.cat_id !== parseInt(body.cat_id)) {
      return errorResponse('Selected subcategory does not belong to the selected category');
    }

    const pro_id = body.pro_id || await getNextId('product', 'pro_id');

    // Create new product with provided data
    const newProduct = await prisma.product.create({
      data: withBranchData(branchId, {
        pro_id,
        cat_id: parseInt(body.cat_id),
        sub_cat_id: parseInt(body.sub_cat_id),
        pro_title: body.pro_title.trim(),
        pro_description: body.pro_description?.trim() || '',
        pro_cost_price: parseFloat(body.pro_cost_price) || 0,
        pro_sale_price: parseFloat(body.pro_sale_price) || 0,
        pro_baser_price: parseFloat(body.pro_baser_price) || 0,
        pro_crate: parseFloat(body.pro_crate) || 0,
        pro_stock_qnty: parseInt(body.pro_stock_qnty) || 0,
        low_stock_quantity: body.low_stock_quantity !== undefined ? parseInt(body.low_stock_quantity) || 10 : 10,
        pro_unit: body.pro_unit?.trim() || 'pcs',
        pro_packing: body.pro_packing?.trim() || null,
        updated_by: user.user_id,
      })
    });

    if (body.store_id) {
      await updateStoreStock(
        parseInt(body.store_id),
        newProduct.pro_id,
        parseFloat(newProduct.pro_stock_qnty) || 0,
        'set',
        user.user_id
      );
    }

    const createdProductWithRelations = await prisma.product.findUnique({
      where: { pro_id: newProduct.pro_id },
      include: {
        category: {
          select: {
            cat_id: true,
            cat_name: true,
            cat_code: true
          }
        },
        sub_category: {
          select: {
            sub_cat_id: true,
            sub_cat_name: true,
            sub_cat_code: true
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            role: true
          }
        },
        store_stocks: {
          select: {
            store_id: true,
            stock_quantity: true
          }
        }
      }
    });

    console.log('✅ Product created successfully');
    return NextResponse.json(createdProductWithRelations, { status: 201 });
  } catch (err) {
    console.error('❌ Error creating product:', err);
    return errorResponse('Failed to create product', 500);
  }
}

// ========================================
// PUT — Update a product
// ========================================
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    
    if (!body.id) return errorResponse('Product ID is required');

    // Get or create user
    let user = await prisma.users.findFirst();
    if (!user) {
      user = await prisma.users.create({
        data: {
          email: 'admin@example.com',
          full_name: 'System Administrator',
          password: 'hashedpassword',
          role: 'ADMIN',
          is_verified: true,
          status: 'ACTIVE'
        }
      });
    }

    // Prepare update data
    const updateData = {
      pro_title: body.pro_title?.trim(),
      pro_description: body.pro_description?.trim(),
      pro_cost_price: body.pro_cost_price ? parseFloat(body.pro_cost_price) : undefined,
      pro_sale_price: body.pro_sale_price ? parseFloat(body.pro_sale_price) : undefined,
      pro_baser_price: body.pro_baser_price ? parseFloat(body.pro_baser_price) : undefined,
      pro_crate: body.pro_crate ? parseFloat(body.pro_crate) : undefined,
      pro_stock_qnty: body.pro_stock_qnty ? parseInt(body.pro_stock_qnty) : undefined,
      low_stock_quantity: body.low_stock_quantity !== undefined ? parseInt(body.low_stock_quantity) : undefined,
      pro_unit: body.pro_unit?.trim(),
      pro_packing: body.pro_packing?.trim(),
      updated_by: user.user_id,
    };

    // Handle category and subcategory updates if provided
    if (body.cat_id && body.sub_cat_id) {
      // Verify category and subcategory exist
      const category = await prisma.categories.findUnique({
        where: { cat_id: parseInt(body.cat_id) }
      });
      if (!category) return errorResponse('Invalid category selected');

      const subcategory = await prisma.subCategory.findUnique({
        where: { sub_cat_id: parseInt(body.sub_cat_id) }
      });
      if (!subcategory) return errorResponse('Invalid subcategory selected');

      // Verify subcategory belongs to the selected category
      if (subcategory.cat_id !== parseInt(body.cat_id)) {
        return errorResponse('Selected subcategory does not belong to the selected category');
      }

      updateData.cat_id = parseInt(body.cat_id);
      updateData.sub_cat_id = parseInt(body.sub_cat_id);
    }

    const updatedProduct = await prisma.product.update({
      where: { pro_id: body.id },
      data: updateData,
      include: {
        category: {
          select: {
            cat_id: true,
            cat_name: true,
            cat_code: true
          }
        },
        sub_category: {
          select: {
            sub_cat_id: true,
            sub_cat_name: true,
            sub_cat_code: true
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            role: true
          }
        },
        store_stocks: {
          select: {
            store_id: true,
            stock_quantity: true
          }
        }
      }
    });

    if (body.store_id && body.pro_stock_qnty !== undefined) {
      await updateStoreStock(
        parseInt(body.store_id),
        updatedProduct.pro_id,
        parseFloat(updatedProduct.pro_stock_qnty) || 0,
        'set',
        user.user_id
      );

      const finalProduct = await prisma.product.findUnique({
        where: { pro_id: updatedProduct.pro_id },
        include: {
          category: {
            select: {
              cat_id: true,
              cat_name: true,
              cat_code: true
            }
          },
          sub_category: {
            select: {
              sub_cat_id: true,
              sub_cat_name: true,
              sub_cat_code: true
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              role: true
            }
          },
          store_stocks: {
            select: {
              store_id: true,
              stock_quantity: true
            }
          }
        }
      });
      return NextResponse.json(finalProduct);
    }

    return NextResponse.json(updatedProduct);
  } catch (err) {
    console.error('❌ Error updating product:', err);
    return errorResponse('Failed to update product', 500);
  }
}

// ========================================
// DELETE — Delete a product
// ========================================
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

  if (!id) return errorResponse('Product ID is required');

  try {
    // Check if product exists
    const existing = await prisma.product.findUnique({
      where: { pro_id: id },
      include: {
        _count: {
          select: {
            sale_details: true,
            purchase_details: true
          }
        }
      }
    });

    if (!existing) return errorResponse('Product not found', 404);

    // Check if product has related records
    if (existing._count.sale_details > 0) {
      return errorResponse('Cannot delete product with existing sales. Please archive instead.', 409);
    }
    if (existing._count.purchase_details > 0) {
      return errorResponse('Cannot delete product with existing purchases. Please archive instead.', 409);
    }

    // Delete product
    await prisma.product.delete({
      where: { pro_id: id },
    });

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting product:', err);
    return errorResponse('Failed to delete product', 500);
  }
}