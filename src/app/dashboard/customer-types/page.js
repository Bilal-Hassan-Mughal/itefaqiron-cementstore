'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/dashboard-layout';

// Material-UI imports
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Snackbar,
  Alert,
  Stack,
  Fade,
  Zoom
} from '@mui/material';

// Material Icons
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Tag as TagIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Category as CategoryIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

// Custom Styles matching application design
const STYLES = {
  glassCard: {
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '24px',
    border: '1px solid rgba(224, 224, 224, 0.5)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
      boxShadow: '0 15px 50px rgba(0,0,0,0.08)',
    }
  },
  gradientHeader: {
    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    color: 'white',
    p: { xs: 3, md: 4 },
    borderRadius: '0 0 32px 32px',
    mb: 4,
    boxShadow: '0 10px 30px rgba(30, 58, 138, 0.2)',
  },
  primaryGradientBtn: {
    background: 'linear-gradient(45deg, #3b82f6 30%, #2ecc71 90%)',
    borderRadius: '14px',
    px: 3,
    py: 1.2,
    fontSize: '0.9rem',
    fontWeight: '600',
    textTransform: 'none',
    color: 'white',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
    '&:hover': {
      background: 'linear-gradient(45deg, #2563eb 30%, #27ae60 90%)',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
    },
    transition: 'all 0.2s',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
    '& .MuiTableCell-head': {
      fontWeight: '700',
      color: '#64748b',
      textTransform: 'uppercase',
      fontSize: '0.75rem',
      letterSpacing: '0.05em',
      py: 2,
    }
  },
  input: {
    '& .MuiOutlinedInput-root': {
      borderRadius: '12px',
      backgroundColor: '#f8fafc',
      '& fieldset': { border: '1px solid #e2e8f0' },
      '&:hover fieldset': { borderColor: '#cbd5e1' },
      '&.Mui-focused fieldset': { borderColor: '#3b82f6' },
    }
  }
};

