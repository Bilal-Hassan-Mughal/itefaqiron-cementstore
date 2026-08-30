'use client';

import { useState, useEffect, Fragment } from 'react';
import { Package, Search, Filter, ArrowUp, LayoutGrid, Clock, ListChecks, DollarSign, AlertTriangle, TrendingUp, Plus, Edit, Trash2, X, ChevronDown, Tag, Folder, Boxes } from 'lucide-react';
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
  Divider
} from '@mui/material';

// Material Icons
import {

  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Inventory as PackageIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  FilterList as FilterIcon,
  AttachMoney as DollarIcon,
  Numbers as HashIcon,
  CalendarToday as CalendarIcon,
  LocalOffer as TagIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  TrendingUp as TrendingUpIcon,
  Warning as AlertIcon,
  Star as StarIcon,
  Visibility as EyeIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ProductsPage() {
  // State management
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [stockFilter, setStockFilter] = useState('all');

  // Keyboard navigation states for Category/Subcategory Autocomplete
  const [categoryInput, setCategoryInput] = useState('');
  const [subcategoryInput, setSubcategoryInput] = useState('');
  const [categoryHighlighted, setCategoryHighlighted] = useState(null);
  const [subcategoryHighlighted, setSubcategoryHighlighted] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [subcategoryOpen, setSubcategoryOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    pro_title: '',
    pro_description: '',
    pro_cost_price: '',
    pro_sale_price: '',
    pro_baser_price: '',
    pro_crate: '',
    pro_stock_qnty: '',
    low_stock_quantity: '',
    pro_unit: '',
    pro_packing: '',
    cat_id: '',
    sub_cat_id: '',
    store_id: ''
  });

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Quick action states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ cat_name: '' });
  const [subcategoryFormData, setSubcategoryFormData] = useState({ sub_cat_name: '', cat_id: '' });

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes, subcategoriesRes, storesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/categories'),
        fetch('/api/subcategories'),
        fetch('/api/stores')
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData);
      }
      if (subcategoriesRes.ok) {
        const subcategoriesData = await subcategoriesRes.json();
        setSubcategories(subcategoriesData);
      }
      if (storesRes.ok) {
        const storesData = await storesRes.json();
        if (storesData.success && Array.isArray(storesData.data)) {
          setStores(storesData.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching data',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const getFilteredSubcategories = () => {
    if (!selectedCategory) return subcategories;
    return subcategories.filter(sub => sub.cat_id === selectedCategory);
  };

  // Get subcategories for the form based on selected category in form
  const getFormSubcategories = () => {
    if (!formData.cat_id) return subcategories;
    return subcategories.filter(sub => sub.cat_id === formData.cat_id);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newProduct = await response.json();
        setProducts(prev => [...prev, newProduct]);
        setShowProductForm(false);
        setFormData({
          pro_title: '',
          pro_description: '',
          pro_cost_price: '',
          pro_sale_price: '',
          pro_baser_price: '',
          pro_crate: '',
          pro_stock_qnty: '',
          low_stock_quantity: '',
          pro_unit: '',
          pro_packing: '',
          cat_id: '',
          sub_cat_id: '',
          store_id: ''
        });
        setSnackbar({
          open: true,
          message: 'Product added successfully!',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to create product',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error creating product:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create product',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setFormData({
      pro_title: product.pro_title || '',
      pro_description: product.pro_description || '',
      pro_cost_price: product.pro_cost_price || '',
      pro_sale_price: product.pro_sale_price || '',
      pro_baser_price: product.pro_baser_price || '',
      pro_crate: product.pro_crate || '',
      pro_stock_qnty: product.pro_stock_qnty || '',
      low_stock_quantity: product.low_stock_quantity || '',
      pro_unit: product.pro_unit || '',
      pro_packing: product.pro_packing || '',
      cat_id: product.cat_id || '',
      sub_cat_id: product.sub_cat_id || '',
      store_id: product.store_stocks?.[0]?.store_id || ''
    });
    // Populate Category and Subcategory input states
    const category = categories.find(c => c.cat_id === product.cat_id);
    const subcategory = subcategories.find(s => s.sub_cat_id === product.sub_cat_id);
    if (category) setCategoryInput(category.cat_name);
    if (subcategory) setSubcategoryInput(subcategory.sub_cat_name);
    setShowProductForm(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingProduct.pro_id,
          ...formData
        }),
      });

      if (response.ok) {
        const updatedProduct = await response.json();
        setProducts(prev => prev.map(product =>
          product.pro_id === editingProduct.pro_id ? updatedProduct : product
        ));
        setShowProductForm(false);
        setEditingProduct(null);
        setFormData({
          pro_title: '',
          pro_description: '',
          pro_cost_price: '',
          pro_sale_price: '',
          pro_baser_price: '',
          pro_crate: '',
          pro_stock_qnty: '',
          low_stock_quantity: '',
          pro_unit: '',
          pro_packing: '',
          cat_id: '',
          sub_cat_id: '',
          store_id: ''
        });
        setSnackbar({
          open: true,
          message: 'Product updated successfully!',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to update product',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating product:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update product',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/products?id=${productId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setProducts(prev => prev.filter(product => product.pro_id !== productId));
          setSnackbar({
            open: true,
            message: 'Product deleted successfully!',
            severity: 'success'
          });
        } else {
          const error = await response.json();
          setSnackbar({
            open: true,
            message: error.error || 'Failed to delete product',
            severity: 'error'
          });
        }
      } catch (error) {
        console.error('Error deleting product:', error);
        setSnackbar({
          open: true,
          message: 'Failed to delete product',
          severity: 'error'
        });
      }
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // When purchase cost changes, auto-sync cost price
      ...(name === 'pro_crate' ? { pro_cost_price: value } : {})
    }));
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle Tab key on Category field (select highlighted option and move to Subcategory)
  const handleCategoryKeyDown = (e) => {
    if (e.key === 'Tab' && categoryOpen) {
      e.preventDefault();
      
      // Select the highlighted option
      if (categoryHighlighted) {
        setFormData(prev => ({
          ...prev,
          cat_id: categoryHighlighted.cat_id,
          sub_cat_id: '' // Reset subcategory when category changes
        }));
        setCategoryInput(categoryHighlighted.cat_name);
      } else if (categories.length > 0) {
        // If no highlighted, select first match
        const firstMatch = categories.find(c => c.cat_name.toLowerCase().includes(categoryInput.toLowerCase())) || categories[0];
        setFormData(prev => ({
          ...prev,
          cat_id: firstMatch.cat_id,
          sub_cat_id: ''
        }));
        setCategoryInput(firstMatch.cat_name);
      }
      
      setCategoryOpen(false);
      
      // Auto-focus and auto-open Subcategory after a brief delay
      setTimeout(() => {
        const subcategoryInput = document.querySelector('[data-field="subcategoryAutocomplete"] input');
        if (subcategoryInput) {
          subcategoryInput.focus();
          setSubcategoryOpen(true);
        }
      }, 50);
    }
  };

  // Handle Tab key on Subcategory field (select highlighted option and close)
  const handleSubcategoryKeyDown = (e) => {
    if (e.key === 'Tab' && subcategoryOpen) {
      e.preventDefault();
      
      // Select the highlighted option
      if (subcategoryHighlighted) {
        setFormData(prev => ({
          ...prev,
          sub_cat_id: subcategoryHighlighted.sub_cat_id
        }));
        setSubcategoryInput(subcategoryHighlighted.sub_cat_name);
      } else {
        const formSubcats = getFormSubcategories();
        if (formSubcats.length > 0) {
          const firstMatch = formSubcats.find(s => s.sub_cat_name.toLowerCase().includes(subcategoryInput.toLowerCase())) || formSubcats[0];
          setFormData(prev => ({
            ...prev,
            sub_cat_id: firstMatch.sub_cat_id
          }));
          setSubcategoryInput(firstMatch.sub_cat_name);
        }
      }
      
      setSubcategoryOpen(false);
      
      // Move focus to next field (Purchase Cost - first pricing field)
      setTimeout(() => {
        const purchaseCostInput = document.querySelector('input[name="pro_crate"]');
        if (purchaseCostInput) {
          purchaseCostInput.focus();
        }
      }, 50);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!formData.pro_title.trim()) {
      setSnackbar({
        open: true,
        message: 'Product title is required',
        severity: 'error'
      });
      return;
    }

    if (!formData.cat_id) {
      setSnackbar({
        open: true,
        message: 'Please select a category',
        severity: 'error'
      });
      return;
    }

    if (parseFloat(formData.pro_stock_qnty) > 0 && !formData.store_id) {
      setSnackbar({
        open: true,
        message: 'Please select a store for the initial stock quantity',
        severity: 'error'
      });
      return;
    }

    if (editingProduct) {
      await handleUpdateProduct(e);
    } else {
      await handleAddProduct(e);
    }
  };

  const handleCloseDialog = () => {
    setShowProductForm(false);
    setEditingProduct(null);
    setFormData({
      pro_title: '',
      pro_description: '',
      pro_cost_price: '',
      pro_sale_price: '',
      pro_baser_price: '',
      pro_crate: '',
      pro_stock_qnty: '',
      pro_unit: '',
      pro_packing: '',
      cat_id: '',
      sub_cat_id: '',
      store_id: ''
    });
    // Clear Category and Subcategory input states
    setCategoryInput('');
    setSubcategoryInput('');
    setCategoryHighlighted(null);
    setSubcategoryHighlighted(null);
    setCategoryOpen(false);
    setSubcategoryOpen(false);
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Quick action handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.cat_name.trim()) {
      setSnackbar({
        open: true,
        message: 'Category name is required',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryFormData)
      });

      if (response.ok) {
        const newCategory = await response.json();
        setSnackbar({
          open: true,
          message: 'Category added successfully',
          severity: 'success'
        });
        setCategoryFormData({ cat_name: '' });
        setShowCategoryForm(false);
        // Update categories dropdown locally
        setCategories(prev => [...prev, newCategory]);
      } else {
        throw new Error('Failed to add category');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error adding category',
        severity: 'error'
      });
    }
  };

  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    if (!subcategoryFormData.sub_cat_name.trim() || !subcategoryFormData.cat_id) {
      setSnackbar({
        open: true,
        message: 'Subcategory name and category are required',
        severity: 'error'
      });
      return;
    }

    try {
      const response = await fetch('/api/subcategories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subcategoryFormData)
      });

      if (response.ok) {
        const newSubcategory = await response.json();
        setSnackbar({
          open: true,
          message: 'Subcategory added successfully',
          severity: 'success'
        });
        setSubcategoryFormData({ sub_cat_name: '', cat_id: '' });
        setShowSubcategoryForm(false);
        // Update subcategories dropdown locally
        setSubcategories(prev => [...prev, newSubcategory]);
      } else {
        throw new Error('Failed to add subcategory');
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Error adding subcategory',
        severity: 'error'
      });
    }
  };

  // Filter and sort products
  const filteredAndSortedProducts = products
    .filter(product => {
      const matchesSearch = product.pro_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.pro_description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || product.cat_id === selectedCategory;
      const matchesSubcategory = !selectedSubcategory || product.sub_cat_id === selectedSubcategory;

      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = product.pro_stock_qnty < 10;
      } else if (stockFilter === 'out') {
        matchesStock = product.pro_stock_qnty <= 0;
      }

      return matchesSearch && matchesCategory && matchesSubcategory && matchesStock;
    })
    .sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // Handle date sorting
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle numeric sorting
      if (sortBy === 'pro_cost_price' || sortBy === 'pro_sale_price' || sortBy === 'pro_stock_qnty') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    })
    .map((product, index) => ({
      ...product,
      sequentialId: index + 1
    }));

  // Calculate stats
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, product) => sum + (parseFloat(product.pro_cost_price) * parseFloat(product.pro_stock_qnty) || 0), 0);
  const lowStockProducts = products.filter(product => parseFloat(product.pro_stock_qnty) < (product.low_stock_quantity ?? 10)).length;
  const outOfStockProducts = products.filter(product => product.pro_stock_qnty <= 0).length;

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedSubcategory('');
    setSortBy('created_at');
    setSortOrder('desc');
    setStockFilter('all');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress size={80} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Stack spacing={4}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Button
              startIcon={<Plus size={28} />}
              onClick={() => setShowProductForm(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%) !important',
                backgroundSize: '300% 300%',
                backgroundClip: 'padding-box',
                animation: 'gradientShift 4s ease infinite, attentionBlink 2s infinite',
                border: '3px solid transparent',
                borderRadius: '50px',
                borderImage: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.2)) 1',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a67d8 0%, #6b46c1 25%, #e379f2 50%, #e53e3e 75%, #3182ce 100%) !important',
                  transform: 'translateY(-4px) scale(1.08)',
                  boxShadow: `
                    0 30px 60px rgba(102, 126, 234, 0.4),
                    0 20px 40px rgba(118, 75, 162, 0.3),
                    0 15px 30px rgba(245, 87, 108, 0.25),
                    0 10px 20px rgba(79, 172, 254, 0.2),
                    0 0 0 1px rgba(255, 255, 255, 0.1),
                    inset 0 2px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -2px 0 rgba(0, 0, 0, 0.2)
                  `,
                  animation: 'bounce 0.6s ease-in-out, gradientShift 3s ease infinite',
                  borderImage: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(255,255,255,0.3)) 1',
                },
                '&:active': {
                  transform: 'translateY(-2px) scale(1.05)',
                  boxShadow: `
                    0 15px 30px rgba(102, 126, 234, 0.3),
                    0 10px 20px rgba(118, 75, 162, 0.25),
                    0 5px 10px rgba(245, 87, 108, 0.2),
                    inset 0 1px 0 rgba(0, 0, 0, 0.2)
                  `,
                },
                px: 6,
                py: 3,
                fontSize: '1.3rem',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                borderRadius: 50,
                boxShadow: `
                  0 20px 40px rgba(102, 126, 234, 0.25),
                  0 15px 30px rgba(118, 75, 162, 0.2),
                  0 10px 20px rgba(245, 87, 108, 0.15),
                  0 5px 10px rgba(79, 172, 254, 0.1),
                  inset 0 1px 0 rgba(255, 255, 255, 0.2),
                  inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                `,
                minWidth: '250px',
                color: 'white',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  transition: 'left 0.6s ease-in-out',
                },
                '&:hover::before': {
                  left: '100%',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '-3px',
                  left: '-3px',
                  right: '-3px',
                  bottom: '-3px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe)',
                  borderRadius: '53px',
                  zIndex: -1,
                  animation: 'borderGlow 3s ease-in-out infinite alternate',
                  filter: 'blur(10px)',
                  opacity: 0.7,
                },
                '@keyframes gradientShift': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '25%': { backgroundPosition: '100% 0%' },
                  '50%': { backgroundPosition: '100% 100%' },
                  '75%': { backgroundPosition: '0% 100%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
                '@keyframes attentionBlink': {
                  '0%, 15%': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%) !important', transform: 'scale(1)' },
                  '16%, 30%': { background: 'linear-gradient(135deg, #2d3748 0%, #2d1b69 25%, #4a0e4e 50%, #7f1d1d 75%, #1a365d 100%) !important', transform: 'scale(0.98)' },
                  '31%, 45%': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%) !important', transform: 'scale(1)' },
                  '46%, 60%': { background: 'linear-gradient(135deg, #1a202c 0%, #2d1b69 25%, #6b21a8 50%, #9f1239 75%, #1e3a8a 100%) !important', transform: 'scale(0.99)' },
                  '61%, 75%': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%) !important', transform: 'scale(1)' },
                  '76%, 90%': { background: 'linear-gradient(135deg, #4a5568 0%, #553c9a 25%, #7c2d12 50%, #991b1b 75%, #2c5282 100%) !important', transform: 'scale(0.995)' },
                  '91%, 100%': { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%) !important', transform: 'scale(1)' },
                },
                '@keyframes bounce': {
                  '0%, 20%, 50%, 80%, 100%': { transform: 'translateY(-4px) scale(1.08)' },
                  '40%': { transform: 'translateY(-8px) scale(1.12)' },
                  '60%': { transform: 'translateY(-6px) scale(1.1)' },
                },
                '@keyframes borderGlow': {
                  '0%': { opacity: 0.3 },
                  '100%': { opacity: 0.8 },
                },
              }}
            >
              Add New Product
            </Button>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Products Management
              </Typography>
            </Box>
          </Box>

          {/* Premium Filters Section */}
          <Box sx={{ flexShrink: 0, width: '100%' }}>
            <Card sx={{
              borderRadius: 2,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
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
                    md: 'repeat(4, 1fr)'
                  },
                  gap: 3,
                  width: '100%'
                }}>
                  {/* Search */}
                  <Box>
                    <TextField
                      fullWidth
                      label="Search"
                      placeholder="Search products..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start" sx={{ mr: 1 }}>
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

                  {/* Category Filter */}
                  <Box>
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select
                        value={selectedCategory}
                        label="Category"
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setSelectedSubcategory('');
                        }}
                        startAdornment={
                          <InputAdornment position="start" sx={{ mr: 1, ml: -0.5 }}>
                            <Folder size={18} color="#94a3b8" />
                          </InputAdornment>
                        }
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'white',
                        }}
                      >
                        <MenuItem value="">All Categories</MenuItem>
                        {categories.map(category => (
                          <MenuItem key={category.cat_id} value={category.cat_id}>
                            {category.cat_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Subcategory Filter */}
                  <Box>
                    <FormControl fullWidth disabled={!selectedCategory}>
                      <InputLabel>Subcategory</InputLabel>
                      <Select
                        value={selectedSubcategory}
                        label="Subcategory"
                        onChange={(e) => setSelectedSubcategory(e.target.value)}
                        startAdornment={
                          <InputAdornment position="start" sx={{ mr: 1, ml: -0.5 }}>
                            <Boxes size={18} color="#94a3b8" />
                          </InputAdornment>
                        }
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'white',
                        }}
                      >
                        <MenuItem value="">All Subcategories</MenuItem>
                        {getFilteredSubcategories().map(subcategory => (
                          <MenuItem key={subcategory.sub_cat_id} value={subcategory.sub_cat_id}>
                            {subcategory.sub_cat_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Stock Filter */}
                  <Box>
                    <FormControl fullWidth>
                      <InputLabel>Stock Status</InputLabel>
                      <Select
                        value={stockFilter}
                        label="Stock Status"
                        onChange={(e) => setStockFilter(e.target.value)}
                        startAdornment={
                          <InputAdornment position="start" sx={{ mr: 1, ml: -0.5 }}>
                            <Tag size={18} color="#94a3b8" />
                          </InputAdornment>
                        }
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'white',
                        }}
                      >
                        <MenuItem value="all">All Products</MenuItem>
                        <MenuItem value="low">Low Stock</MenuItem>
                        <MenuItem value="out">Out of Stock</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Sort By */}
                  <Box sx={{ gridColumn: { md: 'span 2' } }}>
                    <FormControl fullWidth>
                      <InputLabel>Sort By</InputLabel>
                      <Select
                        value={sortBy}
                        label="Sort By"
                        onChange={(e) => setSortBy(e.target.value)}
                        startAdornment={
                          <InputAdornment position="start" sx={{ mr: 1, ml: -0.5 }}>
                            <Filter size={18} color="#94a3b8" />
                          </InputAdornment>
                        }
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'white',
                        }}
                      >
                        <MenuItem value="pro_title">Product Name</MenuItem>
                        <MenuItem value="pro_cost_price">Cost Price</MenuItem>
                        <MenuItem value="pro_sale_price">Sale Price</MenuItem>
                        <MenuItem value="pro_stock_qnty">Stock Quantity</MenuItem>
                        <MenuItem value="created_at">Created Date</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Sort Order */}
                  <Box sx={{ gridColumn: { md: 'span 2' } }}>
                    <FormControl fullWidth>
                      <InputLabel>Order</InputLabel>
                      <Select
                        value={sortOrder}
                        label="Order"
                        onChange={(e) => setSortOrder(e.target.value)}
                        startAdornment={
                          <InputAdornment position="start" sx={{ mr: 1, ml: -0.5 }}>
                            <ArrowUp size={18} color="#94a3b8" />
                          </InputAdornment>
                        }
                        sx={{
                          borderRadius: 1.5,
                          bgcolor: 'white',
                        }}
                      >
                        <MenuItem value="asc">Ascending</MenuItem>
                        <MenuItem value="desc">Descending</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Box>

          {/* Unified Professional Stats Bar */}
          <Box sx={{ flexShrink: 0, width: '100%' }}>
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
                  { title: 'Total Products', val: totalProducts, color: '#2563eb', bg: '#eff6ff', icon: <Package size={24} />, isCurrency: false },
                  { title: 'Total Value', val: totalValue, color: '#16a34a', bg: '#f0fdf4', icon: <DollarSign size={24} />, isCurrency: true },
                  { title: 'Low Stock', val: lowStockProducts, color: '#d97706', bg: '#fffbeb', icon: <AlertTriangle size={24} />, isCurrency: false },
                  { title: 'Out of Stock', val: outOfStockProducts, color: '#dc2626', bg: '#fef2f2', icon: <Boxes size={24} />, isCurrency: false }
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
                          {stat.val.toLocaleString(undefined, { minimumFractionDigits: stat.isCurrency ? 2 : 0, maximumFractionDigits: stat.isCurrency ? 2 : 0 })}
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

          {/* Products Table */}
          <Card sx={{ height: 600, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc' }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700, color: '#334155' }}>
                Products List
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Showing {filteredAndSortedProducts.length} of {products.length} products
              </Typography>
            </Box>
            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', boxShadow: 'none' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>No</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Store</TableCell>
                    <TableCell>Qty</TableCell>
                    <TableCell>Purchase Rate</TableCell>
                    <TableCell>Crate (CodeRate)</TableCell>
                    <TableCell>Sale Rate</TableCell>
                    <TableCell>Base Rate</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAndSortedProducts.map((product, index) => (
                    <TableRow key={product.pro_id} hover>
                      {/* S. No */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {index + 1}
                        </Typography>
                      </TableCell>

                      {/* Product */}
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {product.pro_title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.pro_description || 'No description'}
                          </Typography>
                        </Box>
                      </TableCell>

                      {/* Store */}
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {product.store_stocks && product.store_stocks.length > 0 ? (
                            product.store_stocks.map(ss => {
                              const storeObj = stores.find(st => st.storeid === ss.store_id);
                              return (
                                <Chip 
                                  key={ss.store_id}
                                  label={`${storeObj ? storeObj.store_name : `Store #${ss.store_id}`}: ${parseFloat(ss.stock_quantity || 0)}`}
                                  size="small"
                                  sx={{ 
                                    fontSize: '0.75rem', 
                                    height: '20px',
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    fontWeight: 500,
                                    border: '1px solid #e2e8f0',
                                    width: 'fit-content'
                                  }}
                                />
                              );
                            })
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: '0.85rem' }}>
                              No stock recorded
                            </Typography>
                          )}
                        </Box>
                      </TableCell>

                      {/* Qty */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {product.pro_stock_qnty} {product.pro_unit || 'units'}
                        </Typography>
                      </TableCell>

                      {/* CRate */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {fmtAmt(product.pro_crate)}
                        </Typography>
                      </TableCell>

                      {/* Purchase Rate */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {parseFloat(((product.pro_cost_price ?? product.pro_baser_price) || 0)).toFixed(2)}
                        </Typography>
                      </TableCell>

                      {/* Sale Rate */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {fmtAmt(product.pro_sale_price)}
                        </Typography>
                      </TableCell>

                      {/* Base Rate */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {fmtAmt(product.pro_baser_price)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Edit Product">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditProduct(product)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Product">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteProduct(product.pro_id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          {/* Product Dialog */}
          <Dialog
            open={showProductForm}
            onClose={handleCloseDialog}
            maxWidth="md"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }
            }}
          >
            <DialogTitle
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #9C27B0 90%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 3
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    mr: 2,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <PackageIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {editingProduct ? 'Update product information' : 'Create a new product in your inventory'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={handleCloseDialog}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
              {/* Quick Action Buttons */}
              <Box sx={{ 
                p: 3, 
                pb: 2,
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap',
                borderBottom: '1px solid #e2e8f0',
                bgcolor: 'white'
              }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCategoryForm(true)}
                  sx={{
                    borderColor: '#2196F3',
                    color: '#2196F3',
                    '&:hover': {
                      borderColor: '#1976D2',
                      backgroundColor: 'rgba(33, 150, 243, 0.04)'
                    }
                  }}
                >
                  Add Category
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setShowSubcategoryForm(true)}
                  sx={{
                    borderColor: '#9C27B0',
                    color: '#9C27B0',
                    '&:hover': {
                      borderColor: '#7B1FA2',
                      backgroundColor: 'rgba(156, 39, 176, 0.04)'
                    }
                  }}
                >
                  Add Subcategory
                </Button>
              </Box>

              <Box component="form" onSubmit={handleSubmit} sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
                {/* SECTION 1: Basic Information */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 700, 
                    color: '#1e293b',
                    mb: 2,
                    pb: 1.5,
                    borderBottom: '2px solid #2196F3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#2196F3' }}></Box>
                    Basic Information
                  </Typography>
                  <Grid container spacing={2.5}>
                    {/* Product Title */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        required
                        label="Product Title"
                        name="pro_title"
                        value={formData.pro_title}
                        onChange={handleFormChange}
                        placeholder="Enter product title"
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Description */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Description"
                        name="pro_description"
                        value={formData.pro_description}
                        onChange={handleFormChange}
                        placeholder="Enter product description"
                        multiline
                        rows={3}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* SECTION 2: Category & Classification */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 700, 
                    color: '#1e293b',
                    mb: 2,
                    pb: 1.5,
                    borderBottom: '2px solid #9C27B0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#9C27B0' }}></Box>
                    Category & Classification
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* Category - Autocomplete with Tab navigation */}
                    <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
                      <Autocomplete
                        openOnFocus
                        autoHighlight
                        selectOnFocus
                        inputValue={categoryInput}
                        onInputChange={(_, v) => setCategoryInput(v)}
                        options={categories}
                        getOptionLabel={(opt) => opt.cat_name || ''}
                        value={categories.find(c => c.cat_id === formData.cat_id) || null}
                        onChange={(_, newVal) => {
                          if (newVal) {
                            setFormData(prev => ({
                              ...prev,
                              cat_id: newVal.cat_id,
                              sub_cat_id: ''
                            }));
                            setCategoryInput(newVal.cat_name);
                          }
                        }}
                        onHighlightChange={(_, option) => setCategoryHighlighted(option)}
                        open={categoryOpen}
                        onOpen={() => setCategoryOpen(true)}
                        onClose={() => setCategoryOpen(false)}
                        onKeyDown={handleCategoryKeyDown}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Category"
                            required
                            placeholder="Select category"
                            data-field="categoryAutocomplete"
                          />
                        )}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '1.1rem',
                            height: '60px',
                            backgroundColor: 'white',
                            px: 2,
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '1.1rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Box>

                    {/* Subcategory - Autocomplete with Tab navigation */}
                    <Box sx={{ flex: '1 1 45%', minWidth: '300px' }}>
                      <Autocomplete
                        openOnFocus
                        autoHighlight
                        selectOnFocus
                        disabled={!formData.cat_id}
                        inputValue={subcategoryInput}
                        onInputChange={(_, v) => setSubcategoryInput(v)}
                        options={getFormSubcategories()}
                        getOptionLabel={(opt) => opt.sub_cat_name || ''}
                        value={getFormSubcategories().find(s => s.sub_cat_id === formData.sub_cat_id) || null}
                        onChange={(_, newVal) => {
                          if (newVal) {
                            setFormData(prev => ({
                              ...prev,
                              sub_cat_id: newVal.sub_cat_id
                            }));
                            setSubcategoryInput(newVal.sub_cat_name);
                          }
                        }}
                        onHighlightChange={(_, option) => setSubcategoryHighlighted(option)}
                        open={subcategoryOpen}
                        onOpen={() => setSubcategoryOpen(true)}
                        onClose={() => setSubcategoryOpen(false)}
                        onKeyDown={handleSubcategoryKeyDown}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Subcategory"
                            placeholder="Select subcategory"
                            data-field="subcategoryAutocomplete"
                            disabled={!formData.cat_id}
                          />
                        )}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '1.1rem',
                            height: '60px',
                            backgroundColor: 'white',
                            px: 2,
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '1.1rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Box>

                {/* SECTION 3: Pricing Information */}
                <Box sx={{ mb: 4 }}>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 700, 
                    color: '#1e293b',
                    mb: 2,
                    pb: 1.5,
                    borderBottom: '2px solid #16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#16a34a' }}></Box>
                    Pricing Information
                  </Typography>
                  <Grid container spacing={2.5}>
                    {/* CRate */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Purchase Cost"
                        name="pro_crate"
                        type="number"
                        inputProps={{ step: "0.01" }}
                        value={formData.pro_crate}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        InputProps={{
                          startAdornment: <InputAdornment position="start" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>Rs</InputAdornment>,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Sale Price */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Sale Price"
                        name="pro_sale_price"
                        type="number"
                        inputProps={{ step: "0.01" }}
                        value={formData.pro_sale_price}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        InputProps={{
                          startAdornment: <InputAdornment position="start" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>Rs</InputAdornment>,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Base Price */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Base Price"
                        name="pro_baser_price"
                        type="number"
                        inputProps={{ step: "0.01" }}
                        value={formData.pro_baser_price}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        InputProps={{
                          startAdornment: <InputAdornment position="start" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>Rs</InputAdornment>,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Cost Price */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Cost Price"
                        name="pro_cost_price"
                        type="number"
                        inputProps={{ step: "0.01" }}
                        value={formData.pro_cost_price}
                        onChange={handleFormChange}
                        placeholder="0.00"
                        data-field="costPrice"
                        InputProps={{
                          startAdornment: <InputAdornment position="start" sx={{ fontSize: '0.95rem', fontWeight: 600 }}>Rs</InputAdornment>,
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* SECTION 4: Inventory Details */}
                <Box>
                  <Typography variant="subtitle1" sx={{ 
                    fontWeight: 700, 
                    color: '#1e293b',
                    mb: 2,
                    pb: 1.5,
                    borderBottom: '2px solid #d97706',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                  }}>
                    <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: '#d97706' }}></Box>
                    Inventory Details
                  </Typography>
                  <Grid container spacing={2.5}>
                    {/* Stock Quantity */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Stock Quantity"
                        name="pro_stock_qnty"
                        type="number"
                        value={formData.pro_stock_qnty}
                        onChange={handleFormChange}
                        placeholder="0"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Store Selection Dropdown */}
                    <Grid item xs={12} sm={6} md={4}>
                      <FormControl fullWidth required={parseFloat(formData.pro_stock_qnty) > 0}>
                        <InputLabel id="store-select-label" sx={{ fontSize: '0.95rem', fontWeight: 500 }}>Store</InputLabel>
                        <Select
                          labelId="store-select-label"
                          name="store_id"
                          value={formData.store_id}
                          label="Store"
                          onChange={handleFormChange}
                          sx={{
                            borderRadius: 2,
                            height: '48px',
                            backgroundColor: 'white',
                            fontSize: '0.95rem',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          }}
                        >
                          <MenuItem value="">
                            <em>None</em>
                          </MenuItem>
                          {stores.map((store) => (
                            <MenuItem key={store.storeid} value={store.storeid}>
                              {store.store_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Low Stock Alert Quantity */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Low Stock Alert Qty"
                        name="low_stock_quantity"
                        type="number"
                        value={formData.low_stock_quantity}
                        onChange={handleFormChange}
                        placeholder="10"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Unit */}
                    <Grid item xs={12} sm={6} md={4}>
                      <TextField
                        fullWidth
                        label="Unit"
                        name="pro_unit"
                        value={formData.pro_unit}
                        onChange={handleFormChange}
                        placeholder="e.g., pieces, kg, liters"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            height: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>

                    {/* Packing */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Packing"
                        name="pro_packing"
                        value={formData.pro_packing}
                        onChange={handleFormChange}
                        placeholder="Enter packing information"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontSize: '0.95rem',
                            minHeight: '48px',
                            backgroundColor: 'white',
                            '&:hover': {
                              backgroundColor: '#f9fafb'
                            }
                          },
                          '& .MuiInputLabel-root': {
                            fontSize: '0.95rem',
                            fontWeight: 500
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            </DialogContent>

            <DialogActions sx={{ 
              p: 3, 
              gap: 2,
              borderTop: '1px solid #e2e8f0',
              bgcolor: 'white',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <Button
                onClick={handleCloseDialog}
                variant="outlined"
                sx={{ 
                  mr: 1,
                  borderColor: '#cbd5e1',
                  color: '#64748b',
                  padding: '8px 24px',
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  '&:hover': {
                    borderColor: '#94a3b8',
                    backgroundColor: '#f1f5f9'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
                sx={{
                  background: 'linear-gradient(45deg, #2196f3, #9c27b0)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976d2, #7b1fa2)',
                    boxShadow: 6,
                    transform: 'translateY(-2px)',
                  },
                  '&:disabled': {
                    background: 'linear-gradient(45deg, #90caf9, #ce93d8)',
                    color: 'rgba(255,255,255,0.7)'
                  },
                  px: 4,
                  py: 1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Add Category Modal */}
          <Dialog
            open={showCategoryForm}
            onClose={() => setShowCategoryForm(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }
            }}
          >
            <DialogTitle
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #00BCD4 90%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 3
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    mr: 2,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <PackageIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    Add New Category
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Create a new product category
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={() => setShowCategoryForm(false)}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
              <Box component="form" onSubmit={handleAddCategory} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  required
                  label="Category Name"
                  name="cat_name"
                  value={categoryFormData.cat_name}
                  onChange={(e) => setCategoryFormData({ cat_name: e.target.value })}
                  placeholder="Enter category name"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                    mb: 3
                  }}
                />
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, gap: 2 }}>
              <Button
                onClick={() => setShowCategoryForm(false)}
                variant="outlined"
                sx={{
                  borderColor: '#666',
                  color: '#666',
                  '&:hover': {
                    borderColor: '#333',
                    backgroundColor: 'rgba(0,0,0,0.04)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCategory}
                variant="contained"
                sx={{
                  background: 'linear-gradient(45deg, #2196F3 30%, #00BCD4 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1976D2 30%, #0097A7 90%)',
                    boxShadow: 6,
                    transform: 'translateY(-2px)',
                  },
                  px: 3,
                  py: 1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Add Category
              </Button>
            </DialogActions>
          </Dialog>

          {/* Add Subcategory Modal */}
          <Dialog
            open={showSubcategoryForm}
            onClose={() => setShowSubcategoryForm(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }
            }}
          >
            <DialogTitle
              sx={{
                background: 'linear-gradient(45deg, #9C27B0 30%, #E91E63 90%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 3
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Avatar
                  sx={{
                    width: 48,
                    height: 48,
                    mr: 2,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  <PackageIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    Add New Subcategory
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Create a new product subcategory
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={() => setShowSubcategoryForm(false)}
                sx={{
                  color: 'white',
                  bgcolor: 'rgba(255,255,255,0.2)',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.3)',
                    transform: 'scale(1.1)'
                  },
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
              <Box component="form" onSubmit={handleAddSubcategory} sx={{ mt: 2 }}>
                <FormControl fullWidth required sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                  },
                  mb: 3,
                  minWidth: 300
                }}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={subcategoryFormData.cat_id}
                    label="Category"
                    onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, cat_id: e.target.value }))}
                  >
                    {categories.map(category => (
                      <MenuItem key={category.cat_id} value={category.cat_id}>
                        {category.cat_name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  required
                  label="Subcategory Name"
                  name="sub_cat_name"
                  value={subcategoryFormData.sub_cat_name}
                  onChange={(e) => setSubcategoryFormData(prev => ({ ...prev, sub_cat_name: e.target.value }))}
                  placeholder="Enter subcategory name"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    }
                  }}
                />
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, gap: 2 }}>
              <Button
                onClick={() => setShowSubcategoryForm(false)}
                variant="outlined"
                sx={{
                  borderColor: '#666',
                  color: '#666',
                  '&:hover': {
                    borderColor: '#333',
                    backgroundColor: 'rgba(0,0,0,0.04)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSubcategory}
                variant="contained"
                sx={{
                  background: 'linear-gradient(45deg, #9C27B0 30%, #E91E63 90%)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #7B1FA2 30%, #C2185B 90%)',
                    boxShadow: 6,
                    transform: 'translateY(-2px)',
                  },
                  px: 3,
                  py: 1,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                Add Subcategory
              </Button>
            </DialogActions>
          </Dialog>

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
        </Stack>
      </Container>
    </DashboardLayout >
  );
}