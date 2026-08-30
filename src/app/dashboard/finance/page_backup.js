'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  DollarSign,
  Search,
  Filter,
  Hash,
  Calendar,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Receipt,
  CreditCard,
  Banknote
} from 'lucide-react';
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
  Avatar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Divider,
  CardHeader,
  CardActions,
  TablePagination,
  Chip as MuiChip,
  LinearProgress
} from '@mui/material';

export default function FinancePage() {
  // State management
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [editingLedger, setEditingLedger] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Customer dropdown filter states
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    cus_id: '',
    debit_amount: '',
    credit_amount: '',
    bill_no: '',
    trnx_type: 'CASH',
    details: '',
    payments: ''
  });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCustomerDropdown && !event.target.closest('.customer-dropdown')) {
        setShowCustomerDropdown(false);
      }
      if (showAccountDropdown && !event.target.closest('.account-dropdown')) {
        setShowAccountDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCustomerDropdown, showAccountDropdown]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ledgerRes, customersRes] = await Promise.all([
        fetch('/api/ledger'),
        fetch('/api/customers')
      ]);

      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedgerEntries(ledgerData);
      }
      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredLedgerEntries = ledgerEntries.filter(entry => {
    const matchesSearch = entry.customer?.cus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.bill_no?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCustomer = !selectedCustomer || entry.cus_id === selectedCustomer;

    return matchesSearch && matchesCustomer;
  });

  // Customer filtering logic
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.cus_name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      customer.cus_email?.toLowerCase().includes(customerSearchTerm.toLowerCase());
    return matchesSearch;
  });

  // Account filtering logic for filter dropdown
  const filteredAccounts = customers.filter(customer => {
    if (!accountSearchTerm) return true; // Show all when no search term
    const matchesSearch = customer.cus_name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_phone_no?.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
      customer.cus_email?.toLowerCase().includes(accountSearchTerm.toLowerCase());
    return matchesSearch;
  });

  const sortedLedgerEntries = filteredLedgerEntries.sort((a, b) => {
    let aValue, bValue;

    if (sortBy === 'created_at') {
      aValue = new Date(a.created_at);
      bValue = new Date(b.created_at);
    } else if (sortBy === 'debit_amount') {
      aValue = parseFloat(a.debit_amount);
      bValue = parseFloat(b.debit_amount);
    } else if (sortBy === 'credit_amount') {
      aValue = parseFloat(a.credit_amount);
      bValue = parseFloat(b.credit_amount);
    } else if (sortBy === 'closing_balance') {
      aValue = parseFloat(a.closing_balance);
      bValue = parseFloat(b.closing_balance);
    } else if (sortBy === 'customer') {
      aValue = a.customer?.cus_name.toLowerCase();
      bValue = b.customer?.cus_name.toLowerCase();
    } else {
      aValue = a[sortBy];
      bValue = b[sortBy];
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const finalLedgerEntries = sortedLedgerEntries.map((entry, index) => ({
    ...entry,
    sequentialId: index + 1
  }));

  // Stats calculations
  const totalDebit = ledgerEntries.reduce((sum, entry) => sum + parseFloat(entry.debit_amount), 0);
  const totalCredit = ledgerEntries.reduce((sum, entry) => sum + parseFloat(entry.credit_amount), 0);
  const totalPayments = ledgerEntries.reduce((sum, entry) => sum + parseFloat(entry.payments), 0);
  const currentBalance = ledgerEntries.length > 0 ? parseFloat(ledgerEntries[ledgerEntries.length - 1].closing_balance) : 0;

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectCustomer = (customer) => {
    setFormData(prev => ({ ...prev, cus_id: customer.cus_id }));
    setCustomerSearchTerm(customer.cus_name);
    setShowCustomerDropdown(false);
  };

  const getSelectedCustomer = () => {
    return customers.find(customer => customer.cus_id === formData.cus_id);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Validation
      if (!formData.cus_id) {
        alert('Please select an account');
        return;
      }

      if (!formData.debit_amount && !formData.credit_amount) {
        alert('Please enter either debit or credit amount');
        return;
      }

      const url = editingLedger ? '/api/ledger' : '/api/ledger';
      const method = editingLedger ? 'PUT' : 'POST';

      const body = editingLedger
        ? {
          id: editingLedger.l_id,
          ...formData
        }
        : {
          ...formData
        };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await fetchData();
        setShowLedgerForm(false);
        setEditingLedger(null);
        setFormData({
          cus_id: '',
          debit_amount: '',
          credit_amount: '',
          bill_no: '',
          trnx_type: 'CASH',
          details: '',
          payments: ''
        });
      }
    } catch (error) {
      console.error('Error saving ledger entry:', error);
    }
  };

  const handleEdit = (entry) => {
    setEditingLedger(entry);
    setFormData({
      cus_id: entry.cus_id,
      debit_amount: entry.debit_amount.toString(),
      credit_amount: entry.credit_amount.toString(),
      bill_no: entry.bill_no || '',
      trnx_type: entry.trnx_type,
      details: entry.details || '',
      payments: entry.payments.toString()
    });
    setCustomerSearchTerm(entry.customer?.cus_name || '');
    setShowLedgerForm(true);
  };

  const handleDelete = async (entryId) => {
    if (window.confirm('Are you sure you want to delete this ledger entry?')) {
      try {
        const response = await fetch(`/api/ledger?id=${entryId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          await fetchData();
        }
      } catch (error) {
        console.error('Error deleting ledger entry:', error);
      }
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCustomer('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}>
          <CircularProgress size={60} />
          <Typography variant="body1" color="text.secondary">
            Loading ledger entries...
          </Typography>
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 3 }}>
        {/* Header Section */}
        <Box sx={{ flexShrink: 0, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Finance Management
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Manage customer ledger entries, payments, and financial records
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Plus />}
              onClick={() => setShowLedgerForm(true)}
              sx={{
                background: 'linear-gradient(45deg, #4caf50, #2e7d32)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #388e3c, #1b5e20)',
                },
                px: 3,
                py: 1.5,
                borderRadius: 0,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                boxShadow: 3,
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Add Ledger Entry
            </Button>
          </Box>
        </Box>

        {/* Filters Section */}
        <Box sx={{ flexShrink: 0, mb: 3 }}>
          <Card sx={{ borderRadius: 0, boxShadow: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Filters & Sorting
                </Typography>
                <Button
                  onClick={clearFilters}
                  size="small"
                  sx={{
                    color: 'primary.main',
                    textTransform: 'none',
                    fontWeight: 500
                  }}
                >
                  Clear All Filters
                </Button>
              </Box>

              <Grid container spacing={3}>
                {/* Search */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    placeholder="Search ledger entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={20} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 0,
                      }
                    }}
                  />
                </Grid>

                {/* Account Filter */}
                <Grid item xs={12} md={3}>
                  <Autocomplete
                    options={filteredAccounts}
                    getOptionLabel={(option) => option.cus_name}
                    value={selectedCustomer ? customers.find(c => c.cus_id === selectedCustomer) : null}
                    onChange={(event, newValue) => {
                      if (newValue) {
                        setSelectedCustomer(newValue.cus_id);
                        setAccountSearchTerm(newValue.cus_name);
                      } else {
                        setSelectedCustomer('');
                        setAccountSearchTerm('');
                      }
                    }}
                    inputValue={accountSearchTerm}
                    onInputChange={(event, newInputValue) => {
                      setAccountSearchTerm(newInputValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Search accounts..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search size={20} />
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          minWidth: 300,
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 0,
                          }
                        }}
                      />
                    )}
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props;
                      return (
                        <Box component="li" key={key} {...optionProps}>
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {option.cus_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {option.cus_phone_no} {option.cus_email && `• ${option.cus_email}`}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    }}
                    noOptionsText="No accounts found"
                    clearOnEscape
                    clearText="Clear"
                  />
                </Grid>

                {/* Sort */}
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setSortBy(field);
                        setSortOrder(order);
                      }}
                      label="Sort By"
                      sx={{
                        borderRadius: 0,
                      }}
                    >
                      <MenuItem value="created_at-desc">Newest First</MenuItem>
                      <MenuItem value="created_at-asc">Oldest First</MenuItem>
                      <MenuItem value="customer-asc">Customer A-Z</MenuItem>
                      <MenuItem value="customer-desc">Customer Z-A</MenuItem>
                      <MenuItem value="debit_amount-desc">Debit High-Low</MenuItem>
                      <MenuItem value="credit_amount-desc">Credit High-Low</MenuItem>
                      <MenuItem value="closing_balance-desc">Balance High-Low</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>

        {/* Stats Cards Section */}
        <Box sx={{ flexShrink: 0, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 0, boxShadow: 3, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{
                      bgcolor: 'error.main',
                      mr: 2,
                      width: 48,
                      height: 48,
                      background: 'linear-gradient(45deg, #f44336, #d32f2f)'
                    }}>
                      <TrendingUp size={24} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Total Debit
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {totalDebit.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 0, boxShadow: 3, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{
                      bgcolor: 'success.main',
                      mr: 2,
                      width: 48,
                      height: 48,
                      background: 'linear-gradient(45deg, #4caf50, #2e7d32)'
                    }}>
                      <TrendingDown size={24} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Total Credit
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {totalCredit.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 0, boxShadow: 3, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{
                      bgcolor: 'primary.main',
                      mr: 2,
                      width: 48,
                      height: 48,
                      background: 'linear-gradient(45deg, #2196f3, #1976d2)'
                    }}>
                      <DollarSign size={24} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Total Payments
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {totalPayments.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ borderRadius: 0, boxShadow: 3, height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{
                      bgcolor: 'secondary.main',
                      mr: 2,
                      width: 48,
                      height: 48,
                      background: 'linear-gradient(45deg, #9c27b0, #7b1fa2)'
                    }}>
                      <Receipt size={24} />
                    </Avatar>
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Current Balance
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {currentBalance.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* Table Section */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Card sx={{ borderRadius: 0, boxShadow: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Table Header */}
            <CardHeader
              title="Ledger Entries"
              action={
                <Typography variant="body2" color="text.secondary">
                  Showing {finalLedgerEntries.length} of {ledgerEntries.length} entries
                </Typography>
              }
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            />

            {finalLedgerEntries.length === 0 ? (
              <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 2
              }}>
                <Receipt size={48} color="#9e9e9e" />
                <Typography variant="h6" color="text.secondary">
                  No ledger entries found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchTerm || selectedCustomer
                    ? 'Try adjusting your filters to see more results.'
                    : 'Get started by adding your first ledger entry.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <TableContainer sx={{ flex: 1 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Entry</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Customer</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Pre Balance</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Debit</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Credit</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Balance</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {finalLedgerEntries.map((entry) => (
                        <TableRow key={entry.l_id} hover>
                          {/* Entry */}
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                Entry #{entry.sequentialId}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {entry.l_id.toString().slice(-8)}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Customer */}
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {entry.customer?.cus_name || 'N/A'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {entry.customer?.cus_phone_no || 'N/A'}
                              </Typography>
                            </Box>
                          </TableCell>

                          {/* Pre Balance */}
                          <TableCell>
                            <Typography variant="body2">
                              {parseFloat(entry.opening_balance).toFixed(2)}
                            </Typography>
                          </TableCell>

                          {/* Debit */}
                          <TableCell>
                            <Typography variant="body2" color="error.main" fontWeight="medium">
                              {parseFloat(entry.debit_amount).toFixed(2)}
                            </Typography>
                          </TableCell>

                          {/* Credit */}
                          <TableCell>
                            <Typography variant="body2" color="success.main" fontWeight="medium">
                              {parseFloat(entry.credit_amount).toFixed(2)}
                            </Typography>
                          </TableCell>

                          {/* Balance */}
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {parseFloat(entry.closing_balance).toFixed(2)}
                            </Typography>
                          </TableCell>

                          {/* Type */}
                          <TableCell>
                            <Chip
                              label={entry.trnx_type}
                              size="small"
                              variant="outlined"
                              color={
                                entry.trnx_type === 'CASH' ? 'primary' :
                                  entry.trnx_type === 'BANK_TRANSFER' ? 'secondary' : 'default'
                              }
                            />
                          </TableCell>

                          {/* Created */}
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(entry.created_at).toLocaleDateString()}
                            </Typography>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="Edit Entry">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEdit(entry)}
                                  sx={{ color: 'primary.main' }}
                                >
                                  <Edit size={16} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete Entry">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDelete(entry.l_id)}
                                  sx={{ color: 'error.main' }}
                                >
                                  <Trash2 size={16} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}
          </Card>
        </Box>
      </Container>

      {/* Ledger Form Modal */}
      <Dialog
        open={showLedgerForm}
        onClose={() => {
          setShowLedgerForm(false);
          setEditingLedger(null);
          setFormData({
            cus_id: '',
            debit_amount: '',
            credit_amount: '',
            bill_no: '',
            trnx_type: 'CASH',
            details: '',
            payments: ''
          });
          setCustomerSearchTerm('');
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 0 }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 2
        }}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>
            {editingLedger ? 'Edit Ledger Entry' : 'Add New Ledger Entry'}
          </Typography>
          <IconButton
            onClick={() => {
              setShowLedgerForm(false);
              setEditingLedger(null);
              setFormData({
                cus_id: '',
                debit_amount: '',
                credit_amount: '',
                bill_no: '',
                trnx_type: 'CASH',
                details: '',
                payments: ''
              });
              setCustomerSearchTerm('');
            }}
            sx={{ color: 'text.secondary' }}
          >
            <X size={20} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Account Selection */}
            <Autocomplete
              options={filteredCustomers}
              getOptionLabel={(option) => option.cus_name}
              value={formData.cus_id ? customers.find(c => c.cus_id === formData.cus_id) : null}
              onChange={(event, newValue) => {
                if (newValue) {
                  setFormData(prev => ({ ...prev, cus_id: newValue.cus_id }));
                  setCustomerSearchTerm(newValue.cus_name);
                } else {
                  setFormData(prev => ({ ...prev, cus_id: '' }));
                  setCustomerSearchTerm('');
                }
              }}
              inputValue={customerSearchTerm}
              onInputChange={(event, newInputValue) => {
                setCustomerSearchTerm(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Account *"
                  placeholder="Search accounts..."
                  required
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search size={20} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    minWidth: 300,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                    }
                  }}
                />
              )}
              renderOption={(props, option) => {
                const { key, ...optionProps } = props;
                return (
                  <Box component="li" key={key} {...optionProps}>
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {option.cus_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.cus_phone_no} {option.cus_email && `• ${option.cus_email}`}
                      </Typography>
                    </Box>
                  </Box>
                );
              }}
              noOptionsText="No accounts found"
              clearOnEscape
              clearText="Clear"
            />

            {/* Selected Customer Display */}
            {formData.cus_id && getSelectedCustomer() && (
              <Alert
                severity="success"
                action={
                  <IconButton
                    size="small"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, cus_id: '' }));
                      setCustomerSearchTerm('');
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <X size={16} />
                  </IconButton>
                }
              >
                <Typography variant="body2" fontWeight="medium">
                  {getSelectedCustomer().cus_name}
                </Typography>
                <Typography variant="caption">
                  {getSelectedCustomer().cus_phone_no} {getSelectedCustomer().cus_email && `• ${getSelectedCustomer().cus_email}`}
                </Typography>
              </Alert>
            )}

            {/* Amount Fields */}
            <Grid container spacing={3}>
              {/* Debit Amount */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Debit Amount"
                  name="debit_amount"
                  type="number"
                  value={formData.debit_amount}
                  onChange={handleInputChange}
                  inputProps={{ step: 0.01, min: 0 }}
                  placeholder="0.00"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      '&:hover fieldset': {
                        borderColor: 'error.main',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'error.main',
                      },
                    },
                  }}
                />
              </Grid>

              {/* Credit Amount */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Credit Amount"
                  name="credit_amount"
                  type="number"
                  value={formData.credit_amount}
                  onChange={handleInputChange}
                  inputProps={{ step: 0.01, min: 0 }}
                  placeholder="0.00"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      '&:hover fieldset': {
                        borderColor: 'success.main',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: 'success.main',
                      },
                    },
                  }}
                />
              </Grid>
            </Grid>

            {/* Transaction Type and Bill No */}
            <Grid container spacing={3}>
              {/* Transaction Type */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Transaction Type</InputLabel>
                  <Select
                    name="trnx_type"
                    value={formData.trnx_type}
                    onChange={handleInputChange}
                    label="Transaction Type"
                    sx={{
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderRadius: 0,
                      }
                    }}
                  >
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="CHEQUE">Cheque</MenuItem>
                    <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Bill No */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Bill Number"
                  name="bill_no"
                  value={formData.bill_no}
                  onChange={handleInputChange}
                  placeholder="Enter bill number"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                    }
                  }}
                />
              </Grid>
            </Grid>

            {/* Details */}
            <TextField
              fullWidth
              label="Details"
              name="details"
              value={formData.details}
              onChange={handleInputChange}
              multiline
              rows={3}
              placeholder="Enter transaction details"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                }
              }}
            />

            {/* Payments */}
            <TextField
              fullWidth
              label="Payments"
              name="payments"
              type="number"
              value={formData.payments}
              onChange={handleInputChange}
              inputProps={{ step: 0.01, min: 0 }}
              placeholder="0.00"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 0,
                }
              }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button
            onClick={() => {
              setShowLedgerForm(false);
              setEditingLedger(null);
              setFormData({
                cus_id: '',
                debit_amount: '',
                credit_amount: '',
                bill_no: '',
                trnx_type: 'CASH',
                details: '',
                payments: ''
              });
              setCustomerSearchTerm('');
            }}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            onClick={handleSubmit}
            sx={{
              background: 'linear-gradient(45deg, #2196f3, #9c27b0)',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976d2, #7b1fa2)',
              },
              px: 4,
              py: 1.5,
              borderRadius: 0,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 3,
              '&:hover': {
                boxShadow: 6,
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {editingLedger ? 'Update Entry' : 'Create Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}