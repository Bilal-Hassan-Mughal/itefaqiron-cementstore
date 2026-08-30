'use client';

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import DashboardLayout from '../components/dashboard-layout';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Divider,
  Alert,
  AlertTitle,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  FormLabel,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CompareArrows as MappingIcon,
  PlayArrow as ImportIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  SettingsBackupRestore as RollbackIcon,
  ArrowForward as ArrowIcon,
  TableChart as TableIcon,
  Cached as LoadingIcon
} from '@mui/icons-material';

// Fields schema for each import type
const FIELDS_SCHEMA = {
  customerType: [
    { key: 'cus_type_id', label: 'Customer Type ID', required: false, type: 'number', matches: ['id', 'typeid', 'cus_type_id', 'code'] },
    { key: 'cus_type_title', label: 'Type Title/Name', required: true, type: 'string', matches: ['title', 'name', 'type', 'customertype', 'customer type'] }
  ],
  customerCategory: [
    { key: 'cus_cat_id', label: 'Customer Category ID', required: false, type: 'number', matches: ['id', 'categoryid', 'cus_cat_id', 'code'] },
    { key: 'cus_cat_title', label: 'Category Title/Name', required: true, type: 'string', matches: ['title', 'name', 'category', 'customercategory', 'customer category'] }
  ],
  city: [
    { key: 'city_id', label: 'City ID', required: false, type: 'number', matches: ['id', 'cityid', 'city_id', 'code'] },
    { key: 'city_name', label: 'City Name', required: true, type: 'string', matches: ['name', 'city', 'cityname', 'city name'] }
  ],
  customer: [
    { key: 'cus_id', label: 'Account ID', required: false, type: 'number', matches: ['id', 'accountid', 'customerid', 'cus_id', 'code'] },
    { key: 'cus_name', label: 'Account Name', required: true, type: 'string', matches: ['name', 'customer name', 'customer', 'cus_name', 'account name'] },
    { key: 'cus_category', label: 'Category (ID or Title)', required: true, type: 'any', matches: ['category', 'cus_category', 'customer category', 'category id'] },
    { key: 'cus_type', label: 'Type (ID or Title)', required: true, type: 'any', matches: ['type', 'cus_type', 'customer type', 'type id'] },
    { key: 'city_id', label: 'City (ID or Name)', required: false, type: 'any', matches: ['city', 'city_id', 'city name', 'cityid'] },
    { key: 'cus_phone_no', label: 'Primary Phone', required: true, type: 'string', matches: ['phone', 'phone number', 'contact', 'mobile', 'cus_phone_no'] },
    { key: 'cus_phone_no2', label: 'Secondary Phone', required: false, type: 'string', matches: ['phone2', 'secondary phone', 'mobile2', 'cus_phone_no2'] },
    { key: 'cus_address', label: 'Address', required: true, type: 'string', matches: ['address', 'location', 'cus_address'] },
    { key: 'cus_reference', label: 'Reference', required: false, type: 'string', matches: ['reference', 'ref', 'cus_reference'] },
    { key: 'cus_account_info', label: 'Account Info', required: false, type: 'string', matches: ['info', 'details', 'account info', 'cus_account_info'] },
    { key: 'other', label: 'Other/Remarks', required: false, type: 'string', matches: ['other', 'remarks', 'notes'] },
    { key: 'cus_balance', label: 'Opening Balance', required: false, type: 'number', matches: ['balance', 'opening balance', 'cus_balance'] },
    { key: 'CNIC', label: 'CNIC Number', required: false, type: 'string', matches: ['cnic', 'cnic no', 'cnic number'] },
    { key: 'NTN_NO', label: 'NTN Number', required: false, type: 'string', matches: ['ntn', 'ntn no', 'ntn number'] },
    { key: 'name_urdu', label: 'Urdu Name', required: false, type: 'string', matches: ['urdu', 'name urdu', 'name_urdu', 'urdu name'] }
  ],
  ledger: [
    { key: 'l_id', label: 'Ledger Entry ID', required: false, type: 'number', matches: ['id', 'ledgerid', 'l_id'] },
    { key: 'cus_id', label: 'Account ID or Name', required: true, type: 'any', matches: ['account', 'customer', 'cus_id', 'account id'] },
    { key: 'opening_balance', label: 'Opening Balance', required: false, type: 'number', matches: ['opening', 'opening balance', 'opening_balance'] },
    { key: 'debit_amount', label: 'Debit Amount', required: false, type: 'number', matches: ['debit', 'debit amount', 'debit_amount'] },
    { key: 'credit_amount', label: 'Credit Amount', required: false, type: 'number', matches: ['credit', 'credit amount', 'credit_amount'] },
    { key: 'closing_balance', label: 'Closing Balance', required: false, type: 'number', matches: ['closing', 'closing balance', 'closing_balance'] },
    { key: 'bill_no', label: 'Bill/Invoice Number', required: false, type: 'string', matches: ['bill', 'bill number', 'bill_no', 'invoice', 'invoice no'] },
    { key: 'trnx_type', label: 'Transaction Type', required: true, type: 'string', matches: ['type', 'transaction type', 'trnx_type', 'trnx'] },
    { key: 'details', label: 'Details/Description', required: false, type: 'string', matches: ['details', 'description', 'remarks'] },
    { key: 'payments', label: 'Payment Amount', required: false, type: 'number', matches: ['payment', 'payments', 'amount paid'] },
    { key: 'cash_payment', label: 'Cash Payment', required: false, type: 'number', matches: ['cash', 'cash payment', 'cash_payment'] },
    { key: 'bank_payment', label: 'Bank Payment', required: false, type: 'number', matches: ['bank', 'bank payment', 'bank_payment'] },
    { key: 'created_at', label: 'Date', required: false, type: 'date', matches: ['date', 'created_at', 'time', 'timestamp'] }
  ],
  categories: [
    { key: 'cat_id', label: 'Category ID', required: false, type: 'number', matches: ['id', 'categoryid', 'cat_id'] },
    { key: 'cat_name', label: 'Category Name', required: true, type: 'string', matches: ['name', 'category', 'category name', 'cat_name'] },
    { key: 'cat_code', label: 'Category Code', required: false, type: 'string', matches: ['code', 'category code', 'cat_code'] }
  ],
  subCategory: [
    { key: 'sub_cat_id', label: 'Subcategory ID', required: false, type: 'number', matches: ['id', 'subcategoryid', 'sub_cat_id'] },
    { key: 'cat_id', label: 'Parent Category (ID/Name)', required: true, type: 'any', matches: ['category', 'parent category', 'cat_id', 'category id'] },
    { key: 'sub_cat_name', label: 'Subcategory Name', required: true, type: 'string', matches: ['name', 'subcategory', 'sub_cat_name', 'subcategory name'] },
    { key: 'sub_cat_code', label: 'Subcategory Code', required: false, type: 'string', matches: ['code', 'subcategory code', 'sub_cat_code'] }
  ],
  product: [
    { key: 'pro_id', label: 'Product ID', required: false, type: 'number', matches: ['id', 'productid', 'pro_id'] },
    { key: 'store_id', label: 'Store (ID or Name)', required: false, type: 'any', matches: ['store', 'storeid', 'store name', 'store_id'] },
    { key: 'cat_id', label: 'Category (ID/Name)', required: true, type: 'any', matches: ['category', 'cat_id', 'category id'] },
    { key: 'sub_cat_id', label: 'Subcategory (ID/Name)', required: true, type: 'any', matches: ['subcategory', 'sub_cat_id', 'subcategory id'] },
    { key: 'pro_title', label: 'Product Name/Title', required: true, type: 'string', matches: ['title', 'name', 'product', 'pro_title', 'product name'] },
    { key: 'pro_description', label: 'Description', required: false, type: 'string', matches: ['description', 'desc', 'pro_description', 'details'] },
    { key: 'pro_cost_price', label: 'Cost Price', required: true, type: 'number', matches: ['cost', 'cost price', 'purchase price', 'pro_cost_price', 'buying price'] },
    { key: 'pro_sale_price', label: 'Sale/Retail Price', required: true, type: 'number', matches: ['sale', 'sale price', 'retail price', 'pro_sale_price', 'price'] },
    { key: 'pro_baser_price', label: 'Base Price', required: false, type: 'number', matches: ['base', 'base price', 'pro_baser_price'] },
    { key: 'pro_crate', label: 'Crate Rate', required: false, type: 'number', matches: ['crate', 'crate rate', 'pro_crate'] },
    { key: 'pro_stock_qnty', label: 'Stock Quantity', required: false, type: 'number', matches: ['stock', 'quantity', 'qnty', 'qty', 'pro_stock_qnty'] },
    { key: 'low_stock_quantity', label: 'Low Stock Limit', required: false, type: 'number', matches: ['low stock', 'min stock', 'alert quantity', 'low_stock_quantity'] },
    { key: 'pro_unit', label: 'Unit (e.g. Kg, Bag)', required: true, type: 'string', matches: ['unit', 'pro_unit'] },
    { key: 'pro_packing', label: 'Packing Details', required: false, type: 'string', matches: ['packing', 'pro_packing'] }
  ],
  expenseTitle: [
    { key: 'id', label: 'Title ID', required: false, type: 'number', matches: ['id', 'titleid', 'code'] },
    { key: 'title', label: 'Expense Title', required: true, type: 'string', matches: ['title', 'name', 'expense title', 'expensename'] }
  ],
  expense: [
    { key: 'exp_id', label: 'Expense ID', required: false, type: 'number', matches: ['id', 'expenseid', 'exp_id'] },
    { key: 'exp_title', label: 'Expense Detail/Title', required: true, type: 'string', matches: ['title', 'detail', 'expense', 'exp_title', 'description'] },
    { key: 'exp_type', label: 'Expense Category (ID/Title)', required: true, type: 'any', matches: ['type', 'category', 'expense title', 'exp_type', 'title'] },
    { key: 'exp_detail', label: 'Additional details', required: false, type: 'string', matches: ['additional', 'notes', 'remarks', 'exp_detail'] },
    { key: 'exp_amount', label: 'Expense Amount', required: true, type: 'number', matches: ['amount', 'expense amount', 'exp_amount', 'cost'] },
    { key: 'is_paid', label: 'Is Paid (Yes/No)', required: false, type: 'boolean', matches: ['paid', 'is paid', 'is_paid', 'status'] },
    { key: 'paid_from_account_id', label: 'Cash Account (ID/Name)', required: false, type: 'any', matches: ['cash account', 'paid from', 'paid_from_account_id', 'cash'] },
    { key: 'cash_amount', label: 'Cash Amount Paid', required: false, type: 'number', matches: ['cash amount', 'cash_amount', 'cash paid'] },
    { key: 'bank_account_id', label: 'Bank Account (ID/Name)', required: false, type: 'any', matches: ['bank account', 'bank', 'bank_account_id'] },
    { key: 'bank_amount', label: 'Bank Amount Paid', required: false, type: 'number', matches: ['bank amount', 'bank_amount', 'bank paid'] },
    { key: 'payment_date', label: 'Payment Date', required: false, type: 'date', matches: ['date', 'payment date', 'payment_date'] },
    { key: 'payment_reference', label: 'Ref/Cheque No', required: false, type: 'string', matches: ['ref', 'reference', 'cheque', 'payment_reference'] }
  ]
};

