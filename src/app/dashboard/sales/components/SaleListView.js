'use client';

import React from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Autocomplete,
  LinearProgress,
  Tooltip
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import ClearIcon from '@mui/icons-material/Clear';
import EditIcon from '@mui/icons-material/Edit';
import FilterIcon from '@mui/icons-material/FilterList';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import VisibilityIcon from '@mui/icons-material/Visibility';

import DashboardLayout from '@/app/dashboard/components/dashboard-layout';
import DateFilterInput from '@/app/dashboard/components/date-filter-input';
import { formatDatePK } from '@/lib/date-helper';
import { BRAND } from '@/lib/brand-theme';
import { useSalesContext } from './SalesContext';
import {
  SALES_PAGE_CARD_SX,
  SALES_FILTER_GRID,
  SALES_FILTER_FIELD_SX,
  SALES_EXCEL_TABLE_SX,
  SALES_EXCEL_HEAD_SX,
  SALES_NUM_CELL_SX,
  filterSaleCustomers,
  isCustomerAccount,
  getBillTypeChipSx
} from './sale-utils';

export default function SaleListView() {
  const ctx = useSalesContext();

  const {
    listLoading,
    setCurrentView,
    dataLoadedRef,
    fetchFormReferenceData,
    sales,
    listTotal,
    handlePrintSalesList,
    clearFilters,
    searchTerm,
    setSearchTerm,
    customers,
    customerCategories,
    filterCustomer,
    setFilterCustomer,
    filterBillType,
    setFilterBillType,
    stores,
    filterStore,
    setFilterStore,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    filterAmount,
    setFilterAmount,
    filterMinAmount,
    setFilterMinAmount,
    filterMaxAmount,
    setFilterMaxAmount,
    filterPaymentType,
    setFilterPaymentType,
    filterBalanceStatus,
    setFilterBalanceStatus,
    filterItem,
    setFilterItem,
    filterQuantity,
    setFilterQuantity,
    filterNotes,
    setFilterNotes,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    listPage,
    setListPage,
    listPageSize,
    setListPageSize,
    tableContainerRef,
    filteredSales,
    handleOpenCustomerLedger,
    renderSaleLineItemsCell,
    handleViewBill,
    handleEdit,
    handlePrintBill,
    resolveBillForActions,
    setCurrentBillData,
    setReceiptDialogOpen,
    setBillType,
    handleLoadSaleForReturnMain,
    jumpToPage,
    setJumpToPage,
    handlePageChange,
    fmtAmt,
  } = ctx;

  const getSortLabel = (value) => {
    const labels = {
      'created_at-desc': 'Newest First',
      'created_at-asc': 'Oldest First',
      'customer-asc': 'Customer A-Z',
      'customer-desc': 'Customer Z-A',
      'total_amount-desc': 'Amount High-Low',
      'total_amount-asc': 'Amount Low-High'
    };
    return labels[value] || 'Newest First';
  };

  return (
    <DashboardLayout>
      {listLoading && <LinearProgress sx={{ position: 'sticky', top: 0, zIndex: 10 }} />}
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Header - Just the Add Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', py: 2 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setCurrentView('create');
                if (!dataLoadedRef.current.form) fetchFormReferenceData(true);
              }}
              size="large"
              sx={{
                background: 'linear-gradient(180deg, #43a047 0%, #2e7d32 100%)',
                boxShadow: '0 8px 24px rgba(46, 125, 50, 0.28)',
                px: 6,
                py: 2.5,
                fontSize: '1.3rem',
                fontWeight: 'bold',
                borderRadius: '16px',
                minWidth: '320px',
                minHeight: '70px',
                position: 'relative',
                overflow: 'hidden',
                textTransform: 'none',
                transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, background 0.35s ease',
                animation: 'saleBtnGlow 3.2s ease-in-out infinite',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-60%',
                  width: '40%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)',
                  transform: 'skewX(-20deg)',
                  animation: 'saleBtnSheen 4s ease-in-out infinite',
                },
                '&:hover': {
                  background: 'linear-gradient(180deg, #4caf50 0%, #2e7d32 100%)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 28px rgba(46, 125, 50, 0.36)',
                  animation: 'none',
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: '0 6px 16px rgba(46, 125, 50, 0.28)',
                },
                '& .MuiButton-startIcon': {
                  marginRight: '10px',
                  transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
                },
                '&:hover .MuiButton-startIcon': {
                  transform: 'translateX(2px)',
                },
                '@keyframes saleBtnGlow': {
                  '0%, 100%': {
                    boxShadow: '0 8px 24px rgba(46, 125, 50, 0.24)',
                  },
                  '50%': {
                    boxShadow: '0 10px 28px rgba(46, 125, 50, 0.34)',
                  },
                },
                '@keyframes saleBtnSheen': {
                  '0%': { left: '-60%' },
                  '45%, 100%': { left: '130%' },
                },
              }}
            >
              Add New Sale
            </Button>
          </Box>

          {/* Sales panel — stats, filters & excel grid */}
          <Card sx={{ ...SALES_PAGE_CARD_SX, mb: 3 }}>
            {/* Filters toolbar */}
            <Box sx={{
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              borderBottom: '1px solid #e2e8f0',
              bgcolor: '#fff',
            }}>
              <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon sx={{ color: BRAND.primary.blue, fontSize: 20 }} />
                Filters & Sorting
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.25 }}>
                <Chip
                  size="small"
                  label={`${sales.length} of ${listTotal}`}
                  sx={{
                    bgcolor: BRAND.tint.blue,
                    color: BRAND.primary.blue,
                    fontWeight: 700,
                    height: 32,
                    px: 0.5,
                    fontSize: '0.8125rem',
                    borderRadius: '8px',
                  }}
                />
                <Button
                  onClick={handlePrintSalesList}
                  size="small"
                  variant="contained"
                  startIcon={<PrintIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    bgcolor: BRAND.primary.blue,
                    borderRadius: '8px',
                    height: 32,
                    px: 1.5,
                    '&:hover': { bgcolor: '#1e40af' },
                  }}
                >
                  Print List
                </Button>
                <Button
                  onClick={clearFilters}
                  size="small"
                  variant="outlined"
                  startIcon={<ClearIcon sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    color: '#64748b',
                    borderColor: '#cbd5e1',
                    borderRadius: '8px',
                    height: 32,
                    px: 1.5,
                    '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
                  }}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            {/* Filter fields */}
            <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafbfc' }}>
              <Box sx={SALES_FILTER_GRID}>
                <Box sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search Sales"
                    placeholder="ID, Customer, Reference, or Amount..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={customers.filter(customer => isCustomerAccount(customer, customerCategories))}
                    getOptionLabel={(option) => option.cus_name || ''}
                    filterOptions={filterSaleCustomers}
                    value={customers.find(c => c.cus_id.toString() === filterCustomer) || null}
                    onChange={(event, newValue) => {
                      setFilterCustomer(newValue ? newValue.cus_id.toString() : '');
                    }}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Customer"
                        placeholder="All Customers"
                        onFocus={(e) => e.target.select()}
                        sx={SALES_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
                    <InputLabel>Bill Type</InputLabel>
                    <Select
                      value={filterBillType}
                      onChange={(e) => setFilterBillType(e.target.value)}
                      label="Bill Type"
                    >
                      <MenuItem value="">All Types</MenuItem>
                      <MenuItem value="BILL">Bill</MenuItem>
                      <MenuItem value="QUOTATION">Quotation</MenuItem>
                      <MenuItem value="SALE_RETURN">Sale Return</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={stores}
                    getOptionLabel={(option) => option.store_name || ''}
                    value={stores.find(s => s.storeid.toString() === filterStore) || null}
                    onChange={(event, newValue) => setFilterStore(newValue ? newValue.storeid.toString() : '')}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Store"
                        placeholder="All Stores"
                        onFocus={(e) => e.target.select()}
                        sx={SALES_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>

                <Box>
                  <DateFilterInput
                    fullWidth
                    size="small"
                    label="From Date"
                    value={dateFrom}
                    onChange={(val) => setDateFrom(val)}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <DateFilterInput
                    fullWidth
                    size="small"
                    label="To Date"
                    value={dateTo}
                    onChange={(val) => setDateTo(val)}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Amount"
                    type="number"
                    placeholder="e.g. 5000"
                    value={filterAmount}
                    onChange={(e) => setFilterAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Amount"
                    type="number"
                    placeholder="e.g. 1000"
                    value={filterMinAmount}
                    onChange={(e) => setFilterMinAmount(e.target.value)}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Max Amount"
                    type="number"
                    placeholder="e.g. 50000"
                    value={filterMaxAmount}
                    onChange={(e) => setFilterMaxAmount(e.target.value)}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
                    <InputLabel>Payment Type</InputLabel>
                    <Select
                      value={filterPaymentType}
                      onChange={(e) => setFilterPaymentType(e.target.value)}
                      label="Payment Type"
                    >
                      <MenuItem value="">All Types</MenuItem>
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="BANK">Bank</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <FormControl fullWidth size="small" sx={SALES_FILTER_FIELD_SX}>
                    <InputLabel>Balance Status</InputLabel>
                    <Select
                      value={filterBalanceStatus}
                      onChange={(e) => setFilterBalanceStatus(e.target.value)}
                      label="Balance Status"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="with_balance">With Balance</MenuItem>
                      <MenuItem value="without_balance">Without Balance</MenuItem>
                      <MenuItem value="overpaid">Overpaid</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search by Item"
                    placeholder="Product name..."
                    value={filterItem}
                    onChange={(e) => setFilterItem(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search by Quantity"
                    placeholder="e.g. 5 or 2.5"
                    value={filterQuantity}
                    onChange={(e) => setFilterQuantity(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    inputProps={{ inputMode: 'decimal' }}
                    InputProps={{
                      endAdornment: filterQuantity ? (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={() => setFilterQuantity('')}
                            sx={{
                              color: '#dc2626',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              minWidth: 'auto',
                              p: '2px 6px',
                              lineHeight: 1,
                              '&:hover': {
                                bgcolor: '#fef2f2',
                                color: '#b91c1c'
                              }
                            }}
                          >
                            Clear
                          </Button>
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    label="Search by Notes"
                    placeholder="Reference or notes..."
                    value={filterNotes}
                    onChange={(e) => setFilterNotes(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={SALES_FILTER_FIELD_SX}
                  />
                </Box>

                <Box>
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'created_at-desc', label: 'Newest First' },
                      { value: 'created_at-asc', label: 'Oldest First' },
                      { value: 'customer-asc', label: 'Customer A-Z' },
                      { value: 'customer-desc', label: 'Customer Z-A' },
                      { value: 'total_amount-desc', label: 'Amount High-Low' },
                      { value: 'total_amount-asc', label: 'Amount Low-High' },
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{ value: `${sortBy}-${sortOrder}`, label: getSortLabel(`${sortBy}-${sortOrder}`) }}
                    onChange={(event, newValue) => {
                      if (newValue) {
                        const [field, order] = newValue.value.split('-');
                        setSortBy(field);
                        setSortOrder(order);
                      }
                    }}
                    autoSelect
                    autoHighlight
                    openOnFocus
                    selectOnFocus
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Sort By"
                        placeholder="Select..."
                        onFocus={(e) => e.target.select()}
                        sx={SALES_FILTER_FIELD_SX}
                      />
                    )}
                  />
                </Box>
              </Box>
            </Box>

            {/* Sales list header */}
            <Box sx={{
              px: { xs: 1.5, md: 2 },
              py: 1.25,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #cbd5e1',
              bgcolor: '#f1f5f9',
              flexWrap: 'wrap',
              gap: 1,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography sx={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                  Sales List
                </Typography>
                <Chip
                  label={listTotal === 0 ? '0 sales' : `Page ${listPage} of ${Math.max(1, Math.ceil(listTotal / listPageSize))}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                />
              </Box>

              <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 600 }}>
                {listTotal === 0
                  ? '0 rows'
                  : `Showing ${((listPage - 1) * listPageSize) + 1}–${Math.min(listPage * listPageSize, listTotal)} of ${listTotal.toLocaleString()} sales`}
              </Typography>
            </Box>
            <TableContainer
              ref={tableContainerRef}
              sx={{ overflowX: 'auto', maxWidth: '100%', bgcolor: '#fff', maxHeight: 'calc(100vh - 320px)' }}
            >
              <Table stickyHeader sx={SALES_EXCEL_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    {[
                      { label: 'Sale ID', align: 'left' },
                      { label: 'Customer', align: 'left' },
                      { label: 'Items & Qty', align: 'left' },
                      { label: 'Reference', align: 'left' },
                      { label: 'Total', align: 'right' },
                      { label: 'Discount', align: 'right' },
                      { label: 'Shipping', align: 'right' },
                      { label: 'Payment', align: 'right' },
                      { label: 'Balance', align: 'right' },
                      { label: 'Bill Type', align: 'center' },
                      { label: 'Date', align: 'center' },
                      { label: 'Actions', align: 'center' },
                    ].map((col) => (
                      <TableCell key={col.label} align={col.align} sx={SALES_EXCEL_HEAD_SX}>
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {listLoading && filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6, border: '1px solid #cbd5e1' }}>
                        <CircularProgress size={36} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem', mt: 1.5 }}>
                          Loading sales…
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 6, border: '1px solid #cbd5e1' }}>
                        <ShoppingCartIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                        <Typography sx={{ fontWeight: 600, color: '#64748b', fontSize: '0.875rem' }}>
                          {sales.length === 0 ? 'No sales found' : 'No sales match your filters'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                          {sales.length === 0 ? 'Create your first sale to get started.' : 'Try adjusting your filter criteria.'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale, rowIndex) => {
                      const balance = parseFloat(sale.total_amount || 0) - parseFloat(sale.payment || 0);
                      return (
                        <TableRow
                          key={sale.sale_id}
                          onClick={() => handleOpenCustomerLedger(sale)}
                          sx={{
                            bgcolor: rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc',
                            '&:hover': { bgcolor: '#eff6ff' },
                            cursor: 'pointer',
                          }}
                        >
                          <TableCell sx={{ fontWeight: 700, color: BRAND.primary.blue, whiteSpace: 'nowrap' }}>
                            {sale.is_return ? `#SR-${sale.return_id}` : `#${sale.sale_id}`}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.customer?.cus_name || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ minWidth: 180, maxWidth: 280, verticalAlign: 'top', py: 0.75 }}>
                            {renderSaleLineItemsCell(sale)}
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sale.reference || '—'}
                          </TableCell>
                          <TableCell sx={{ ...SALES_NUM_CELL_SX, fontWeight: 700, color: '#1e293b' }}>
                            {fmtAmt(sale.total_amount)}
                          </TableCell>
                          <TableCell sx={SALES_NUM_CELL_SX}>{fmtAmt(sale.discount)}</TableCell>
                          <TableCell sx={SALES_NUM_CELL_SX}>{fmtAmt(sale.shipping_amount)}</TableCell>
                          <TableCell sx={{ ...SALES_NUM_CELL_SX, fontWeight: 600, color: BRAND.text.green }}>
                            {fmtAmt(sale.payment)}
                          </TableCell>
                          <TableCell sx={{
                            ...SALES_NUM_CELL_SX,
                            fontWeight: 700,
                            color: balance > 0 ? BRAND.primary.pink : balance < 0 ? BRAND.text.green : '#64748b',
                          }}>
                            {fmtAmt(balance)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={sale.bill_type || 'BILL'}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                borderRadius: '4px',
                                ...getBillTypeChipSx(sale.bill_type),
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ color: '#64748b', whiteSpace: 'nowrap' }}>
                            {formatDatePK(sale?.created_at) || '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ p: 0.4, whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                            <Stack direction="row" spacing={0} justifyContent="center" flexWrap="nowrap">
                              <Tooltip title="View Details">
                                <IconButton size="small" color="primary" onClick={() => handleViewBill(sale)} sx={{ p: 0.4 }}>
                                  <VisibilityIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit Sale">
                                <IconButton size="small" sx={{ color: '#f59e0b', p: 0.4 }} onClick={() => handleEdit(sale)}>
                                  <EditIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Customer Ledger">
                                <IconButton
                                  size="small"
                                  sx={{ color: BRAND.supporting.cyan, p: 0.4 }}
                                  onClick={(e) => handleOpenCustomerLedger(sale, e)}
                                >
                                  <ListAltIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print Thermal">
                                <IconButton size="small" sx={{ color: '#fd7e14', p: 0.4 }} onClick={() => handlePrintBill('THERMAL', false, sale)}>
                                  <PrintIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print A4 Invoice">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  sx={{ p: 0.4 }}
                                  onClick={async () => {
                                    const fullBill = await resolveBillForActions(sale);
                                    setCurrentBillData(fullBill || sale);
                                    setReceiptDialogOpen(true);
                                  }}
                                >
                                  <PrintIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Return Sale">
                                <IconButton
                                  size="small"
                                  sx={{ color: BRAND.primary.pink, p: 0.4 }}
                                  onClick={() => {
                                    setCurrentView('create');
                                    setBillType('SALE_RETURN');
                                    handleLoadSaleForReturnMain(sale);
                                  }}
                                >
                                  <TrendingDownIcon sx={{ fontSize: 17 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}

                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{
              borderTop: '1px solid #e2e8f0',
              px: { xs: 1.5, md: 2 },
              py: 1.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1.5,
              bgcolor: '#f8fafc',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <FormControl variant="outlined" size="small" sx={{ minWidth: 140 }}>
                  <InputLabel id="sales-rows-per-page-label">Rows per page</InputLabel>
                  <Select
                    labelId="sales-rows-per-page-label"
                    value={listPageSize}
                    onChange={(e) => {
                      const newSize = parseInt(e.target.value, 10);
                      setListPageSize(newSize);
                      setListPage(1);
                    }}
                    label="Rows per page"
                  >
                    <MenuItem value={10}>10 per page</MenuItem>
                    <MenuItem value={25}>25 per page</MenuItem>
                    <MenuItem value={50}>50 per page</MenuItem>
                    <MenuItem value={100}>100 per page</MenuItem>
                    <MenuItem value={200}>200 per page</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {listTotal === 0
                    ? '0 sales'
                    : `Showing ${((listPage - 1) * listPageSize) + 1}–${Math.min(listPage * listPageSize, listTotal)} of ${listTotal.toLocaleString()} sales`}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                    Go to:
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const pageNum = parseInt(jumpToPage, 10);
                        if (!isNaN(pageNum) && pageNum >= 1) {
                          handlePageChange(pageNum);
                          setJumpToPage('');
                        }
                      }
                    }}
                    placeholder={`1-${Math.max(1, Math.ceil(listTotal / listPageSize))}`}
                    sx={{
                      width: 75,
                      '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem', textAlign: 'center' }
                    }}
                    inputProps={{ min: 1, max: Math.max(1, Math.ceil(listTotal / listPageSize)) }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!jumpToPage || isNaN(parseInt(jumpToPage, 10)) || parseInt(jumpToPage, 10) < 1}
                    onClick={() => {
                      const pageNum = parseInt(jumpToPage, 10);
                      if (!isNaN(pageNum) && pageNum >= 1) {
                        handlePageChange(pageNum);
                        setJumpToPage('');
                      }
                    }}
                    sx={{ minWidth: 40, px: 1, py: 0.5, fontSize: '0.75rem', textTransform: 'none' }}
                  >
                    Go
                  </Button>
                </Box>

                <Pagination
                  count={Math.max(1, Math.ceil(listTotal / listPageSize))}
                  page={listPage}
                  onChange={(_, value) => handlePageChange(value)}
                  color="primary"
                  showFirstButton
                  showLastButton
                  siblingCount={1}
                  boundaryCount={1}
                  disabled={listLoading}
                />
              </Box>
            </Box>
          </Card>
        </Stack>
      </Container>
    </DashboardLayout>
  );
}
