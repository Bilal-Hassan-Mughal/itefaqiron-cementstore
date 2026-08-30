'use client';

import { useState, useEffect } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import DashboardLayout from '../components/dashboard-layout';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Stack
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ShoppingBag as PackageIcon,
  AccountBalance as BalanceIcon
} from '@mui/icons-material';

export default function SubscriptionsPage() {
  const [packages, setPackages] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [packagesRes, subscriptionsRes, customersRes] = await Promise.all([
        fetch('/api/packages?active=true'),
        fetch('/api/subscriptions'),
        fetch('/api/customers?dropdown=true')
      ]);

      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData);
      }

      if (subscriptionsRes.ok) {
        const subscriptionsData = await subscriptionsRes.json();
        setSubscriptions(subscriptionsData);
      }

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        setCustomers(customersData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleOpenSubscribeDialog = (packageData) => {
    setSelectedPackage(packageData);
    setSelectedCustomer(null);
    setSubscribeDialogOpen(true);
  };

  const handleCloseSubscribeDialog = () => {
    setSubscribeDialogOpen(false);
    setSelectedPackage(null);
    setSelectedCustomer(null);
  };

  const handleSubscribe = async () => {
    if (!selectedCustomer) {
      showSnackbar('Please select a customer', 'error');
      return;
    }

    if (!selectedPackage) {
      showSnackbar('Package not selected', 'error');
      return;
    }

    // Check balance
    const customerBalance = parseFloat(selectedCustomer.cus_balance || 0);
    const packagePrice = parseFloat(selectedPackage.price);

    if (customerBalance < packagePrice) {
      showSnackbar(
        `Insufficient balance. Required: ${packagePrice.toFixed(2)}, Available: ${customerBalance.toFixed(2)}`,
        'error'
      );
      return;
    }

    try {
      setSubscribing(true);

      // Get user ID from localStorage (adjust as needed)
      const userData = localStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      const updated_by = user?.user_id || 1;

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cus_id: selectedCustomer.cus_id,
          package_id: selectedPackage.package_id,
          payment_method: 'BALANCE',
          reference: null,
          updated_by
        }),
      });

      if (response.ok) {
        showSnackbar('Subscription successful!', 'success');
        handleCloseSubscribeDialog();
        await fetchData(); // Refresh data
      } else {
        const errorData = await response.json();
        showSnackbar(errorData.error || 'Failed to subscribe', 'error');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      showSnackbar('Error processing subscription', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  // Get customer balance for selected customer
  const getCustomerBalance = () => {
    if (!selectedCustomer) return 0;
    return parseFloat(selectedCustomer.cus_balance || 0);
  };

  // Filter customers with type "Customer"
  const getRegularCustomers = () => {
    return customers.filter(customer =>
      customer.customer_category?.cus_cat_title?.toLowerCase().includes('customer')
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress size={80} />
        </Box>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 2 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 1 }}>
              Package Subscriptions
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Subscribe to packages using your shopping balance
            </Typography>
          </Box>

          {/* Packages Grid */}
          <Grid container spacing={3}>
            {packages.map((packageData) => (
              <Grid item xs={12} md={6} lg={4} key={packageData.package_id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                      <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                        {packageData.package_name}
                      </Typography>
                      <Chip
                        label={packageData.is_active ? 'Active' : 'Inactive'}
                        color={packageData.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    {packageData.package_description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {packageData.package_description}
                      </Typography>
                    )}

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        PKR {parseFloat(packageData.price).toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Valid for {packageData.duration_days} days
                      </Typography>
                    </Box>

                    {packageData.features && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                          Features:
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                          {packageData.features}
                        </Typography>
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      fullWidth
                      startIcon={<PackageIcon />}
                      onClick={() => handleOpenSubscribeDialog(packageData)}
                      disabled={!packageData.is_active}
                      sx={{ mt: 'auto' }}
                    >
                      Subscribe with Balance
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {packages.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <PackageIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No packages available
              </Typography>
            </Box>
          )}

          {/* Active Subscriptions */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 2 }}>
              Active Subscriptions
            </Typography>
            {subscriptions.filter(s => s.status === 'ACTIVE').length > 0 ? (
              <Grid container spacing={2}>
                {subscriptions
                  .filter(s => s.status === 'ACTIVE')
                  .map((subscription) => (
                    <Grid item xs={12} md={6} key={subscription.subscription_id}>
                      <Card>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {subscription.package?.package_name}
                            </Typography>
                            <Chip
                              label={subscription.status}
                              color="success"
                              size="small"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Customer: {subscription.customer?.cus_name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Amount: PKR {parseFloat(subscription.amount).toFixed(2)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Start: {formatDatePK(subscription.start_date)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            End: {formatDatePK(subscription.end_date)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No active subscriptions
              </Typography>
            )}
          </Box>
        </Stack>
      </Container>

      {/* Subscribe Dialog */}
      <Dialog
        open={subscribeDialogOpen}
        onClose={handleCloseSubscribeDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Subscribe to {selectedPackage?.package_name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Package Details */}
            {selectedPackage && (
              <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Package Details
                </Typography>
                <Typography variant="body2">
                  <strong>Price:</strong> PKR {parseFloat(selectedPackage.price).toFixed(2)}
                </Typography>
                <Typography variant="body2">
                  <strong>Duration:</strong> {selectedPackage.duration_days} days
                </Typography>
              </Box>
            )}

            {/* Customer Selection */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                Select Customer *
              </Typography>
              <TextField
                select
                fullWidth
                SelectProps={{
                  native: true,
                }}
                value={selectedCustomer?.cus_id || ''}
                onChange={(e) => {
                  const customerId = parseInt(e.target.value);
                  const customer = customers.find(c => c.cus_id === customerId);
                  setSelectedCustomer(customer);
                }}
                variant="outlined"
              >
                <option value="">Select a customer</option>
                {getRegularCustomers().map((customer) => (
                  <option key={customer.cus_id} value={customer.cus_id}>
                    {customer.cus_name} - Balance: PKR {parseFloat(customer.cus_balance || 0).toFixed(2)}
                  </option>
                ))}
              </TextField>
            </Box>

            {/* Balance Information */}
            {selectedCustomer && selectedPackage && (
              <Box>
                <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Balance Information
                  </Typography>
                  <Typography variant="body2">
                    <strong>Current Balance:</strong> PKR {getCustomerBalance().toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Package Price:</strong> PKR {parseFloat(selectedPackage.price).toFixed(2)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 'bold',
                      color: getCustomerBalance() >= parseFloat(selectedPackage.price) ? 'success.main' : 'error.main',
                      mt: 1
                    }}
                  >
                    <strong>Remaining Balance:</strong> PKR{' '}
                    {(getCustomerBalance() - parseFloat(selectedPackage.price)).toFixed(2)}
                  </Typography>
                </Box>

                {getCustomerBalance() < parseFloat(selectedPackage.price) && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    Insufficient balance. Please add funds to your account.
                  </Alert>
                )}
              </Box>
            )}

            {/* Payment Method */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
                Payment Method
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
                <BalanceIcon sx={{ color: 'primary.main' }} />
                <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                  Shopping Balance
                </Typography>
              </Box>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseSubscribeDialog} disabled={subscribing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubscribe}
            variant="contained"
            disabled={
              subscribing ||
              !selectedCustomer ||
              !selectedPackage ||
              getCustomerBalance() < parseFloat(selectedPackage.price)
            }
            startIcon={subscribing ? <CircularProgress size={16} /> : <CheckCircleIcon />}
          >
            {subscribing ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}

