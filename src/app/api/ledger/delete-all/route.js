import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { type } = body;

    console.log(`🗑️ Starting ledger deletion for type: ${type}`);

    if (!type) {
      return NextResponse.json(
        { error: 'Type parameter is required' },
        { status: 400 }
      );
    }

    let totalDeleted = 0;
    const deletionResults = {};

    // Delete ALL transactions regardless of type
    if (type === 'all') {
      try {
        const allDeletions = await prisma.ledger.deleteMany({});
        deletionResults.total_entries = allDeletions.count;
        totalDeleted = allDeletions.count;
        console.log(`✅ Deleted ${allDeletions.count} ALL ledger entries`);
      } catch (err) {
        console.warn('❌ Could not delete ALL entries:', err.message);
        deletionResults.total_entries = 0;
      }
    }
    // Delete PURCHASE transactions
    else if (type === 'purchase') {
      try {
        const purchaseDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'PURCHASE'
          }
        });
        deletionResults.purchase = purchaseDeletions.count;
        totalDeleted += purchaseDeletions.count;
        console.log(`✅ Deleted ${purchaseDeletions.count} PURCHASE entries`);
      } catch (err) {
        console.warn('❌ Could not delete PURCHASE entries:', err.message);
        deletionResults.purchase = 0;
      }

      try {
        const purchaseReturnDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'PURCHASE_RETURN'
          }
        });
        deletionResults.purchase_return = purchaseReturnDeletions.count;
        totalDeleted += purchaseReturnDeletions.count;
        console.log(`✅ Deleted ${purchaseReturnDeletions.count} PURCHASE_RETURN entries`);
      } catch (err) {
        console.warn('❌ Could not delete PURCHASE_RETURN entries:', err.message);
        deletionResults.purchase_return = 0;
      }
    }
    // Delete ORDER transactions (note: SUBSCRIPTION doesn't exist in enum)
    else if (type === 'order') {
      console.log('ℹ️ Note: SUBSCRIPTION type does not exist in TransactionType enum');
      deletionResults.order = 0;
    }
    // Delete SALES transactions
    else if (type === 'sales') {
      try {
        const saleDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'SALE'
          }
        });
        deletionResults.sale = saleDeletions.count;
        totalDeleted += saleDeletions.count;
        console.log(`✅ Deleted ${saleDeletions.count} SALE entries`);
      } catch (err) {
        console.warn('❌ Could not delete SALE entries:', err.message);
        deletionResults.sale = 0;
      }

      try {
        const returnDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'SALE_RETURN'
          }
        });
        deletionResults.sale_return = returnDeletions.count;
        totalDeleted += returnDeletions.count;
        console.log(`✅ Deleted ${returnDeletions.count} SALE_RETURN entries`);
      } catch (err) {
        console.warn('❌ Could not delete SALE_RETURN entries:', err.message);
        deletionResults.sale_return = 0;
      }

      try {
        const cashPaymentDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'CASH_PAYMENT'
          }
        });
        deletionResults.cash_payment = cashPaymentDeletions.count;
        totalDeleted += cashPaymentDeletions.count;
        console.log(`✅ Deleted ${cashPaymentDeletions.count} CASH_PAYMENT entries`);
      } catch (err) {
        console.warn('❌ Could not delete CASH_PAYMENT entries:', err.message);
        deletionResults.cash_payment = 0;
      }

      try {
        const bankPaymentDeletions = await prisma.ledger.deleteMany({
          where: {
            trnx_type: 'BANK_PAYMENT'
          }
        });
        deletionResults.bank_payment = bankPaymentDeletions.count;
        totalDeleted += bankPaymentDeletions.count;
        console.log(`✅ Deleted ${bankPaymentDeletions.count} BANK_PAYMENT entries`);
      } catch (err) {
        console.warn('❌ Could not delete BANK_PAYMENT entries:', err.message);
        deletionResults.bank_payment = 0;
      }
    }

    console.log(`✅ Total deleted ${totalDeleted} ledger entries`);

    if (totalDeleted === 0) {
      return NextResponse.json({
        success: false,
        message: `No ledger entries found for type: ${type}`,
        totalDeleted: 0,
        details: deletionResults
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} ledger entries`,
      totalDeleted,
      details: deletionResults
    });
  } catch (error) {
    console.error('❌ Error deleting ledger entries:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete ledger entries', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
