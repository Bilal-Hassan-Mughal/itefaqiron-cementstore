import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateStoreStock, getStoreStock } from '@/lib/storeStock';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

// GET - Get all stock transfers or a specific transfer
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const transferId = searchParams.get('transfer_id');
    const transferNo = searchParams.get('transfer_no');

    if (transferId) {
      // Get specific transfer by ID
      const transfer = await prisma.stockTransfer.findUnique({
        where: { transfer_id: parseInt(transferId) },
        include: {
          from_store: true,
          to_store: true,
          transfer_details: {
            include: {
              product: true
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              email: true
            }
          }
        }
      });

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      return NextResponse.json(transfer);
    }

    if (transferNo) {
      // Get specific transfer by transfer number
      const transfer = await prisma.stockTransfer.findUnique({
        where: { transfer_no: transferNo },
        include: {
          from_store: true,
          to_store: true,
          transfer_details: {
            include: {
              product: true
            }
          },
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              email: true
            }
          }
        }
      });

      if (!transfer) {
        return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
      }

      return NextResponse.json(transfer);
    }

    // Get all transfers
    // Check if Prisma model exists, otherwise use raw SQL
    let transfers;
    if (prisma.stockTransfer && typeof prisma.stockTransfer.findMany === 'function') {
      transfers = await prisma.stockTransfer.findMany({
      include: {
        from_store: {
          select: {
            storeid: true,
            store_name: true
          }
        },
        to_store: {
          select: {
            storeid: true,
            store_name: true
          }
        },
        transfer_details: {
          include: {
            product: {
              select: {
                pro_id: true,
                pro_title: true,
                pro_unit: true
              }
            }
          }
        },
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    } else {
      // Fallback to raw SQL if table exists but Prisma model not available
      try {
        const rawTransfers = await prisma.$queryRaw`
          SELECT 
            st.transfer_id,
            st.transfer_no,
            st.transfer_date,
            st.from_store_id,
            st.to_store_id,
            st.notes,
            st.created_at,
            st.updated_at,
            fs.storeid as from_store_storeid,
            fs.store_name as from_store_name,
            ts.storeid as to_store_storeid,
            ts.store_name as to_store_name
          FROM stock_transfers st
          LEFT JOIN stores fs ON st.from_store_id = fs.storeid
          LEFT JOIN stores ts ON st.to_store_id = ts.storeid
          WHERE st.branch_id = ${branchId}
          ORDER BY st.created_at DESC
        `;
        
        // Fetch transfer details for each transfer
        transfers = await Promise.all(
          (Array.isArray(rawTransfers) ? rawTransfers : []).map(async (transfer) => {
            const details = await prisma.$queryRaw`
              SELECT 
                std.*,
                p.pro_id,
                p.pro_title,
                p.pro_unit
              FROM stock_transfer_details std
              LEFT JOIN products p ON std.pro_id = p.pro_id
              WHERE std.transfer_id = ${transfer.transfer_id}
            `;
            
            return {
              ...transfer,
              from_store: {
                storeid: transfer.from_store_storeid || transfer.from_store_id,
                store_name: transfer.from_store_name
              },
              to_store: {
                storeid: transfer.to_store_storeid || transfer.to_store_id,
                store_name: transfer.to_store_name
              },
              transfer_details: Array.isArray(details) ? details.map(d => ({
                ...d,
                product: {
                  pro_id: d.pro_id,
                  pro_title: d.pro_title,
                  pro_unit: d.pro_unit
                }
              })) : []
            };
          })
        );
      } catch (error) {
        // Table doesn't exist - return empty array with helpful message
        if (error.code === 'P2010' || error.code === 'P2021' || error.message?.includes("doesn't exist") || error.message?.includes('does not exist')) {
          console.warn('⚠️ stock_transfers table does not exist. Returning empty array. Please run the migration SQL.');
          return NextResponse.json([]);
        }
        throw error;
      }
    }

    return NextResponse.json(transfers);
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    
    // Handle table doesn't exist error gracefully
    if (error.code === 'P2021' || error.code === 'P2010' || error.message?.includes("doesn't exist") || error.message?.includes('does not exist')) {
      console.warn('⚠️ stock_transfers table does not exist. Returning empty array.');
      console.warn('📋 Please run the SQL from COPY_THIS_SQL_NOW.sql file in your database.');
      return NextResponse.json([]);
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch stock transfers', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new stock transfer
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const {
      transfer_date,
      from_store_id,
      to_store_id,
      notes,
      transfer_details,
      updated_by
    } = body;

    // Validation
    if (!transfer_date || !from_store_id || !to_store_id) {
      return NextResponse.json(
        { error: 'Transfer date, from store, and to store are required' },
        { status: 400 }
      );
    }

    if (!transfer_details || transfer_details.length === 0) {
      return NextResponse.json(
        { error: 'At least one product must be transferred' },
        { status: 400 }
      );
    }

    if (from_store_id === to_store_id) {
      return NextResponse.json(
        { error: 'From store and to store cannot be the same' },
        { status: 400 }
      );
    }

    // Stock validation removed - allowing negative stock
    // Generate transfer number (optional - can be auto-generated)
    const transferNo = body.transfer_no || `TRF-${Date.now()}`;

    // Create transfer in a transaction with increased timeout
    const result = await prisma.$transaction(async (tx) => {
      // Create the transfer
      // TEMPORARY: Using raw SQL until Prisma client is regenerated
      // TODO: After running 'npx prisma generate', switch back to using tx.stockTransfer.create()
      console.warn('⚠️ Using raw SQL for stock transfer (Prisma model not regenerated). Please run: npx prisma generate');
      
      let transfer;
      
      // Insert transfer using raw SQL
      // Check if table exists first
      try {
        await tx.$executeRaw`
          INSERT INTO stock_transfers (transfer_no, transfer_date, from_store_id, to_store_id, notes, updated_by, created_at, updated_at)
          VALUES (${transferNo}, ${new Date(transfer_date)}, ${parseInt(from_store_id)}, ${parseInt(to_store_id)}, ${notes || null}, ${updated_by || null}, NOW(), NOW())
        `;
      } catch (error) {
        if (error.code === 'P2010' || error.message?.includes("doesn't exist")) {
          return NextResponse.json(
            { 
              error: 'Database tables not found',
              message: 'The stock_transfers table does not exist. You must run the migration SQL first.',
              instructions: [
                '1. Open phpMyAdmin or MySQL Workbench',
                '2. Select your database',
                '3. Go to SQL tab',
                '4. Run the SQL from: prisma/migrations/create_stock_transfers.sql',
                '5. Or see RUN_MIGRATION_NOW.md for the SQL',
                '',
                'The SQL file is located at: prisma/migrations/create_stock_transfers.sql'
              ],
              sqlFile: 'prisma/migrations/create_stock_transfers.sql'
            },
            { status: 500 }
          );
        }
        throw error;
      }
      
      // Get the inserted transfer ID (must be in same connection/transaction)
      const idResult = await tx.$queryRaw`SELECT LAST_INSERT_ID() as transfer_id`;
      
      let transferId = null;
      // Handle different result formats from Prisma
      if (Array.isArray(idResult)) {
        if (idResult.length > 0) {
          const first = idResult[0];
          if (first && typeof first === 'object') {
            transferId = first.transfer_id || first['LAST_INSERT_ID()'] || Object.values(first)[0];
          }
        }
      } else if (idResult && typeof idResult === 'object') {
        transferId = idResult.transfer_id || idResult['LAST_INSERT_ID()'];
      }
      
      // Convert to number if it's a string
      transferId = transferId ? parseInt(transferId) : null;
      
      if (!transferId || isNaN(transferId)) {
        console.error('Failed to get transfer ID. Result:', idResult);
        throw new Error('Failed to get transfer ID after insert');
      }
      
      // Insert transfer details
      for (const detail of transfer_details) {
        await tx.$executeRaw`
          INSERT INTO stock_transfer_details (transfer_id, pro_id, quantity, packing, created_at)
          VALUES (${transferId}, ${detail.pro_id}, ${parseInt(detail.quantity)}, ${parseInt(detail.packing || 0)}, NOW())
        `;
      }
      
      // Fetch the complete transfer with relations
      const transferDataArray = await tx.$queryRaw`
        SELECT 
          st.transfer_id,
          st.transfer_no,
          st.transfer_date,
          st.from_store_id,
          st.to_store_id,
          st.notes,
          st.created_at,
          st.updated_at,
          fs.storeid as from_store_storeid,
          fs.store_name as from_store_name,
          ts.storeid as to_store_storeid,
          ts.store_name as to_store_name
        FROM stock_transfers st
        LEFT JOIN stores fs ON st.from_store_id = fs.storeid
        LEFT JOIN stores ts ON st.to_store_id = ts.storeid
        WHERE st.transfer_id = ${transferId}
      `;
      
      const transferData = Array.isArray(transferDataArray) && transferDataArray.length > 0 
        ? transferDataArray[0] 
        : null;
      
      if (!transferData) {
        throw new Error('Failed to fetch transfer data after insert');
      }
      
      const transferDetailsArray = await tx.$queryRaw`
        SELECT 
          std.transfer_detail_id,
          std.transfer_id,
          std.pro_id,
          std.quantity,
          std.packing,
          p.pro_id as product_pro_id,
          p.pro_title
        FROM stock_transfer_details std
        LEFT JOIN products p ON std.pro_id = p.pro_id
        WHERE std.transfer_id = ${transferId}
      `;
      
      const transferDetails = Array.isArray(transferDetailsArray) ? transferDetailsArray : [];
      
      transfer = {
        transfer_id: transferData.transfer_id,
        transfer_no: transferData.transfer_no,
        transfer_date: transferData.transfer_date,
        from_store_id: transferData.from_store_id,
        to_store_id: transferData.to_store_id,
        notes: transferData.notes,
        created_at: transferData.created_at,
        updated_at: transferData.updated_at,
        from_store: {
          storeid: transferData.from_store_storeid || transferData.from_store_id,
          store_name: transferData.from_store_name
        },
        to_store: {
          storeid: transferData.to_store_storeid || transferData.to_store_id,
          store_name: transferData.to_store_name
        },
        transfer_details: transferDetails.map(d => ({
          transfer_detail_id: d.transfer_detail_id,
          transfer_id: d.transfer_id,
          pro_id: d.pro_id,
          quantity: d.quantity,
          packing: d.packing || 0,
          product: {
            pro_id: d.product_pro_id || d.pro_id,
            pro_title: d.pro_title
          }
        }))
      };

      // Update store stocks - pass transaction client to ensure all operations are in same transaction
      for (const detail of transfer_details) {
        const qty = parseInt(detail.quantity);
        
        // Decrease stock in from_store
        await updateStoreStock(
          parseInt(from_store_id),
          detail.pro_id,
          qty, // Use positive value, operation will be 'decrement'
          'decrement',
          updated_by || null,
          tx // Pass transaction client
        );

        // Increase stock in to_store
        await updateStoreStock(
          parseInt(to_store_id),
          detail.pro_id,
          qty,
          'increment',
          updated_by || null,
          tx // Pass transaction client
        );
      }

      return transfer;
    }, {
      timeout: 60000, // 60 seconds timeout for complex operations
      maxWait: 20000 // 20 seconds max wait to start transaction
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating stock transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create stock transfer', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a stock transfer
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const {
      transfer_id,
      transfer_date,
      from_store_id,
      to_store_id,
      notes,
      transfer_details,
      updated_by
    } = body;

    if (!transfer_id) {
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      );
    }

    // Get existing transfer
    const existingTransfer = await prisma.stockTransfer.findUnique({
      where: { transfer_id: parseInt(transfer_id) },
      include: {
        transfer_details: true
      }
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Reverse the old stock changes
    await prisma.$transaction(async (tx) => {
      for (const detail of existingTransfer.transfer_details) {
        // Reverse: increase from_store, decrease to_store
        await updateStoreStock(
          existingTransfer.from_store_id,
          detail.pro_id,
          detail.quantity,
          updated_by || null
        );
        await updateStoreStock(
          existingTransfer.to_store_id,
          detail.pro_id,
          -detail.quantity,
          updated_by || null
        );
      }
    });

    // Apply new stock changes
    if (transfer_details && transfer_details.length > 0) {
      // Stock validation removed - allowing negative stock
      // Update stocks
      await prisma.$transaction(async (tx) => {
        for (const detail of transfer_details) {
          const qty = parseInt(detail.quantity);
          const fromStore = from_store_id || existingTransfer.from_store_id;
          const toStore = to_store_id || existingTransfer.to_store_id;

          await updateStoreStock(fromStore, detail.pro_id, -qty, updated_by || null);
          await updateStoreStock(toStore, detail.pro_id, qty, updated_by || null);
        }
      });
    }

    // Update the transfer record
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { transfer_id: parseInt(transfer_id) },
      data: {
        ...(transfer_date && { transfer_date: new Date(transfer_date) }),
        ...(from_store_id && { from_store_id: parseInt(from_store_id) }),
        ...(to_store_id && { to_store_id: parseInt(to_store_id) }),
        ...(notes !== undefined && { notes }),
        ...(updated_by && { updated_by: parseInt(updated_by) }),
        ...(transfer_details && {
          transfer_details: {
            deleteMany: {},
            create: transfer_details.map(detail => ({
              pro_id: detail.pro_id,
              quantity: parseInt(detail.quantity),
              packing: parseInt(detail.packing || 0)
            }))
          }
        })
      },
      include: {
        from_store: true,
        to_store: true,
        transfer_details: {
          include: {
            product: true
          }
        }
      }
    });

    return NextResponse.json(updatedTransfer);
  } catch (error) {
    console.error('Error updating stock transfer:', error);
    return NextResponse.json(
      { error: 'Failed to update stock transfer', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a stock transfer
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const transferId = searchParams.get('transfer_id');

    if (!transferId) {
      return NextResponse.json(
        { error: 'Transfer ID is required' },
        { status: 400 }
      );
    }

    // Get existing transfer
    const existingTransfer = await prisma.stockTransfer.findUnique({
      where: { transfer_id: parseInt(transferId) },
      include: {
        transfer_details: true
      }
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Transfer not found' },
        { status: 404 }
      );
    }

    // Reverse stock changes and delete transfer
    await prisma.$transaction(async (tx) => {
      // Reverse stock changes
      for (const detail of existingTransfer.transfer_details) {
        // Reverse: increase from_store, decrease to_store
        await updateStoreStock(
          existingTransfer.from_store_id,
          detail.pro_id,
          detail.quantity,
          null
        );
        await updateStoreStock(
          existingTransfer.to_store_id,
          detail.pro_id,
          -detail.quantity,
          null
        );
      }

      // Delete the transfer (cascade will delete details)
      await tx.stockTransfer.delete({
        where: { transfer_id: parseInt(transferId) }
      });
    });

    return NextResponse.json({ message: 'Transfer deleted successfully' });
  } catch (error) {
    console.error('Error deleting stock transfer:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock transfer', details: error.message },
      { status: 500 }
    );
  }
}

