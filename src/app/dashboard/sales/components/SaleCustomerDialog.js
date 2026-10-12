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
  CircularProgress,
  Avatar,
  Autocomplete,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as MapPinIcon,
  Business as BusinessIcon,
  Tag as TagIcon,
  CreditCard as CreditCardIcon,
  AttachMoney as AttachMoneyIcon,
  Description as NotesIcon,
} from '@mui/icons-material';
import { useSalesContext } from './SalesContext';

export default function SaleCustomerDialog() {
  const {
    customerPopupOpen,
    handleCloseCustomerPopup,
    editingCustomer,
    formSelectedCustomer,
    setShowCustomerCategoryPopup,
    setShowCustomerTypePopup,
    setShowCityPopup,
    customerNameInputRef,
    customerUrduNameInputRef,
    customerPhoneInputRef,
    customerAddressInputRef,
    newCustomer,
    setNewCustomer,
    customerCategories,
    customerCategoryOpen,
    setCustomerCategoryOpen,
    customerCategoryInputRef,
    customerTypes,
    customerTypeOpen,
    setCustomerTypeOpen,
    customerTypeInputRef,
    cities,
    isSavingCustomer,
    handleCreateCustomer,
  } = useSalesContext();

  return (
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
                inputRef={customerUrduNameInputRef}
                label="Account Name (Urdu)"
                name="cus_name_urdu"
                value={newCustomer.cus_name_urdu ?? ''}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_name_urdu: e.target.value }))}
                placeholder="اکاؤنٹ کا نام اردو میں"
                dir="rtl"
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: '10px',
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
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>اردو</Typography>
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Row 2 */}
              <TextField
                fullWidth
                inputRef={customerPhoneInputRef}
                label="Phone Number"
                name="cus_phone_no"
                value={newCustomer.cus_phone_no ?? ''}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_phone_no: e.target.value }))}
                placeholder="03XXXXXXXXX"
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: '10px',
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
                        <PhoneIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                inputRef={customerAddressInputRef}
                label="Address"
                name="cus_address"
                value={newCustomer.cus_address ?? ''}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_address: e.target.value }))}
                placeholder="Street address or area"
                sx={{
                  bgcolor: '#ffffff',
                  borderRadius: '10px',
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
                      <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPinIcon sx={{ fontSize: 16, color: '#d97706' }} />
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Row 3 - Dropdowns */}
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
                  id: category.cus_cat_id ?? category.cat_id,
                  title: category.cus_cat_title ?? category.cat_title
                }))}
                getOptionLabel={(option) => option.title || ''}
                value={(() => {
                  const currentId = newCustomer.cus_category ?? newCustomer.cat_id;
                  const found = customerCategories.find(option => (option.cus_cat_id ?? option.cat_id) === currentId);
                  return found
                    ? { id: currentId, title: found.cus_cat_title ?? found.cat_title }
                    : null;
                })()}
                onChange={(event, newValue) => {
                  setNewCustomer(prev => ({
                    ...prev,
                    cat_id: newValue ? newValue.id : '',
                    cus_category: newValue ? newValue.id : ''
                  }));
                }}
                open={customerCategoryOpen}
                onOpen={() => setCustomerCategoryOpen(true)}
                onClose={() => setCustomerCategoryOpen(false)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    inputRef={customerCategoryInputRef}
                    label="Account Category"
                    required
                    placeholder="Select category"
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                        const firstCat = customerCategories && customerCategories.length ? (customerCategories[0].cus_cat_id ?? customerCategories[0].cat_id) : '';
                        if (!newCustomer.cus_category && !newCustomer.cat_id && firstCat) setNewCustomer(prev => ({ ...prev, cat_id: firstCat, cus_category: firstCat }));
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

              {/* Row 5 - CNIC & NTN */}
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
                label="Opening Balance"
                name="cus_balance"
                type="number"
                inputProps={{ step: '0.01' }}
                value={newCustomer.cus_balance ?? ''}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, cus_balance: e.target.value }))}
                onFocus={(e) => e.target.select()}
                placeholder="0 — optional"
                helperText="Set starting balance when creating the account"
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
                    '&.Mui-focused fieldset': { borderColor: '#16a34a', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(22, 163, 74, 0.12)' },
                  },
                  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#16a34a', fontWeight: 700 } }
                }}
                InputProps={{
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
                label="Credit Limit"
                name="credit_limit"
                type="number"
                value={newCustomer.credit_limit ?? ''}
                onChange={(e) => setNewCustomer(prev => ({ ...prev, credit_limit: e.target.value }))}
                onFocus={(e) => e.target.select()}
                placeholder="0.00"
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
                    '&.Mui-focused fieldset': { borderColor: '#6366f1', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(99, 102, 241, 0.12)' },
                  },
                  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, '&.Mui-focused': { color: '#6366f1', fontWeight: 700 } }
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0.8 }}>
                      <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AttachMoneyIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                      </Box>
                    </InputAdornment>
                  ),
                }}
              />

              {/* Row 7 - Full width Note */}
              <Box sx={{ gridColumn: 'span 2' }}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description / Notes"
                  name="description"
                  value={newCustomer.description ?? ''}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional notes or details about this customer"
                  sx={{
                    bgcolor: '#ffffff',
                    borderRadius: '10px',
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
  );
}
