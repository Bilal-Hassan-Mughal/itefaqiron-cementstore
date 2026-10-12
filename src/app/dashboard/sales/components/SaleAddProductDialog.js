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
  Grid,
  TextField,
  InputAdornment,
  Autocomplete,
  CircularProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Inventory as PackageIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Business as BusinessIcon,
  Person as PersonIcon,
  LocationOn as MapPinIcon,
} from '@mui/icons-material';
import BiometricAuthDialog from '@/app/dashboard/components/BiometricAuthDialog';
import { fmtAmt, fmtRateQty } from './sale-utils';
import { useSalesContext } from './SalesContext';
import { formatDatePK, formatTimePK, getCreatedByName } from '@/lib/date-helper';

export default function SaleAddProductDialog() {
  const {
    showAddProductPopup,
    setShowAddProductPopup,
    addProductFormData,
    setAddProductFormData,
    isAddingProduct,
    productCategories,
    productSubcategories,
    productCatInput,
    setProductCatInput,
    productSubCatInput,
    setProductSubCatInput,
    handleAddProductQuick,
    // Add Product Category State
    showAddProductCategoryPopup,
    setShowAddProductCategoryPopup,
    addProductCategoryName,
    setAddProductCategoryName,
    isAddingProductCategory,
    handleAddProductCategory,
    // Add Product Subcategory State
    showAddProductSubCategoryPopup,
    setShowAddProductSubCategoryPopup,
    addProductSubCategoryFormData,
    setAddProductSubCategoryFormData,
    isAddingProductSubCategory,
    handleAddProductSubCategory,
    // Customer Category State
    showCustomerCategoryPopup,
    setShowCustomerCategoryPopup,
    customerCategoryFormData,
    setCustomerCategoryFormData,
    isAddingCustomerCategory,
    handleAddCustomerCategory,
    // Customer Type State
    showCustomerTypePopup,
    setShowCustomerTypePopup,
    customerTypeFormData,
    setCustomerTypeFormData,
    isAddingCustomerType,
    handleAddCustomerType,
    // City State
    showCityPopup,
    setShowCityPopup,
    cityFormData,
    setCityFormData,
    isAddingCity,
    handleAddCity,
    // Auth & Loss Dialogs
    authDialogOpen,
    handleAuthSuccess,
    handleAuthCancel,
    lossConfirmOpen,
    setLossConfirmOpen,
    lossItems,
    handleSaveBill,
    currentBillData,
    selectedBill,
    currentUser,
    isWalkinCustomer,
    getBillDisplayNo,
    getSaleDetailsInAddOrder,
  } = useSalesContext();

  return (
    <>
      {/* Add Product Popup */}
      <Dialog open={showAddProductPopup} onClose={() => setShowAddProductPopup(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)', backdropFilter: 'blur(20px)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' } }}>
        <DialogTitle sx={{ background: 'linear-gradient(45deg, #2196F3 30%, #9C27B0 90%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ width: 48, height: 48, mr: 2, bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
              <PackageIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add New Product</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product in your inventory</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductPopup(false)} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)', transform: 'scale(1.1)' }, transition: 'all 0.2s ease-in-out' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
          <Box sx={{ p: 3, pb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', bgcolor: 'white' }}>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setShowAddProductCategoryPopup(true)}
              sx={{ borderColor: '#2196F3', color: '#2196F3', '&:hover': { borderColor: '#1976D2', backgroundColor: 'rgba(33,150,243,0.04)' } }}>
              Add Category
            </Button>
            <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setShowAddProductSubCategoryPopup(true)}
              sx={{ borderColor: '#9C27B0', color: '#9C27B0', '&:hover': { borderColor: '#7B1FA2', backgroundColor: 'rgba(156,39,176,0.04)' } }}>
              Add Subcategory
            </Button>
          </Box>
          <Box sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
            {/* Basic Information */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #2196F3', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#2196F3' }} />
                Basic Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12}>
                  <TextField fullWidth required label="Product Title"
                    value={addProductFormData.pro_title}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_title: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter product title"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth multiline rows={3} label="Description"
                    value={addProductFormData.pro_description}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_description: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter product description"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
            {/* Category & Classification */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #9C27B0', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#9C27B0' }} />
                Category &amp; Classification
              </Typography>
              <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 45%', minWidth: '280px' }}>
                  <Autocomplete
                    options={productCategories}
                    getOptionLabel={(opt) => opt.cat_name || ''}
                    value={productCategories.find(c => c.cat_id === addProductFormData.cat_id) || null}
                    onChange={(_, v) => setAddProductFormData(prev => ({ ...prev, cat_id: v?.cat_id || '', sub_cat_id: '' }))}
                    inputValue={productCatInput}
                    onInputChange={(_, v) => setProductCatInput(v)}
                    disabled={isAddingProduct}
                    renderInput={(params) => <TextField {...params} label="Category" required placeholder="Select category" />}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '60px', bgcolor: 'white', px: 2 }, '& .MuiInputLabel-root': { fontWeight: 500 } }}
                  />
                </Box>
                <Box sx={{ flex: '1 1 45%', minWidth: '280px' }}>
                  <Autocomplete
                    options={productSubcategories.filter(s => s.cat_id === addProductFormData.cat_id)}
                    getOptionLabel={(opt) => opt.sub_cat_name || ''}
                    value={productSubcategories.find(s => s.sub_cat_id === addProductFormData.sub_cat_id) || null}
                    onChange={(_, v) => setAddProductFormData(prev => ({ ...prev, sub_cat_id: v?.sub_cat_id || '' }))}
                    inputValue={productSubCatInput}
                    onInputChange={(_, v) => setProductSubCatInput(v)}
                    disabled={isAddingProduct || !addProductFormData.cat_id}
                    renderInput={(params) => <TextField {...params} label="Subcategory" required placeholder="Select subcategory" disabled={!addProductFormData.cat_id} />}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '60px', bgcolor: 'white', px: 2 }, '& .MuiInputLabel-root': { fontWeight: 500 } }}
                  />
                </Box>
              </Box>
            </Box>
            {/* Pricing Information */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #16a34a', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#16a34a' }} />
                Pricing Information
              </Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Purchase Cost" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_crate}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_crate: e.target.value, pro_cost_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Sale Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_sale_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_sale_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Base Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_baser_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_baser_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth label="Cost Price" type="number" inputProps={{ step: '0.01' }}
                    value={addProductFormData.pro_cost_price}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_cost_price: e.target.value }))}
                    disabled={isAddingProduct} placeholder="0.00"
                    InputProps={{ startAdornment: <InputAdornment position="start" sx={{ fontWeight: 600 }}>Rs</InputAdornment> }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
            {/* Inventory Details */}
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e293b', mb: 2, pb: 1.5, borderBottom: '2px solid #d97706', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#d97706' }} />
                Inventory Details
              </Typography>
              <Grid container spacing={2.5}>
                {[
                  { label: 'Stock Quantity', field: 'pro_stock_qnty', placeholder: '0', type: 'number' },
                  { label: 'Low Stock Alert Qty', field: 'low_stock_quantity', placeholder: '10', type: 'number' },
                  { label: 'Unit', field: 'pro_unit', placeholder: 'e.g., pieces, kg', type: 'text' },
                ].map(({ label, field, placeholder, type }) => (
                  <Grid item xs={12} sm={6} md={4} key={field}>
                    <TextField fullWidth label={label} type={type}
                      value={addProductFormData[field]}
                      onChange={(e) => setAddProductFormData(prev => ({ ...prev, [field]: e.target.value }))}
                      disabled={isAddingProduct} placeholder={placeholder}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, height: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                  </Grid>
                ))}
                <Grid item xs={12}>
                  <TextField fullWidth label="Packing"
                    value={addProductFormData.pro_packing}
                    onChange={(e) => setAddProductFormData(prev => ({ ...prev, pro_packing: e.target.value }))}
                    disabled={isAddingProduct} placeholder="Enter packing information"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, minHeight: '48px', bgcolor: 'white' }, '& .MuiInputLabel-root': { fontWeight: 500 } }} />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2, borderTop: '1px solid #e2e8f0', bgcolor: 'white', justifyContent: 'flex-end' }}>
          <Button onClick={() => setShowAddProductPopup(false)} variant="outlined"
            sx={{ borderColor: '#cbd5e1', color: '#64748b', padding: '8px 24px', borderRadius: 1.5, textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f1f5f9' } }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddProductQuick} disabled={isAddingProduct}
            startIcon={isAddingProduct ? <CircularProgress size={20} /> : <SaveIcon />}
            sx={{ background: 'linear-gradient(45deg, #2196f3, #9c27b0)', px: 4, py: 1, borderRadius: 1.5, textTransform: 'none', fontWeight: 600, boxShadow: 3, transition: 'all 0.2s ease-in-out', '&:hover': { background: 'linear-gradient(45deg, #1976d2, #7b1fa2)', boxShadow: 6, transform: 'translateY(-2px)' }, '&:disabled': { background: 'linear-gradient(45deg, #90caf9, #ce93d8)', color: 'rgba(255,255,255,0.7)' } }}>
            {isAddingProduct ? 'Saving...' : 'Create Product'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Category Popup */}
      <Dialog open={showAddProductCategoryPopup} onClose={() => setShowAddProductCategoryPopup(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 40, height: 40 }}>
              <FolderIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add Product Category</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product category</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth required
              label="Category Name"
              value={addProductCategoryName}
              onChange={(e) => setAddProductCategoryName(e.target.value)}
              disabled={isAddingProductCategory}
              placeholder="Enter category name"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductCategory} disabled={isAddingProductCategory}
            sx={{ background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)', textTransform: 'none', '&:hover': { background: 'linear-gradient(45deg, #388e3c 30%, #1b5e20 90%)' } }}>
            {isAddingProductCategory ? 'Adding...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Product Sub Category Popup */}
      <Dialog open={showAddProductSubCategoryPopup} onClose={() => setShowAddProductSubCategoryPopup(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #9c27b0 30%, #6a1b9a 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', mr: 2, width: 40, height: 40 }}>
              <FolderOpenIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>Add Product Sub Category</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Create a new product subcategory</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ color: 'white' }}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              options={productCategories}
              getOptionLabel={(opt) => opt.cat_name || ''}
              value={productCategories.find(c => c.cat_id === addProductSubCategoryFormData.cat_id) || null}
              onChange={(_, v) => setAddProductSubCategoryFormData(prev => ({ ...prev, cat_id: v?.cat_id || '' }))}
              disabled={isAddingProductSubCategory}
              renderInput={(params) => <TextField {...params} label="Category" required placeholder="Select category" />}
            />
            <TextField
              fullWidth required
              label="Subcategory Name"
              value={addProductSubCategoryFormData.sub_cat_name}
              onChange={(e) => setAddProductSubCategoryFormData(prev => ({ ...prev, sub_cat_name: e.target.value }))}
              disabled={isAddingProductSubCategory}
              placeholder="Enter subcategory name"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={() => setShowAddProductSubCategoryPopup(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAddProductSubCategory} disabled={isAddingProductSubCategory}
            sx={{ background: 'linear-gradient(45deg, #9c27b0 30%, #6a1b9a 90%)', textTransform: 'none', '&:hover': { background: 'linear-gradient(45deg, #7b1fa2 30%, #4a148c 90%)' } }}>
            {isAddingProductSubCategory ? 'Adding...' : 'Add Sub Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Category Popup */}
      <Dialog
        open={showCustomerCategoryPopup}
        onClose={() => setShowCustomerCategoryPopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add Account Category
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new account category
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCustomerCategoryPopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="Account Category Title"
              value={customerCategoryFormData.cus_cat_title}
              onChange={(e) => setCustomerCategoryFormData({ cus_cat_title: e.target.value })}
              disabled={isAddingCustomerCategory}
              placeholder="Enter account category title"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCustomerCategoryPopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCustomerCategory}
            disabled={isAddingCustomerCategory}
            sx={{
              background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #388e3c 30%, #1b5e20 90%)',
              }
            }}
          >
            {isAddingCustomerCategory ? 'Adding...' : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Account Type Popup */}
      <Dialog
        open={showCustomerTypePopup}
        onClose={() => setShowCustomerTypePopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <PersonIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add Account Type
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new account type
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCustomerTypePopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="Account Type Title"
              value={customerTypeFormData.cus_type_title}
              onChange={(e) => setCustomerTypeFormData({ cus_type_title: e.target.value })}
              disabled={isAddingCustomerType}
              placeholder="Enter account type title"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCustomerTypePopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCustomerType}
            disabled={isAddingCustomerType}
            sx={{
              background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #1976d2 30%, #7b1fa2 90%)',
              }
            }}
          >
            {isAddingCustomerType ? 'Adding...' : 'Add Type'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* City Popup */}
      <Dialog
        open={showCityPopup}
        onClose={() => setShowCityPopup(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{
          background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{
              bgcolor: 'rgba(255,255,255,0.2)',
              mr: 2,
              width: 40,
              height: 40
            }}>
              <MapPinIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                Add City
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Create a new city
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setShowCityPopup(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              required
              label="City Name"
              value={cityFormData.city_name}
              onChange={(e) => setCityFormData({ city_name: e.target.value })}
              disabled={isAddingCity}
              placeholder="Enter city name"
              sx={{ mb: 2 }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
          <Button
            onClick={() => setShowCityPopup(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddCity}
            disabled={isAddingCity}
            sx={{
              background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
              textTransform: 'none',
              '&:hover': {
                background: 'linear-gradient(45deg, #f57c00 30%, #ef6c00 90%)',
              }
            }}
          >
            {isAddingCity ? 'Adding...' : 'Add City'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
