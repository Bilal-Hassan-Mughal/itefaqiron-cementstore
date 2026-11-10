'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Button,
  Box,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  PauseCircleOutline as HoldIcon,
  OpenInNew as OpenIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Storefront as StoreIcon,
  ShoppingCart as CartIcon,
} from '@mui/icons-material';
import { formatDateTimePK } from '@/lib/date-helper';
import { formatCustomerPhoneDisplay } from '@/lib/whatsapp-local';
import { formatHoldAmount, getHoldBillSummary } from './draft-hold-modal-helpers';

const palette = {
  headerBg: 'linear-gradient(135deg, #1a237e 0%, #1a55e3 55%, #0288d1 100%)',
  headerAccent: '#ff9800',
  surface: '#f4f6f9',
  tableHeadBg: '#e8edf4',
  tableHeadBorder: '#c5cdd8',
  rowBorder: '#dce2ea',
  rowOdd: '#ffffff',
  rowEven: '#f8fafc',
  rowHover: '#eef4ff',
  holdCode: '#c45c00',
  primaryBtn: '#1a55e3',
};

const headCellSx = {
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  color: '#334155',
  bgcolor: palette.tableHeadBg,
  borderBottom: `2px solid ${palette.tableHeadBorder}`,
  borderRight: `1px solid ${palette.tableHeadBorder}`,
  py: 1.5,
  px: 1.5,
  whiteSpace: 'nowrap',
  '&:last-child': { borderRight: 'none' },
};

const bodyCellSx = {
  borderBottom: `1px solid ${palette.rowBorder}`,
  borderRight: `1px solid ${palette.rowBorder}`,
  py: 1.75,
  px: 1.5,
  verticalAlign: 'top',
  '&:last-child': { borderRight: 'none' },
};

/**
 * Bill Hold list modal — presentation only; all actions passed from parent.
 */
