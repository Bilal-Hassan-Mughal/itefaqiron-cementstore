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
  CircularProgress,
  Avatar,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  ListAlt as ListAltIcon,
  ShoppingCart as ShoppingCartIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as MapPinIcon,
  Business as BusinessIcon,
  Tag as TagIcon,
  CreditCard as CreditCardIcon,
  AttachMoney as AttachMoneyIcon,
  Info as InfoIcon,
  Translate as TranslateIcon,
  Description as NotesIcon,
} from '@mui/icons-material';
import { formatDatePK } from '@/lib/date-helper';
import { useSalesContext } from './SalesContext';

export default function SaleLoadOrderDialog() {
  const {
    loadOrderDialogOpen,
    setLoadOrderDialogOpen,
    orderSearchTerm,
    setOrderSearchTerm,
    loadOrderListLoading,
    loadOrderList,
    getBillDisplayNo,
    handleLoadOrder,
    // Customer Popup State & Handlers
    customerPopupOpen,
    handleCloseCustomerPopup,
    editingCustomer,
    formSelectedCustomer,
    setShowCustomerCategoryPopup,
    setShowCustomerTypePopup,
    setShowCityPopup,
    customerNameInputRef,
    newCustomer,
    setNewCustomer,
    customerCategories,
    customerTypes,
    customerTypeOpen,
    setCustomerTypeOpen,
    customerTypeInputRef,
    cities,
    isSavingCustomer,
    handleCreateCustomer,
  } = useSalesContext();

  return (
    <>
      {/* Load Order Dialog */}
      <Dialog
        open={loadOrderDialogOpen}
        onClose={() => setLoadOrderDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #1976d2 30%, #2196f3 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ListAltIcon sx={{ mr: 2 }} />
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Load Order
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Select an order to load into the bill
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setLoadOrderDialogOpen(false)} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by customer name, order ID, or order number..."
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Box>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order ID</TableCell>
                  <TableCell>Order Number</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadOrderListLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {loadOrderList
                      .filter(sale => {
                        if (!orderSearchTerm) return true;

                        const searchLower = orderSearchTerm.toLowerCase();
                        const orderNo = getBillDisplayNo(sale);
                        const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                        const matchesId = sale.sale_id?.toString().includes(searchLower);
                        const matchesOrderNo =
                          String(sale.bill_number || '').includes(searchLower) ||
                          orderNo.toLowerCase().includes(searchLower);

                        return matchesName || matchesId || matchesOrderNo;
                      })
                      .map((sale) => (
                        <TableRow key={sale.sale_id} hover>
                          <TableCell>{sale.sale_id}</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {getBillDisplayNo(sale) || '—'}
                          </TableCell>
                          <TableCell>{sale.customer?.cus_name || 'N/A'}</TableCell>
                          <TableCell>{formatDatePK(sale?.created_at) || '—'}</TableCell>
                          <TableCell align="right">{parseFloat(sale.total_amount || 0).toFixed(0)}</TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => handleLoadOrder(sale)}
                              startIcon={<ShoppingCartIcon />}
                            >
                              Load
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!loadOrderListLoading && loadOrderList.filter(sale => {
                      if (!orderSearchTerm) return true;

                      const searchLower = orderSearchTerm.toLowerCase();
                      const orderNo = getBillDisplayNo(sale);
                      const matchesName = sale.customer?.cus_name?.toLowerCase().includes(searchLower);
                      const matchesId = sale.sale_id?.toString().includes(searchLower);
                      const matchesOrderNo =
                        String(sale.bill_number || '').includes(searchLower) ||
                        orderNo.toLowerCase().includes(searchLower);

                      return matchesName || matchesId || matchesOrderNo;
                    }).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                          {orderSearchTerm ? 'No matching orders found' : 'No orders found'}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadOrderDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Customer Creation Popup */}
      <Dialog
        open={customerPopupOpen}
        disableAutoFocus
        onClose={handleCloseCustomerPopup}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle sx={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
          color: 'white',
          px: 3, py: 2.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              width: 40, height: 40,
              backdropFilter: 'blur(4px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <PersonIcon sx={{ fontSize: 22, color: '#fff' }} />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.2, fontSize: '1.1rem' }}>
                {editingCustomer ? 'Edit Customer Account' : 'Add New Customer Account'}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 500, fontSize: '0.78rem' }}>
                {editingCustomer ? `Editing: ${formSelectedCustomer?.cus_name}` : 'Create a new customer profile and ledger account'}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleCloseCustomerPopup}
            sx={{ color: 'white', opacity: 0.85, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' } }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>

            {/* Inline Quick Add Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', bgcolor: '#ffffff', p: 1.2, px: 2, borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                ✨ Quick Add:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Button size="small" variant="outlined" startIcon={<BusinessIcon />} onClick={() => setShowCustomerCategoryPopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', '&:hover': { bgcolor: '#dcfce7', borderColor: '#86efac' } }}>
                  + Category
                </Button>
                <Button size="small" variant="outlined" startIcon={<PersonIcon />} onClick={() => setShowCustomerTypePopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#f5f3ff', borderColor: '#ddd6fe', color: '#5b21b6', '&:hover': { bgcolor: '#ede9fe', borderColor: '#c4b5fd' } }}>
                  + Type
                </Button>
                <Button size="small" variant="outlined" startIcon={<MapPinIcon />} onClick={() => setShowCityPopup(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', py: 0.4, px: 1.2, bgcolor: '#fffbeb', borderColor: '#fde68a', color: '#92400e', '&:hover': { bgcolor: '#fef3c7', borderColor: '#fcd34d' } }}>
                  + City
                </Button>
              </Box>
            </Box>

            {/* Single Form Box */}
            <Box sx={{ p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)' }}>
              {/* Strict 2-Column CSS Grid Layout */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2.2 }}>
                {/* Row 1 */}
                <TextField
                  fullWidth
                  required
                  inputRef={customerNameInputRef}
                  label="Account Name"
                  name="cus_name"
                  value={newCustomer.cus_name ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_name: e.target.value }))}
                  placeholder="Enter account name"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 16, color: '#4f46e5' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  required
                  label="Primary Phone"
                  name="cus_phone_no"
                  type="tel"
                  value={newCustomer.cus_phone_no ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no: e.target.value }))}
                  placeholder="Enter primary phone number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 2 */}
                <TextField
                  fullWidth
                  label="Secondary Phone"
                  name="cus_phone_no2"
                  type="tel"
                  value={newCustomer.cus_phone_no2 ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no2: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter secondary phone number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  required
                  label="Address"
                  name="cus_address"
                  value={newCustomer.cus_address ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_address: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter complete address"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#4f46e5', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(79, 70, 229, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#4f46e5', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <MapPinIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 3 - Account Category & Account Type */}
                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={customerCategories.map(category => ({
                    id: category.cus_cat_id,
                    title: category.cus_cat_title
                  }))}
                  getOptionLabel={(option) => option.title || ''}
                  value={(() => {
                    return customerCategories.find(option => option.cus_cat_id === newCustomer.cus_category)
                      ? { id: newCustomer.cus_category, title: customerCategories.find(option => option.cus_cat_id === newCustomer.cus_category).cus_cat_title }
                      : null;
                  })()}
                  onChange={(event, newValue) => {
                    setNewCustomer(prev => ({
                      ...prev,
                      cus_category: newValue ? newValue.id : ''
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Account Category"
                      required
                      placeholder="Select category"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                          const firstCat = customerCategories && customerCategories.length ? customerCategories[0].cus_cat_id : '';
                          if (!newCustomer.cus_category && firstCat) setNewCustomer(prev => ({ ...prev, cus_category: firstCat }));
                        }
                      }}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#059669', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(5, 150, 105, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#059669', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BusinessIcon sx={{ fontSize: 16, color: '#059669' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={customerTypes.map(type => ({
                    id: type.cus_type_id,
                    title: type.cus_type_title
                  }))}
                  getOptionLabel={(option) => option.title || ''}
                  value={(() => {
                    return customerTypes.find(option => option.cus_type_id === newCustomer.cus_type)
                      ? { id: newCustomer.cus_type, title: customerTypes.find(option => option.cus_type_id === newCustomer.cus_type).cus_type_title }
                      : null;
                  })()}
                  onChange={(event, newValue) => {
                    setNewCustomer(prev => ({
                      ...prev,
                      cus_type: newValue ? newValue.id : ''
                    }));
                  }}
                  open={customerTypeOpen}
                  onOpen={() => setCustomerTypeOpen(true)}
                  onClose={() => setCustomerTypeOpen(false)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      inputRef={customerTypeInputRef}
                      label="Account Type"
                      required
                      placeholder="Select type"
                      onFocus={(e) => e.target.select()}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#7c3aed', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(124, 58, 237, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#7c3aed', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PersonIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                {/* Row 4 - City & Reference */}
                <Autocomplete
                  fullWidth
                  autoSelect={true}
                  autoHighlight={true}
                  openOnFocus={true}
                  selectOnFocus={true}
                  PaperComponent={(props) => (
                    <Paper
                      {...props}
                      elevation={8}
                      sx={{
                        borderRadius: '12px',
                        mt: 1,
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16), 0 2px 8px rgba(15, 23, 42, 0.08)',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        '& .MuiAutocomplete-listbox': {
                          p: 1,
                          maxHeight: '260px',
                          '&::-webkit-scrollbar': { width: '6px' },
                          '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '4px' },
                          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' }
                        },
                        '& .MuiAutocomplete-option': {
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          py: 1.2,
                          px: 2,
                          borderRadius: '8px',
                          mb: 0.5,
                          transition: 'all 0.15s ease',
                          color: '#334155',
                          '&:hover': {
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a'
                          },
                          '&[aria-selected="true"]': {
                            backgroundColor: '#e0e7ff !important',
                            color: '#4338ca',
                            fontWeight: 600
                          }
                        }
                      }}
                    />
                  )}
                  options={cities.map(city => ({
                    id: city.city_id,
                    title: city.city_name
                  }))}
                  getOptionLabel={(option) => option.title || ''}
                  value={(() => {
                    return cities.find(option => option.city_id === newCustomer.city_id)
                      ? { id: newCustomer.city_id, title: cities.find(option => option.city_id === newCustomer.city_id).city_name }
                      : null;
                  })()}
                  onChange={(event, newValue) => {
                    setNewCustomer(prev => ({
                      ...prev,
                      city_id: newValue ? newValue.id : ''
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="City"
                      placeholder="Select city"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                          const firstCity = cities && cities.length ? cities[0].city_id : '';
                          if (!newCustomer.city_id && firstCity) setNewCustomer(prev => ({ ...prev, city_id: firstCity }));
                        }
                      }}
                      sx={{
                        bgcolor: '#ffffff',
                        borderRadius: '10px',
                        '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '10px',
                          backgroundColor: '#ffffff',
                          fontSize: '0.9rem',
                          '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                          '&:hover fieldset': { borderColor: '#818cf8' },
                          '&.Mui-focused fieldset': { borderColor: '#d97706', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(217, 119, 6, 0.12)' },
                        },
                        '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#d97706', fontWeight: 700 } }
                      }}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 0.8 }}>
                            <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <MapPinIcon sx={{ fontSize: 16, color: '#d97706' }} />
                            </Box>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />

                <TextField
                  fullWidth
                  label="Reference"
                  name="cus_reference"
                  value={newCustomer.cus_reference ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_reference: e.target.value }))}
                  placeholder="Enter reference number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#0284c7', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(2, 132, 199, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#0284c7', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TagIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 5 - CNIC & NTN Number */}
                <TextField
                  fullWidth
                  label="CNIC"
                  name="CNIC"
                  value={newCustomer.CNIC ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, CNIC: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter CNIC number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#e11d48', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(225, 29, 72, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#e11d48', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCardIcon sx={{ fontSize: 16, color: '#e11d48' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="NTN Number"
                  name="NTN_NO"
                  value={newCustomer.NTN_NO ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, NTN_NO: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter NTN number"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#0d9488', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(13, 148, 136, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#0d9488', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TagIcon sx={{ fontSize: 16, color: '#0d9488' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 6 - Initial Balance & Account Info */}
                <TextField
                  fullWidth
                  disabled
                  label="Initial Balance"
                  name="cus_balance"
                  type="number"
                  inputProps={{ readOnly: true }}
                  value={newCustomer.cus_balance ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_balance: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Balance is non-editable"
                  sx={{
                    bgcolor: '#f8fafc',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#e2e8f0', borderWidth: '1.5px' },
                    },
                    '& .MuiInputLabel-root': { color: '#94a3b8', fontWeight: 500 }
                  }}
                  InputProps={{
                    readOnly: true,
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AttachMoneyIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Account Info"
                  name="cus_account_info"
                  value={newCustomer.cus_account_info ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_account_info: e.target.value }))}
                  placeholder="Enter account information"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(37, 99, 235, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#2563eb', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <InfoIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 7 - Name in Urdu & Other Information */}
                <TextField
                  fullWidth
                  label="Name in Urdu"
                  name="name_urdu"
                  value={newCustomer.name_urdu ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name_urdu: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter name in Urdu"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#9333ea', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(147, 51, 234, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#9333ea', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TranslateIcon sx={{ fontSize: 16, color: '#9333ea' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Other Information"
                  name="other"
                  value={newCustomer.other ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, other: e.target.value }))}
                  onFocus={(e) => e.target.select()}
                  placeholder="Enter other information"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: '#cbd5e1', borderWidth: '1.5px' },
                      '&:hover fieldset': { borderColor: '#818cf8' },
                      '&.Mui-focused fieldset': { borderColor: '#475569', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(71, 85, 105, 0.12)' },
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#475569', fontWeight: 700 } }
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <NotesIcon sx={{ fontSize: 16, color: '#475569' }} />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.82rem' }}>
            Fields marked with <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> are required
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button onClick={handleCloseCustomerPopup} sx={{ color: '#64748b', fontWeight: 600, px: 3, py: 1, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCustomer}
              variant="contained"
              disabled={isSavingCustomer}
              startIcon={isSavingCustomer ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
                textTransform: 'none',
                px: 3.5, py: 1.1,
                borderRadius: '10px',
                boxShadow: '0 4px 14px rgba(79, 70, 229, 0.38)',
                '&:hover': { background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)', boxShadow: '0 6px 20px rgba(79, 70, 229, 0.5)' }
              }}
            >
              {isSavingCustomer ? 'Saving...' : (editingCustomer ? 'Save Changes' : 'Create Customer Account')}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </>
  );
}
