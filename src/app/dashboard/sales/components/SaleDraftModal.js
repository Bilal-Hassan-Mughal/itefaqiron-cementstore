'use client';

import { useSalesContext } from './SalesContext';
import BillHoldDraftModal from './BillHoldDraftModal';

/** Bill hold modal for SalesPageContent — same UI, context wiring only. */
export default function SaleDraftModal() {
  const {
    draftModalOpen,
    setDraftModalOpen,
    draftSearchTerm,
    setDraftSearchTerm,
    drafts,
    handleLoadDraft,
    handleDeleteDraft,
    clearingAllDrafts,
    handleClearAllDrafts,
    fetchDrafts,
  } = useSalesContext();

  return (
    <BillHoldDraftModal
      open={draftModalOpen}
      onClose={() => setDraftModalOpen(false)}
      draftSearchTerm={draftSearchTerm}
      setDraftSearchTerm={setDraftSearchTerm}
      drafts={drafts}
      onLoadDraft={handleLoadDraft}
      onDeleteDraft={handleDeleteDraft}
      clearingAllDrafts={clearingAllDrafts}
      onClearAllDrafts={handleClearAllDrafts}
      onRefresh={fetchDrafts}
    />
  );
}