export default function BillHoldDraftModal({
  open,
  onClose,
  draftSearchTerm,
  setDraftSearchTerm,
  drafts,
  onLoadDraft,
  onDeleteDraft,
  clearingAllDrafts,
  onClearAllDrafts,
  onRefresh,
}) {
  const filtered = drafts.filter((draft) => {
    if (!draftSearchTerm) return true;
    const q = draftSearchTerm.toLowerCase();
    const summary = getHoldBillSummary(draft);
    return (
      draft.draft_code?.toLowerCase().includes(q) ||
      draft.customer?.cus_name?.toLowerCase().includes(q) ||
      summary.linePreview.toLowerCase().includes(q) ||
      summary.storeName.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2, overflow: 'hidden', border: '1px solid #cbd5e1' },
      }}
    >
      <DialogTitle
        sx={{
          background: palette.headerBg,
          color: 'white',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          py: 2.25,
          px: 3,
          borderBottom: `4px solid ${palette.headerAccent}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <HoldIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
              Bill Hold — saved drafts
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.75, maxWidth: 520, lineHeight: 1.5 }}>
              Paused sales saved with <strong>Hold (F9)</strong>. Pick a row below to continue the same bill.
            </Typography>
            {drafts.length > 0 && (
              <Chip
                size="small"
                label={`${drafts.length} held bill${drafts.length === 1 ? '' : 's'}`}
                sx={{
                  mt: 1.25,
                  bgcolor: palette.headerAccent,
                  color: '#1a237e',
                  fontWeight: 700,
                  height: 26,
                }}
              />
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white', bgcolor: 'rgba(0,0,0,0.12)', '&:hover': { bgcolor: 'rgba(0,0,0,0.22)' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: palette.surface }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search hold code, customer, store, or product…"
          value={draftSearchTerm}
          onChange={(e) => setDraftSearchTerm(e.target.value)}
          sx={{
            mb: 2.5,
            bgcolor: 'white',
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              '& fieldset': { borderColor: palette.tableHeadBorder },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#64748b' }} />
              </InputAdornment>
            ),
          }}
        />

        {drafts.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 5,
              px: 3,
              bgcolor: 'white',
              borderRadius: 2,
              border: `1px dashed ${palette.tableHeadBorder}`,
            }}
          >
            <HoldIcon sx={{ fontSize: 48, mb: 1.5, color: palette.primaryBtn, opacity: 0.35 }} />
            <Typography variant="subtitle1" fontWeight={600} color="#334155" gutterBottom>
              No held bills yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', lineHeight: 1.6 }}>
              On the sale screen, add customer, store, and products, then press <strong>F9</strong> or{' '}
              <strong>Hold Bill</strong>.
            </Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              bgcolor: 'white',
              borderRadius: 2,
              border: `1px solid ${palette.rowBorder}`,
            }}
          >
            <Typography color="text.secondary">No holds match your search.</Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              maxHeight: 440,
              borderRadius: 2,
              bgcolor: 'white',
              border: `1px solid ${palette.tableHeadBorder}`,
              overflow: 'auto',
            }}
          >
            <Table stickyHeader size="medium" sx={{ borderCollapse: 'separate' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headCellSx, width: 118 }}>Hold #</TableCell>
                  <TableCell sx={{ ...headCellSx, minWidth: 160 }}>Customer</TableCell>
                  <TableCell sx={{ ...headCellSx, minWidth: 220 }}>What&apos;s on this bill</TableCell>
                  <TableCell sx={{ ...headCellSx, width: 112 }} align="right">
                    Est. total
                  </TableCell>
                  <TableCell sx={{ ...headCellSx, width: 148 }}>Last saved</TableCell>
                  <TableCell sx={{ ...headCellSx, width: 168 }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((draft, index) => {
                  const summary = getHoldBillSummary(draft);
                  const phone = formatCustomerPhoneDisplay(draft.customer);
                  const zebra = index % 2 === 0 ? palette.rowOdd : palette.rowEven;
                  return (
                    <TableRow
                      key={draft.draft_id}
                      hover
                      sx={{
                        bgcolor: zebra,
                        transition: 'background-color 0.15s ease',
                        '&:hover': { bgcolor: palette.rowHover },
                        '&:last-child td': { borderBottom: 'none' },
                      }}
                    >
                      <TableCell sx={bodyCellSx}>
                        <Typography variant="body2" fontWeight={700} sx={{ color: palette.holdCode }}>
                          {draft.draft_code}
                        </Typography>
                        <Chip
                          label={summary.billType}
                          size="small"
                          sx={{
                            mt: 0.75,
                            height: 22,
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            bgcolor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Typography variant="body2" fontWeight={600} color="#1e293b" lineHeight={1.4}>
                          {draft.customer?.cus_name || 'Walk-in / no customer'}
                        </Typography>
                        {phone && phone !== 'N/A' && (
                          <Typography variant="caption" color="#64748b" display="block" sx={{ mt: 0.35 }}>
                            {phone}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Stack spacing={0.75}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                            <CartIcon sx={{ fontSize: 17, color: '#64748b', mt: 0.15 }} />
                            <Typography variant="body2" color="#334155" lineHeight={1.45}>
                              <strong>{summary.itemCount}</strong> item{summary.itemCount === 1 ? '' : 's'}
                              {summary.linePreview ? (
                                <>
                                  {' '}
                                  <Typography component="span" variant="body2" color="#64748b">
                                    · {summary.linePreview}
                                  </Typography>
                                </>
                              ) : null}
                            </Typography>
                          </Box>
                          {summary.storeName && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <StoreIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                              <Typography variant="caption" color="#64748b">
                                {summary.storeName}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={bodyCellSx}>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          color="#0f172a"
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          {formatHoldAmount(summary.estimatedTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={bodyCellSx}>
                        <Typography variant="caption" color="#64748b" sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTimePK(draft.updated_at)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={bodyCellSx}>
                        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<OpenIcon sx={{ fontSize: '1rem !important' }} />}
                            onClick={() => onLoadDraft(draft)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 600,
                              bgcolor: palette.primaryBtn,
                              boxShadow: 'none',
                              px: 1.5,
                              '&:hover': { bgcolor: '#1347c4', boxShadow: 'none' },
                            }}
                          >
                            Open
                          </Button>
                          <Tooltip title="Remove this hold">
                            <IconButton
                              size="small"
                              onClick={() => onDeleteDraft(draft.draft_id, draft.draft_code)}
                              sx={{
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                                bgcolor: '#fff',
                                '&:hover': { bgcolor: '#fef2f2' },
                              }}
                              aria-label="Delete hold"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>

      <Divider sx={{ borderColor: palette.tableHeadBorder }} />

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          bgcolor: '#fff',
          borderTop: `1px solid ${palette.rowBorder}`,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {drafts.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={clearingAllDrafts}
            onClick={onClearAllDrafts}
            sx={{ mr: 'auto', textTransform: 'none', fontWeight: 600 }}
          >
            {clearingAllDrafts ? 'Clearing…' : 'Clear all holds'}
          </Button>
        )}
        <Button onClick={onClose} sx={{ textTransform: 'none', color: '#475569' }}>
          Close
        </Button>
        {drafts.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderColor: palette.headerAccent,
              color: '#c45c00',
              '&:hover': { borderColor: '#f57c00', bgcolor: '#fff8f0' },
            }}
          >
            Refresh list
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