export default function AccountTypesPage() {
  const [customerTypes, setCustomerTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [showTypeForm, setShowTypeForm] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState({
    cus_type_title: ''
  });

  // Delete modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch account types on mount
  useEffect(() => {
    fetchCustomerTypes();
  }, []);

  const fetchCustomerTypes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customer-types');
      if (response.ok) {
        const data = await response.json();
        setCustomerTypes(data || []);
      } else {
        showSnackbar('Failed to fetch account types', 'error');
      }
    } catch (error) {
      console.error('Error fetching account types:', error);
      showSnackbar('Error fetching account types', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Open add dialog
  const handleOpenAddModal = () => {
    setEditingType(null);
    setTypeForm({ cus_type_title: '' });
    setShowTypeForm(true);
  };

  // Open edit dialog
  const handleOpenEditModal = (type) => {
    setEditingType(type);
    setTypeForm({ cus_type_title: type.cus_type_title });
    setShowTypeForm(true);
  };

  // Save add/edit
  const handleSaveType = async (e) => {
    e.preventDefault();
    if (!typeForm.cus_type_title.trim()) {
      showSnackbar('Account type title is required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const isEdit = !!editingType;
      const url = '/api/customer-types';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { id: editingType.cus_type_id, cus_type_title: typeForm.cus_type_title.trim() }
        : { cus_type_title: typeForm.cus_type_title.trim() };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        showSnackbar(
          isEdit ? 'Account type updated successfully!' : 'Account type added successfully!',
          'success'
        );
        setShowTypeForm(false);
        setTypeForm({ cus_type_title: '' });
        setEditingType(null);
        fetchCustomerTypes();
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || 'Failed to save account type', 'error');
      }
    } catch (error) {
      console.error('Error saving account type:', error);
      showSnackbar('Failed to save account type', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open delete confirm modal
  const handleOpenDeleteModal = (type) => {
    setTypeToDelete(type);
    setDeleteConfirmOpen(true);
  };

  // Execute delete
  const handleDeleteType = async () => {
    if (!typeToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/customer-types?id=${typeToDelete.cus_type_id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showSnackbar('Account type deleted successfully!', 'success');
        setDeleteConfirmOpen(false);
        setTypeToDelete(null);
        fetchCustomerTypes();
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || 'Failed to delete account type', 'error');
      }
    } catch (error) {
      console.error('Error deleting account type:', error);
      showSnackbar('Failed to delete account type', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter types by search term
  const filteredTypes = useMemo(() => {
    return customerTypes.filter(type =>
      (type.cus_type_title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(type.cus_type_id).includes(searchTerm)
    );
  }, [customerTypes, searchTerm]);

  return (
    <DashboardLayout>
      <Box sx={{ minHeight: '100vh', pb: 8, bgcolor: '#f8fafc' }}>
        {/* Header */}
        <Box sx={STYLES.gradientHeader}>
          <Container maxWidth="xl">
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: '800', letterSpacing: '-0.02em', mb: 1 }}>
                  Account Types Management
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Define, create, and manage account types for system account categorizations
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenAddModal}
                sx={STYLES.primaryGradientBtn}
              >
                Add Account Type
              </Button>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="xl">
          <Stack spacing={4}>
            {/* Search & Stats Card */}
            <Card sx={STYLES.glassCard}>
              <CardContent sx={{ p: 3 }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      placeholder="Search account type title or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      sx={STYLES.input}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: '#94a3b8' }} />
                          </InputAdornment>
                        ),
                        endAdornment: searchTerm && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearchTerm('')}>
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 2 }}>
                      <Paper
                        variant="outlined"
                        sx={{
                          px: 3,
                          py: 1.5,
                          borderRadius: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          bgcolor: '#f1f5f9',
                          borderColor: '#e2e8f0'
                        }}
                      >
                        <TagIcon color="primary" />
                        <Box>
                          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: '600' }}>
                            TOTAL TYPES
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: '800', color: '#1e293b' }}>
                            {customerTypes.length}
                          </Typography>
                        </Box>
                      </Paper>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Account Types Table Card */}
            <Card sx={STYLES.glassCard}>
              <TableContainer>
                <Table>
                  <TableHead sx={STYLES.tableHeader}>
                    <TableRow>
                      <TableCell sx={{ pl: 4 }}>ID</TableCell>
                      <TableCell>ACCOUNT TYPE TITLE</TableCell>
                      <TableCell>CREATED AT</TableCell>
                      <TableCell align="right" sx={{ pr: 4 }}>ACTIONS</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                          <CircularProgress size={36} color="primary" />
                          <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
                            Loading account types...
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : filteredTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                          <TagIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                          <Typography variant="h6" sx={{ color: '#475569', fontWeight: '600' }}>
                            No Account Types Found
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
                            {searchTerm ? 'No results matching your search criteria' : 'Click "Add Account Type" to create your first type'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTypes.map((type) => (
                        <TableRow
                          key={type.cus_type_id}
                          hover
                          sx={{
                            transition: 'all 0.2s',
                            '&:hover': { bgcolor: '#f8fafc' }
                          }}
                        >
                          <TableCell sx={{ pl: 4, fontWeight: '700', color: '#334155' }}>
                            #{type.cus_type_id}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Chip
                                label={type.cus_type_title}
                                sx={{
                                  bgcolor: '#eff6ff',
                                  color: '#1d4ed8',
                                  fontWeight: '700',
                                  fontSize: '0.875rem',
                                  py: 0.5,
                                  px: 1,
                                  borderRadius: '10px'
                                }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', fontSize: '0.875rem' }}>
                            {type.created_at
                              ? new Date(type.created_at).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'N/A'}
                          </TableCell>
                          <TableCell align="right" sx={{ pr: 4 }}>
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Tooltip title="Edit Type">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenEditModal(type)}
                                  sx={{
                                    bgcolor: '#f1f5f9',
                                    color: '#3b82f6',
                                    '&:hover': { bgcolor: '#dbeafe' }
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Type">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDeleteModal(type)}
                                  sx={{
                                    bgcolor: '#fef2f2',
                                    color: '#ef4444',
                                    '&:hover': { bgcolor: '#fee2e2' }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Stack>
        </Container>

        {/* Add / Edit Account Type Dialog */}
        <Dialog
          open={showTypeForm}
          onClose={() => !isSubmitting && setShowTypeForm(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { borderRadius: '24px', p: 1 }
          }}
        >
          <form onSubmit={handleSaveType}>
            <DialogTitle sx={{ fontWeight: '800', fontSize: '1.25rem', pt: 3, pb: 1 }}>
              {editingType ? 'Edit Account Type' : 'Add New Account Type'}
            </DialogTitle>
            <DialogContent sx={{ py: 2 }}>
              <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                {editingType
                  ? 'Update the title for this account type.'
                  : 'Specify the name for the new account type to categorize accounts.'}
              </Typography>
              <TextField
                autoFocus
                fullWidth
                label="Account Type Title"
                placeholder="e.g. Retailer, Wholesaler, Contractor"
                value={typeForm.cus_type_title}
                onChange={(e) => setTypeForm({ cus_type_title: e.target.value })}
                sx={STYLES.input}
                required
              />
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 1 }}>
              <Button
                onClick={() => setShowTypeForm(false)}
                disabled={isSubmitting}
                sx={{ color: '#64748b', textTransform: 'none', fontWeight: '600' }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={STYLES.primaryGradientBtn}
              >
                {isSubmitting ? 'Saving...' : editingType ? 'Update Type' : 'Save Type'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteConfirmOpen}
          onClose={() => !isDeleting && setDeleteConfirmOpen(false)}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: { borderRadius: '24px', p: 1 }
          }}
        >
          <DialogTitle sx={{ fontWeight: '800', color: '#dc2626', pt: 3, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" /> Delete Account Type
          </DialogTitle>
          <DialogContent sx={{ py: 2 }}>
            <Typography variant="body1" sx={{ color: '#334155', fontWeight: '600', mb: 1 }}>
              Are you sure you want to delete &quot;{typeToDelete?.cus_type_title}&quot;?
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              This action cannot be undone. You can only delete account types that are not assigned to any accounts.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={isDeleting}
              sx={{ color: '#64748b', textTransform: 'none', fontWeight: '600' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteType}
              variant="contained"
              color="error"
              disabled={isDeleting}
              startIcon={isDeleting ? <CircularProgress size={18} color="inherit" /> : <DeleteIcon />}
              sx={{
                borderRadius: '12px',
                px: 3,
                py: 1,
                fontWeight: '600',
                textTransform: 'none'
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast Snackbar Notification */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            onClose={handleSnackbarClose}
            severity={snackbar.severity}
            variant="filled"
            sx={{ width: '100%', borderRadius: '12px', fontWeight: '600' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
