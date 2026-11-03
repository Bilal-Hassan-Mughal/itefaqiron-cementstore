import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { AUDIT_ACTIONS } from '@/lib/audit-logger';
import { LEDGER_AUDIT_CAUSE, logLedgerAudit } from '@/lib/ledger-audit';

const SNAPSHOT_LIMIT = 300;

async function snapshotBeforeDelete(where) {
  const total = await prisma.ledger.count({ where });
  if (total === 0) {
    return { total: 0, rows: [], truncated: false };
  }
  const rows = await prisma.ledger.findMany({
    where,
    select: {
      l_id: true,
      cus_id: true,
      bill_no: true,
      ledger_type: true,
      trnx_type: true,
      debit_amount: true,
      credit_amount: true,
      created_at: true,
    },
    orderBy: { l_id: 'asc' },
    take: SNAPSHOT_LIMIT,
  });
  return { total, rows, truncated: total > rows.length };
}

async function deleteManyWithSnapshot(where) {
  const snapshot = await snapshotBeforeDelete(where);
  if (snapshot.total === 0) {
    return { count: 0, snapshot };
  }
  const result = await prisma.ledger.deleteMany({ where });
  return { count: result.count, snapshot };
}

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
    /** @type {{ category: string, total: number, truncated: boolean, entries: object[] }[]} */
    const auditSnapshots = [];

    if (type === 'all') {
      try {
        const { count, snapshot } = await deleteManyWithSnapshot({});
        deletionResults.total_entries = count;
        totalDeleted = count;
        if (count > 0) {
          auditSnapshots.push({
            category: 'all',
            total: snapshot.total,
            truncated: snapshot.truncated,
            entries: snapshot.rows,
          });
        }
        console.log(`✅ Deleted ${count} ALL ledger entries`);
      } catch (err) {
        console.warn('❌ Could not delete ALL entries:', err.message);
        deletionResults.total_entries = 0;
      }
    } else if (type === 'purchase') {
      try {
        const { count, snapshot } = await deleteManyWithSnapshot({
          trnx_type: 'PURCHASE',
        });
        deletionResults.purchase = count;
        totalDeleted += count;
        if (count > 0) {
          auditSnapshots.push({
            category: 'purchase',
            total: snapshot.total,
            truncated: snapshot.truncated,
            entries: snapshot.rows,
          });
        }
        console.log(`✅ Deleted ${count} PURCHASE entries`);
      } catch (err) {
        console.warn('❌ Could not delete PURCHASE entries:', err.message);
        deletionResults.purchase = 0;
      }

      try {
        const { count, snapshot } = await deleteManyWithSnapshot({
          trnx_type: 'PURCHASE_RETURN',
        });
        deletionResults.purchase_return = count;
        totalDeleted += count;
        if (count > 0) {
          auditSnapshots.push({
            category: 'purchase_return',
            total: snapshot.total,
            truncated: snapshot.truncated,
            entries: snapshot.rows,
          });
        }
        console.log(`✅ Deleted ${count} PURCHASE_RETURN entries`);
      } catch (err) {
        console.warn('❌ Could not delete PURCHASE_RETURN entries:', err.message);
        deletionResults.purchase_return = 0;
      }
    } else if (type === 'order') {
      console.log('ℹ️ Note: SUBSCRIPTION type does not exist in TransactionType enum');
      deletionResults.order = 0;
    } else if (type === 'sales') {
      const salesCategories = [
        { key: 'sale', trnx_type: 'SALE' },
        { key: 'sale_return', trnx_type: 'SALE_RETURN' },
        { key: 'cash_payment', trnx_type: 'CASH_PAYMENT' },
        { key: 'bank_payment', trnx_type: 'BANK_PAYMENT' },
      ];

      for (const { key, trnx_type } of salesCategories) {
        try {
          const { count, snapshot } = await deleteManyWithSnapshot({ trnx_type });
          deletionResults[key] = count;
          totalDeleted += count;
          if (count > 0) {
            auditSnapshots.push({
              category: key,
              total: snapshot.total,
              truncated: snapshot.truncated,
              entries: snapshot.rows,
            });
          }
          console.log(`✅ Deleted ${count} ${trnx_type} entries`);
        } catch (err) {
          console.warn(`❌ Could not delete ${trnx_type} entries:`, err.message);
          deletionResults[key] = 0;
        }
      }
    }

    console.log(`✅ Total deleted ${totalDeleted} ledger entries`);

    if (totalDeleted > 0) {
      logLedgerAudit({
        request,
        branchId: __branchScope.branchId,
        action: AUDIT_ACTIONS.DELETE,
        cause: LEDGER_AUDIT_CAUSE.FINANCE_DELETE_BULK,
        entityId: type,
        description: `Bulk ledger delete (${type}): ${totalDeleted} entr${totalDeleted === 1 ? 'y' : 'ies'} removed.`,
        details: {
          bulk_type: type,
          total_deleted: totalDeleted,
          breakdown: deletionResults,
          snapshots: auditSnapshots,
        },
      });
    }

    if (totalDeleted === 0) {
      return NextResponse.json({
        success: false,
        message: `No ledger entries found for type: ${type}`,
        totalDeleted: 0,
        details: deletionResults,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${totalDeleted} ledger entries`,
      totalDeleted,
      details: deletionResults,
    });
  } catch (error) {
    console.error('❌ Error deleting ledger entries:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete ledger entries',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
