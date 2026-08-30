'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import {
    Download,
    Printer,
    ArrowLeft,
    Search,
    Filter,
    Users,
    Calendar,
    AlertCircle,
    ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../components/dashboard-layout';
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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Divider,
    Stack,
    Alert
} from '@mui/material';

export default function CustomerBalanceReport() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState([]);
    const [types, setTypes] = useState([]);
    const [categories, setCategories] = useState([]);
    const [summary, setSummary] = useState(null);

    // Filter states
    const [selectedType, setSelectedType] = useState('ALL');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [daysFilter, setDaysFilter] = useState('');
    const [balanceRange, setBalanceRange] = useState('ALL');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [reportRes, typesRes, categoriesRes] = await Promise.all([
                fetch('/api/reports?type=customer-balance-report'),
                fetch('/api/customer-types'),
                fetch('/api/customer-category')
            ]);

            if (reportRes.ok) {
                const data = await reportRes.json();
                setCustomers(data.customers || []);
                setSummary(data.summary);
            }

            if (typesRes.ok) {
                const typeData = await typesRes.json();
                setTypes(typeData || []);
            }

            if (categoriesRes.ok) {
                const catData = await categoriesRes.json();
                setCategories(catData || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Find the ID for 'Customer' category to use as default filter
    const customerCategoryId = useMemo(() => {
        const cat = categories.find(c =>
            c.cus_cat_title.toLowerCase().includes('customer')
        );
        return cat?.cus_cat_id;
    }, [categories]);

    // Filtered list for the Account Selector (Autocomplete)
    // Filters by 'Customer' category AND the selected Type
    const autocompleteCustomers = useMemo(() => {
        let list = customers;

        // 1. Filter by 'Customer' category (default logic)
        if (customerCategoryId) {
            list = list.filter(c => c.cus_category === customerCategoryId);
        }

        // 2. Filter by selected Type if one is chosen
        if (selectedType !== 'ALL') {
            list = list.filter(c => c.cus_type === parseInt(selectedType));
        }

        return list;
    }, [customers, customerCategoryId, selectedType]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(customer => {
            // Search filter
            const matchesSearch = !searchTerm ||
                customer.cus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                customer.cus_phone_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                customer.cus_id.toString().includes(searchTerm);

            // Type filter
            const matchesType = selectedType === 'ALL' || customer.cus_type === parseInt(selectedType);

            // Specific Customer filter
            const matchesCustomer = !selectedCustomer || customer.cus_id === selectedCustomer.cus_id;

            // Default: Only show Customer category accounts if no specific customer is selected
            const matchesDefaultCategory = selectedCustomer || !customerCategoryId || customer.cus_category === customerCategoryId;

            // Days filter (Inactive for X days or more)
            let matchesDays = true;
            if (daysFilter) {
                if (!customer.last_activity) {
                    matchesDays = true; // No activity ever means inactive for any number of days
                } else {
                    const lastActive = new Date(customer.last_activity);
                    const today = new Date();
                    const diffTime = Math.abs(today - lastActive);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    matchesDays = diffDays >= parseInt(daysFilter);
                }
            }

            // Balance Range filter
            let matchesRange = true;
            const absBalance = Math.abs(customer.cus_balance);
            if (balanceRange === '0-50000') {
                matchesRange = absBalance >= 0 && absBalance <= 50000;
            } else if (balanceRange === '51000-100000') {
                matchesRange = absBalance > 50000 && absBalance <= 100000;
            } else if (balanceRange === 'GTE-100000') {
                matchesRange = absBalance > 100000;
            }

            return matchesSearch && matchesType && matchesCustomer && matchesDays && matchesRange && matchesDefaultCategory;
        });
    }, [customers, searchTerm, selectedType, selectedCustomer, daysFilter, balanceRange, customerCategoryId]);

    const getBalanceColor = (balance) => {
        const absBal = Math.abs(balance);
        if (absBal <= 50000) return '#16a34a'; // Green
        if (absBal <= 100000) return '#d97706'; // Amber/Yellow
        return '#dc2626'; // Red
    };

    const getBalanceBg = (balance) => {
        const absBal = Math.abs(balance);
        if (absBal <= 50000) return '#f0fdf4';
        if (absBal <= 100000) return '#fffbeb';
        return '#fef2f2';
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportCSV = () => {
        let csv = 'Customer ID,Customer Name,Phone,Type,Last Activity,Balance,Status\n';
        filteredCustomers.forEach(c => {
            const balance = parseBalance(c.cus_balance);
            const status = balance >= 0 ? 'Receivable' : 'Payable';
            csv += `${c.cus_id},"${c.cus_name}","${c.cus_phone_no || ''}","${c.customer_type?.cus_type_title || ''}","${c.last_activity ? formatDatePK(c.last_activity) : 'Never'}",${Math.abs(balance)},${status}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Customer_Balance_Report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const parseBalance = (val) => parseFloat(val || 0);

    const totalFilteredBalance = filteredCustomers.reduce((sum, c) => sum + parseBalance(c.cus_balance), 0);

    if (loading) {
        return (
            <DashboardLayout>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                    <CircularProgress size={60} thickness={4} />
                </Box>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Container maxWidth={false} sx={{ py: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="print:hidden">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton
                            onClick={() => router.push('/dashboard/reports')}
                            sx={{
                                bgcolor: 'white',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                '&:hover': { bgcolor: '#f8fafc' }
                            }}
                        >
                            <ArrowLeft size={20} />
                        </IconButton>
                        <Box>
                            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                Account Balance Analysis
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                                Professional financial overview and aging activity report
                            </Typography>
                        </Box>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            startIcon={<Download size={18} />}
                            onClick={handleExportCSV}
                            sx={{
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 600,
                                borderColor: '#e2e8f0',
                                color: '#475569',
                                px: 3,
                                '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
                            }}
                        >
                            Export
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Printer size={18} />}
                            onClick={handlePrint}
                            sx={{
                                borderRadius: '12px',
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#1e293b',
                                px: 3,
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                '&:hover': { bgcolor: '#0f172a', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }
                            }}
                        >
                            Print Report
                        </Button>
                    </Stack>
                </Box>

                {/* Enhanced Filters Card */}
                <Card
                    sx={{
                        mb: 4,
                        borderRadius: '20px',
                        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
                        border: '1px solid #f1f5f9',
                        overflow: 'visible'
                    }}
                    className="print:hidden"
                >
                    <CardContent sx={{ p: '24px !important' }}>
                        <Grid container spacing={2} alignItems="flex-end">
                            {/* Type Filter - FAR LEFT */}
                            <Grid item xs={12} sm={6} md={2}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 1, mb: 0.5, display: 'block', textTransform: 'uppercase' }}>
                                    Type
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <Select
                                        value={selectedType}
                                        onChange={(e) => setSelectedType(e.target.value)}
                                        sx={{
                                            borderRadius: '12px',
                                            bgcolor: '#f8fafc',
                                            '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e2e8f0' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Types</MenuItem>
                                        {types.map((type) => (
                                            <MenuItem key={type.cus_type_id} value={type.cus_type_id}>{type.cus_type_title}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Specifically Account Selector - Only shows CUSTOMERS by default */}
                            <Grid item xs={12} md={3.5}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 1, mb: 0.5, display: 'block', textTransform: 'uppercase' }}>
                                    Select Customer Account
                                </Typography>
                                <Autocomplete
                                    size="small"
                                    options={autocompleteCustomers}
                                    getOptionLabel={(option) => option.cus_name}
                                    value={selectedCustomer}
                                    onChange={(event, newValue) => setSelectedCustomer(newValue)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Find customer..."
                                            variant="outlined"
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: '12px',
                                                    bgcolor: '#f8fafc'
                                                }
                                            }}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Range Filter */}
                            <Grid item xs={12} sm={6} md={2}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 1, mb: 0.5, display: 'block', textTransform: 'uppercase' }}>
                                    Severity
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <Select
                                        value={balanceRange}
                                        onChange={(e) => setBalanceRange(e.target.value)}
                                        sx={{
                                            borderRadius: '12px',
                                            bgcolor: '#f8fafc',
                                            '& .MuiOutlinedInput-notchedOutline': { border: '1px solid #e2e8f0' }
                                        }}
                                    >
                                        <MenuItem value="ALL">All Ranges</MenuItem>
                                        <MenuItem value="0-50000">Normal</MenuItem>
                                        <MenuItem value="51000-100000">Monitor</MenuItem>
                                        <MenuItem value="GTE-100000">Critical</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Aging Filter */}
                            <Grid item xs={12} sm={6} md={1.5}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 1, mb: 0.5, display: 'block', textTransform: 'uppercase' }}>
                                    Inactive
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    type="number"
                                    value={daysFilter}
                                    placeholder="Days"
                                    onChange={(e) => setDaysFilter(e.target.value)}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                            bgcolor: '#f8fafc'
                                        }
                                    }}
                                />
                            </Grid>

                            {/* Global Search */}
                            <Grid item xs={12} sm={12} md={3}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, ml: 1, mb: 0.5, display: 'block', textTransform: 'uppercase' }}>
                                    Quick Search
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Name, Phone, ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><Search size={18} color="#94a3b8" /></InputAdornment>,
                                    }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '12px',
                                            bgcolor: '#f8fafc'
                                        }
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Stats Summary Area */}
                <Box sx={{ mb: 4 }} className="print:hidden">
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 3 }}>
                                <CardContent sx={{ p: 2 }}>
                                    <Typography variant="overline" color="primary" sx={{ fontWeight: 700 }}>Filtered Accounts</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800 }}>{filteredCustomers.length}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3 }}>
                                <CardContent sx={{ p: 2 }}>
                                    <Typography variant="overline" color="success.main" sx={{ fontWeight: 700 }}>Filtered Balance</Typography>
                                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#166534' }}>
                                        PKR {Math.abs(totalFilteredBalance).toLocaleString()}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Box>

                {/* Main Table Area */}
                <Paper
                    sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 3,
                        overflow: 'hidden',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        border: '1px solid #e2e8f0'
                    }}
                    className="print-table"
                >
                    {/* Print Header (Only visible when printing) */}
                    <Box className="hidden print:block" sx={{ textAlign: 'center', p: 4, borderBottom: '2px solid #000' }}>
                        <Typography variant="h4" sx={{ fontWeight: 800 }}>ITTEFAQ BUILDERS</Typography>
                        <Typography variant="h6">Customer Balance Report</Typography>
                        <Typography variant="body2">Date: {formatDatePK(new Date())}</Typography>
                        <Divider sx={{ my: 2 }} />
                    </Box>

                    <TableContainer sx={{ flex: 1 }}>
                        <Table stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 80 }}>A/C #</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 200 }}>Customer Name</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 150 }}>Contact Info</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 150 }}>Account Type</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 150, textAlign: 'center' }}>Last Activity</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 150, textAlign: 'right' }}>Current Balance</TableCell>
                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 700, minWidth: 120, textAlign: 'center' }}>Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map((customer) => {
                                        const balance = parseBalance(customer.cus_balance);
                                        const color = getBalanceColor(balance);
                                        const bg = getBalanceBg(balance);

                                        return (
                                            <TableRow
                                                key={customer.cus_id}
                                                sx={{
                                                    '&:hover': { bgcolor: '#f1f5f9' },
                                                    transition: 'background-color 0.15s'
                                                }}
                                            >
                                                <TableCell sx={{ fontWeight: 600 }}>{customer.cus_id}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                        {customer.cus_name}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>{customer.cus_phone_no || 'No Phone'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{customer.city?.city_name || 'N/A'}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={customer.customer_type?.cus_type_title || 'N/A'}
                                                        size="small"
                                                        sx={{ fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569' }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                                        {customer.last_activity ? formatDatePK(customer.last_activity) : '—'}
                                                    </Typography>
                                                    {customer.last_activity && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            ({Math.ceil(Math.abs(new Date() - new Date(customer.last_activity)) / (1000 * 60 * 60 * 24))} days ago)
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'right', bgcolor: bg }}>
                                                    <Typography
                                                        variant="body1"
                                                        sx={{
                                                            fontWeight: 800,
                                                            color: color,
                                                            fontFamily: 'monospace'
                                                        }}
                                                    >
                                                        {Math.abs(balance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <Chip
                                                        label={balance >= 0 ? 'Receivable' : 'Payable'}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontWeight: 700,
                                                            borderColor: color,
                                                            color: color,
                                                            textTransform: 'uppercase',
                                                            fontSize: '0.65rem'
                                                        }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} sx={{ py: 10, textAlign: 'center' }}>
                                            <AlertCircle size={48} color="#94a3b8" style={{ margin: '0 auto', marginBottom: 16 }} />
                                            <Typography variant="h6" color="text.secondary">No matching accounts found</Typography>
                                            <Button variant="text" onClick={() => {
                                                setSelectedCategory('ALL');
                                                setSelectedCustomer(null);
                                                setSearchTerm('');
                                                setDaysFilter('');
                                                setBalanceRange('ALL');
                                            }}>Clear all filters</Button>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Table Footer */}
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '2px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                            Showing {filteredCustomers.length} of {customers.length} accounts
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 4 }}>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Total Filtered Balance</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: totalFilteredBalance >= 0 ? '#16a34a' : '#dc2626' }}>
                                    PKR {Math.abs(totalFilteredBalance).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Paper>

            </Container>

            <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          .no-print { display: none !important; }
          body { font-size: 10px !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          table { width: 100% !important; table-layout: fixed !important; border-collapse: collapse !important; font-size: 9px !important; }
          th, td { padding: 4px 6px !important; overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          th { position: static !important; }
          tr { page-break-inside: avoid !important; }
          thead { display: table-header-group !important; }
          tfoot { display: table-footer-group !important; }
        }
      `}</style>
        </DashboardLayout>
    );
}
