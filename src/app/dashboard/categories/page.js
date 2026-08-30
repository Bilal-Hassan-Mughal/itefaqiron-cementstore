'use client';

import { useState, useEffect, Fragment } from 'react';
import { Plus, Edit, Trash2, Check, X, Folder, Tag, Calendar, Package, Search, Filter, ArrowUp } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { formatDatePK } from '@/lib/date-helper';

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
  Divider
} from '@mui/material';

// Material Icons
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Tag as TagIcon,
  CalendarToday as CalendarIcon,
  Inventory as PackageIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    cat_name: ''
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Load categories from API
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      } else {
        setSnackbar({
          open: true,
          message: 'Failed to fetch categories',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setSnackbar({
        open: true,
        message: 'Error fetching categories',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const newCategory = await response.json();
        setCategories(prev => [...prev, newCategory]);
        setShowCategoryForm(false);
        setFormData({
          cat_name: ''
        });
        setSnackbar({
          open: true,
          message: 'Category added successfully!',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to create category',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error creating category:', error);
      setSnackbar({
        open: true,
        message: 'Failed to create category',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setFormData({
      cat_name: category.cat_name || ''
    });
    setShowCategoryForm(true);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingCategory.cat_id,
          cat_name: formData.cat_name
        }),
      });

      if (response.ok) {
        const updatedCategory = await response.json();
        setCategories(prev => prev.map(category =>
          category.cat_id === editingCategory.cat_id ? updatedCategory : category
        ));
        setShowCategoryForm(false);
        setEditingCategory(null);
        setFormData({
          cat_name: ''
        });
        setSnackbar({
          open: true,
          message: 'Category updated successfully!',
          severity: 'success'
        });
      } else {
        const error = await response.json();
        setSnackbar({
          open: true,
          message: error.error || 'Failed to update category',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating category:', error);
      setSnackbar({
        open: true,
        message: 'Failed to update category',
        severity: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (window.confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/categories?id=${categoryId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setCategories(prev => prev.filter(category => category.cat_id !== categoryId));
          setSnackbar({
            open: true,
            message: 'Category deleted successfully!',
            severity: 'success'
          });
        } else {
          const error = await response.json();
          setSnackbar({
            open: true,
            message: error.error || 'Failed to delete category',
            severity: 'error'
          });
        }
      } catch (error) {
        console.error('Error deleting category:', error);
        setSnackbar({
          open: true,
          message: 'Failed to delete category',
          severity: 'error'
        });
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


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!formData.cat_name.trim()) {
      setSnackbar({
        open: true,
        message: 'Category name is required',
        severity: 'error'
      });
      return;
    }

    console.log('Submitting category form:', formData);

    if (editingCategory) {
      await handleUpdateCategory(e);
    } else {
      await handleAddCategory(e);
    }
  };

  const handleCloseDialog = () => {
    setShowCategoryForm(false);
    setEditingCategory(null);
    setFormData({ cat_name: '' });
  };

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Filter and sort categories
  const filteredAndSortedCategories = categories
    .filter(category =>
      category.cat_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aValue, bValue;

      // Handle special field mappings
      if (sortBy === 'product_count') {
        aValue = a._count?.products || 0;
        bValue = b._count?.products || 0;
      } else if (sortBy === 'sub_category_count') {
        aValue = a._count?.sub_categories || 0;
        bValue = b._count?.sub_categories || 0;
      } else {
        aValue = a[sortBy];
        bValue = b[sortBy];
      }

      // Handle date sorting
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle numeric sorting
      if (sortBy === 'product_count' || sortBy === 'sub_category_count') {
        aValue = parseInt(aValue);
        bValue = parseInt(bValue);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    })
    .map((category, index) => ({
      ...category,
      sequentialId: index + 1
    }));

  // Calculate stats
  const totalCategories = categories.length;
  const totalProducts = categories.reduce((sum, cat) => sum + (cat._count?.products || 0), 0);
  const totalSubCategories = categories.reduce((sum, cat) => sum + (cat._count?.sub_categories || 0), 0);
  const recentAdditions = categories.filter(cat => {
    const createdDate = new Date(cat.created_at);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return createdDate > sevenDaysAgo;
  }).length;

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const getCategoryIcon = (categoryName) => {
    const name = categoryName.toLowerCase();
    if (name.includes('electronic')) return '⚡';
    if (name.includes('cloth') || name.includes('apparel')) return '👕';
    if (name.includes('home') || name.includes('garden')) return '🏠';
    if (name.includes('sport') || name.includes('fitness')) return '⚽';
    if (name.includes('book') || name.includes('media')) return '📚';
    return '📁';
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
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                Category Management
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
                Organize your products with categories and subcategories
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Plus size={20} />}
              onClick={() => setShowCategoryForm(true)}
              sx={{
                background: 'linear-gradient(45deg, #2196f3, #9c27b0)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #1976d2, #7b1fa2)',
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                },
                px: 4,
                py: 1.5,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                boxShadow: 3,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Add New Category
            </Button>
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
                    md: 'repeat(3, 1fr)'
                  },
                  gap: 3,
                  width: '100%'
                }}>
                  {/* Search */}
                  <Box>
                    <TextField
                      fullWidth
                      label="Search"
                      placeholder="Search categories..."
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

                  {/* Sort By */}
                  <Box>
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
                        <MenuItem value="cat_name">Category Name</MenuItem>
                        <MenuItem value="product_count">Product Count</MenuItem>
                        <MenuItem value="sub_category_count">Sub Category Count</MenuItem>
                        <MenuItem value="created_at">Created Date</MenuItem>
                        <MenuItem value="updated_at">Updated Date</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Sort Order */}
                  <Box>
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
                  { title: 'Total Categories', val: totalCategories, color: '#2563eb', bg: '#eff6ff', icon: <Folder size={24} /> },
                  { title: 'Total Products', val: totalProducts, color: '#16a34a', bg: '#f0fdf4', icon: <Package size={24} /> },
                  { title: 'Sub Categories', val: totalSubCategories, color: '#d97706', bg: '#fffbeb', icon: <Tag size={24} /> },
                  { title: 'Recent Additions', val: recentAdditions, color: '#dc2626', bg: '#fef2f2', icon: <Calendar size={24} /> }
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

          {/* Categories Table */}
          <Card sx={{ height: 600, display: 'flex', flexDirection: 'column', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#f8fafc' }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 700, color: '#334155' }}>
                Categories List
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                Showing {filteredAndSortedCategories.length} of {categories.length} categories
              </Typography>
            </Box>
            <TableContainer component={Paper} sx={{ flex: 1, overflow: 'auto', boxShadow: 'none' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>Products</TableCell>
                    <TableCell>Sub Categories</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Updated By</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAndSortedCategories.map((category) => (
                    <TableRow key={category.cat_id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                            {category.cat_name}
                          </Typography>
                          <Chip label={`ID: #${category.sequentialId}`} size="small" variant="outlined" />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PackageIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {category._count?.products || 0}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <TagIcon sx={{ mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {category._count?.sub_categories || 0}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDatePK(category.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {category.updated_by_user?.full_name ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                mr: 1,
                                background: 'linear-gradient(45deg, #4CAF50 30%, #2196F3 90%)',
                                fontSize: '0.75rem'
                              }}
                            >
                              {category.updated_by_user.full_name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                {category.updated_by_user.full_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                {category.updated_by_user.role || 'User'}
                              </Typography>
                            </Box>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            N/A
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Edit Category">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleEditCategory(category)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Category">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteCategory(category.cat_id)}
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

          {/* Category Dialog */}
          <Dialog
            open={showCategoryForm}
            onClose={handleCloseDialog}
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
                  <FolderIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {editingCategory ? 'Update category information' : 'Create a new product category'}
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

            <DialogContent sx={{ p: 3 }}>
              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  required
                  label="Category Name"
                  name="cat_name"
                  value={formData.cat_name}
                  onChange={handleFormChange}
                  placeholder="Enter category name (e.g., Electronics)"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 1.5,
                    },
                    mb: 3
                  }}
                />
              </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 0 }}>
              <Button
                onClick={handleCloseDialog}
                variant="outlined"
                sx={{ mr: 2 }}
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
                  px: 4,
                  py: 1.5,
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 3,
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
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
    </DashboardLayout>
  );
}
