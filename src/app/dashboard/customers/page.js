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
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Check, X, Phone, Mail, MapPin, User, Building, CreditCard, Calendar, Search, Loader2, Users, TrendingUp, TrendingDown, Wallet, DollarSign, Filter, ArrowUp, ArrowUpDown, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal, ExternalLink, Tag, FileText, Languages, Info, Hash, Sparkles } from 'lucide-react';
import { Fragment } from 'react';
import DashboardLayout from '../components/dashboard-layout';
import { openAccountLedgerTab, FINANCE_LEDGER_PATH } from '@/lib/ledger-tabs';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const EMPTY_CUSTOMER_FORM = {
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
  city_id: '',
};

export default function CustomersPage() {
  const router = useRouter();
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
  const [formData, setFormData] = useState({ ...EMPTY_CUSTOMER_FORM });

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
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  // Print
  const tableRef = useRef(null);

  // Snackbar states
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  const openNewCustomerForm = () => {
    setEditingCustomer(null);
    setFormData({ ...EMPTY_CUSTOMER_FORM });
    setShowCustomerForm(true);
  };

  // Load configuration details from API on mount
  useEffect(() => {
    fetchStaticData();
  }, []);

  // Header "Add Customer" → ?action=add or open-customer-form event
  useEffect(() => {
    const openFromHeader = () => openNewCustomerForm();

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'add') {
        openFromHeader();
        params.delete('action');
        const qs = params.toString();
        window.history.replaceState(
          null,
          '',
          qs ? `/dashboard/customers?${qs}` : '/dashboard/customers'
        );
      }
    }

    window.addEventListener('open-customer-form', openFromHeader);
    return () => window.removeEventListener('open-customer-form', openFromHeader);
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
    if (sortBy !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 opacity-40" />;
    }
    return sortOrder === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-blue-600" />
      : <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-blue-600 rotate-180" />;
  };

  const activeFilterCount = [
    debouncedSearch,
    debouncedMinAmount,
    typeFilter !== 'all',
    categoryFilter !== 'all',
    balanceFilter !== 'all',
    activityFilter !== 'all',
  ].filter(Boolean).length;

  const setQuickBalanceFilter = (value) => {
    setBalanceFilter((prev) => (prev === value ? 'all' : value));
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
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (title.includes('supplier')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (title.includes('bank')) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
    if (title.includes('transport')) {
      return 'bg-teal-100 text-teal-800 border-teal-200';
    }
    if (title.includes('builders') || title.includes('iron')) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (title) {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getBalanceColor = (balance) => {
    const bal = parseFloat(balance);
    if (bal > 0) return 'text-green-600';
    if (bal < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getActivityRowClass = (customer) => {
    const balance = parseFloat(customer.cus_balance);
    if (balance <= 0) return 'bg-white hover:bg-slate-50';
    const now = new Date();
    const lastActivity = customer.updated_at ? new Date(customer.updated_at) : new Date(customer.created_at);
    const diffDays = (now - lastActivity) / (1000 * 60 * 60 * 24);
    if (diffDays <= 30) return 'bg-emerald-50/80 hover:bg-emerald-100/80';
    if (diffDays <= 90) return 'bg-blue-50/80 hover:bg-blue-100/80';
    if (diffDays <= 180) return 'bg-amber-50/80 hover:bg-amber-100/80';
    return 'bg-rose-50/80 hover:bg-rose-100/80';
  };

  const getBalanceMeta = (balance) => {
    const bal = parseFloat(balance) || 0;
    if (bal > 0) {
      return {
        amountClass: 'text-emerald-700',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        label: 'Receivable',
      };
    }
    if (bal < 0) {
      return {
        amountClass: 'text-rose-700',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        label: 'Payable',
      };
    }
    return {
      amountClass: 'text-slate-500',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      label: 'Settled',
    };
  };

  const handleOpenLedger = (customer, e) => {
    if (e) e.stopPropagation();
    if (!customer?.cus_id) return;
    openAccountLedgerTab(customer.cus_id, customer.cus_name);
    router.push(FINANCE_LEDGER_PATH);
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

  // Get customer type title from ID
  const getCustomerTypeTitle = (typeId) => {
    const customerType = customerTypes.find(type => type.cus_type_id === typeId);
    return customerType ? customerType.cus_type_title : typeId || 'Unknown';
  };

  const showingFrom = totalCustomers === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, totalCustomers);

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
      <div className="w-full bg-slate-100 pb-6">
        {/* Top actions — New Account left (original position), Print right */}
        <div className="px-4 sm:px-6 pt-2 md:pt-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="contained"
              onClick={openNewCustomerForm}
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
                overflow: 'visible',
              }}
              aria-label="Create new account"
            >
              New Account
            </Button>
            <Button
              variant="outlined"
              onClick={handlePrint}
              startIcon={<span style={{ fontSize: 18 }}>🖨️</span>}
              sx={{
                borderColor: '#3b82f6',
                color: '#3b82f6',
                fontWeight: 700,
                borderRadius: 2,
                px: 3,
                py: 1.25,
                '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb' },
              }}
            >
              Print List
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex-shrink-0 px-4 sm:px-6 pt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { title: 'Total Accounts', val: totalCustomers, color: 'blue', icon: Users, currency: false },
              { title: 'Receivables', val: totalReceivables, color: 'emerald', icon: TrendingUp, currency: true },
              { title: 'Payables', val: totalPayables, color: 'rose', icon: TrendingDown, currency: true },
              { title: 'Net Balance', val: netBalance, color: 'amber', icon: Wallet, currency: true },
            ].map((stat) => {
              const Icon = stat.icon;
              const colorMap = {
                blue: 'from-blue-50 to-indigo-100 border-blue-200 text-blue-800',
                emerald: 'from-emerald-50 to-teal-100 border-emerald-200 text-emerald-800',
                rose: 'from-rose-50 to-red-100 border-rose-200 text-rose-800',
                amber: 'from-amber-50 to-orange-100 border-amber-200 text-amber-900',
              };
              return (
                <div key={stat.title} className={`bg-gradient-to-br ${colorMap[stat.color]} border rounded-2xl p-4 shadow-sm`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider opacity-70">{stat.title}</p>
                    <Icon className="w-4 h-4 opacity-60" />
                  </div>
                  <p className="text-xl sm:text-2xl font-black mt-2 tabular-nums">
                    {stat.currency && <span className="text-xs font-semibold opacity-60 mr-1">Rs.</span>}
                    {stat.val.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-3">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-800">Search &amp; Filters</span>
                {activeFilterCount > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersExpanded((p) => !p)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {filtersExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {filtersExpanded ? 'Hide' : 'Show'} filters
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-4 space-y-4">
              {/* Main Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, phone, address, reference, city, or balance (e.g. 50000)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              {/* Quick balance chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mr-1">Quick:</span>
                {[
                  { id: 'positive', label: 'Receivable (+)', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
                  { id: 'negative', label: 'Payable (−)', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
                  { id: 'zero', label: 'Zero Balance', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
                  { id: 'non-zero', label: 'Has Balance', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
                ].map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setQuickBalanceFilter(chip.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                      balanceFilter === chip.id ? `${chip.cls} ring-2 ring-offset-1 ring-blue-400` : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {filtersExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 pt-1">
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'all', label: 'All Types' },
                      ...customerTypes.map((type) => ({ value: type.cus_type_id, label: type.cus_type_title })),
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={(() => {
                      if (typeFilter === 'all') return { value: 'all', label: 'All Types' };
                      const selected = customerTypes.find((type) => type.cus_type_id === typeFilter);
                      return selected ? { value: selected.cus_type_id, label: selected.cus_type_title } : { value: 'all', label: 'All Types' };
                    })()}
                    onChange={(event, newValue) => setTypeFilter(newValue ? newValue.value : 'all')}
                    renderInput={(params) => (
                      <TextField {...params} label="Account Type" placeholder="All types" />
                    )}
                  />
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'all', label: 'All Categories' },
                      ...customerCategories.map((category) => ({ value: category.cus_cat_title, label: category.cus_cat_title })),
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{ value: categoryFilter, label: categoryFilter === 'all' ? 'All Categories' : categoryFilter }}
                    onChange={(event, newValue) => setCategoryFilter(newValue ? newValue.value : 'all')}
                    renderInput={(params) => (
                      <TextField {...params} label="Category" placeholder="All categories" />
                    )}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Min Balance"
                    placeholder="e.g. 50000"
                    type="number"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <TrendingUp size={16} className="text-slate-400" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'all', label: 'All Balances' },
                      { value: 'positive', label: 'Positive (+)' },
                      { value: 'negative', label: 'Negative (−)' },
                      { value: 'zero', label: 'Zero' },
                      { value: 'non-zero', label: 'Non-Zero' },
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{
                      value: balanceFilter,
                      label:
                        balanceFilter === 'all' ? 'All Balances' :
                        balanceFilter === 'positive' ? 'Positive (+)' :
                        balanceFilter === 'negative' ? 'Negative (−)' :
                        balanceFilter === 'zero' ? 'Zero' :
                        balanceFilter === 'non-zero' ? 'Non-Zero' : 'All Balances',
                    }}
                    onChange={(event, newValue) => setBalanceFilter(newValue ? newValue.value : 'all')}
                    renderInput={(params) => (
                      <TextField {...params} label="Balance Status" />
                    )}
                  />
                  <Autocomplete
                    fullWidth
                    size="small"
                    options={[
                      { value: 'all', label: 'All Activity' },
                      { value: '1month', label: '≤ 1 Month' },
                      { value: '1to3months', label: '1–3 Months' },
                      { value: '3to6months', label: '3–6 Months' },
                      { value: 'over6months', label: '> 6 Months' },
                    ]}
                    getOptionLabel={(option) => option.label}
                    value={{
                      value: activityFilter,
                      label:
                        activityFilter === 'all' ? 'All Activity' :
                        activityFilter === '1month' ? '≤ 1 Month' :
                        activityFilter === '1to3months' ? '1–3 Months' :
                        activityFilter === '3to6months' ? '3–6 Months' :
                        activityFilter === 'over6months' ? '> 6 Months' : 'All Activity',
                    }}
                    onChange={(event, newValue) => setActivityFilter(newValue ? newValue.value : 'all')}
                    renderInput={(params) => (
                      <TextField {...params} label="Last Activity" />
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Accounts Table */}
        <div className="px-4 sm:px-6 pb-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Accounts List</h2>
                <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {totalCustomers} total
                </span>
                {isFetching && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
              </div>
              <p className="text-xs text-slate-500">
                Showing {showingFrom}–{showingTo} of {totalCustomers} · Page {page} of {totalPages}
              </p>
            </div>

            <div className="overflow-x-auto relative" ref={tableRef}>
              {isFetching && (
                <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              )}

              <table className="w-full text-sm border-collapse min-w-[960px]">
                <thead className="sticky top-0 z-[1]">
                  <tr className="bg-slate-900 text-slate-100 text-[11px] font-bold uppercase tracking-wider">
                    <th className="px-3 py-3 w-12 text-center border-r border-slate-800">#</th>
                    <th
                      className="px-4 py-3 text-left border-r border-slate-800 cursor-pointer select-none"
                      onClick={() => handleSort('cus_name')}
                    >
                      <span className="inline-flex items-center gap-1">Account Name {renderSortIndicator('cus_name')}</span>
                    </th>
                    <th className="px-4 py-3 text-left border-r border-slate-800 w-44">Phone</th>
                    <th className="px-4 py-3 text-left border-r border-slate-800 min-w-[140px]">Address</th>
                    <th className="px-4 py-3 text-center border-r border-slate-800 w-28">Type</th>
                    <th className="px-4 py-3 text-left border-r border-slate-800 w-32">Category</th>
                    <th
                      className="px-4 py-3 text-right border-r border-slate-800 w-36 cursor-pointer select-none text-blue-300"
                      onClick={() => handleSort('cus_balance')}
                    >
                      <span className="inline-flex items-center justify-end gap-1 w-full">Balance {renderSortIndicator('cus_balance')}</span>
                    </th>
                    <th
                      className="px-4 py-3 text-center border-r border-slate-800 w-28 cursor-pointer select-none"
                      onClick={() => handleSort('created_at')}
                    >
                      <span className="inline-flex items-center justify-center gap-1">Created {renderSortIndicator('created_at')}</span>
                    </th>
                    <th className="px-3 py-3 text-center w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.length === 0 && !isFetching ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-16 text-center">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700">No accounts found</p>
                        <p className="text-xs text-slate-400 mt-1">Try changing search or filters</p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => {
                      const balanceMeta = getBalanceMeta(customer.cus_balance);
                      const typeTitle = getCustomerTypeTitle(customer.cus_type);
                      const categoryTitle = customer.customer_category?.cus_cat_title || customer.cus_category || '—';
                      const typeClass = getTypeColor(customer.cus_type);

                      return (
                        <tr
                          key={customer.cus_id}
                          className={`transition-colors ${getActivityRowClass(customer)}`}
                        >
                          <td className="px-3 py-3 text-center text-xs font-semibold text-slate-400 border-r border-slate-100/80">
                            {customer.sequentialId}
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100/80">
                            <div className="flex items-center gap-3 min-w-[180px]">
                              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-sm flex items-center justify-center shadow-sm">
                                {(customer.cus_name || '?').charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenLedger(customer, e)}
                                  className="font-bold text-slate-900 text-sm leading-snug text-left hover:text-blue-700 hover:underline block w-full truncate"
                                  title={`Open ledger: ${customer.cus_name}`}
                                >
                                  {customer.cus_name || '—'}
                                </button>
                                {customer.name_urdu && (
                                  <p className="text-xs text-slate-500 truncate mt-0.5" dir="rtl">{customer.name_urdu}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                                  <span className="text-[10px] font-semibold text-slate-400">ID {customer.cus_id}</span>
                                  {customer.cus_reference && (
                                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                      Ref: {customer.cus_reference}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100/80">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-slate-800 tabular-nums">
                                  {customer.cus_phone_no || '—'}
                                </span>
                              </div>
                              {customer.cus_phone_no2 && (
                                <div className="flex items-center gap-1.5 text-slate-500">
                                  <Phone className="w-3 h-3 flex-shrink-0 opacity-60" />
                                  <span className="text-xs tabular-nums">{customer.cus_phone_no2}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100/80">
                            <div className="flex items-start gap-1.5 max-w-[200px]">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-slate-600 leading-relaxed line-clamp-2" title={customer.cus_address || ''}>
                                {customer.cus_address || customer.city?.city_name || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center border-r border-slate-100/80">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${typeClass}`}>
                              {typeTitle}
                            </span>
                          </td>
                          <td className="px-4 py-3 border-r border-slate-100/80">
                            <span className="text-xs font-semibold text-slate-700">{categoryTitle}</span>
                          </td>
                          <td className="px-4 py-3 text-right border-r border-slate-100/80 tabular-nums">
                            <p className={`font-black text-base ${balanceMeta.amountClass}`}>
                              Rs. {fmtAmt(customer.cus_balance)}
                            </p>
                            <span className={`inline-block mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${balanceMeta.badgeClass}`}>
                              {balanceMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center border-r border-slate-100/80">
                            <span className="text-xs font-medium text-slate-600 whitespace-nowrap">
                              {formatDatePK(customer.created_at)}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenLedger(customer)}
                                title="Open ledger"
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCustomer(customer)}
                                title="Edit account"
                                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(customer.cus_id)}
                                title="Delete account"
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {customers.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-bold text-xs">
                      <td colSpan={6} className="px-4 py-3 text-right uppercase tracking-wider border-r border-slate-700 text-slate-300">
                        Page total ({customers.length} shown)
                      </td>
                      <td className="px-4 py-3 text-right border-r border-slate-700 tabular-nums">
                        <span className={`font-black text-base ${getBalanceMeta(customers.reduce((s, c) => s + parseFloat(c.cus_balance || 0), 0)).amountClass}`}>
                          Rs. {fmtAmt(customers.reduce((s, c) => s + parseFloat(c.cus_balance || 0), 0))}
                        </span>
                      </td>
                      <td colSpan={2} className="px-4 py-3" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <Box sx={{ borderTop: 1, borderColor: 'divider', px: 3, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, bgcolor: '#f8fafc' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {customers.length} on this page · {totalCustomers} total accounts
                </Typography>
              </Box>

              <Pagination
                count={totalPages}
                page={page}
                onChange={(event, value) => setPage(value)}
                color="primary"
                showFirstButton
                showLastButton
                siblingCount={1}
                boundaryCount={1}
              />
            </Box>
          </div>
        </div>

        {/* Activity legend */}
        <div className="px-4 sm:px-6 pb-2">
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium">
            <span className="font-bold text-slate-600">Row colors (receivable accounts):</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-green-200 mr-1 align-middle" />≤ 1 month</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-blue-200 mr-1 align-middle" />1–3 months</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-200 mr-1 align-middle" />3–6 months</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-red-200 mr-1 align-middle" />&gt; 6 months</span>
          </div>
        </div>

        {/* Add / Edit Customer Modal Form */}
        <Dialog
          open={showCustomerForm}
          onClose={() => setShowCustomerForm(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              maxWidth: 820,
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              border: '1px solid #cbd5e1'
            }
          }}
        >
          <DialogTitle sx={{
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
            borderTop: '4px solid #6366f1',
            color: 'white',
            px: 3, py: 2.2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8 }}>
              <Avatar sx={{
                bgcolor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.2)',
                width: 42, height: 42,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}>
                <PersonIcon sx={{ fontSize: 24, color: '#fff' }} />
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  {editingCustomer ? 'Edit Customer Account' : 'Add New Customer Account'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.8rem' }}>
                  {editingCustomer ? 'Update customer profile information' : 'Create a new customer profile and ledger account'}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => setShowCustomerForm(false)}
              sx={{ color: 'white', opacity: 0.8, '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 0.5 }}>
              
              {/* Quick Actions Bar */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5, 
                bgcolor: '#ffffff', 
                py: 1.2, px: 2, 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                flexWrap: 'wrap'
              }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 0.6, fontSize: '0.85rem' }}>
                  <Sparkles size={16} color="#4f46e5" /> Quick Add:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<BusinessIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setShowCustomerCategoryPopup(true)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', bgcolor: '#f0fdf4', borderColor: '#a7f3d0', color: '#047857', px: 1.5, py: 0.4, '&:hover': { bgcolor: '#dcfce7', borderColor: '#10b981' } }}>
                    + Category
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<PersonIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setShowCustomerTypePopup(true)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', bgcolor: '#f5f3ff', borderColor: '#ddd6fe', color: '#6d28d9', px: 1.5, py: 0.4, '&:hover': { bgcolor: '#ede9fe', borderColor: '#8b5cf6' } }}>
                    + Type
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<LocationIcon sx={{ fontSize: '16px !important' }} />} onClick={() => setShowCityPopup(true)}
                    sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', bgcolor: '#fffbeb', borderColor: '#fde68a', color: '#b45309', px: 1.5, py: 0.4, '&:hover': { bgcolor: '#fef3c7', borderColor: '#f59e0b' } }}>
                    + City
                  </Button>
                </Box>
              </Box>

              {/* Strict 2-Column CSS Grid Layout */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2.2 }}>
                {/* Row 1 */}
                <TextField
                  fullWidth
                  required
                  label="Account Name"
                  name="cus_name"
                  value={formData.cus_name}
                  onChange={handleFormChange}
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
                          <User size={16} color="#4f46e5" />
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
                  value={formData.cus_phone_no}
                  onChange={handleFormChange}
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
                          <Phone size={16} color="#475569" />
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
                  value={formData.cus_phone_no2}
                  onChange={handleFormChange}
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
                          <Phone size={16} color="#94a3b8" />
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
                  value={formData.cus_address}
                  onChange={handleFormChange}
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
                          <MapPin size={16} color="#475569" />
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
                      placeholder="Select category"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                          const firstCat = customerCategories && customerCategories.length ? customerCategories[0].cus_cat_id : '';
                          if (!formData.cus_category && firstCat) setFormData(prev => ({ ...prev, cus_category: firstCat }));
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
                              <Building size={16} color="#059669" />
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
                              <User size={16} color="#7c3aed" />
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
                      placeholder="Select city"
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && params.inputProps?.ariaExpanded) {
                          const firstCity = cities && cities.length ? cities[0].city_id : '';
                          if (!formData.city_id && firstCity) setFormData(prev => ({ ...prev, city_id: firstCity }));
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
                              <MapPin size={16} color="#d97706" />
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
                  value={formData.cus_reference}
                  onChange={handleFormChange}
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
                          <Tag size={16} color="#0284c7" />
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
                  value={formData.CNIC}
                  onChange={handleFormChange}
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
                          <CreditCard size={16} color="#e11d48" />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="NTN Number"
                  name="NTN_NO"
                  value={formData.NTN_NO}
                  onChange={handleFormChange}
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
                          <Hash size={16} color="#0d9488" />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Row 6 - Initial Balance & Account Info */}
                <TextField
                  fullWidth
                  disabled={!!editingCustomer}
                  label={editingCustomer ? 'Account Balance' : 'Opening Balance'}
                  name="cus_balance"
                  type="number"
                  inputProps={{ step: '0.01', ...(editingCustomer ? { readOnly: true } : {}) }}
                  value={formData.cus_balance}
                  onChange={handleFormChange}
                  placeholder={editingCustomer ? 'Use ledger to adjust balance' : '0 — optional'}
                  helperText={editingCustomer ? 'Balance is managed via ledger transactions' : 'Set starting balance when creating the account'}
                  sx={{
                    bgcolor: editingCustomer ? '#f8fafc' : '#ffffff',
                    borderRadius: '10px',
                    '& .MuiFormLabel-asterisk': { color: '#ef4444 !important', fontWeight: 700 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '10px',
                      backgroundColor: editingCustomer ? '#f8fafc' : '#ffffff',
                      fontSize: '0.9rem',
                      '& fieldset': { borderColor: editingCustomer ? '#e2e8f0' : '#cbd5e1', borderWidth: '1.5px' },
                      ...(!editingCustomer && {
                        '&:hover fieldset': { borderColor: '#818cf8' },
                        '&.Mui-focused fieldset': { borderColor: '#16a34a', borderWidth: '2px', boxShadow: '0 0 0 3.5px rgba(22, 163, 74, 0.12)' },
                      }),
                    },
                    '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 500, ...(!editingCustomer && { '&.Mui-focused': { color: '#16a34a', fontWeight: 700 } }) }
                  }}
                  InputProps={{
                    readOnly: !!editingCustomer,
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 0.8 }}>
                        <Box sx={{ width: 30, height: 30, borderRadius: '7px', bgcolor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <DollarSign size={16} color="#16a34a" />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Account Info"
                  name="cus_account_info"
                  value={formData.cus_account_info}
                  onChange={handleFormChange}
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
                          <Info size={16} color="#2563eb" />
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
                  value={formData.name_urdu}
                  onChange={handleFormChange}
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
                          <Languages size={16} color="#9333ea" />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />

                <TextField
                  fullWidth
                  label="Other Information"
                  name="other"
                  value={formData.other}
                  onChange={handleFormChange}
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
                          <FileText size={16} color="#475569" />
                        </Box>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 2.2, bgcolor: '#ffffff', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, fontSize: '0.82rem' }}>
              Fields marked with <span style={{ color: '#ef4444', fontWeight: 700 }}>*</span> are required
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button onClick={() => setShowCustomerForm(false)} sx={{ color: '#64748b', fontWeight: 600, px: 3, py: 1, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#f1f5f9' } }}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                variant="contained"
                disabled={isSubmitting}
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
                {isSubmitting ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  editingCustomer ? 'Update Customer' : 'Create Customer'
                )}
              </Button>
            </Box>
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
