import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { categoryId, purchasePercentage, salePercentage } = body;

    // Validation
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    // Require at least one percentage (allow negative/positive values)
    const hasPurchase = purchasePercentage !== undefined && purchasePercentage !== null && purchasePercentage !== '';
    const hasSale = salePercentage !== undefined && salePercentage !== null && salePercentage !== '';
    if (!hasPurchase && !hasSale) {
      return NextResponse.json({ error: 'Please provide purchasePercentage and/or salePercentage' }, { status: 400 });
    }

    const purchaseVal = hasPurchase ? parseFloat(purchasePercentage) : null;
    const saleVal = hasSale ? parseFloat(salePercentage) : null;
    if ((purchaseVal !== null && isNaN(purchaseVal)) || (saleVal !== null && isNaN(saleVal))) {
      return NextResponse.json({ error: 'Percentage values must be valid numbers' }, { status: 400 });
    }

    // Get all products in the category
    const products = await prisma.product.findMany({
      where: { cat_id: parseInt(categoryId) }
    });

    if (products.length === 0) {
      return NextResponse.json({ 
        message: 'No products found in this category',
        updatedCount: 0 
      }, { status: 200 });
    }

    // Calculate adjustment amount based on percentage of base price
    // This amount will be added or subtracted from all rates
    let updatedCount = 0;
    
    for (const product of products) {
      try {
        const basePrice = parseFloat(product.pro_baser_price) || 0;
        console.log(`📊 Product: ${product.pro_title}, Base: ${basePrice}`);

        const updatedData = {};

        // Update purchase rate (pro_crate and pro_cost_price) using purchasePercentage (if provided) based on base rate.
        if (purchaseVal !== null) {
          const newPurchase = parseFloat((basePrice + basePrice * (purchaseVal / 100)).toFixed(2));
          const finalPurchase = parseFloat(Math.max(0, newPurchase).toFixed(2));
          updatedData.pro_crate = finalPurchase;
          updatedData.pro_cost_price = finalPurchase;
          console.log(`  Purchase rate: base ${basePrice} → purchase% ${purchaseVal}% = ${finalPurchase}`);
        }

        // Update sale price using salePercentage (if provided) based on the new/existing purchase rate.
        if (saleVal !== null) {
          const refPurchaseRate = purchaseVal !== null
            ? updatedData.pro_crate
            : (parseFloat(product.pro_crate || product.pro_cost_price || 0));

          const newSalePrice = parseFloat((refPurchaseRate + refPurchaseRate * (saleVal / 100)).toFixed(2));
          const finalSalePrice = parseFloat(Math.max(0, newSalePrice).toFixed(2));
          updatedData.pro_sale_price = finalSalePrice;
          console.log(`  Sale: purchaseRate ${refPurchaseRate} → sale% ${saleVal}% = ${finalSalePrice}`);
        }

        // Only update if there's data to update
        if (Object.keys(updatedData).length > 0) {
          await prisma.product.update({
            where: { pro_id: product.pro_id },
            data: updatedData
          });
          updatedCount++;
        }
      } catch (productError) {
        console.error(`Error updating product ${product.pro_id}:`, productError);
        // Continue with next product
      }
    }

    return NextResponse.json({
      message: `Successfully updated ${updatedCount} products`,
      updatedCount: updatedCount,
      totalInCategory: products.length
    }, { status: 200 });

  } catch (error) {
    console.error('Error in adjust-price:', error);
    return NextResponse.json({ 
      error: 'Failed to adjust prices',
      details: error.message 
    }, { status: 500 });
  }
}
