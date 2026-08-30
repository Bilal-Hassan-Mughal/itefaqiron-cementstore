'use client';

import { useState, useEffect } from 'react';
import { formatDateTimePK } from '@/lib/date-helper';
import DashboardLayout from '../components/dashboard-layout';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  CardActions,
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
  Alert,
  CircularProgress,
  Fab,
  Tooltip,
  InputAdornment,
  Divider,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemAvatar,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Store as StoreIcon,
  LocationOn as LocationIcon,
  Schedule as ScheduleIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

export default function StoresPage() {
  // State management
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form data
  const [formData, setFormData] = useState({
    store_name: '',
    store_address: ''
  });

  // Snackbar states
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Fetch stores data
  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stores');
      const result = await response.json();
      
      if (result.success) {
        setStores(result.data);
      } else {
        console.error('Error fetching stores:', result.error);
        setSnackbar({
          open: true,
          message: 'Error fetching stores: ' + result.error,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching stores: ' + error.message,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Validation
      if (!formData.store_name.trim()) {
        alert('Store name is required');
        return;
      }

      const url = '/api/stores';
      const method = editingStore ? 'PUT' : 'POST';
      const body = editingStore 
        ? { ...formData, storeid: editingStore.storeid }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.success) {
        setSnackbar({
          open: true,
          message: result.message,
          severity: 'success'
        });
        setFormData({ store_name: '', store_address: '' });
        setEditingStore(null);
        setOpenDialog(false);
        fetchStores();
      } else {
        setSnackbar({
          open: true,
          message: 'Error: ' + result.error,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving store:', error);
      setSnackbar({
        open: true,
        message: 'Error saving store: ' + error.message,
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = (store) => {
    setEditingStore(store);
    setFormData({
      store_name: store.store_name,
      store_address: store.store_address || ''
    });
    setOpenDialog(true);
  };

  // Handle delete
  const handleDelete = async (store) => {
    if (!window.confirm(`Are you sure you want to delete "${store.store_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/stores?storeid=${store.storeid}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setSnackbar({
          open: true,
          message: result.message,
          severity: 'success'
        });
        fetchStores();
      } else {
        setSnackbar({
          open: true,
          message: 'Error: ' + result.error,
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error deleting store:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting store: ' + error.message,
        severity: 'error'
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setFormData({ store_name: '', store_address: '' });
    setEditingStore(null);
    setOpenDialog(false);
  };

  // Handle add new
  const handleAddNew = () => {
    setFormData({ store_name: '', store_address: '' });
    setEditingStore(null);
    setOpenDialog(true);
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Filter stores
  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.store_address && store.store_address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Format date
  const formatDate = (dateString) => {
    return formatDateTimePK(dateString);
  };

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="60vh"
        flexDirection="column"
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="textSecondary" sx={{ mt: 2 }}>
          Loading stores...
        </Typography>
      </Box>
    );
  }

  return (
    <DashboardLayout>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <StoreIcon sx={{ mr: 2, color: 'primary.main' }} />
                Store Management
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Manage your store locations and information
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddNew}
              sx={{ 
                px: 3, 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              Add New Store
            </Button>
          </Stack>
        </Box>

        {/* Search and Filter */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search stores by name or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
          </CardContent>
        </Card>

        {/* Form Dialog */}
        <Dialog open={openDialog} onClose={handleCancel} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" component="div">
              {editingStore ? 'Edit Store' : 'Add New Store'}
            </Typography>
          </DialogTitle>
          <form onSubmit={handleSubmit}>
            <DialogContent>
              <Stack spacing={3} sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  label="Store Name"
                  name="store_name"
                  value={formData.store_name}
                  onChange={handleInputChange}
                  required
                  variant="outlined"
                  placeholder="Enter store name"
                />
                <TextField
                  fullWidth
                  label="Store Address"
                  name="store_address"
                  value={formData.store_address}
                  onChange={handleInputChange}
                  variant="outlined"
                  placeholder="Enter store address"
                  multiline
                  rows={3}
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={handleCancel} color="inherit">
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {isSubmitting ? (editingStore ? 'Updating...' : 'Creating...') : (editingStore ? 'Update Store' : 'Create Store')}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* Stores List */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="h6" component="h2">
                Stores ({filteredStores.length})
              </Typography>
            </Box>
            
            {filteredStores.length === 0 ? (
              <Box sx={{ p: 8, textAlign: 'center' }}>
                <StoreIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No stores found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchTerm ? 'No stores match your search criteria.' : 'Get started by adding your first store.'}
                </Typography>
                {!searchTerm && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddNew}
                  >
                    Add Your First Store
                  </Button>
                )}
              </Box>
            ) : (
              <List>
                {filteredStores.map((store, index) => (
                  <ListItem
                    key={store.storeid}
                    divider={index < filteredStores.length - 1}
                    sx={{ 
                      '&:hover': { 
                        backgroundColor: 'action.hover' 
                      },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <BusinessIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="h6" component="span">
                            {store.store_name}
                          </Typography>
                          <Chip 
                            label={`ID: ${store.storeid}`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {store.store_address && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <LocationIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2" color="text.secondary">
                                {store.store_address}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                Created: {formatDate(store.created_at)}
                              </Typography>
                            </Box>
                            {store.updated_at !== store.created_at && (
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <ScheduleIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  Updated: {formatDate(store.updated_at)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Stack direction="row" spacing={1}>
                        <Tooltip title="Edit store">
                          <IconButton
                            onClick={() => handleEdit(store)}
                            color="primary"
                            size="small"
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete store">
                          <IconButton
                            onClick={() => handleDelete(store)}
                            color="error"
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>

        {/* Snackbar for notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleSnackbarClose} 
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
        </Container>
      </Box>
    </DashboardLayout>
  );
}
