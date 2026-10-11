import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
  Autocomplete,
  Stack,
  Grid,
  Table,
  TableContainer,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Select,
  MenuItem,
  Chip,
  Paper,
  Container
} from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownIcon from '@mui/icons-material/ArrowDownward';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PrintIcon from '@mui/icons-material/Print';
import SaveIcon from '@mui/icons-material/Save';
import ListIcon from '@mui/icons-material/List';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PackageIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import DashboardLayout from '@/app/dashboard/components/dashboard-layout';
import DateFilterInput from '@/app/dashboard/components/date-filter-input';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { useSalesContext } from './SalesContext';
import { SaleCustomerDropdownListbox } from './SaleDropdownListbox';
import {
  SALE_ENTRY_ROW1_SX,
  SALE_ENTRY_ROW1_RETURN_SX,
  SALE_ENTRY_CELL_SX,
  SALE_ENTRY_LABEL_SX,
  SALE_ENTRY_CONTROL_SX,
  SALE_ENTRY_ROW2_SX,
  SALES_NUM_CELL_SX,
  saleDropdownRowStyle,
  saleDropdownCellStyle,
  SALE_DROPDOWN_POPPER_SX,
  SALE_CUSTOMER_DROPDOWN_GRID,
  isCustomerAccount,
  matchesCustomerType,
  filterSaleCustomers,
  getFocusedAutocompleteOption,
  EMPTY_PAYMENT_DATA,
  getCartLineCostRate,
  paymentInputValue
} from './sale-utils';

