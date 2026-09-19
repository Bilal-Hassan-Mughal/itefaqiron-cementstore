import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateStoreStock } from '@/lib/storeStock';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

// POST - Convert hold bill to actual sale
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { hold_bill_id, updated_by } = body;

    if (!hold_bill_id) {
      return NextResponse.json({ error: 'Hold bill ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get hold bill with details
      const holdBill = await tx.holdBill.findUnique({
        where: { hold_bill_id },
        include: {
          hold_bill_details: {
            include: {
              product: true
            }
          },
          customer: true
        }
      });

      if (!holdBill) {
        throw new Error('Hold bill not found');
      }

      if (holdBill.status === 'CONVERTED') {
        throw new Error('Hold bill has already been converted');
      }

      if (holdBill.status === 'CANCELLED') {
        throw new Error('Cannot convert a cancelled hold bill');
      }

      // Calculate net total (including shipping amount)
      const netTotal = parseFloat(holdBill.total_amount) - parseFloat(holdBill.discount) + parseFloat(holdBill.shipping_amount || 0);

      // Create sale
      const sale = await tx.sale.create({
        data: {
          cus_id: holdBill.cus_id,
          total_amount: parseFloat(holdBill.total_amount),
          discount: parseFloat(holdBill.discount),
          payment: parseFloat(holdBill.payment),
          payment_type: holdBill.payment_type,
          debit_account_id: holdBill.debit_account_id,
          credit_account_id: holdBill.credit_account_id,
          loader_id: holdBill.loader_id,
          shipping_amount: parseFloat(holdBill.shipping_amount || 0),
          bill_type: holdBill.bill_type,
          reference: holdBill.reference,
          updated_by
        }
      });

      // Create sale details
      const saleDetailPromises = holdBill.hold_bill_details.map(detail => 
        tx.saleDetail.create({
          data: {
            sale_id: sale.sale_id,
            pro_id: detail.pro_id,
            vehicle_no: detail.vehicle_no,
            qnty: detail.qnty,
            unit: detail.unit,
            unit_rate: detail.unit_rate,
            total_amount: detail.total_amount,
            discount: detail.discount,
            net_total: detail.net_total,
            cus_id: holdBill.cus_id,
            updated_by
          }
        })
      );

      await Promise.all(saleDetailPromises);

      // Update store stock quantities
      const storeStockUpdatePromises = holdBill.hold_bill_details.map(async detail => {
        await updateStoreStock(holdBill.store_id, detail.pro_id, detail.qnty, 'decrement', updated_by);
      });

      await Promise.all(storeStockUpdatePromises);

      // Create ledger entries
      // Debit entry for sale
      const l_id_hb = await getNextId('ledger', 'l_id', tx);
      await tx.ledger.create({
        data: {
          l_id: l_id_hb,
          cus_id: holdBill.cus_id,
          opening_balance: holdBill.customer.cus_balance,
          debit_amount: netTotal,
          credit_amount: 0,
          closing_balance: holdBill.customer.cus_balance + netTotal,
          bill_no: sale.sale_id,
          trnx_type: 'CASH',
          ledger_type: holdBill.bill_type === 'ORDER' ? 'Order' : 'Sale',
          details: `Sale - ${holdBill.bill_type} (Converted from Hold Bill #${holdBill.hold_bill_id})`,
          payments: 0,
          updated_by
        }
      });

      // Credit entry for payment (if payment > 0)
      if (parseFloat(holdBill.payment) > 0) {
        const l_id_hb_pay = await getNextId('ledger', 'l_id', tx);
        await tx.ledger.create({
          data: {
            l_id: l_id_hb_pay,
            cus_id: holdBill.cus_id,
            opening_balance: holdBill.customer.cus_balance + netTotal,
            debit_amount: 0,
            credit_amount: parseFloat(holdBill.payment),
            closing_balance: holdBill.customer.cus_balance + netTotal - parseFloat(holdBill.payment),
            bill_no: sale.sale_id,
            trnx_type: holdBill.payment_type,
            ledger_type: 'Receiving',
            details: `Payment - ${holdBill.bill_type} (Converted from Hold Bill #${holdBill.hold_bill_id})`,
            payments: parseFloat(holdBill.payment),
            updated_by
          }
        });
      }

      // Update customer balance
      await tx.customer.update({
        where: { cus_id: holdBill.cus_id },
        data: {
          cus_balance: holdBill.customer.cus_balance + netTotal - parseFloat(holdBill.payment)
        }
      });

      // Update hold bill status to CONVERTED
      await tx.holdBill.update({
        where: { hold_bill_id },
        data: {
          status: 'CONVERTED',
          updated_by
        }
      });

      return {
        sale,
        holdBill: {
          ...holdBill,
          status: 'CONVERTED'
        }
      };
    }, {
      timeout: 15000 // 15 seconds timeout for complex transactions
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error converting hold bill:', error);
    return NextResponse.json({ error: 'Failed to convert hold bill' }, { status: 500 });
  }
}


