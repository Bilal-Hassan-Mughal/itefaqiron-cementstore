import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';

// Get next draft code
async function getNextDraftCode() {
  const lastDraft = await prisma.draftSale.findFirst({
    orderBy: { draft_id: 'desc' },
    select: { draft_code: true }
  });

  if (!lastDraft) return 'DRAFT-001';

  // Extract number from last draft code
  const lastNumber = parseInt(lastDraft.draft_code.split('-')[1]);
  const nextNumber = lastNumber + 1;
  return `DRAFT-${String(nextNumber).padStart(3, '0')}`;
}

// GET - Fetch all active drafts or specific draft
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      // Fetch specific draft
      const draft = await prisma.draftSale.findUnique({
        where: { draft_id: parseInt(id) },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true,
              cus_address: true
            }
          }
        }
      });

      if (!draft) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }

      return NextResponse.json(draft);
    }

    // Fetch all active drafts
    const drafts = await prisma.draftSale.findMany({
      where: { is_active: true },
      include: {
        customer: {
          select: {
            cus_id: true,
            cus_name: true,
            cus_phone_no: true
          }
        }
      },
      orderBy: { updated_at: 'desc' }
    });

    return NextResponse.json(drafts);
  } catch (error) {
    console.error('❌ Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update draft
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const data = await request.json();
    const {
      draft_id, // If provided, it's an update
      store_id,
      cus_id,
      form_state, // Form data to save
      updated_by
    } = data;

    // Validate form_state
    if (!form_state) {
      return NextResponse.json(
        { error: 'form_state is required' },
        { status: 400 }
      );
    }

    // Convert form_state to JSON string
    const formStateJson = typeof form_state === 'string' ? form_state : JSON.stringify(form_state);
    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    if (draft_id) {
      // Update existing draft
      const updatedDraft = await prisma.draftSale.update({
        where: { draft_id: parseInt(draft_id) },
        data: {
          store_id: store_id || null,
          cus_id: cus_id || null,
          form_state_json: formStateJson,
          updated_by: validatedUpdatedBy
        },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          }
        }
      });

      console.log('✅ Draft updated:', updatedDraft.draft_code);
      return NextResponse.json(updatedDraft);
    } else {
      // Create new draft
      const draftCode = await getNextDraftCode();

      const newDraft = await prisma.draftSale.create({
        data: {
          draft_code: draftCode,
          store_id: store_id || null,
          cus_id: cus_id || null,
          form_state_json: formStateJson,
          is_active: true,
          updated_by: validatedUpdatedBy
        },
        include: {
          customer: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          }
        }
      });

      console.log('✅ Draft created:', draftCode);
      return NextResponse.json(newDraft);
    }
  } catch (error) {
    console.error('❌ Error saving draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a draft
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    const deletedDraft = await prisma.draftSale.delete({
      where: { draft_id: parseInt(id) }
    });

    console.log('✅ Draft deleted:', deletedDraft.draft_code);
    return NextResponse.json({
      success: true,
      message: `Draft ${deletedDraft.draft_code} deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Deactivate a draft (soft delete)
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const data = await request.json();
    const { id, is_active } = data;

    if (!id) {
      return NextResponse.json(
        { error: 'Draft ID is required' },
        { status: 400 }
      );
    }

    const updatedDraft = await prisma.draftSale.update({
      where: { draft_id: parseInt(id) },
      data: { is_active: is_active !== undefined ? is_active : false }
    });

    console.log(`✅ Draft ${updatedDraft.draft_code} status updated to is_active=${updatedDraft.is_active}`);
    return NextResponse.json(updatedDraft);
  } catch (error) {
    console.error('❌ Error updating draft status:', error);
    return NextResponse.json(
      { error: 'Failed to update draft', details: error.message },
      { status: 500 }
    );
  }
}
