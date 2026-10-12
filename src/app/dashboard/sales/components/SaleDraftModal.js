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
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { formatDateTimePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';

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
    <Dialog
      open={draftModalOpen}
      onClose={() => setDraftModalOpen(false)}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle sx={{
        background: 'linear-gradient(45deg, #f57c00 30%, #ff9800 90%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SaveIcon sx={{ mr: 2, fontSize: 28 }} />
          <Box>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Draft Sales
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Load a saved draft or create a new one
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={() => setDraftModalOpen(false)} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search drafts..."
            value={draftSearchTerm}
            onChange={(e) => setDraftSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {drafts.length === 0 ? (
          <Box sx={{
            textAlign: 'center',
            py: 4,
            color: 'text.secondary'
          }}>
            <SaveIcon sx={{ fontSize: 48, mb: 2, opacity: 0.3 }} />
            <Typography>
              No drafts available. Save your current form as a draft to get started!
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Draft Code</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drafts
                  .filter(draft => {
                    if (!draftSearchTerm) return true;
                    const searchLower = draftSearchTerm.toLowerCase();
                    return (
                      draft.draft_code?.toLowerCase().includes(searchLower) ||
                      draft.customer?.cus_name?.toLowerCase().includes(searchLower)
                    );
                  })
                  .map((draft) => (
                    <TableRow key={draft.draft_id} hover>
                      <TableCell sx={{ fontWeight: 'bold', color: '#f57c00' }}>
                        {draft.draft_code}
                      </TableCell>
                      <TableCell>
                        {draft.customer?.cus_name || 'No customer'}
                      </TableCell>
                      <TableCell>
                        {formatDateTimePK(draft.updated_at)}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="Load this draft">
                          <IconButton
                            size="small"
                            onClick={() => handleLoadDraft(draft)}
                            sx={{ color: '#2196f3' }}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete this draft">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteDraft(draft.draft_id, draft.draft_code)}
                            sx={{ color: '#f44336' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, bgcolor: 'grey.50' }}>
        {drafts.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            disabled={clearingAllDrafts}
            onClick={handleClearAllDrafts}
            sx={{ mr: 'auto' }}
          >
            {clearingAllDrafts ? 'Clearing…' : 'Clear All'}
          </Button>
        )}
        <Button onClick={() => setDraftModalOpen(false)}>Close</Button>
        {drafts.length > 0 && (
          <Button
            variant="text"
            sx={{ color: '#f57c00' }}
            onClick={() => {
              fetchDrafts();
            }}
          >
            Refresh
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
