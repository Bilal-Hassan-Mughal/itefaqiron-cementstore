'use client';

import { useState, useEffect, useRef } from 'react';
import { formatDatePK } from '@/lib/date-helper';
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
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Pagination
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  CreditCard as CreditCardIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  AttachMoney as AttachMoneyIcon
} from '@mui/icons-material';
import { Plus, Edit, Trash2, Check, X, Phone, Mail, MapPin, User, Building, CreditCard, Calendar, Search, Loader2, Users, TrendingUp, TrendingDown, Wallet, DollarSign, Filter, ArrowUp } from 'lucide-react';
import { Fragment } from 'react';
import DashboardLayout from '../components/dashboard-layout';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [customerCategories, setCustomerCategories] = useState([]);
  const [customerTypes, setCustomerTypes] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Pagination & Filtering & Sorting States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalReceivables, setTotalReceivables] = useState(0);
  const [totalPayables, setTotalPayables] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [sortBy, setSortBy] = useState('cus_name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    cus_name: '',
    cus_phone_no: '',
    cus_phone_no2: '',
    cus_address: '',
    cus_reference: '',
    cus_account_info: '',
    other: '',
    cus_type: '',
    cus_category: '',
    cus_balance: 0,
    CNIC: '',
    NTN_NO: '',
    name_urdu: '',
    city_id: ''
  });

  // Popup states
  const [showCustomerTypePopup, setShowCustomerTypePopup] = useState(false);
  const [showCustomerCategoryPopup, setShowCustomerCategoryPopup] = useState(false);
  const [showCityPopup, setShowCityPopup] = useState(false);
  const [customerTypeFormData, setCustomerTypeFormData] = useState({ cus_type_title: '' });
  const [customerCategoryFormData, setCustomerCategoryFormData] = useState({ cus_cat_title: '' });
  const [cityFormData, setCityFormData] = useState({ city_name: '' });

  // Loading states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingCustomerType, setIsAddingCustomerType] = useState(false);
  const [isAddingCustomerCategory, setIsAddingCustomerCategory] = useState(false);
  const [isAddingCity, setIsAddingCity] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');

  // Print / WhatsApp
  const tableRef = useRef(null);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // Snackbar states
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load configuration details from API on mount
  useEffect(() => {
    fetchStaticData();
  }, []);

  // Debounce search and minAmount input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setDebouncedMinAmount(minAmount);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchTerm, minAmount]);

  // Fetch paginated customers when filters, page, sorting changes
  useEffect(() => {
    fetchCustomers(page);
  }, [page, limit, debouncedSearch, debouncedMinAmount, typeFilter, categoryFilter, balanceFilter, activityFilter, sortBy, sortOrder]);

  // Reset to page 1 whenever any filter condition changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedMinAmount, typeFilter, categoryFilter, balanceFilter, activityFilter]);

  const fetchStaticData = async () => {
    try {
      setLoading(true);
      const [categoriesRes, customerTypesRes, citiesRes] = await Promise.all([
        fetch('/api/customer-category'),
        fetch('/api/customer-types'),
        fetch('/api/cities')
      ]);

      if (categoriesRes.ok && customerTypesRes.ok && citiesRes.ok) {
        const categoriesData = await categoriesRes.json();
        const customerTypesData = await customerTypesRes.json();
        const citiesData = await citiesRes.json();

        setCustomerCategories(categoriesData);
        setCustomerTypes(customerTypesData);
        setCities(citiesData);
      } else {
        console.error('Failed to fetch configuration options');
        setSnackbar({
          open: true,
          message: 'Failed to fetch settings options',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error fetching settings options:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (currentPage = page) => {
    try {
      setIsFetching(true);
      const queryParams = new URLSearchParams({
        paginate: 'true',
        page: String(currentPage),
        limit: String(limit),
        search: debouncedSearch,
        minAmount: debouncedMinAmount,
        typeFilter,
        categoryFilter,
        balanceFilter,
        activityFilter,
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/customers?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const customersWithSeq = (data.customers || []).map((customer, index) => ({
          ...customer,
          sequentialId: (currentPage - 1) * limit + index + 1
        }));
        setCustomers(customersWithSeq);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCustomers(data.stats?.totalCustomers || 0);
        setTotalReceivables(data.stats?.totalReceivables || 0);
        setTotalPayables(data.stats?.totalPayables || 0);
        setNetBalance(data.stats?.netBalance || 0);
      } else {
        console.error('Failed to fetch customers');
        setSnackbar({
          open: true,
          message: 'Failed to fetch customer list',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchFullFilteredList = async () => {
    try {
      setIsSubmitting(true);
      const queryParams = new URLSearchParams({
        paginate: 'true',
        all: 'true',
        search: debouncedSearch,
        minAmount: debouncedMinAmount,
        typeFilter,
        categoryFilter,
        balanceFilter,
        activityFilter,
        sortBy,
        sortOrder
      });

      const response = await fetch(`/api/customers?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        return (data.customers || []).map((customer, index) => ({
          ...customer,
          sequentialId: index + 1
        }));
      } else {
        console.error('Failed to fetch complete filtered list');
        return [];
      }
    } catch (err) {
      console.error('Error loading complete list:', err);
      return [];
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? ' 🔼' : ' 🔽';
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newCustomer = await response.json();
        setShowCustomerForm(false);
        setFormData({
          cus_name: '',
          cus_phone_no: '',
          cus_phone_no2: '',
          cus_address: '',
          cus_reference: '',
          cus_account_info: '',
          other: '',
          cus_type: '',
          cus_category: '',
          cus_balance: 0,
          CNIC: '',
          NTN_NO: '',
          name_urdu: '',
          city_id: ''
        });
        new BroadcastChannel('customers-sync').postMessage({ type: 'customer-added', customer: newCustomer });
        alert('Account added successfully!');
        setPage(1);
        fetchCustomers(1);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create Account');
      }
    } catch (error) {
      console.error('Error creating Account:', error);
      alert('Failed to create Account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      cus_name: customer.cus_name || '',
      cus_phone_no: customer.cus_phone_no || '',
      cus_phone_no2: customer.cus_phone_no2 || '',
      cus_address: customer.cus_address || '',
      cus_reference: customer.cus_reference || '',
      cus_account_info: customer.cus_account_info || '',
      other: customer.other || '',
      cus_type: customer.cus_type || '',
      cus_category: customer.cus_category || '',
      cus_balance: customer.cus_balance || 0,
      CNIC: customer.CNIC || '',
      NTN_NO: customer.NTN_NO || '',
      name_urdu: customer.name_urdu || '',
      city_id: customer.city_id || ''
    });
    setShowCustomerForm(true);
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/customers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingCustomer.cus_id,
          ...formData
        }),
      });

      if (response.ok) {
        const updatedCustomer = await response.json();
        setShowCustomerForm(false);
        setEditingCustomer(null);
        setFormData({
          cus_name: '',
          cus_phone_no: '',
          cus_phone_no2: '',
          cus_address: '',
          cus_reference: '',
          cus_account_info: '',
          other: '',
          cus_type: '',
          cus_category: '',
          cus_balance: 0,
          CNIC: '',
          NTN_NO: '',
          name_urdu: '',
          city_id: ''
        });
        new BroadcastChannel('customers-sync').postMessage({ type: 'customer-updated', customer: updatedCustomer });
        alert('Account updated successfully!');
        fetchCustomers(page);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update Account');
      }
    } catch (error) {
      console.error('Error updating Account:', error);
      alert('Failed to update Account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    if (window.confirm('Are you sure you want to delete this Account?')) {
      try {
        const response = await fetch(`/api/customers?id=${customerId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          alert('Account deleted successfully!');
          fetchCustomers(page);
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete Account');
        }
      } catch (error) {
        console.error('Error deleting Account:', error);
        alert('Failed to delete Account');
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Customer Type handlers
  const handleAddCustomerType = async (e) => {
    e.preventDefault();
    setIsAddingCustomerType(true);
    try {
      const response = await fetch('/api/customer-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerTypeFormData)
      });

      if (response.ok) {
        const newCustomerType = await response.json();
        setCustomerTypes(prev => [...prev, newCustomerType]);
        setShowCustomerTypePopup(false);
        setCustomerTypeFormData({ cus_type_title: '' });
        alert('Account type added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create Account type');
      }
    } catch (error) {
      console.error('Error creating Account type:', error);
      alert('Failed to create Account type');
    } finally {
      setIsAddingCustomerType(false);
    }
  };

  // Customer Category handlers
  const handleAddCustomerCategory = async (e) => {
    e.preventDefault();
    setIsAddingCustomerCategory(true);
    try {
      const response = await fetch('/api/customer-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerCategoryFormData)
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCustomerCategories(prev => [...prev, newCategory]);
        setShowCustomerCategoryPopup(false);
        setCustomerCategoryFormData({ cus_cat_title: '' });
        alert('Account category added successfully!');
      } else {
        alert('Failed to add account category');
      }
    } catch (error) {
      console.error('Error adding account category:', error);
      alert('Error adding account category');
    } finally {
      setIsAddingCustomerCategory(false);
    }
  };

  // City handlers
  const handleAddCity = async (e) => {
    e.preventDefault();
    // Client-side duplicate check (case-insensitive)
    const name = (cityFormData.city_name || '').trim().toLowerCase();
    if (!name) return alert('City name is required');
    const exists = cities.some(c => (c.city_name || '').trim().toLowerCase() === name);
    if (exists) return alert('City with this name already exists');

    setIsAddingCity(true);
    try {
      const response = await fetch('/api/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cityFormData)
      });

      if (response.ok) {
        const newCity = await response.json();
        setCities(prev => [...prev, newCity]);
        setShowCityPopup(false);
        setCityFormData({ city_name: '' });
        alert('City added successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create city');
      }
    } catch (error) {
      console.error('Error creating city:', error);
      alert('Failed to create city');
    } finally {
      setIsAddingCity(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.cus_name.trim()) {
      alert('Account name is required');
      return;
    }
    if (!formData.cus_phone_no.trim()) {
      alert('Phone number is required');
      return;
    }
    if (!formData.cus_address.trim()) {
      alert('Address is required');
      return;
    }
    if (!formData.cus_category) {
      alert('Account category is required');
      return;
    }

    if (editingCustomer) {
      await handleUpdateCustomer(e);
    } else {
      await handleAddCustomer(e);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setMinAmount('');
    setDebouncedMinAmount('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setBalanceFilter('all');
    setActivityFilter('all');
    setSortBy('cus_name');
    setSortOrder('asc');
  };

  const getTypeColor = (typeId) => {
    const customerType = customerTypes.find(type => type.cus_type_id === typeId);
    const title = (customerType?.cus_type_title || '').toLowerCase();
    if (title.includes('cash')) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (title.includes('supplier')) {
      return 'bg-red-100 text-red-800';
    }
    if (title.includes('bank')) {
      return 'bg-indigo-100 text-indigo-800';
    }
    if (title.includes('builders') || title.includes('iron')) {
      return 'bg-orange-100 text-orange-800';
    }
    if (title) {
      return 'bg-emerald-100 text-emerald-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getBalanceColor = (balance) => {
    const bal = parseFloat(balance);
    if (bal > 0) return 'text-green-600';
    if (bal < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getActivityRowBg = (customer) => {
    const balance = parseFloat(customer.cus_balance);
    if (balance <= 0) return undefined;
    const now = new Date();
    const lastActivity = customer.updated_at ? new Date(customer.updated_at) : new Date(customer.created_at);
    const diffDays = (now - lastActivity) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return '#dcfce7';       // green-100
    if (diffDays <= 90) return '#dbeafe';       // blue-100
    if (diffDays <= 180) return '#fef9c3';      // yellow-100
    return '#fee2e2';                           // red-100
  };

  const buildPrintHTML = (list) => {
    const now = new Date().toLocaleString();
    const sortedList = [...list].sort((a, b) => 
      (a.cus_name || '').localeCompare(b.cus_name || '', undefined, { sensitivity: 'base' })
    );
    const totalBalance = sortedList.reduce((sum, c) => sum + parseFloat(c.cus_balance || 0), 0);
    const rows = sortedList.map((c, i) => {
      const bg = getActivityRowBg(c) || '#fff';
      const bal = parseFloat(c.cus_balance);
      const balColor = bal > 0 ? '#16a34a' : bal < 0 ? '#dc2626' : '#374151';
      const lastAct = c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-GB') : new Date(c.created_at).toLocaleDateString('en-GB');
      const cat = c.customer_category?.cus_cat_title || c.cus_category || '';
      return `<tr style="background:${bg}">
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${i + 1}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${c.cus_name || ''}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${c.cus_phone_no || ''}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${cat}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;color:${balColor};font-weight:600">${parseFloat(c.cus_balance || 0).toLocaleString()}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:center">${lastAct}</td>
      </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Accounts List — Itefaq Iron & Cement Store</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;margin:24px;color:#1e293b}
      h1{font-size:1.2rem;font-weight:800;margin:0}
      p.sub{font-size:0.8rem;color:#64748b;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:0.82rem}
      th{background:#1e3a5f;color:#fff;padding:7px 8px;border:1px solid #1e3a5f;text-align:left}
      th:last-child,th:nth-child(5){text-align:right}
      th:first-child{text-align:center}
      .legend{display:flex;gap:16px;margin-top:12px;font-size:0.75rem}
      .dot{width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:middle}
      @media print{@page{size:A4 portrait;margin:12mm}}
    </style></head><body>
    <h1>Itefaq Iron &amp; Cement Store — Accounts List</h1>
    <p class="sub">Printed: ${now} &nbsp;|&nbsp; Total: ${list.length} accounts</p>
    <table>
      <thead><tr>
        <th>#</th><th>Name</th><th>Phone</th><th>Category</th><th style="text-align:right">Balance (PKR)</th><th style="text-align:center">Last Activity</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr style="font-weight:bold;background:#f1f5f9;border-top:2px solid #1e3a5f">
          <td colspan="4" style="padding:8px 8px;border:1px solid #e5e7eb;text-align:right">Total:</td>
          <td style="padding:8px 8px;border:1px solid #e5e7eb;text-align:right;color:${totalBalance >= 0 ? '#16a34a' : '#dc2626'}">${totalBalance.toLocaleString()}</td>
          <td style="border:1px solid #e5e7eb"></td>
        </tr>
      </tfoot>
    </table>
    <div class="legend">
      <span><span class="dot" style="background:#86efac"></span>≤ 1 Month</span>
      <span><span class="dot" style="background:#93c5fd"></span>1–3 Months</span>
      <span><span class="dot" style="background:#fde047"></span>3–6 Months</span>
      <span><span class="dot" style="background:#fca5a5"></span>&gt; 6 Months</span>
    </div>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  };

  const handlePrint = async () => {
    const fullList = await fetchFullFilteredList();
    const w = window.open('', '_blank', 'width=1100,height=750');
    w.document.write(buildPrintHTML(fullList));
    w.document.close();
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappPhone.trim()) return;
    setIsSendingWhatsApp(true);
    try {
      const fullList = await fetchFullFilteredList();
      const { jsPDF } = await import('jspdf');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 12;
      const colWidths = [10, 50, 30, 35, 33, 28]; // # | Name | Phone | Category | Balance | Last Activity
      const rowH = 7;
      let y = margin;

      // Header block
      doc.setFillColor(30, 58, 95);
      doc.rect(margin, y, pageW - margin * 2, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Itefaq Iron & Cement Store — Accounts List', margin + 4, y + 8);
      y += 16;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}   |   Total: ${fullList.length} accounts`, margin, y);
      y += 6;

      // Table header
      const headers = ['#', 'Name', 'Phone', 'Category', 'Balance (PKR)', 'Last Activity'];
      doc.setFillColor(30, 58, 95);
      doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      let x = margin;
      headers.forEach((h, i) => {
        const align = (i === 4) ? 'right' : (i === 0 || i === 5) ? 'center' : 'left';
        const cellX = align === 'right' ? x + colWidths[i] - 2 : align === 'center' ? x + colWidths[i] / 2 : x + 2;
        doc.text(h, cellX, y + 5, { align });
        x += colWidths[i];
      });
      y += rowH;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);

      fullList.forEach((c, i) => {
        if (y + rowH > pageH - margin) {
          doc.addPage();
          y = margin;
        }

        const bal = parseFloat(c.cus_balance || 0);
        const bg = getActivityRowBg(c);
        const lastAct = c.updated_at
          ? new Date(c.updated_at).toLocaleDateString('en-GB')
          : new Date(c.created_at).toLocaleDateString('en-GB');
        const cat = c.customer_category?.cus_cat_title || c.cus_category || '';

        // Row background
        if (bg) {
          const rgb = bg === '#dcfce7' ? [220, 252, 231] : bg === '#dbeafe' ? [219, 234, 254] : bg === '#fef9c3' ? [254, 249, 195] : [254, 226, 226];
          doc.setFillColor(...rgb);
          doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
        } else if (i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
        }

        // Row border
        doc.setDrawColor(229, 231, 235);
        doc.rect(margin, y, pageW - margin * 2, rowH, 'S');

        // Cell text
        doc.setTextColor(30, 41, 59);
        x = margin;
        const cells = [String(i + 1), c.cus_name || '', c.cus_phone_no || '', cat, bal.toLocaleString(), lastAct];
        cells.forEach((cell, ci) => {
          if (ci === 4) {
            // Balance — colored
            doc.setTextColor(bal > 0 ? 22 : bal < 0 ? 220 : 55, bal > 0 ? 163 : bal < 0 ? 38 : 65, bal > 0 ? 74 : bal < 0 ? 38 : 81);
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'normal');
          }
          const align = ci === 4 ? 'right' : (ci === 0 || ci === 5) ? 'center' : 'left';
          const maxW = colWidths[ci] - 3;
          const clipped = doc.getTextWidth(cell) > maxW ? doc.splitTextToSize(cell, maxW)[0] : cell;
          const cellX = align === 'right' ? x + colWidths[ci] - 2 : align === 'center' ? x + colWidths[ci] / 2 : x + 2;
          doc.text(clipped, cellX, y + 5, { align });
          x += colWidths[ci];
        });
        y += rowH;
      });

      // Legend at bottom of last page
      y += 4;
      if (y + 8 > pageH - margin) { doc.addPage(); y = margin; }
      const legend = [
        { color: [134, 239, 172], label: '\u22641 Month' },
        { color: [147, 197, 253], label: '1\u20133 Months' },
        { color: [253, 224, 71], label: '3\u20136 Months' },
        { color: [252, 165, 165], label: '>6 Months' },
      ];
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      let lx = margin;
      legend.forEach(({ color, label }) => {
        doc.setFillColor(...color);
        doc.rect(lx, y, 6, 4, 'F');
        doc.setTextColor(30, 41, 59);
        doc.text(label, lx + 8, y + 3.5);
        lx += 40;
      });

      // Convert PDF to clipboard + open WhatsApp Desktop
      const { sharePdfViaWhatsAppDesktop, whatsAppSuccessMessage } = await import('@/lib/whatsapp-local');
      const { opened } = await sharePdfViaWhatsAppDesktop(doc, whatsappPhone.trim());
      setSnackbar({ open: true, message: whatsAppSuccessMessage(opened), severity: 'success' });
      setShowWhatsAppDialog(false);
      setWhatsappPhone('');
    } catch (err) {
      setSnackbar({ open: true, message: 'Error: ' + err.message, severity: 'error' });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // Get customer type title from ID
  const getCustomerTypeTitle = (typeId) => {
    const customerType = customerTypes.find(type => type.cus_type_id === typeId);
    return customerType ? customerType.cus_type_title : typeId || 'Unknown';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 w-full p-4 md:p-6 lg:p-8">
        {/* Header with prominent animated New Account button at far left */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="contained"
              onClick={() => setShowCustomerForm(true)}
              startIcon={<AddIcon />}
              className="blink-button-strong"
              sx={{
                bgcolor: '#e02424',
                color: '#fff',
                '&:hover': { bgcolor: '#e02424', transform: 'scale(1.03)', boxShadow: '0 20px 40px rgba(224,36,36,0.20)' },
                px: 6,
                py: 2.25,
                minWidth: 220,
                borderRadius: '14px',
                fontWeight: 900,
                fontSize: '1.125rem',
                letterSpacing: '0.02em',
                boxShadow: '0 14px 36px rgba(0,0,0,0.26)',
                transition: 'transform 160ms cubic-bezier(.2,.9,.2,1), box-shadow 160ms ease',
                position: 'relative',
                overflow: 'visible'
              }}
              aria-label="Create new account"
            >
              New Account
            </Button>

            {/* removed redundant 'Accounts' title per request */}
          </div>

          {/* Print & WhatsApp */}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              onClick={handlePrint}
              startIcon={<span style={{ fontSize: 18 }}>🖨️</span>}
              sx={{
                borderColor: '#3b82f6', color: '#3b82f6', fontWeight: 700, borderRadius: 2,
                '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb' }
              }}
            >
              Print List
            </Button>
            <Button
              variant="contained"
              onClick={() => setShowWhatsAppDialog(true)}
              startIcon={<span style={{ fontSize: 18 }}>📲</span>}
              sx={{
                bgcolor: '#25d366', color: '#fff', fontWeight: 700, borderRadius: 2,
                '&:hover': { bgcolor: '#128c7e' }
              }}
            >
              Send WhatsApp
            </Button>
          </Box>
        </div>


        {/* Premium Filters Section */}
        <Box sx={{ flexShrink: 0, mb: 3, width: '100%' }}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            width: '100%',
            border: '1px solid #e2e8f0',
            bgcolor: '#f8fafc'
          }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#334155' }}>
                  Filters & Sorting
                </Typography>
                <Button
                  onClick={clearFilters}
                  size="small"
                  sx={{
                    color: '#64748b',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { color: '#ef4444' }
                  }}
                >
                  Clear All Filters
                </Button>
              </Box>

              <Box sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: '1fr 1fr',
                  md: 'repeat(3, 1fr)',
                  lg: 'repeat(6, 1fr)'
                },
                gap: 3,
                width: '100%'
              }}>
                {/* Search */}
                <Box>
                  <TextField
                    fullWidth
                    label="Search"
                    placeholder="Search by name, phone, address, city, reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search size={18} color="#94a3b8" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                        bgcolor: 'white',
                      }
                    }}
                  />
                </Box>

                {/* Type Filter */}
                <Box>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={[
                      { value: 'all', label: 'All Types' },
                      ...customerTypes.map(type => ({
                        value: type.cus_type_id,
                        label: type.cus_type_title
                      }))
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={(() => {
                      if (typeFilter === 'all') return { value: 'all', label: 'All Types' };
                      const selected = customerTypes.find(type => type.cus_type_id === typeFilter);
                      return selected ? { value: selected.cus_type_id, label: selected.cus_type_title } : { value: 'all', label: 'All Types' };
                    })()}
                    onChange={(event, newValue) => {
                      setTypeFilter(newValue ? newValue.value : 'all');
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account Type"
                        placeholder="Select type"
                        onFocus={(e) => e.target.select()}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <Fragment>
                              <InputAdornment position="start">
                                <Building size={18} color="#94a3b8" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </Fragment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            bgcolor: 'white',
                          }
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Category Filter */}
                <Box>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={[
                      { value: 'all', label: 'All Categories' },
                      ...customerCategories.map(category => ({
                        value: category.cus_cat_title,
                        label: category.cus_cat_title
                      }))
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{ value: categoryFilter, label: categoryFilter === 'all' ? 'All Categories' : categoryFilter }}
                    onChange={(event, newValue) => {
                      setCategoryFilter(newValue ? newValue.value : 'all');
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Category"
                        placeholder="Select category"
                        onFocus={(e) => e.target.select()}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <Fragment>
                              <InputAdornment position="start">
                                <Filter size={18} color="#94a3b8" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </Fragment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            bgcolor: 'white',
                          }
                        }}
                      />
                    )}
                  />
                </Box>

                {/* Balance > Amount Filter */}
                <Box>
                  <TextField
                    fullWidth
                    label="Balance > Amount"
                    placeholder="e.g. 50000"
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <TrendingUp size={18} color="#94a3b8" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1.5,
                        bgcolor: 'white',
                      }
                    }}
                  />
                </Box>

                {/* Balance Filter */}
                <Box>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={[
                      { value: 'all', label: 'All Balances' },
                      { value: 'positive', label: 'Positive Balance' },
                      { value: 'negative', label: 'Negative Balance' },
                      { value: 'zero', label: 'Zero Balance' },
                      { value: 'non-zero', label: 'With Balance (Non-Zero)' }
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{
                      value: balanceFilter, label:
                        balanceFilter === 'all' ? 'All Balances' :
                          balanceFilter === 'positive' ? 'Positive Balance' :
                            balanceFilter === 'negative' ? 'Negative Balance' :
                              balanceFilter === 'zero' ? 'Zero Balance' :
                                balanceFilter === 'non-zero' ? 'With Balance (Non-Zero)' : 'All Balances'
                    }}
                    onChange={(event, newValue) => {
                      setBalanceFilter(newValue ? newValue.value : 'all');
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Balance Status"
                        placeholder="Select balance"
                        onFocus={(e) => e.target.select()}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <Fragment>
                              <InputAdornment position="start">
                                <Wallet size={18} color="#94a3b8" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </Fragment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            bgcolor: 'white',
                          }
                        }}
                      />
                    )}
                  />
                </Box>
 
                {/* Activity Filter */}
                <Box>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={[
                      { value: 'all', label: 'All Activity' },
                      { value: '1month', label: '≤ 1 Month (Active)' },
                      { value: '1to3months', label: '1–3 Months' },
                      { value: '3to6months', label: '3–6 Months' },
                      { value: 'over6months', label: '> 6 Months (Inactive)' }
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{
                      value: activityFilter,
                      label: activityFilter === 'all' ? 'All Activity' :
                        activityFilter === '1month' ? '≤ 1 Month (Active)' :
                          activityFilter === '1to3months' ? '1–3 Months' :
                            activityFilter === '3to6months' ? '3–6 Months' :
                              activityFilter === 'over6months' ? '> 6 Months (Inactive)' : 'All Activity'
                    }}
                    onChange={(event, newValue) => {
                      setActivityFilter(newValue ? newValue.value : 'all');
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Last Activity"
                        placeholder="Select activity"
                        onFocus={(e) => e.target.select()}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <Fragment>
                              <InputAdornment position="start">
                                <Calendar size={18} color="#94a3b8" />
                              </InputAdornment>
                              {params.InputProps.startAdornment}
                            </Fragment>
                          ),
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.5,
                            bgcolor: 'white',
                          }
                        }}
                      />
                    )}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
 
        {/* Unified Professional Stats Bar */}
        <Box sx={{ flexShrink: 0, mb: 4, width: '100%' }}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            bgcolor: 'white',
            border: '1px solid #e5e7eb'
          }}>
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'stretch',
              justifyContent: 'space-between',
              p: 0
            }}>
              {[
                { title: 'Total Accounts', val: totalCustomers, color: '#2563eb', bg: '#eff6ff', icon: <Users size={24} />, isCurrency: false },
                { title: 'Total Receivables', val: totalReceivables, color: '#16a34a', bg: '#f0fdf4', icon: <TrendingUp size={24} />, isCurrency: true },
                { title: 'Total Payables', val: totalPayables, color: '#dc2626', bg: '#fef2f2', icon: <TrendingDown size={24} />, isCurrency: true },
                { title: 'Net Balance', val: netBalance, color: '#d97706', bg: '#fffbeb', icon: <Wallet size={24} />, isCurrency: true }
              ].map((stat, i) => (
                <Fragment key={i}>
                  <Box sx={{
                    flex: 1,
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2.5,
                    width: '100%',
                    bgcolor: stat.bg,
                    position: 'relative',
                    borderBottom: i < 3 && { xs: '1px solid #e5e7eb', md: 'none' },
                    '&:hover': {
                      bgcolor: 'white',
                      transition: 'background-color 0.3s'
                    }
                  }}>
                    <Avatar sx={{
                      bgcolor: 'white',
                      color: stat.color,
                      width: 52,
                      height: 52,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      border: `1.5px solid ${stat.color}20`
                    }}>
                      {stat.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="overline" sx={{
                        display: 'block',
                        lineHeight: 1,
                        mb: 0.5,
                        color: '#6b7280',
                        fontWeight: 700,
                        letterSpacing: 1.2
                      }}>
                        {stat.title}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0.5, color: stat.color }}>
                        {stat.isCurrency && <span style={{ fontSize: '0.8rem', marginRight: 4, opacity: 0.6 }}>PKR</span>}
                        {stat.val.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                  {i < 3 && (
                    <Divider
                      orientation="vertical"
                      flexItem
                      sx={{
                        display: { xs: 'none', md: 'block' },
                        bgcolor: '#e5e7eb',
                        height: 60,
                        my: 'auto'
                      }}
                    />
                  )}
                </Fragment>
              ))}
            </Box>
          </Card>
        </Box>
 
        {/* Customers Table */}
        <Card sx={{ minHeight: 600, height: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
              Accounts List
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Accounts: {totalCustomers}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {isFetching && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress color="primary" />
              </Box>
            )}
            <TableContainer ref={tableRef} component={Paper} sx={{ height: '100%' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell onClick={() => handleSort('cus_name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Account {renderSortIndicator('cus_name')}
                    </TableCell>
                    <TableCell>Contact</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell onClick={() => handleSort('cus_balance')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Balance {renderSortIndicator('cus_balance')}
                    </TableCell>
                    <TableCell onClick={() => handleSort('created_at')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Created {renderSortIndicator('created_at')}
                    </TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.cus_id}
                      hover
                      sx={{ bgcolor: getActivityRowBg(customer) }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{
                            bgcolor: 'primary.main',
                            mr: 2,
                            width: 40,
                            height: 40
                          }}>
                            {customer.cus_name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {customer.cus_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: #{customer.sequentialId}
                            </Typography>
                            {customer.cus_reference && (
                              <Typography variant="caption" color="primary" display="block">
                                Ref: {customer.cus_reference}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2">{customer.cus_phone_no}</Typography>
                          </Box>
                          {customer.cus_phone_no2 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                              <PhoneIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                              <Typography variant="body2">{customer.cus_phone_no2}</Typography>
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <LocationIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                            <Typography variant="body2" sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {customer.cus_address}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getCustomerTypeTitle(customer.cus_type)}
                          size="small"
                          sx={{
                            backgroundColor: getTypeColor(customer.cus_type).includes('yellow') ? '#fef3c7' :
                              getTypeColor(customer.cus_type).includes('red') ? '#fee2e2' :
                                getTypeColor(customer.cus_type).includes('emerald') ? '#d1fae5' :
                                  getTypeColor(customer.cus_type).includes('orange') ? '#fed7aa' :
                                    getTypeColor(customer.cus_type).includes('indigo') ? '#e0e7ff' :
                                      getTypeColor(customer.cus_type).includes('pink') ? '#fce7f3' : '#f3f4f6',
                            color: getTypeColor(customer.cus_type).includes('yellow') ? '#92400e' :
                              getTypeColor(customer.cus_type).includes('red') ? '#dc2626' :
                                getTypeColor(customer.cus_type).includes('emerald') ? '#059669' :
                                  getTypeColor(customer.cus_type).includes('orange') ? '#ea580c' :
                                    getTypeColor(customer.cus_type).includes('indigo') ? '#4338ca' :
                                      getTypeColor(customer.cus_type).includes('pink') ? '#be185d' : '#374151'
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {customer.customer_category?.cus_cat_title || customer.cus_category}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            color: getBalanceColor(customer.cus_balance).includes('green') ? 'success.main' :
                              getBalanceColor(customer.cus_balance).includes('red') ? 'error.main' : 'text.secondary'
                          }}
                        >
                          {fmtAmt(customer.cus_balance)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDatePK(customer.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditCustomer(customer)}
                            sx={{ color: 'primary.main' }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteCustomer(customer.cus_id)}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <FormControl variant="outlined" size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="rows-per-page-label">Rows per page</InputLabel>
              <Select
                labelId="rows-per-page-label"
                id="rows-per-page"
                value={limit}
                onChange={(e) => {
                  setLimit(parseInt(e.target.value));
                  setPage(1);
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
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          </Box>
        </Card>
 
        {/* WhatsApp Send Dialog */}
        <Dialog open={showWhatsAppDialog} onClose={() => setShowWhatsAppDialog(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: 22 }}>📲</span> Send Accounts List via WhatsApp
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This will capture the current filtered list ({totalCustomers} accounts) as an image and send it via WhatsApp.
            </Typography>
            <TextField
              fullWidth
              label="WhatsApp Phone Number"
              placeholder="e.g. 03001234567"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendWhatsApp(); }}
              autoFocus
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setShowWhatsAppDialog(false)} disabled={isSendingWhatsApp}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp || !whatsappPhone.trim()}
              sx={{ bgcolor: '#25d366', '&:hover': { bgcolor: '#128c7e' }, fontWeight: 700, minWidth: 130 }}
            >
              {isSendingWhatsApp ? 'Sending...' : 'Send'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Full Replica of Sales Page Customer Modal */}
        <Dialog
          open={showCustomerForm}
          onClose={() => setShowCustomerForm(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              minHeight: '80vh'
            }
          }}
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
                width: 48,
                height: 48
              }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
                  {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {editingCustomer ? 'Update customer profile' : 'Create a new customer profile'}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setShowCustomerForm(false)}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 3 }}>
            <Box component="form" sx={{ mt: 2 }}>
              {/* Quick Actions */}
              <Box sx={{
                bgcolor: 'grey.50',
                borderRadius: 2,
                p: 2,
                border: 1,
                borderColor: 'grey.200',
                mb: 3
              }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BusinessIcon />}
                    onClick={() => setShowCustomerCategoryPopup(true)}
                    sx={{
                      borderColor: 'success.main',
                      color: 'success.main',
                      '&:hover': {
                        borderColor: 'success.dark',
                        backgroundColor: 'success.light',
                        color: 'success.dark'
                      }
                    }}
                  >
                    Add Account Category
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<PersonIcon />}
                    onClick={() => setShowCustomerTypePopup(true)}
                    sx={{
                      borderColor: 'secondary.main',
                      color: 'secondary.main',
                      '&:hover': {
                        borderColor: 'secondary.dark',
                        backgroundColor: 'secondary.light',
                        color: 'secondary.dark'
                      }
                    }}
                  >
                    Add Type
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LocationIcon />}
                    onClick={() => setShowCityPopup(true)}
                    sx={{
                      borderColor: 'warning.main',
                      color: 'warning.main',
                      '&:hover': {
                        borderColor: 'warning.dark',
                        backgroundColor: 'warning.light',
                        color: 'warning.dark'
                      }
                    }}
                  >
                    Add City
                  </Button>
                </Box>
              </Box>

              <Grid container spacing={3}>
                {/* First Row - Name, Primary Phone, Secondary Phone */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    label="Account Name"
                    name="cus_name"
                    value={formData.cus_name}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter account name"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    required
                    label="Primary Phone"
                    name="cus_phone_no"
                    type="tel"
                    value={formData.cus_phone_no}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter primary phone number"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Secondary Phone"
                    name="cus_phone_no2"
                    type="tel"
                    value={formData.cus_phone_no2}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter secondary phone number"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Address"
                    name="cus_address"
                    value={formData.cus_address}
                    onChange={handleFormChange}
                    placeholder="Enter complete address"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Second Row - Customer Type, Category */}
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={customerTypes.map(type => ({
                      id: type.cus_type_id,
                      title: type.cus_type_title
                    }))}
                    getOptionLabel={(option) => option.title || ''}
                    value={(() => {
                      return customerTypes.find(option => option.cus_type_id === formData.cus_type)
                        ? { id: formData.cus_type, title: customerTypes.find(option => option.cus_type_id === formData.cus_type).cus_type_title }
                        : null;
                    })()}
                    onChange={(event, newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        cus_type: newValue ? newValue.id : ''
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account Type"
                        required
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 250 }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <PersonIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={customerCategories.map(category => ({
                      id: category.cus_cat_id,
                      title: category.cus_cat_title
                    }))}
                    getOptionLabel={(option) => option.title || ''}
                    value={(() => {
                      return customerCategories.find(option => option.cus_cat_id === formData.cus_category)
                        ? { id: formData.cus_category, title: customerCategories.find(option => option.cus_cat_id === formData.cus_category).cus_cat_title }
                        : null;
                    })()}
                    onChange={(event, newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        cus_category: newValue ? newValue.id : ''
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Account Category"
                        required
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                            const firstCat = customerCategories && customerCategories.length ? customerCategories[0].cus_cat_id : '';
                            if (!formData.cus_category && firstCat) setFormData(prev => ({ ...prev, cus_category: firstCat }));
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <BusinessIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* Third Row - Reference, Account Info, City */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Reference"
                    name="cus_reference"
                    value={formData.cus_reference}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter reference number"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Account Info"
                    name="cus_account_info"
                    value={formData.cus_account_info}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter account information"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <Autocomplete
                    fullWidth
                    autoSelect={true}
                    autoHighlight={true}
                    openOnFocus={true}
                    selectOnFocus={true}
                    options={cities.map(city => ({
                      id: city.city_id,
                      title: city.city_name
                    }))}
                    getOptionLabel={(option) => option.title || ''}
                    value={(() => {
                      return cities.find(option => option.city_id === formData.city_id)
                        ? { id: formData.city_id, title: cities.find(option => option.city_id === formData.city_id).city_name }
                        : null;
                    })()}
                    onChange={(event, newValue) => {
                      setFormData(prev => ({
                        ...prev,
                        city_id: newValue ? newValue.id : ''
                      }));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City"
                        onFocus={(e) => e.target.select()}
                        sx={{ minWidth: 250 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                            const firstCity = cities && cities.length ? cities[0].city_id : '';
                            if (!formData.city_id && firstCity) setFormData(prev => ({ ...prev, city_id: firstCity }));
                          }
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <LocationIcon />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>

                {/* Fourth Row - CNIC, NTN, Balance */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    name="CNIC"
                    value={formData.CNIC}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter CNIC number"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="NTN Number"
                    name="NTN_NO"
                    value={formData.NTN_NO}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter NTN number"
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    disabled
                    label="Initial Balance"
                    name="cus_balance"
                    type="number"
                    inputProps={{ step: "0.01", readOnly: true }}
                    value={formData.cus_balance}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Balance is non-editable"
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <AttachMoneyIcon />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                {/* Fifth Row - Other, Name in Urdu */}
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Other Information"
                    name="other"
                    value={formData.other}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter other information"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name in Urdu"
                    name="name_urdu"
                    value={formData.name_urdu}
                    onChange={handleFormChange}
                    sx={{ minWidth: 250 }}
                    placeholder="Enter name in Urdu"
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={() => setShowCustomerForm(false)} color="primary">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={isSubmitting}
              sx={{ bgcolor: '#6f42c1', '&:hover': { bgcolor: '#5a2d91' } }}
            >
              {isSubmitting ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                editingCustomer ? 'Update Customer' : 'Create Customer'
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Customer Type Popup */}
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
                <BusinessIcon />
              </Avatar>
              <Box>
                <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                  Add Customer Type
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  Create a new Customer type
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
            <Box component="form" onSubmit={handleAddCustomerType} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                required
                label="Customer Type Title"
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
              disabled={isAddingCustomerType}
              onClick={handleAddCustomerType}
              sx={{
                background: 'linear-gradient(45deg, #2196f3 30%, #9c27b0 90%)',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976d2 30%, #7b1fa2 90%)',
                }
              }}
            >
              {isAddingCustomerType ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                  Adding...
                </Box>
              ) : (
                'Add Type'
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Customer Category Popup */}
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
                  Create a new Account category
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
            <Box component="form" onSubmit={handleAddCustomerCategory} sx={{ mt: 2 }}>
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
              disabled={isAddingCustomerCategory}
              onClick={handleAddCustomerCategory}
              sx={{
                background: 'linear-gradient(45deg, #4caf50 30%, #2e7d32 90%)',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(45deg, #388e3c 30%, #1b5e20 90%)',
                }
              }}
            >
              {isAddingCustomerCategory ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                  Adding...
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckIcon sx={{ mr: 1 }} />
                  Add Category
                </Box>
              )}
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
                <LocationIcon />
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
            <Box component="form" onSubmit={handleAddCity} sx={{ mt: 2 }}>
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
              disabled={isAddingCity}
              onClick={handleAddCity}
              sx={{
                background: 'linear-gradient(45deg, #ff9800 30%, #f57c00 90%)',
                textTransform: 'none',
                '&:hover': {
                  background: 'linear-gradient(45deg, #f57c00 30%, #ef6c00 90%)',
                }
              }}
            >
              {isAddingCity ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                  Adding...
                </Box>
              ) : (
                'Add City'
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </div>

      <style jsx global>{`
        .blink-button-strong {
          animation: pulseStrong 1400ms infinite cubic-bezier(.2,.9,.2,1);
          will-change: transform, box-shadow, filter;
        }

        @keyframes pulseStrong {
          0% { transform: translateY(0) scale(1); box-shadow: 0 8px 20px rgba(139,0,0,0.18); filter: drop-shadow(0 6px 18px rgba(139,0,0,0.12)); }
          45% { transform: translateY(-4px) scale(1.03); box-shadow: 0 18px 40px rgba(139,0,0,0.28); filter: drop-shadow(0 12px 30px rgba(139,0,0,0.18)); }
          100% { transform: translateY(0) scale(1); box-shadow: 0 8px 20px rgba(139,0,0,0.18); filter: drop-shadow(0 6px 18px rgba(139,0,0,0.12)); }
        }

        /* Slight border pulse for attention */
        .blink-button-strong::after {
          content: '';
          position: absolute;
          left: 12px;
          right: 12px;
          top: 6px;
          bottom: 6px;
          border-radius: 12px;
          pointer-events: none;
          box-shadow: 0 0 0 0 rgba(139,0,0,0.12);
          animation: ring 2000ms infinite ease-out;
        }

        /* glossy shine removed — flat single red color per design */
        .shiny-button::before { display: none; }

        @keyframes ring {
          0% { box-shadow: 0 0 0 0 rgba(139,0,0,0.18); }
          70% { box-shadow: 0 10px 40px 12px rgba(139,0,0,0.06); }
          100% { box-shadow: 0 0 0 0 rgba(139,0,0,0); }
        }

        /* Respect reduced-motion preference */
        @media (prefers-reduced-motion: reduce) {
          .blink-button-strong, .blink-button-strong::after { animation: none !important; box-shadow: none !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