export default function SaleCreateView() {
  const ctx = useSalesContext();
  const {
    autoHoldIfActive,
    billType,
    calculateBalance,
    calculateGrandTotal,
    calculateTotalAmount,
    calculateTransportTotal,
    cancelCurrentScreen,
    clearFormState,
    commitDropdownOnTab,
    currentBillData,
    customerCategories,
    customerTypeFilterOpen,
    customerTypeHighlightRef,
    customers,
    drafts,
    editingSale,
    fetchDrafts,
    filterSaleProducts,
    fmtAmt,
    fmtRateQty,
    formSelectedCustomer,
    formSelectedProduct,
    formSelectedStore,
    getHighlightedOptionIndex,
    handleAddProductToTable,
    handleLoadSaleForReturnMain,
    handleOpenEditCustomer,
    handleOpenLedger,
    handlePaymentDataChange,
    handlePrintBill,
    handleRemoveProductFromTable,
    moveProductRow,
    handleSaleSearch,
    loadSaleReturnInvoiceOptions,
    saleInvoiceSearchLoading,
    handleSaveBill,
    handleSaveDraft,
    handleSearchOrder,
    isSavingDraft,
    isSearchingOrder,
    loading,
    orderSearchTerm,
    paymentData,
    productHighlightRef,
    productTableData,
    products,
    saleEntryDate,
    salePageCustomerTypeOptions,
    saleSearchOpen,
    saleSearchResults,
    sales,
    savingBill,
    screenStack,
    selectedCustomerTypeFilter,
    selectedSaleForReturnMain,
    setBillType,
    setCurrentBillData,
    setCurrentDraftId,
    setCurrentView,
    setCustomerTypeFilterOpen,
    setDraftModalOpen,
    setFormSelectedCustomer,
    setFormSelectedProduct,
    setFormSelectedStore,
    setLoadedOrderId,
    setOrderSearchTerm,
    setPaymentData,
    setProductTableData,
    setSaleEntryDate,
    setSaleSearchOpen,
    setSaleSearchResults,
    setSelectedCustomerTypeFilter,
    setSelectedSaleForReturnMain,
    setTransportOptions,
    formatTransportAccountLabel,
    storeHighlightRef,
    stores,
    transportOptions,
    productFormData,
    handleProductSelect,
    handleQuantityChange,
    handleRateChange,
    transportAccounts,
    newTransport,
    setNewTransport,
    handleAddTransport,
    handleRemoveTransport,
    bankAccounts,
    toggleVisibleCrate,
    visibleCrates,
    customerHighlightRef,
    isOnline,
    offlineQueueCount,
    isSyncingOffline,
    triggerAutoSync,
    setLoadQuotationDialogOpen,
    openLoadOrderDialog,
    handleOpenCustomerPopup,
    setShowAddProductPopup,
    setShowAddProductCategoryPopup,
    setShowAddProductSubCategoryPopup,
    currentScreenIndex,
  } = ctx;

  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 1 }}>

        {/* Page Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <IconButton
              onClick={() => setCurrentView('list')}
              sx={{
                bgcolor: 'primary.main', color: 'white', borderRadius: 2,
                '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.05)' },
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <SearchIcon />
            </IconButton>
            <Box>
              <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', color: billType === 'SALE_RETURN' ? '#d32f2f' : editingSale ? '#1565c0' : 'text.primary' }}>
                {editingSale ? `Edit Sale #${editingSale.bill_number || editingSale.sale_id}` : billType === 'SALE_RETURN' ? 'Return Sale' : 'Create New Sale'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {editingSale ? 'Update sale details — ledger will be adjusted automatically' : billType === 'SALE_RETURN' ? 'Select an invoice to return items' : 'Select products and create sale order'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {/* Network Status Badge */}
            <Chip
              icon={isOnline ? <WifiIcon style={{ color: '#2e7d32' }} /> : <WifiOffIcon style={{ color: '#d32f2f' }} />}
              label={isOnline ? (offlineQueueCount > 0 ? `Online (${offlineQueueCount} Pending)` : 'Online') : `Offline Mode (${offlineQueueCount} Pending)`}
              color={!isOnline || offlineQueueCount > 0 ? 'warning' : 'success'}
              variant={!isOnline || offlineQueueCount > 0 ? 'filled' : 'outlined'}
              size="small"
              sx={{ fontWeight: 'bold', px: 0.5 }}
            />
            {offlineQueueCount > 0 && (
              <Button variant="contained" size="small"
                startIcon={isSyncingOffline ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                onClick={triggerAutoSync} disabled={isSyncingOffline || !isOnline}
                sx={{ bgcolor: '#ed6c02', color: 'white', fontWeight: 'bold', '&:hover': { bgcolor: '#e65100' } }}
                title="Upload pending offline bills to online server"
              >
                {isSyncingOffline ? 'Syncing...' : `Sync Offline (${offlineQueueCount})`}
              </Button>
            )}
            <Button variant="outlined" startIcon={<ReceiptIcon />}
              onClick={() => setLoadQuotationDialogOpen(true)}
              sx={{ mr: 2, borderColor: '#ed6c02', color: '#ed6c02', '&:hover': { borderColor: '#e65100', backgroundColor: '#fff3e0' } }}
            >Load Quotation</Button>
            <Button variant="outlined" startIcon={<ListAltIcon />}
              onClick={openLoadOrderDialog}
              sx={{ mr: 2, borderColor: '#1976d2', color: '#1976d2', '&:hover': { borderColor: '#115293', backgroundColor: '#e3f2fd' } }}
            >Load Order</Button>
            <Button variant="outlined" startIcon={<AddIcon />}
              onClick={handleOpenCustomerPopup}
              sx={{ borderColor: '#6f42c1', color: '#6f42c1', '&:hover': { borderColor: '#5a2d91', backgroundColor: '#f8f5ff' } }}
            >Create Customer</Button>
            <Button variant="outlined" startIcon={<PackageIcon />}
              onClick={() => setShowAddProductPopup(true)}
              sx={{ borderColor: 'info.main', color: 'info.main', '&:hover': { borderColor: 'info.dark', backgroundColor: 'info.light', color: 'info.dark' } }}
            >Add Product</Button>
            <Button variant="outlined" startIcon={<FolderIcon />}
              onClick={() => setShowAddProductCategoryPopup(true)}
              sx={{ borderColor: 'success.main', color: 'success.main', '&:hover': { borderColor: 'success.dark', backgroundColor: 'success.light', color: 'success.dark' } }}
            >Add Product Category</Button>
            <Button variant="outlined" startIcon={<FolderOpenIcon />}
              onClick={() => setShowAddProductSubCategoryPopup(true)}
              sx={{ borderColor: 'secondary.main', color: 'secondary.main', '&:hover': { borderColor: 'secondary.dark', backgroundColor: 'secondary.light', color: 'secondary.dark' } }}
            >Add Product Sub Category</Button>
          </Box>
        </Box>

        {/* Screen Stack Indicator */}
        {currentScreenIndex >= 0 && screenStack.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', mb: 2, gap: 1 }}>
            <Box sx={{ background: 'rgba(51,65,85,0.1)', color: '#475569', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, border: '1px solid rgba(51,65,85,0.2)' }}>
              SCREEN {currentScreenIndex + 1}
              {screenStack.length > 1 && (<span style={{ opacity: 0.7, fontSize: '10px', marginLeft: '4px' }}>({currentScreenIndex + 1}/{screenStack.length})</span>)}
            </Box>
            {screenStack.length > 1 && (
              <IconButton size="small" onClick={cancelCurrentScreen} title="Cancel this screen (Ctrl+X)"
                sx={{ color: '#dc3545', padding: 0, '&:hover': { bgcolor: 'rgba(220,53,69,0.1)' } }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </Box>
        )}

        <Card>
            <CardContent sx={{ p: 2 }}>
              {/* Transaction Type Banner */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 2,
                  borderRadius: 2,
                  background: billType === 'SALE_RETURN'
                    ? 'linear-gradient(45deg, #c62828 30%, #ef5350 90%)' // Red for Return
                    : 'linear-gradient(45deg, #047857 30%, #10b981 90%)', // Green for Sale
                  boxShadow: '0 3px 5px 2px rgba(0,0,0,0.1)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {billType === 'SALE_RETURN' ? 'Sale Return Entry' : 'New Sale Entry'}
                    </Typography>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.2)',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}>
                      {billType === 'SALE_RETURN' ? <TrendingDownIcon sx={{ color: 'white' }} /> : <ReceiptIcon sx={{ color: 'white' }} />}
                      <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                        {billType === 'SALE_RETURN' ? 'Return In' : 'Invoice Out'}
                      </Typography>
                    </Box>
                  </Box>

                  <Autocomplete
                    size="small"
                    options={['BILL', 'SALE_RETURN']}
                    value={billType ?? 'BILL'}
                    onChange={(e, newValue) => {
                      setBillType(newValue || 'BILL');
                      if (newValue !== 'SALE_RETURN') {
                        setSelectedSaleForReturnMain(null);
                      }
                    }}
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select Transaction Type"
                        variant="standard"
                        onFocus={(e) => e.target.select()}
                        sx={{
                          minWidth: 200,
                          '& .MuiInputBase-input': {
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.1rem',
                            paddingRight: 2
                          },
                          '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.7)' },
                          '& .MuiInput-underline:after': { borderBottomColor: 'white' },
                          '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottomColor: 'white' }
                        }}
                      />
                    )}
                  />
                </Box>

              </Box>

              {/* Filter and Order Search Row */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>

                {/* Left Side: Customer Type Dropdown Filter */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'black', whiteSpace: 'nowrap' }}>
                    Customer Type:
                  </Typography>
                  <Autocomplete
                    size="small"
                    sx={{ minWidth: 450 }}
                    options={salePageCustomerTypeOptions}
                    getOptionLabel={(option) => option.cus_type_title || ''}
                    value={selectedCustomerTypeFilter ?? null}
                    open={customerTypeFilterOpen}
                    onOpen={() => setCustomerTypeFilterOpen(true)}
                    onClose={() => setCustomerTypeFilterOpen(false)}
                    onChange={(event, newValue) => {
                      setSelectedCustomerTypeFilter(newValue ?? null);
                      setCustomerTypeFilterOpen(false);
                      if (newValue) {
                        const typeTitle = (newValue.cus_type_title || '').toLowerCase();
                        if (typeTitle.includes('walk')) {
                          const matchingCustomer = customers.find((c) =>
                            Number(c.cus_type) === Number(newValue.cus_type_id) ||
                            (c.customer_type?.cus_type_id != null && Number(c.customer_type.cus_type_id) === Number(newValue.cus_type_id)) ||
                            (c.cus_name || '').toLowerCase().includes('walk')
                          );
                          if (matchingCustomer) {
                            setFormSelectedCustomer(matchingCustomer);
                          }
                        }
                      }
                      setTimeout(() => {
                        const customerInput = document.getElementById('customer-search-dropdown-input');
                        if (customerInput) {
                          customerInput.focus();
                          if (typeof customerInput.select === 'function') customerInput.select();
                        }
                      }, 50);
                    }}
                    isOptionEqualToValue={(option, value) => option.cus_type_id === value?.cus_type_id}
                    autoSelect={true}
                    autoHighlight={true}
                    selectOnFocus={true}
                    slotProps={{
                      clearIndicator: { tabIndex: -1 },
                      popupIndicator: { tabIndex: -1 },
                      popper: {
                        placement: 'bottom-start',
                        modifiers: [
                          {
                            name: 'flip',
                            enabled: false,
                          },
                        ],
                      },
                    }}
                    onHighlightChange={(_, option) => {
                      if (option) customerTypeHighlightRef.current = option;
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        setCustomerTypeFilterOpen(false);

                        let toSelect = customerTypeHighlightRef.current;
                        if (!toSelect) {
                          const idx = getHighlightedOptionIndex();
                          if (idx != null && salePageCustomerTypeOptions[idx]) {
                            toSelect = salePageCustomerTypeOptions[idx];
                          }
                        }
                        if (!toSelect && e.target.value) {
                          const searchVal = e.target.value.toLowerCase().trim();
                          toSelect = salePageCustomerTypeOptions.find(opt =>
                            (opt.cus_type_title || '').toLowerCase().includes(searchVal)
                          );
                        }

                        if (toSelect) {
                          setSelectedCustomerTypeFilter(toSelect);
                          const typeTitle = (toSelect.cus_type_title || '').toLowerCase();
                          if (typeTitle.includes('walk')) {
                            const matchingCustomer = customers.find((c) =>
                              Number(c.cus_type) === Number(toSelect.cus_type_id) ||
                              (c.customer_type?.cus_type_id != null && Number(c.customer_type.cus_type_id) === Number(toSelect.cus_type_id)) ||
                              (c.cus_name || '').toLowerCase().includes('walk')
                            );
                            if (matchingCustomer) {
                              setFormSelectedCustomer(matchingCustomer);
                            }
                          }
                        }

                        [0, 25, 75, 150].forEach((delay) => {
                          setTimeout(() => {
                            const customerInput = document.getElementById('customer-search-dropdown-input') ||
                                                  document.querySelector('input[placeholder*="Search by name"]');
                            if (customerInput) {
                              customerInput.focus();
                              if (typeof customerInput.select === 'function') {
                                try { customerInput.select(); } catch (err) {}
                              }
                            }
                          }, delay);
                        });
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="customer-type-filter-autocomplete-input"
                        placeholder="All Customer Types"
                        variant="outlined"
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            setCustomerTypeFilterOpen(false);

                            let toSelect = customerTypeHighlightRef.current;
                            if (!toSelect && e.target.value) {
                              const searchVal = e.target.value.toLowerCase().trim();
                              toSelect = salePageCustomerTypeOptions.find(opt =>
                                (opt.cus_type_title || '').toLowerCase().includes(searchVal)
                              );
                            }

                            if (toSelect) {
                              setSelectedCustomerTypeFilter(toSelect);
                            }

                            [0, 25, 75, 150].forEach((delay) => {
                              setTimeout(() => {
                                const customerInput = document.getElementById('customer-search-dropdown-input') ||
                                                      document.querySelector('input[placeholder*="Search by name"]');
                                if (customerInput) {
                                  customerInput.focus();
                                  if (typeof customerInput.select === 'function') {
                                    try { customerInput.select(); } catch (err) {}
                                  }
                                }
                              }, delay);
                            });
                          }
                        }}
                        sx={{
                          bgcolor: 'white',
                          borderRadius: '8px',
                          '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                          '& .MuiInputBase-input': {
                            fontWeight: 'bold',
                            color: 'black'
                          }
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Right Side: Load Order Components */}
                {billType !== 'SALE_RETURN' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'text.primary', whiteSpace: 'nowrap' }}>
                      Load Order:
                    </Typography>
                    <TextField
                      size="small"
                      placeholder="Enter Order Number (e.g. 123)"
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      sx={{ width: 250, bgcolor: 'white' }}
                      InputProps={{
                        endAdornment: (
                          <SearchIcon color="action" fontSize="small" />
                        ),
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchOrder();
                        }
                      }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSearchOrder}
                      disabled={isSearchingOrder || !orderSearchTerm}
                      sx={{ bgcolor: '#1976d2', color: 'white', '&:hover': { bgcolor: '#1565c0' } }}
                    >
                      {isSearchingOrder ? <CircularProgress size={20} color="inherit" /> : 'Load'}
                    </Button>
                  </Box>
                ) : <Box />}
              </Box>

              {/* First Row - Customer, Date, Reference */}
              <Box sx={billType === 'SALE_RETURN' ? SALE_ENTRY_ROW1_RETURN_SX : SALE_ENTRY_ROW1_SX}>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75, gap: 1, minHeight: 22, flexWrap: 'wrap' }}>
                    <Typography sx={{ ...SALE_ENTRY_LABEL_SX, mb: 0 }}>
                      CUSTOMER
                    </Typography>
                    {formSelectedCustomer && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          component="span"
                          sx={{
                            bgcolor: '#bbf7d0',
                            color: '#14532d',
                            border: '1px solid #22c55e',
                            px: 2,
                            py: 0.75,
                            borderRadius: 1.5,
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            lineHeight: 1.3,
                            letterSpacing: '0.02em',
                            display: 'inline-block',
                            boxShadow: '0 1px 2px rgba(22, 163, 74, 0.15)',
                          }}
                        >
                          Balance:{' '}
                          <Box component="span" sx={{ fontSize: '1.05rem', fontWeight: 900 }}>
                            {parseFloat(formSelectedCustomer.cus_balance || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
                          </Box>
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ListAltIcon />}
                          onClick={handleOpenLedger}
                          sx={{
                            py: 0.5,
                            fontSize: '0.75rem',
                            color: 'secondary.main',
                            borderColor: 'secondary.main',
                            '&:hover': {
                              borderColor: 'secondary.dark',
                              bgcolor: 'secondary.light',
                              color: 'white'
                            }
                          }}
                        >
                          View Ledger
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditIcon />}
                          onClick={handleOpenEditCustomer}
                          sx={{
                            py: 0.5,
                            fontSize: '0.75rem',
                            color: 'warning.main',
                            borderColor: 'warning.main',
                            '&:hover': {
                              borderColor: 'warning.dark',
                              bgcolor: 'warning.light',
                              color: 'white'
                            }
                          }}
                        >
                          Edit
                        </Button>
                      </Stack>
                    )}
                  </Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      '& .MuiAutocomplete-popupIndicator': { color: 'white' },
                      '& .MuiAutocomplete-clearIndicator': { color: 'white' }
                    }}
                    onKeyDown={(e) => {
                      commitDropdownOnTab(
                        e,
                        customerHighlightRef.current || formSelectedCustomer,
                        (val) => {
                          setFormSelectedCustomer(val);
                          if (billType === 'SALE_RETURN') {
                            setSaleSearchResults([]);
                            setSelectedSaleForReturnMain(null);
                          }
                        },
                        () => {
                          if (billType === 'SALE_RETURN') {
                            return document.querySelector('input[placeholder*="Search Sale ID"]');
                          }
                          return document.getElementById('product-select-dropdown-input')
                            || document.querySelector('input[placeholder*="Select product"]');
                        }
                      );
                    }}
                    onHighlightChange={(_, option) => {
                      if (option) customerHighlightRef.current = option;
                    }}
                    options={customers.filter(customer => {
                      if (!isCustomerAccount(customer, customerCategories)) return false;
                      if (selectedCustomerTypeFilter) {
                        return matchesCustomerType(customer, selectedCustomerTypeFilter);
                      }
                      return true;
                    })}
                    getOptionLabel={(option) => option.cus_name || ''}
                    slots={{ listbox: SaleCustomerDropdownListbox }}
                    slotProps={{
                      popper: {
                        sx: {
                          ...SALE_DROPDOWN_POPPER_SX,
                          minWidth: 740,
                        },
                        modifiers: [{ name: 'flip', enabled: false }],
                      },
                      paper: {
                        sx: { width: 740, maxWidth: '92vw', mt: 0.5 },
                      },
                    }}
                    filterOptions={filterSaleCustomers}
                    value={formSelectedCustomer ?? null}
                    onChange={(event, newValue) => {
                      setFormSelectedCustomer(newValue ?? null);
                      if (billType === 'SALE_RETURN') {
                        setSaleSearchResults([]);
                        setSelectedSaleForReturnMain(null);
                      }
                    }}
                    isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    renderOption={(props, option, { index }) => {
                      const { key, ownerState, ...optionProps } = props;
                      return (
                        <li key={option.cus_id ?? key} {...optionProps} style={{ ...saleDropdownRowStyle(SALE_CUSTOMER_DROPDOWN_GRID), ...optionProps.style }}>
                          <span style={{ ...saleDropdownCellStyle, justifyContent: 'center', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                            {index + 1}
                          </span>
                          <span
                            title={option.cus_name || ''}
                            style={{
                              ...saleDropdownCellStyle,
                              fontWeight: 700,
                              color: '#111827',
                              whiteSpace: 'normal',
                              overflow: 'visible',
                              textOverflow: 'unset',
                              lineHeight: 1.25,
                            }}
                          >
                            {option.cus_name || ''}
                          </span>
                          <span title={option.cus_phone_no || ''} style={{ ...saleDropdownCellStyle, fontVariantNumeric: 'tabular-nums' }}>
                            {option.cus_phone_no || ''}
                          </span>
                          <span title={option.cus_address || ''} style={saleDropdownCellStyle}>
                            {option.cus_address || ''}
                          </span>
                          <span
                            title={`Balance: Rs. ${parseFloat(option.cus_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            style={{
                              ...saleDropdownCellStyle,
                              borderRight: 'none',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: parseFloat(option.cus_balance || 0) > 0 ? '#b91c1c' : parseFloat(option.cus_balance || 0) < 0 ? '#15803d' : '#475569',
                              justifyContent: 'flex-end',
                              paddingRight: 10,
                            }}
                          >
                            Rs. {parseFloat(option.cus_balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </li>
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        id="customer-search-dropdown-input"
                        fullWidth
                        placeholder="Search by name, phone, address, city, reference"
                        onFocus={(e) => e.target.select()}
                        sx={{
                          bgcolor: '#2e7d32',
                          width: '100%',
                          minWidth: 0,
                          borderRadius: 1,
                          '& .MuiOutlinedInput-root': {
                            height: 40,
                            fontSize: '0.95rem',
                            color: 'white !important',
                            WebkitTextFillColor: 'white !important',
                            '& fieldset': {
                              borderColor: '#1b5e20',
                              borderWidth: '2px'
                            },
                            '&:hover fieldset': {
                              borderColor: '#1b5e20'
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#1b5e20'
                            }
                          },
                          '& .MuiInputBase-input': {
                            fontWeight: 'bold',
                            color: 'white !important',
                            WebkitTextFillColor: 'white !important',
                            '&::placeholder': {
                              color: 'rgba(255, 255, 255, 0.7) !important',
                              WebkitTextFillColor: 'rgba(255, 255, 255, 0.7) !important',
                              opacity: 1
                            }
                          }
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Return Invoice Selection (Only for Sale Return) */}
                {billType === 'SALE_RETURN' && (
                  <Box sx={SALE_ENTRY_CELL_SX}>
                    <Typography sx={SALE_ENTRY_LABEL_SX}>
                      SELECT INVOICE
                    </Typography>
                    <Autocomplete
                      open={saleSearchOpen}
                      onOpen={() => {
                        setSaleSearchOpen(true);
                        loadSaleReturnInvoiceOptions('');
                      }}
                      onClose={() => setSaleSearchOpen(false)}
                      options={saleSearchResults}
                      getOptionLabel={(option) => {
                        // Helper to find customer name
                        const cName = option.customer?.cus_name || (customers.find(c => c.cus_id === option.cus_id)?.cus_name) || 'Unknown';
                        return `#${option.sale_id} - ${cName} - ${option.reference || 'No Ref'} (${parseFloat(option.total_amount).toFixed(0)})`;
                      }}
                      value={selectedSaleForReturnMain ?? null}
                      onChange={(event, newValue) => {
                        if (newValue) handleLoadSaleForReturnMain(newValue);
                      }}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      onInputChange={(event, inputValue, reason) => {
                        if (reason === 'reset') return;
                        handleSaleSearch(inputValue);
                      }}
                      loading={saleInvoiceSearchLoading}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Search Sale ID..."
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && selectedSaleForReturnMain) {
                              e.preventDefault();
                              const productInput = document.querySelector('input[placeholder*="Select product"]');
                              if (productInput) productInput.focus();
                            }
                          }}
                          sx={{ ...SALE_ENTRY_CONTROL_SX }}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {saleInvoiceSearchLoading ? <CircularProgress color="inherit" size={18} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                      noOptionsText={saleInvoiceSearchLoading ? 'Loading sales…' : 'No sales found'}
                    />
                  </Box>
                )}


                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    DATE
                  </Typography>
                  <DateFilterInput
                    fullWidth
                    size="small"
                    value={saleEntryDate}
                    onChange={(val) => setSaleEntryDate(val)}
                    sx={SALE_ENTRY_CONTROL_SX}
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    REFERENCE
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    sx={SALE_ENTRY_CONTROL_SX}
                    value={paymentData.notes || ''}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                    onFocus={(e) => e.target.select()}
                  />
                </Box>
              </Box>


              {/* Product Selection Row */}
              <Box sx={SALE_ENTRY_ROW2_SX}>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    SELECT PRODUCT
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
                    sx={{ width: '100%', minWidth: 0 }}
                    options={products || []}
                    getOptionLabel={(option) => option.pro_title || ''}
                    getOptionKey={(option) => option.pro_id}
                    filterOptions={filterSaleProducts}
                    slotProps={{
                      listbox: {
                        sx: {
                          height: 240,
                          maxHeight: 240,
                          overflowY: 'auto',
                          overscrollBehavior: 'contain',
                          py: 0,
                          '& .MuiAutocomplete-option': {
                            minHeight: 36,
                            height: 36,
                            py: 0,
                            alignItems: 'center',
                          },
                        },
                      },
                      paper: {
                        sx: { width: '100%', minWidth: 280, mt: 0.5 },
                      },
                      popper: {
                        modifiers: [
                          { name: 'flip', enabled: false },
                        ],
                      },
                    }}
                    renderOption={(props, option) => {
                      const { key, ...optionProps } = props;
                      return (
                        <li key={option.pro_id ?? key} {...optionProps} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                          <Typography noWrap sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}>
                            {option.pro_title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            {visibleCrates.includes(option.pro_id) && (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {option.pro_cost_price ? 'PKR ' + fmtRateQty(option.pro_cost_price) : 'N/A'}
                              </Typography>
                            )}
                            <IconButton
                              size="small"
                              tabIndex={-1}
                              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); toggleVisibleCrate(option.pro_id); }}
                              aria-label={visibleCrates.includes(option.pro_id) ? 'Hide purchase rate' : 'Show purchase rate'}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </li>
                      );
                    }}
                    value={formSelectedProduct ?? null}
                    onChange={(event, newValue) => {
                      handleProductSelect(newValue);
                    }}
                    isOptionEqualToValue={(option, value) => option.pro_id === value?.pro_id}
                    autoHighlight={true}
                    autoSelect={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    onHighlightChange={(_, option) => {
                      if (option) productHighlightRef.current = option;
                    }}
                    renderInput={(params) => {
                      const prevKeyDown = params.inputProps?.onKeyDown;
                      return (
                        <TextField
                          {...params}
                          id="product-select-dropdown-input"
                          placeholder={products.length === 0 ? "No products available" : "Select product"}
                          onFocus={(e) => e.target.select()}
                          inputProps={{
                            ...params.inputProps,
                            onKeyDown: (e) => {
                              if (!e.shiftKey && (e.key === 'Tab' || e.key === 'Enter')) {
                                const inputValue = e.currentTarget.value || '';
                                const filtered = filterSaleProducts(products || [], { inputValue });
                                const idx = getFocusedAutocompleteOption();
                                const pick = productHighlightRef.current
                                  || (idx != null ? filtered[idx] : null)
                                  || filtered[0]
                                  || formSelectedProduct;
                                if (pick) {
                                  commitDropdownOnTab(
                                    e,
                                    pick,
                                    (val) => handleProductSelect(val),
                                    () => document.querySelector('input[placeholder*="Select Store"]')
                                  );
                                  return;
                                }
                              }
                              prevKeyDown?.(e);
                            },
                          }}
                          sx={{ ...SALE_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formSelectedProduct ? 'bold' : 'normal' } }}
                        />
                      );
                    }}
                    disabled={products.length === 0}
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    SELECT STORE
                  </Typography>
                  <Autocomplete
                    size="small"
                    fullWidth
                    sx={{ width: '100%', minWidth: 0 }}
                    options={stores || []}
                    getOptionLabel={(option) => option.store_name || ''}
                    value={formSelectedStore ?? null}
                    onChange={(event, newValue) => {
                      setFormSelectedStore(newValue);
                    }}
                    isOptionEqualToValue={(option, value) => option.storeid === value?.storeid}
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    onHighlightChange={(_, option) => {
                      if (option) storeHighlightRef.current = option;
                    }}
                    onKeyDown={(e) => {
                      commitDropdownOnTab(
                        e,
                        storeHighlightRef.current || formSelectedStore,
                        (val) => setFormSelectedStore(val),
                        () => document.querySelector('#sale-qty-input')
                      );
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Select Store"
                        onFocus={(e) => e.target.select()}
                        sx={{ ...SALE_ENTRY_CONTROL_SX, '& .MuiInputBase-input': { fontWeight: formSelectedStore ? 'bold' : 'normal' } }}
                      />
                    )}
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    QTY
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    id="sale-qty-input"
                    value={paymentInputValue(productFormData.quantity)}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    inputProps={{ step: 'any' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        // If rate is already filled, add product directly
                        if (productFormData.rate > 0) {
                          handleAddProductToTable();
                        } else {
                          // Focus on rate field if rate is not filled
                          const rateInput = document.getElementById('sale-rate-input');
                          if (rateInput) rateInput.focus();
                        }
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        // Move to RATE field
                        const rateInput = document.getElementById('sale-rate-input');
                        if (rateInput) rateInput.focus();
                      }
                    }}
                    sx={{
                      ...SALE_ENTRY_CONTROL_SX,
                      '& .MuiInputBase-input': {
                        fontWeight: 'bold',
                        color: '#000000',
                        WebkitTextFillColor: '#000000 !important'
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: '#000000',
                        WebkitTextFillColor: '#000000 !important',
                        fontWeight: 'bold',
                        opacity: 1
                      }
                    }}
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    SALE RATE
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={paymentInputValue(productFormData.rate)}
                    onChange={(e) => handleRateChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    inputProps={{ step: 'any' }}
                    id="sale-rate-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        // Add product to table when Enter is pressed in rate field
                        handleAddProductToTable();
                      } else if (e.key === 'Tab') {
                        e.preventDefault();
                        // Tab should focus the + button
                        const addBtn = document.getElementById('add-product-btn');
                        if (addBtn) {
                          addBtn.focus();
                        }
                      }
                    }}
                    sx={{
                      ...SALE_ENTRY_CONTROL_SX,
                      '& .MuiInputBase-input': {
                        fontWeight: 'bold',
                        color: '#000000',
                        WebkitTextFillColor: '#000000 !important'
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: '#000000',
                        WebkitTextFillColor: '#000000 !important',
                        fontWeight: 'bold',
                        opacity: 1
                      }
                    }}
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    AMOUNT
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    value={productFormData.amount ?? ''}
                    sx={SALE_ENTRY_CONTROL_SX}
                    disabled
                  />
                </Box>
                <Box sx={SALE_ENTRY_CELL_SX}>
                  <Typography sx={SALE_ENTRY_LABEL_SX}>
                    STOCK
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    value={productFormData.stock ?? ''}
                    disabled
                    sx={{ ...SALE_ENTRY_CONTROL_SX, bgcolor: '#f8f9fa', '& .MuiInputBase-root': { ...SALE_ENTRY_CONTROL_SX['& .MuiInputBase-root'], bgcolor: '#f8f9fa' } }}
                  />
                </Box>
                <Box sx={{ minWidth: 0, width: '100%', display: 'flex', alignItems: 'end' }}>
                  <Button
                    variant="contained"
                    id="add-product-btn"
                    onClick={handleAddProductToTable}
                    fullWidth
                    sx={{
                      bgcolor: '#6f42c1',
                      color: 'white',
                      borderRadius: 1,
                      minWidth: 40,
                      width: 44,
                      height: 40,
                      p: 0,
                      '&:hover': { bgcolor: '#5a2d91' }
                    }}
                  >
                    +
                  </Button>
                </Box>
              </Box>

              {/* Product Table */}
              <TableContainer component={Paper} sx={{ mb: 2, border: '1px solid #e9ecef' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#2e7d32', '& th': { bgcolor: '#2e7d32 !important' } }}>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>S. No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Store</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Sale Price</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Move</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', py: 1, color: 'white' }}>Delete</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productTableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No products added yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      productTableData.map((product, index) => {
                        const rowColors = [
                          '#e8f4fd', // light blue
                          '#e8f8f0', // light green
                          '#f3e8fd', // light purple
                          '#fef9e7', // light yellow
                          '#fdecea', // light red
                          '#e8f6fd', // light cyan
                        ];
                        const rowBg = rowColors[index % rowColors.length];
                        return (
                          <TableRow
                            key={product.id}
                            sx={{
                              bgcolor: rowBg,
                              '&:hover': { filter: 'brightness(0.96)' },
                              transition: 'background-color 0.15s'
                            }}
                          >
                            <TableCell sx={{ py: 1, fontWeight: 'bold', color: 'text.secondary', fontSize: '0.8rem' }}>{index + 1}</TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <Select
                                size="small"
                                value={product.storeid || ''}
                                onChange={(e) => {
                                  const s = stores.find(st => st.storeid === e.target.value);
                                  setProductTableData(prev => prev.map(p =>
                                    p.id === product.id ? { ...p, storeid: s?.storeid, store_name: s?.store_name } : p
                                  ));
                                }}
                                sx={{ minWidth: 110, fontSize: '0.85rem' }}
                              >
                                {stores.map(s => (
                                  <MenuItem key={s.storeid} value={s.storeid}>{s.store_name}</MenuItem>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell sx={{ py: 1, fontWeight: 700 }}>{product.pro_title}</TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <TextField
                                size="small"
                                placeholder="Description"
                                value={product.size || ''}
                                onChange={(e) => {
                                  const newSize = e.target.value;
                                  setProductTableData((prev) =>
                                    prev.map((p) =>
                                      p.id === product.id ? { ...p, size: newSize } : p
                                    )
                                  );
                                }}
                                onFocus={(e) => e.target.select()}
                                sx={{
                                  width: 150,
                                  '& .MuiInputBase-input': {
                                    padding: '4px 8px',
                                    textAlign: 'left',
                                    fontWeight: 'bold'
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <TextField
                                size="small"
                                type="number"
                                value={product.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseFloat(e.target.value) || 0;
                                  if (newQuantity > 0) {
                                    const updatedData = productTableData.map((p) =>
                                      p.id === product.id
                                        ? {
                                          ...p,
                                          quantity: newQuantity,
                                          amount: Number((newQuantity * p.rate).toFixed(0))
                                        }
                                        : p
                                    );
                                    setProductTableData(updatedData);
                                  }
                                }}
                                onFocus={(e) => e.target.select()}
                                sx={{
                                  width: 80,
                                  '& .MuiInputBase-input': {
                                    padding: '4px 8px',
                                    textAlign: 'center',
                                    fontWeight: 'bold'
                                  }
                                }}
                                inputProps={{ min: 0.01, step: 'any' }}
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, whiteSpace: 'normal', overflow: 'visible', verticalAlign: 'top' }}>
                              {(() => {
                                const cp = getCartLineCostRate(product, products);
                                const belowCost = cp > 0 && parseFloat(product.rate) < cp;
                                return (
                                  <>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={product.rate}
                                      onChange={(e) => {
                                        const newRate = parseFloat(e.target.value) || 0;
                                        if (newRate >= 0) {
                                          setProductTableData((prev) =>
                                            prev.map((p) =>
                                              p.id === product.id
                                                ? {
                                                  ...p,
                                                  rate: newRate,
                                                  amount: Number((p.quantity * newRate).toFixed(0)),
                                                  cost_price: p.cost_price || cp
                                                }
                                                : p
                                            )
                                          );
                                        }
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      sx={{
                                        width: 100,
                                        '& .MuiInputBase-input': {
                                          padding: '4px 8px',
                                          textAlign: 'center',
                                          fontWeight: 'bold',
                                          color: belowCost ? '#dc2626' : 'inherit'
                                        },
                                        '& .MuiOutlinedInput-root': {
                                          '& fieldset': {
                                            borderColor: belowCost ? '#dc2626' : undefined,
                                            borderWidth: belowCost ? 2 : undefined
                                          }
                                        }
                                      }}
                                      inputProps={{ min: 0, step: 'any' }}
                                    />
                                    {belowCost ? (
                                      <Typography variant="caption" sx={{ color: '#dc2626', display: 'block', mt: 0.25, fontWeight: 600, whiteSpace: 'normal', lineHeight: 1.3 }}>
                                        âš ï¸ Below cost ({fmtRateQty(cp)})
                                      </Typography>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </TableCell>
                            <TableCell sx={{ py: 1, fontWeight: 'bold' }}>{parseFloat(product.amount || 0).toFixed(0)}</TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                <Tooltip title="Move up">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={index === 0}
                                      onClick={() => moveProductRow(index, -1)}
                                      sx={{ p: 0.25, color: 'primary.main', '&:disabled': { opacity: 0.3 } }}
                                    >
                                      <ArrowUpIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                                <Tooltip title="Move down">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={index === productTableData.length - 1}
                                      onClick={() => moveProductRow(index, 1)}
                                      sx={{ p: 0.25, color: 'primary.main', '&:disabled': { opacity: 0.3 } }}
                                    >
                                      <ArrowDownIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1 }}>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveProductFromTable(product.id)}
                                sx={{ color: 'error.main' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                    {productTableData.length > 0 && (
                      <TableRow sx={{ bgcolor: '#2e7d32', borderTop: '2px solid #dee2e6', '& td': { bgcolor: '#2e7d32 !important' } }}>
                        <TableCell colSpan={6} sx={{ py: 2, fontWeight: 'bold', textAlign: 'right', color: 'white' }}>
                          Total Amount:
                        </TableCell>
                        <TableCell colSpan={2} sx={{ py: 2, fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }} key={`table-total-${calculateTotalAmount()}-${transportOptions.length}`}>
                          {Number(calculateTotalAmount()).toFixed(0)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Transport Section */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.primary' }}>
                  Transport Options
                </Typography>

                {/* Transport Input Fields */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={6}>
                    <Autocomplete
                      size="small"
                      options={transportAccounts || []}
                      getOptionLabel={(option) => formatTransportAccountLabel(option)}
                      value={transportAccounts.find(account => account.cus_id === newTransport.accountId) || null}
                      onChange={(event, newValue) => {
                        setNewTransport((prev) => ({
                          ...prev,
                          accountId: newValue ? newValue.cus_id : '',
                          accountName: newValue ? formatTransportAccountLabel(newValue) : '',
                        }));
                      }}
                      isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                      autoSelect={true}
                      autoHighlight={true}
                      openOnFocus={true}
                      selectOnFocus={true}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Select Transport Account"
                          onFocus={(e) => e.target.select()}
                          sx={{ minWidth: 300, bgcolor: 'white' }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ mt: 1 }}>
                      <Button
                        variant="contained"
                        onClick={handleAddTransport}
                        sx={{
                          bgcolor: '#6f42c1',
                          color: 'white',
                          minWidth: 40,
                          '&:hover': { bgcolor: '#5a2d91' }
                        }}
                      >
                        +
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {/* Transport Options Display */}
                {transportOptions.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
                      Transport Options ({transportOptions.length}):
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {transportOptions.map((transport) => (
                        <Chip
                          key={transport.id}
                          label={`${transport.accountName}: ${transport.amount.toFixed(0)}`}
                          onDelete={() => handleRemoveTransport(transport.id)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>
                      Transport Total: {calculateTransportTotal().toFixed(0)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Payment Details */}
              <Box sx={{ mt: 2, p: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {/* Left Section - Payment Fields */}
                <Box sx={{
                  flex: '1 1 48%',
                  minWidth: '300px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* First Row - CASH, BANK, BANK ACCOUNT, TOTAL CASH RECEIVED */}
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            CASH
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Bal: {fmtAmt(customers.find(c => c.cus_name === 'Cash Account')?.cus_balance ?? 0)}
                          </Typography>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.cash)}
                          onChange={(e) => handlePaymentDataChange('cash', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          sx={{
                            bgcolor: '#2e7d32',
                            borderRadius: 1,
                            '& .MuiOutlinedInput-root': {
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important',
                              '& fieldset': {
                                borderColor: '#1b5e20',
                                borderWidth: '2px'
                              },
                              '&:hover fieldset': {
                                borderColor: '#1b5e20'
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#1b5e20'
                              }
                            },
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: 'white !important',
                              WebkitTextFillColor: 'white !important'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: 'rgba(255, 255, 255, 0.7) !important',
                              WebkitTextFillColor: 'rgba(255, 255, 255, 0.7) !important',
                              fontWeight: 'bold',
                              opacity: 1
                            }
                          }}
                          placeholder="0"
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                          BANK
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.bank)}
                          onChange={(e) => handlePaymentDataChange('bank', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          inputProps={{ step: 'any' }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              // Only intercept Tab and move focus to BANK ACCOUNT when a bank amount is present
                              if (parseFloat(paymentData.bank || 0) > 0) {
                                e.preventDefault();
                                setTimeout(() => {
                                  const bankAccountInput = document.querySelector('input[placeholder="Select Bank"]');
                                  if (bankAccountInput) {
                                    bankAccountInput.focus();
                                  }
                                }, 0);
                              }
                            }
                          }}
                          sx={{
                            bgcolor: 'white',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important',
                              fontWeight: 'bold',
                              opacity: 1
                            }
                          }}
                          placeholder="0"
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary' }}>
                            BANK ACCOUNT
                          </Typography>
                          {paymentData.bankAccountId && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Bal: {fmtAmt(bankAccounts.find(a => a.cus_id === paymentData.bankAccountId)?.cus_balance ?? 0)}
                            </Typography>
                          )}
                        </Box>
                        <Autocomplete
                          size="small"
                          options={bankAccounts || []}
                          getOptionLabel={(option) => option.cus_name || ''}
                          value={bankAccounts.find(account => account.cus_id === paymentData.bankAccountId) || null}
                          onChange={(event, newValue) => {
                            handlePaymentDataChange('bankAccountId', newValue ? newValue.cus_id : '');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Tab') {
                              e.preventDefault();
                              // Auto-select first bank account on Tab
                              if (bankAccounts.length > 0 && !paymentData.bankAccountId) {
                                handlePaymentDataChange('bankAccountId', bankAccounts[0].cus_id);
                              }
                              // Close dropdown, blur field, and allow natural tab to next element
                              setTimeout(() => {
                                const inputField = document.querySelector('input[placeholder="Select Bank"]');
                                if (inputField) {
                                  inputField.blur();
                                }
                              }, 0);
                            }
                          }}
                          isOptionEqualToValue={(option, value) => option.cus_id === value?.cus_id}
                          autoSelect={true}
                          autoHighlight={true}
                          openOnFocus={true}
                          selectOnFocus={true}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              placeholder="Select Bank"
                              onFocus={(e) => e.target.select()}
                              sx={{
                                bgcolor: 'white',
                                '& .MuiInputBase-input': {
                                  padding: '8px',
                                  fontWeight: 'bold',
                                  color: '#000000',
                                  WebkitTextFillColor: '#000000 !important'
                                }
                              }}
                            />
                          )}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={3}>
                      <Box>
                        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                          TOTAL CASH RECEIVED
                        </Typography>
                        <TextField
                          fullWidth
                          size="small"
                          type="number"
                          value={Number(paymentData.totalCashReceived).toFixed(0)}
                          sx={{
                            bgcolor: '#f5f5f5',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important'
                            }
                          }}
                          disabled
                        />
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Fourth Row - NOTES */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium', color: 'text.secondary' }}>
                      NOTES
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      size="small"
                      value={paymentData.notes ?? ''}
                      onChange={(e) => handlePaymentDataChange('notes', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        }
                      }}
                      placeholder="Enter any notes..."
                    />
                  </Box>
                </Box>

                {/* Right Section - Input Fields */}
                <Box sx={{
                  flex: '1 1 48%',
                  minWidth: '300px',
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: '#fafafa',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* PREVIOUS BALANCE & BILL ADVANCE - Show customer's balance and advance side-by-side */}
                  {formSelectedCustomer && (
                    <Box sx={{ mb: 1.5, display: 'flex', gap: 2, width: '100%' }}>
                      {/* PREV. BALANCE (readonly, warning orange color theme) */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'warning.main', minWidth: '105px' }}>
                          PREV. BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={parseFloat(formSelectedCustomer?.cus_balance || 0).toFixed(0)}
                          inputProps={{ readOnly: true }}
                          sx={{
                            bgcolor: '#fffbeb',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#c2410c !important',
                              WebkitTextFillColor: '#c2410c !important'
                            },
                            flex: 1
                          }}
                          placeholder="0"
                        />
                      </Box>

                      {/* BILL ADVANCE (editable, success green color theme) */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'success.main', minWidth: '95px' }}>
                          BILL ADVANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.advancePayment)}
                          onChange={(e) => handlePaymentDataChange('advancePayment', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          sx={{
                            bgcolor: '#e8f5e9',
                            '& .MuiInputBase-input': {
                              padding: '8px',
                              fontWeight: 'bold',
                              color: '#1b5e20 !important',
                              WebkitTextFillColor: '#1b5e20 !important'
                            },
                            flex: 1
                          }}
                          placeholder="0"
                        />
                      </Box>
                    </Box>
                  )}

                  {/* SUB TOTAL (Product Total Only) - Show for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        SUB TOTAL
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={(() => {
                          const productTotal = productTableData.reduce((sum, product) => sum + parseFloat(product.amount || 0), 0);
                          return productTotal.toFixed(0);
                        })()}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        disabled
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}

                  {/* TOTAL AMOUNT (After Advance Deduction) - Hidden for Sale Return */}
                  {billType !== 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        TOTAL AMOUNT
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={calculateTotalAmount().toFixed(0)}
                        onChange={() => { }}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}

                  {/* LABOUR */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      LABOUR
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.labour)}
                      onChange={(e) => handlePaymentDataChange('labour', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                  </Box>

                  {/* DELIVERY CHARGES (total including transport) */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DELIVERY CHARGES
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.deliveryCharges)}
                      onChange={(e) => handlePaymentDataChange('deliveryCharges', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                    {calculateTransportTotal() > 0 && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                        (includes Transport: {calculateTransportTotal().toFixed(0)})
                      </Typography>
                    )}
                  </Box>

                  {/* DISCOUNT */}
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                      DISCOUNT
                    </Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={paymentInputValue(paymentData.discount)}
                      onChange={(e) => handlePaymentDataChange('discount', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ step: 'any' }}
                      sx={{
                        bgcolor: 'white',
                        '& .MuiInputBase-input': {
                          padding: '8px',
                          fontWeight: 'bold',
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important'
                        },
                        '& .MuiInputBase-input::placeholder': {
                          color: '#000000',
                          WebkitTextFillColor: '#000000 !important',
                          fontWeight: 'bold',
                          opacity: 1
                        },
                        flex: 1
                      }}
                      placeholder="0"
                    />
                  </Box>

                  {/* GRAND TOTAL - Show for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'medium', color: 'text.secondary', minWidth: '140px' }}>
                        GRAND TOTAL
                      </Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={calculateGrandTotal().toFixed(0)}
                        sx={{
                          bgcolor: 'white',
                          '& .MuiInputBase-input': {
                            padding: '8px',
                            fontWeight: 'bold',
                            color: '#000000 !important',
                            WebkitTextFillColor: '#000000 !important'
                          },
                          '& .MuiInputBase-input::placeholder': {
                            color: '#000000',
                            WebkitTextFillColor: '#000000 !important',
                            fontWeight: 'bold',
                            opacity: 1
                          },
                          flex: 1
                        }}
                        disabled
                        inputProps={{ readOnly: true }}
                      />
                    </Box>
                  )}



                  {/* RETURN PAYMENT - CASH and BANK (Hidden) for Sale Return */}
                  {billType === 'SALE_RETURN' && (
                    <Box sx={{ mb: 2 }}>
                      {/* RETURN (CASH) - Hidden */}
                      <Box sx={{ display: 'none' }}>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.cash)}
                          onChange={(e) => handlePaymentDataChange('cash', e.target.value)}
                          placeholder="0"
                        />
                      </Box>

                      {/* RETURN (BANK) - Hidden */}
                      <Box sx={{ display: 'none' }}>
                        <TextField
                          size="small"
                          type="number"
                          value={paymentInputValue(paymentData.bank)}
                          onChange={(e) => handlePaymentDataChange('bank', e.target.value)}
                          placeholder="0"
                        />
                      </Box>

                      {/* TOTAL RETURN (CASH + BANK) - Visible */}
                      <Box sx={{
                        p: 1.5,
                        bgcolor: 'error.light',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        border: '2px solid',
                        borderColor: 'error.main'
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'error.main', minWidth: '140px' }}>
                          TOTAL RETURN
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={(() => {
                            const cashReturn = parseFloat(paymentData.cash || 0);
                            const bankReturn = parseFloat(paymentData.bank || 0);
                            const totalReturn = cashReturn + bankReturn;
                            return totalReturn === 0 ? '' : totalReturn.toFixed(0);
                          })()}
                          sx={{
                            bgcolor: 'white',
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            '& .MuiInputBase-input::placeholder': {
                              color: '#000000',
                              WebkitTextFillColor: '#000000 !important',
                              fontWeight: 'bold',
                              opacity: 1
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>
                    </Box>
                  )}

                  {/* BALANCE - Hidden for Sale Return */}
                  {billType !== 'SALE_RETURN' && (
                    <Box sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: 'primary.main',
                      borderRadius: 1,
                      display: 'flex',
                      gap: 2,
                      width: '100%',
                      alignItems: 'center'
                    }}>
                      {/* BILL BALANCE */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', minWidth: '105px' }}>
                          BILL BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={calculateBalance().toFixed(0)}
                          sx={{
                            bgcolor: 'white',
                            borderRadius: 1,
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>

                      {/* TOTAL BALANCE */}
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white', minWidth: '115px' }}>
                          TOTAL BALANCE
                        </Typography>
                        <TextField
                          size="small"
                          type="number"
                          value={(
                            parseFloat(formSelectedCustomer?.cus_balance || 0) + calculateBalance()
                          ).toFixed(0)}
                          sx={{
                            bgcolor: 'white',
                            borderRadius: 1,
                            '& .MuiInputBase-input': {
                              fontWeight: 'bold',
                              fontSize: '1.1rem',
                              color: '#000000 !important',
                              WebkitTextFillColor: '#000000 !important',
                              padding: '8px'
                            },
                            flex: 1
                          }}
                          disabled
                          inputProps={{ readOnly: true }}
                        />
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>


              {/* Action Buttons */}
              <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
                <Button
                  variant="outlined"
                  sx={{
                    color: '#ff9800',
                    borderColor: '#ff9800',
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: 'rgba(255, 152, 0, 0.04)',
                      borderColor: '#f57c00'
                    }
                  }}
                  onClick={async () => {
                    await autoHoldIfActive();
                    clearFormState();
                  }}
                  disabled={loading || savingBill}
                  title="Clear current form only (screen stays in stack)"
                >
                  ðŸ§¹ Clear Form
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: '#6c757d',
                    color: '#6c757d',
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: '#5a6268',
                      color: '#5a6268'
                    }
                  }}
                  onClick={async () => {
                    await autoHoldIfActive();
                    setCurrentBillData(null);
                    setFormSelectedCustomer(null);
                    setFormSelectedProduct(null);
                    setFormSelectedStore(null);
                    setProductTableData([]);
                    setPaymentData({ ...EMPTY_PAYMENT_DATA });
                    setTransportOptions([]);
                    setLoadedOrderId(null);
                    setCurrentDraftId(null);
                  }}
                >
                  New
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: '#fd7e14',
                    color: '#fd7e14',
                    borderRadius: 2,
                    '&:hover': {
                      borderColor: '#e8690b',
                      color: '#e8690b'
                    }
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#e8690b' }
                  }}
                  onClick={() => handlePrintBill('A4')}
                  disabled={!currentBillData}
                >
                  Print A4
                </Button>
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#e8690b' }
                  }}
                  onClick={() => handlePrintBill('THERMAL')}
                  disabled={!currentBillData}
                >
                  Print Thermal
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#dc3545',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#c82333' },
                    opacity: screenStack.length === 1 ? 0.6 : 1
                  }}
                  tabIndex={-1}
                  onClick={cancelCurrentScreen}
                  disabled={screenStack.length === 1}
                  title={screenStack.length === 1 ? 'Reset current screen (cannot cancel - this is the only screen)' : 'Remove current screen from stack'}
                >
                  âœ• Cancel Current
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    bgcolor: '#6c757d',
                    color: 'white',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#5a6268' }
                  }}
                  tabIndex={-1}
                  onClick={() => setCurrentView('list')}
                  title="Return to sales list (current screen saved)"
                >
                  â† Back to List
                </Button>
                <Button
                  variant="contained"
                  tabIndex={-1}
                  sx={{
                    bgcolor: '#fd7e14',
                    color: 'white',
                    borderRadius: 2,
                    fontWeight: 600,
                    '&:hover': { bgcolor: '#e8690a' }
                  }}
                  onClick={async () => {
                    await handleSaveDraft();
                    clearFormState();
                  }}
                  disabled={isSavingDraft || productTableData.length === 0}
                  title="Hold bill (F9)"
                >
                  {isSavingDraft ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : 'â¸'} Hold
                </Button>
                <Button
                  variant="outlined"
                  tabIndex={-1}
                  sx={{
                    borderColor: '#fd7e14',
                    color: '#fd7e14',
                    borderRadius: 2,
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    px: 1.2,
                    minWidth: 'auto',
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: '#fff3e0', borderColor: '#e8690a' }
                  }}
                  onClick={() => { fetchDrafts(); setDraftModalOpen(true); }}
                  title="View hold bills"
                >
                  ðŸ“‹ Hold Bills ({drafts.length})
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<SaveIcon />}
                  sx={{
                    background: 'linear-gradient(135deg,#2ecc71 0%,#28a745 50%,#1e7e34 100%)',
                    color: 'white',
                    borderRadius: 3,
                    minWidth: 220,
                    boxShadow: '0 6px 18px rgba(40,167,69,0.18)',
                    textTransform: 'none',
                    fontWeight: 600,
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(40,167,69,0.22)' }
                  }}
                  onClick={() => handleSaveBill(false)}
                  disabled={savingBill}
                >
                  {savingBill ? (
                    <>
                      <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                      {editingSale ? 'Updating...' : 'Saving...'}
                    </>
                  ) : (
                    editingSale ? 'Update Sale' : 'Save Sale'
                  )}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </DashboardLayout>
  );
}