export default function ExcelImportPage() {
  const [importType, setImportType] = useState('customerCategory');
  const [excelData, setExcelData] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [previewRows, setPreviewRows] = useState([]);
  const [options, setOptions] = useState({
    conflictResolution: 'skip',
    autoCreateDependencies: true,
    rollbackOnError: false
  });
  
  // Progress/Uploading state
  const [currentStep, setCurrentStep] = useState(0); // 0: Select & Upload, 1: Column Mapping & Preview, 2: Importing, 3: Success/Report
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [progress, setProgress] = useState({ processed: 0, total: 0 });

  const fileInputRef = useRef(null);

  // Auto-fuzzy match headers on importType or Sheet change
  useEffect(() => {
    if (headers.length > 0) {
      const targetFields = FIELDS_SCHEMA[importType] || [];
      const newMapping = {};
      
      targetFields.forEach(field => {
        // Find best match in headers
        const matchedHeader = headers.find(h => {
          const cleanH = String(h).toLowerCase().trim();
          return field.matches.some(pattern => cleanH === pattern || cleanH.includes(pattern));
        });
        
        newMapping[field.key] = matchedHeader || '';
      });
      
      setColumnMapping(newMapping);
    }
  }, [importType, headers]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    processFile(file);
  };

  const processFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        setSheets(workbook.SheetNames);
        setSelectedSheet(workbook.SheetNames[0]);
        
        // Save workbook context to fetch sheets later if needed
        window.currentWorkbook = workbook;
        
        loadSheetData(workbook.SheetNames[0], workbook);
        setCurrentStep(1);
        setStatusMessage(null);
      } catch (err) {
        console.error(err);
        setStatusMessage({ severity: 'error', message: 'Failed to read Excel file. Please ensure it is a valid spreadsheet.' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const loadSheetData = (sheetName, workbook = window.currentWorkbook) => {
    if (!workbook) return;
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    if (jsonData.length === 0) {
      setStatusMessage({ severity: 'warning', message: 'Selected sheet is empty!' });
      setHeaders([]);
      setExcelData(null);
      setPreviewRows([]);
      return;
    }

    // Get all unique headers from all rows to cover missing cells in row 1
    const allHeaders = new Set();
    jsonData.forEach(row => {
      Object.keys(row).forEach(key => allHeaders.add(key));
    });
    
    const headerList = Array.from(allHeaders);
    setHeaders(headerList);
    setExcelData(jsonData);
    setPreviewRows(jsonData.slice(0, 10)); // Preview first 10 rows
  };

  const handleSheetChange = (e) => {
    const name = e.target.value;
    setSelectedSheet(name);
    loadSheetData(name);
  };

  const handleMappingChange = (fieldKey, headerValue) => {
    setColumnMapping(prev => ({
      ...prev,
      [fieldKey]: headerValue
    }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const startImport = async () => {
    if (!excelData || excelData.length === 0) {
      setStatusMessage({ severity: 'error', message: 'No data to import.' });
      return;
    }

    // Check required fields
    const targetFields = FIELDS_SCHEMA[importType];
    const missingFields = [];
    
    targetFields.forEach(field => {
      if (field.required && !columnMapping[field.key]) {
        missingFields.push(field.label);
      }
    });

    if (missingFields.length > 0) {
      setStatusMessage({
        severity: 'error',
        message: `Please map the following required fields: ${missingFields.join(', ')}`
      });
      return;
    }

    // Prepare JSON payload by mapping columns
    const mappedPayload = excelData.map(row => {
      const mappedRow = {};
      Object.entries(columnMapping).forEach(([fieldKey, excelHeader]) => {
        if (excelHeader) {
          const cellValue = row[excelHeader];
          // Simple parsing based on schema expected type
          const fieldDef = targetFields.find(f => f.key === fieldKey);
          if (fieldDef?.type === 'number' && cellValue !== '') {
            mappedRow[fieldKey] = Number(cellValue);
          } else if (fieldDef?.type === 'boolean') {
            const strVal = String(cellValue).toLowerCase().trim();
            mappedRow[fieldKey] = strVal === 'true' || strVal === 'yes' || strVal === '1' || cellValue === true;
          } else {
            mappedRow[fieldKey] = cellValue;
          }
        }
      });
      return mappedRow;
    });

    setIsImporting(true);
    setCurrentStep(2);
    setStatusMessage(null);
    setProgress({ processed: 0, total: mappedPayload.length });

    const totalRecords = mappedPayload.length;
    const chunkSize = options.rollbackOnError ? totalRecords : 100;
    
    // Cumulative stats
    const aggregatedStats = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    try {
      for (let i = 0; i < totalRecords; i += chunkSize) {
        const chunk = mappedPayload.slice(i, i + chunkSize);
        
        const response = await fetch('/api/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: importType,
            data: chunk,
            conflictResolution: options.conflictResolution,
            autoCreateDependencies: options.autoCreateDependencies,
            rollbackOnError: options.rollbackOnError
          }),
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Bulk import failed on a batch.');
        }

        // Aggregate stats
        const chunkStats = result.stats;
        aggregatedStats.success += chunkStats.success;
        aggregatedStats.failed += chunkStats.failed;
        aggregatedStats.created += chunkStats.created;
        aggregatedStats.updated += chunkStats.updated;
        aggregatedStats.skipped += chunkStats.skipped;
        
        // Adjust error row indices to match the original Excel sheet
        if (chunkStats.errors && Array.isArray(chunkStats.errors)) {
          chunkStats.errors.forEach(err => {
            aggregatedStats.errors.push({
              ...err,
              row: err.row + i
            });
          });
        }

        const nextProcessed = Math.min(i + chunkSize, totalRecords);
        setProgress({ processed: nextProcessed, total: totalRecords });
      }

      setImportResults(aggregatedStats);
      setCurrentStep(3);
    } catch (err) {
      console.error(err);
      setStatusMessage({ 
        severity: 'error', 
        message: err.message || 'Network error occurred while calling the bulk import API.' 
      });
      setCurrentStep(1);
    } finally {
      setIsImporting(false);
    }
  };

  const resetImporter = () => {
    setExcelData(null);
    setSheets([]);
    setSelectedSheet('');
    setHeaders([]);
    setColumnMapping({});
    setPreviewRows([]);
    setCurrentStep(0);
    setImportResults(null);
    setStatusMessage(null);
    setProgress({ processed: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const getTargetFields = () => FIELDS_SCHEMA[importType] || [];

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={4}>
          {/* Header */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                  Excel / CSV Data Import
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
                  Bulk import tables from spreadsheets directly into your database with smart mapping.
                </Typography>
              </Box>
              {currentStep > 0 && (
                <Button variant="outlined" onClick={resetImporter} color="warning" sx={{ borderRadius: 1.5 }}>
                  Reset / Load Different File
                </Button>
              )}
            </Box>
          </Grid>

          {/* Status Message */}
          {statusMessage && (
            <Grid item xs={12}>
              <Alert severity={statusMessage.severity} onClose={() => setStatusMessage(null)} sx={{ borderRadius: 1.5 }}>
                {statusMessage.message}
              </Alert>
            </Grid>
          )}

          {/* STEP 0: FILE UPLOAD & TARGET SELECTION */}
          {currentStep === 0 && (
            <>
              <Grid item xs={12} md={4}>
                <Card sx={{ borderRadius: 2, height: '100%', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#334155' }}>
                      1. Select Destination Table
                    </Typography>
                    
                    <FormControl fullWidth sx={{ mb: 4 }}>
                      <InputLabel>Destination Table</InputLabel>
                      <Select
                        value={importType}
                        label="Destination Table"
                        onChange={(e) => setImportType(e.target.value)}
                        sx={{ borderRadius: 1.5 }}
                      >
                        <MenuItem value="customerCategory">Customer Categories</MenuItem>
                        <MenuItem value="customerType">Customer Types</MenuItem>
                        <MenuItem value="city">Cities</MenuItem>
                        <MenuItem value="customer">Customer Accounts</MenuItem>
                        <MenuItem value="ledger">Customer Ledgers</MenuItem>
                        <Divider />
                        <MenuItem value="categories">Product Categories</MenuItem>
                        <MenuItem value="subCategory">Product Sub Categories</MenuItem>
                        <MenuItem value="product">Products</MenuItem>
                        <Divider />
                        <MenuItem value="expenseTitle">Expense Titles</MenuItem>
                        <MenuItem value="expense">Expenses</MenuItem>
                      </Select>
                    </FormControl>

                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#334155' }}>
                      Import Options
                    </Typography>

                    <FormControl component="fieldset" sx={{ mb: 3 }}>
                      <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.875rem', mb: 1 }}>Conflict Handling</FormLabel>
                      <RadioGroup
                        value={options.conflictResolution}
                        onChange={(e) => setOptions(prev => ({ ...prev, conflictResolution: e.target.value }))}
                      >
                        <FormControlLabel value="skip" control={<Radio size="small" />} label="Skip existing rows (Recommend)" />
                        <FormControlLabel value="overwrite" control={<Radio size="small" />} label="Overwrite / Update existing records" />
                        <FormControlLabel value="error" control={<Radio size="small" />} label="Halt & Error on duplicates" />
                      </RadioGroup>
                    </FormControl>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.autoCreateDependencies}
                          onChange={(e) => setOptions(prev => ({ ...prev, autoCreateDependencies: e.target.checked }))}
                        />
                      }
                      label="Auto-create missing categories/types/cities"
                      sx={{ mb: 2 }}
                    />

                    <FormControlLabel
                      control={
                        <Switch
                          checked={options.rollbackOnError}
                          onChange={(e) => setOptions(prev => ({ ...prev, rollbackOnError: e.target.checked }))}
                          color="error"
                        />
                      }
                      label="Rollback entire sheet if any row fails"
                      sx={{ mb: 2 }}
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={8}>
                <Card
                  sx={{
                    borderRadius: 2,
                    border: '2px dashed #cbd5e1',
                    bgcolor: '#f8fafc',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: '#3b82f6',
                      bgcolor: '#eff6ff'
                    },
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent sx={{ p: 6, textAlign: 'center' }}>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".xlsx,.xls,.csv"
                      style={{ display: 'none' }}
                    />
                    <UploadIcon sx={{ fontSize: 64, color: '#94a3b8', mb: 2 }} />
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#334155' }}>
                      Drag & Drop Excel or CSV file
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', mb: 4 }}>
                      Supports files ending in .xlsx, .xls, or .csv
                    </Typography>
                    <Button
                      variant="contained"
                      sx={{
                        background: 'linear-gradient(45deg, #2563eb, #3b82f6)',
                        px: 4,
                        py: 1.5,
                        borderRadius: 1.5,
                        textTransform: 'none',
                        fontWeight: 600
                      }}
                    >
                      Browse Files
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}

          {/* STEP 1: COLUMN MAPPING & PREVIEW */}
          {currentStep === 1 && (
            <>
              {/* Left Column - Mapping Configuration */}
              <Grid item xs={12} lg={5}>
                <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                        2. Map Column Headers
                      </Typography>
                      {sheets.length > 1 && (
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <InputLabel>Active Sheet</InputLabel>
                          <Select
                            value={selectedSheet}
                            label="Active Sheet"
                            onChange={handleSheetChange}
                          >
                            {sheets.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                          </Select>
                        </FormControl>
                      )}
                    </Box>

                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                      Ensure database fields map to the correct headers from your Excel sheet. Required fields are marked with an asterisk (*).
                    </Typography>

                    <Divider sx={{ mb: 3 }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxHeight: 450, overflowY: 'auto', pr: 1 }}>
                      {getTargetFields().map((field) => (
                        <Box key={field.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                          <Box sx={{ minWidth: 160 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569' }}>
                              {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                              Expected: {field.type}
                            </Typography>
                          </Box>

                          <ArrowIcon sx={{ color: '#cbd5e1' }} />

                          <FormControl fullWidth size="small">
                            <InputLabel>Excel Column</InputLabel>
                            <Select
                              value={columnMapping[field.key] || ''}
                              label="Excel Column"
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              sx={{ borderRadius: 1.5 }}
                            >
                              <MenuItem value=""><em>-- Do Not Map --</em></MenuItem>
                              {headers.map((header) => (
                                <MenuItem key={header} value={header}>{header}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      ))}
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={resetImporter}
                        sx={{ py: 1.5, borderRadius: 1.5, textTransform: 'none' }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={startImport}
                        startIcon={<ImportIcon />}
                        sx={{
                          background: 'linear-gradient(45deg, #16a34a, #22c55e)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #15803d, #16a34a)'
                          },
                          py: 1.5,
                          borderRadius: 1.5,
                          textTransform: 'none',
                          fontWeight: 600
                        }}
                      >
                        Start Import ({excelData?.length} rows)
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column - Data Grid Preview */}
              <Grid item xs={12} lg={7}>
                <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                      Sheet Preview (First 10 rows)
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Showing data as parsed from the sheet <strong>{selectedSheet}</strong>.
                    </Typography>
                  </Box>
                  
                  <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto', boxShadow: 'none', borderRadius: 0 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          {headers.map(h => (
                            <TableCell key={h} sx={{ fontWeight: 'bold', bgcolor: '#f1f5f9' }}>
                              {h}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewRows.map((row, idx) => (
                          <TableRow key={idx} hover>
                            {headers.map(h => (
                              <TableCell key={h} sx={{ maxStringLength: 100, whiteSpace: 'nowrap' }}>
                                {String(row[h] !== undefined ? row[h] : '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Card>
              </Grid>
            </>
          )}

          {/* STEP 2: IMPORTING PROGRESS */}
          {currentStep === 2 && (
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', p: 4, textAlign: 'center' }}>
                <LoadingIcon sx={{ fontSize: 64, color: '#3b82f6', animation: 'spin 2s linear infinite', mb: 3 }} />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#334155' }}>
                  Processing Import...
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b', mb: 3 }}>
                  Inserting records into database tables. Please do not close or reload this page.
                </Typography>
                
                <Box sx={{ width: '50%', mx: 'auto', mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} 
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                  {progress.processed} of {progress.total} records imported
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', mt: 0.5 }}>
                  {progress.total - progress.processed} records remaining
                </Typography>
              </Card>
            </Grid>
          )}

          {/* STEP 3: SUCCESS & REPORTING */}
          {currentStep === 3 && importResults && (
            <Grid item xs={12}>
              <Card sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none', mb: 4 }}>
                <CardContent sx={{ p: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                    <SuccessIcon sx={{ fontSize: 48, color: '#16a34a' }} />
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#334155' }}>
                        Import Completed!
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Successfully processed spreadsheet file. Review summary details below.
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 4 }} />

                  {/* Summary Chips */}
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    {[
                      { label: 'Successfully Parsed', val: importResults.success, color: 'success' },
                      { label: 'Created / Added', val: importResults.created, color: 'info' },
                      { label: 'Updated / Overwritten', val: importResults.updated, color: 'primary' },
                      { label: 'Skipped / Duplicates', val: importResults.skipped, color: 'warning' },
                      { label: 'Failed Rows', val: importResults.failed, color: 'error' }
                    ].map((stat, i) => (
                      <Grid item xs={6} md={2.4} key={i}>
                        <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderRadius: 2, bgcolor: '#f8fafc' }}>
                          <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, display: 'block', mb: 0.5 }}>
                            {stat.label}
                          </Typography>
                          <Typography variant="h4" sx={{ fontWeight: 800 }} color={`${stat.color}.main`}>
                            {stat.val}
                          </Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>

                  {/* Failure Logs */}
                  {importResults.errors.length > 0 && (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#ef4444', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ErrorIcon /> Row Execution Failures ({importResults.errors.length})
                      </Typography>
                      
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300, overflow: 'auto', borderRadius: 2 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fef2f2', color: '#b91c1c', width: 100 }}>Row #</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fef2f2', color: '#b91c1c' }}>Error Message</TableCell>
                              <TableCell sx={{ fontWeight: 'bold', bgcolor: '#fef2f2', color: '#b91c1c' }}>Row Dump</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {importResults.errors.map((err, idx) => (
                              <TableRow key={idx}>
                                <TableCell><strong>{err.row}</strong></TableCell>
                                <TableCell sx={{ color: '#b91c1c' }}>{err.error}</TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                  {JSON.stringify(err.data)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={resetImporter} sx={{ borderRadius: 1.5, px: 4 }}>
                      Import Another File
                    </Button>
                    <Button
                      variant="contained"
                      onClick={() => window.location.href = '/dashboard'}
                      sx={{
                        background: 'linear-gradient(45deg, #2563eb, #3b82f6)',
                        px: 4,
                        borderRadius: 1.5
                      }}
                    >
                      Go to Dashboard
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Container>
    </DashboardLayout>
  );
}
