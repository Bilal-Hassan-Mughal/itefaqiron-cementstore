'use client';

import { useEffect, useState, useMemo } from 'react';
import { formatDatePK } from '@/lib/date-helper';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  Eye,
  EyeOff,
  ShoppingBag,
  FileText,
  ArrowLeftRight,
  Warehouse,
  Receipt,
  ClipboardList,
  RotateCcw,
  ScrollText,
  ListOrdered,
  TrendingDown,
  BookOpen,
  Clock,
  Calendar,
  Filter,
  CreditCard,
  Banknote,
  PieChart,
  BarChart3
} from 'lucide-react';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatMonthLabel = (mStr) => {
  if (!mStr) return '';
  const parts = mStr.split('-');
  if (parts.length < 2) return mStr;
  const mIndex = parseInt(parts[1], 10) - 1;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[mIndex] || parts[1]} '${parts[0].slice(2)}`;
};

const fmtK = v => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v.toFixed(0);
};

export default function DashboardContent({ activeTab }) {
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivityData, setRecentActivityData] = useState([]);
  const [chartsData, setChartsData] = useState(null);
  const [balanceData, setBalanceData] = useState({ customers: [], suppliers: [] });
  const [profitData, setProfitData] = useState([]);
  const [balanceFilters, setBalanceFilters] = useState({ fromDate: '', toDate: '' });
  const [cusCatFilter, setCusCatFilter] = useState('');
  const [supCatFilter, setSupCatFilter] = useState('');
  const [allCategories, setAllCategories] = useState([]);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // New Monthly Analytics State (Credit, Debit, Profit, Sale + Date Filter)
  const [monthlyAnalyticsFilters, setMonthlyAnalyticsFilters] = useState({ fromDate: '', toDate: '' });
  const [monthlyAnalyticsData, setMonthlyAnalyticsData] = useState(null);
  const [monthlyAnalyticsLoading, setMonthlyAnalyticsLoading] = useState(false);

  // Fetch dashboard analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      if (activeTab === 'dashboard') {
        try {
          setLoading(true);
          const response = await fetch('/api/dashboard');
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setAnalyticsData(result.data);
            }
          }
        } catch (error) {
          console.error('Error fetching dashboard analytics:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();
  }, [activeTab]);

  // Fetch monthly analytics (Credit, Debit, Profit, Sale) with date filter
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const fetchMonthlyAnalytics = async () => {
      setMonthlyAnalyticsLoading(true);
      try {
        const params = new URLSearchParams();
        if (monthlyAnalyticsFilters.fromDate) params.set('fromDate', monthlyAnalyticsFilters.fromDate);
        if (monthlyAnalyticsFilters.toDate) params.set('toDate', monthlyAnalyticsFilters.toDate);
        const res = await fetch(`/api/dashboard/monthly-analytics?${params}`);
        const json = await res.json();
        if (json?.success) {
          setMonthlyAnalyticsData(json.data);
        }
      } catch (err) {
        console.error('Error fetching monthly analytics graphs:', err);
      } finally {
        setMonthlyAnalyticsLoading(false);
      }
    };
    fetchMonthlyAnalytics();
  }, [activeTab, monthlyAnalyticsFilters]);

  // Fetch recent activities and charts data
  useEffect(() => {
    const fetchRecentData = async () => {
      try {
        const salesRes = await fetch('/api/sales?limit=100');
        const salesDataRaw = salesRes.ok ? await salesRes.json() : [];
        const salesList = Array.isArray(salesDataRaw) ? salesDataRaw : (salesDataRaw.data || []);

        const purchasesRes = await fetch('/api/purchases?limit=5');
        const purchasesData = purchasesRes.ok ? await purchasesRes.json() : [];

        const activities = [];
        
        salesList.slice(0, 3).forEach(sale => {
          activities.push({
            id: `sale-${sale.sale_id}`,
            action: `Sale #${sale.sale_id}`,
            customer: sale.customer?.cus_name || 'Customer',
            amount: fmtAmt(sale.total_amount),
            time: formatDatePK(sale.created_at),
            status: 'success'
          });
        });

        const purchases = Array.isArray(purchasesData) ? purchasesData : (purchasesData.data || []);
        purchases.slice(0, 2).forEach(purchase => {
          activities.push({
            id: `purchase-${purchase.pur_id}`,
            action: `Purchase #${purchase.pur_id}`,
            customer: purchase.customer?.cus_name || 'Supplier',
            amount: fmtAmt(purchase.total_amount),
            time: formatDatePK(purchase.created_at),
            status: 'info'
          });
        });

        setRecentActivityData(activities);

        const today = new Date();
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          last7Days.push({
            date: date,
            dateStr: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            total: 0
          });
        }

        const daySlots = last7Days.map(d => ({ ...d, billAmt:0, orderAmt:0, total:0, totalCount:0, orderCount:0 }));
        salesList.forEach(sale => {
          const sd = new Date(sale.created_at);
          sd.setHours(0,0,0,0);
          const slot = daySlots.find(d => d.date.getTime() === sd.getTime());
          if (!slot) return;
          const amt = parseFloat(sale.total_amount || 0);
          slot.totalCount++;
          if (sale.bill_type === 'ORDER') { slot.orderAmt += amt; slot.orderCount++; }
          else if (sale.bill_type !== 'QUOTATION') { slot.billAmt += amt; slot.total += amt; }
        });

        const chartData = {
          labels: daySlots.map(d => d.dateStr),
          billAmounts: daySlots.map(d => d.billAmt),
          orderAmounts: daySlots.map(d => d.orderAmt),
          totalCounts: daySlots.map(d => d.totalCount),
          orderCounts: daySlots.map(d => d.orderCount),
          sales: daySlots.map(d => ({ x: d.dateStr, y: d.total })),
          orders: daySlots.map(d => ({ x: d.dateStr, y: d.orderCount }))
        };
        setChartsData(chartData);
      } catch (error) {
        console.error('Error fetching recent data:', error);
      }
    };

    if (activeTab === 'dashboard') {
      fetchRecentData();
      
      const interval = setInterval(() => {
        fetchRecentData();
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    fetch('/api/customer-category')
      .then(r => r.ok ? r.json() : [])
      .then(cats => setAllCategories(Array.isArray(cats) ? cats : []))
      .catch(() => {});
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const fetchBalances = async () => {
      setBalanceLoading(true);
      try {
        const params = new URLSearchParams();
        if (balanceFilters.fromDate) params.set('fromDate', balanceFilters.fromDate);
        if (balanceFilters.toDate)   params.set('toDate',   balanceFilters.toDate);
        if (cusCatFilter)            params.set('cusCatId', cusCatFilter);
        if (supCatFilter)            params.set('supCatId', supCatFilter);
        const res  = await fetch(`/api/dashboard/balance-chart?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) setBalanceData({ customers: json.customers, suppliers: json.suppliers });
      } catch (err) {
        console.error('Error fetching balance data:', err);
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalances();
  }, [activeTab, balanceFilters, cusCatFilter, supCatFilter]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    fetch('/api/dashboard/profit')
      .then(r => r.ok ? r.json() : { success: false })
      .then(json => { if (json.success) setProfitData(json.data); })
      .catch(err => console.error('Profit fetch error:', err));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'usermanagement') {
      router.push('/dashboard/usermanagement');
    } else if (activeTab === 'customercategory') {
      router.push('/dashboard/customercategory');
    }
  }, [activeTab, router]);

  if (activeTab === 'usermanagement' || activeTab === 'customercategory') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return fmtAmt(num);
  };

  const applyDatePreset = (days) => {
    const today = new Date();
    const toStr = today.toISOString().split('T')[0];
    let fromDate = new Date();
    if (days === 'year') {
      fromDate = new Date(today.getFullYear(), 0, 1);
    } else {
      fromDate.setDate(today.getDate() - days);
    }
    const fromStr = fromDate.toISOString().split('T')[0];
    setMonthlyAnalyticsFilters({ fromDate: fromStr, toDate: toStr });
  };

  const kpiData = analyticsData ? [
    {
      title: 'Total Sales',
      value: formatNumber(analyticsData.totalSales.value),
      change: `${analyticsData.totalSales.changeType === 'positive' ? '+' : ''}${analyticsData.totalSales.change}%`,
      changeType: analyticsData.totalSales.changeType,
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Total Orders',
      value: analyticsData.totalOrders.value,
      change: `${analyticsData.totalOrders.changeType === 'positive' ? '+' : ''}${analyticsData.totalOrders.change}%`,
      changeType: analyticsData.totalOrders.changeType,
      icon: ShoppingCart,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Active Customers',
      value: analyticsData.activeCustomers.value,
      change: `${analyticsData.activeCustomers.changeType === 'positive' ? '+' : ''}${analyticsData.activeCustomers.change}%`,
      changeType: analyticsData.activeCustomers.changeType,
      icon: Users,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Total Products',
      value: analyticsData.totalProducts.value,
      change: `${analyticsData.totalProducts.changeType === 'positive' ? '+' : ''}${analyticsData.totalProducts.change}%`,
      changeType: analyticsData.totalProducts.changeType,
      icon: Package,
      color: 'from-orange-500 to-red-500'
    }
  ] : [
    {
      title: 'Total Sales',
      value: '0.00',
      change: '0.0%',
      changeType: 'positive',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: ShoppingCart,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Active Customers',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Users,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Total Products',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Package,
      color: 'from-orange-500 to-red-500'
    }
  ];

  const quickActions = [
    { title: 'New Sale', icon: ShoppingCart, color: 'from-blue-500 to-cyan-500', path: '/dashboard/sales?view=create' },
    { title: 'New Purchase', icon: ShoppingBag, color: 'from-indigo-500 to-blue-500', path: '/dashboard/purchases' },
    { title: 'Orders List', icon: ListOrdered, color: 'from-blue-600 to-indigo-600', path: '/dashboard/orders' },
    { title: 'Add Product', icon: Package, color: 'from-green-500 to-emerald-500', path: '/dashboard/products' },
    { title: 'Add Customer', icon: Users, color: 'from-purple-500 to-pink-500', path: '/dashboard/customers' },
    { title: 'Hold Bills', icon: ClipboardList, color: 'from-yellow-500 to-orange-500', path: '/dashboard/hold-bills' },
    { title: 'Stock Transfer', icon: ArrowLeftRight, color: 'from-teal-500 to-cyan-500', path: '/dashboard/stock-transfer' },
    { title: 'Store Stock', icon: Warehouse, color: 'from-violet-500 to-purple-500', path: '/dashboard/store-stock' },
    { title: 'Expenses', icon: DollarSign, color: 'from-rose-500 to-red-500', path: '/dashboard/expenses' },
    { title: 'Ledger', icon: FileText, color: 'from-slate-500 to-gray-600', path: '/dashboard/finance' },
    { title: 'View Reports', icon: TrendingUp, color: 'from-orange-500 to-red-500', path: '/dashboard/reports' },
    { title: 'Sale Return', icon: RotateCcw, color: 'from-orange-600 to-red-600', path: '/dashboard/sales?view=create&type=return' },
    { title: 'Purchase Return', icon: TrendingDown, color: 'from-red-600 to-rose-600', path: '/dashboard/purchases?view=create&type=return' },
    { title: 'Quotations List', icon: ScrollText, color: 'from-teal-500 to-emerald-500', path: '/dashboard/quotations' },
    { title: 'Sales List', icon: Receipt, color: 'from-cyan-500 to-blue-500', path: '/dashboard/sales' },
    { title: 'Journal Entries', icon: BookOpen, color: 'from-indigo-500 to-purple-500', path: '/dashboard/journal' },
    { title: 'Day End / Closing', icon: Clock, color: 'from-amber-500 to-orange-500', path: '/dashboard/day-end' }
  ];

  const handleQuickActionClick = (path) => {
    if (!path) return;
    try {
      router.push(path);
    } catch (error) {
      window.location.href = path;
    }
  };

  // Helper renderer for SVG bar charts used in Monthly Graphs
  const renderSingleBarChart = ({ data, getValue, colorPrimary, colorGradientStop, barId, labelKey = 'period', hoverUnit = 'PKR' }) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-sm">
          <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
          No data available for selected date range
        </div>
      );
    }

    const pL = 52, pR = 16, pT = 24, pB = 36, W = 600, H = 220;
    const cW = W - pL - pR, cH = H - pT - pB;
    const n = data.length;
    const grpW = cW / n;
    const barW = Math.min(grpW * 0.55, 36);
    const values = data.map(getValue);
    const maxV = Math.max(...values.map(v => Math.abs(v)), 1);

    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230" className="overflow-visible">
        <defs>
          <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorPrimary} />
            <stop offset="100%" stopColor={colorGradientStop} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = pT + cH * (1 - f);
          return (
            <g key={f}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e2e8f0' : '#f8fafc'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '3 3'} />
              <text x={pL - 6} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">{fmtK(maxV * f)}</text>
            </g>
          );
        })}
        {data.map((item, i) => {
          const val = getValue(item);
          const cx = pL + grpW * i + grpW / 2;
          const bx = cx - barW / 2;
          const bH = Math.max((Math.abs(val) / maxV) * cH, val !== 0 ? 3 : 0);
          const lbl = formatMonthLabel(item[labelKey]);
          const hoverTxt = `${lbl}: ${hoverUnit} ${val.toLocaleString()}`;

          return (
            <g key={i} className="group cursor-pointer">
              <rect
                x={bx}
                y={pT + cH - bH}
                width={barW}
                height={bH}
                rx="4"
                fill={`url(#${barId})`}
                className="transition-all duration-200 group-hover:opacity-80"
              >
                <title>{hoverTxt}</title>
              </rect>
              {val !== 0 && (
                <text x={cx} y={pT + cH - bH - 5} fontSize="9" fill={colorPrimary} textAnchor="middle" fontWeight="700">
                  {fmtK(val)}
                </text>
              )}
              <text x={cx} y={H - 8} fontSize="9" fill="#64748b" textAnchor="middle">{lbl}</text>
            </g>
          );
        })}
      </svg>
    );
  };

  if (activeTab === 'dashboard') {
    const monthlyCreditList = monthlyAnalyticsData?.monthlyCredit || [];
    const monthlyDebitList = monthlyAnalyticsData?.monthlyDebit || [];
    const monthlySalesList = monthlyAnalyticsData?.monthlySales || [];
    const monthlyProfitList = monthlyAnalyticsData?.monthlyProfit || [];

    const totalCreditVal = monthlyCreditList.reduce((s, i) => s + i.amount, 0);
    const totalDebitVal = monthlyDebitList.reduce((s, i) => s + i.amount, 0);
    const totalSalesVal = monthlySalesList.reduce((s, i) => s + i.amount, 0);
    const totalProfitVal = monthlyProfitList.reduce((s, i) => s + i.profit, 0);

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* KPI Cards - Analytics Widgets at Top */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 animate-pulse">
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiData.map((kpi, index) => (
              <div key={index} className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{kpi.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
                    <div className="flex items-center mt-2">
                      <span className={`text-sm font-medium ${kpi.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {kpi.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">from last month</span>
                    </div>
                  </div>
                  <div className={`w-16 h-16 bg-gradient-to-r ${kpi.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <kpi.icon className="w-8 h-8 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickActionClick(action.path)}
                  className="group p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-md cursor-pointer"
                >
                  <div className={`w-12 h-12 bg-gradient-to-r ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 text-center">{action.title}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dedicated Monthly Performance & Analytics Graphs with Date Filter */}
        <div className="space-y-6">
          {/* Filter Bar Header */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                Monthly Analytics & Financial Performance
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Visualizing Monthly Credit, Monthly Debit, Monthly Profit, and Monthly Sales with custom date range filters
              </p>
            </div>

            {/* Date Controls & Quick Presets */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-600">From</span>
                <input
                  type="date"
                  value={monthlyAnalyticsFilters.fromDate}
                  onChange={e => setMonthlyAnalyticsFilters(f => ({ ...f, fromDate: e.target.value }))}
                  className="text-xs font-medium text-gray-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-600">To</span>
                <input
                  type="date"
                  value={monthlyAnalyticsFilters.toDate}
                  onChange={e => setMonthlyAnalyticsFilters(f => ({ ...f, toDate: e.target.value }))}
                  className="text-xs font-medium text-gray-800 bg-transparent focus:outline-none"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                <button
                  onClick={() => applyDatePreset(30)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                >
                  30D
                </button>
                <button
                  onClick={() => applyDatePreset(90)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                >
                  3M
                </button>
                <button
                  onClick={() => applyDatePreset(180)}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                >
                  6M
                </button>
                <button
                  onClick={() => applyDatePreset('year')}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                >
                  Year
                </button>
              </div>

              {(monthlyAnalyticsFilters.fromDate || monthlyAnalyticsFilters.toDate) && (
                <button
                  onClick={() => setMonthlyAnalyticsFilters({ fromDate: '', toDate: '' })}
                  className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl font-medium transition-colors"
                >
                  Clear Filter
                </button>
              )}

              {monthlyAnalyticsLoading && (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* 4 Monthly Graphs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Monthly Credit Graph */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    Monthly Credit Graph
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Credit amount / receivings by period</p>
                </div>
                <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-right">
                  <p className="text-[10px] text-emerald-600 uppercase font-bold tracking-wider">Total Credit</p>
                  <p className="text-sm font-black text-emerald-700 font-mono">PKR {fmtAmt(totalCreditVal)}</p>
                </div>
              </div>

              <div className="pt-2">
                {renderSingleBarChart({
                  data: monthlyCreditList,
                  getValue: d => d.amount,
                  colorPrimary: '#059669',
                  colorGradientStop: '#6ee7b7',
                  barId: 'gMonthlyCredit'
                })}
              </div>
            </div>

            {/* 2. Monthly Debit Graph */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-600" />
                    Monthly Debit Graph
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Debit amount / payments by period</p>
                </div>
                <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100 text-right">
                  <p className="text-[10px] text-amber-600 uppercase font-bold tracking-wider">Total Debit</p>
                  <p className="text-sm font-black text-amber-700 font-mono">PKR {fmtAmt(totalDebitVal)}</p>
                </div>
              </div>

              <div className="pt-2">
                {renderSingleBarChart({
                  data: monthlyDebitList,
                  getValue: d => d.amount,
                  colorPrimary: '#d97706',
                  colorGradientStop: '#fcd34d',
                  barId: 'gMonthlyDebit'
                })}
              </div>
            </div>

            {/* 3. Monthly Profit Graph */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Monthly Profit Graph
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Net profit performance (Revenue - Cost - Expense)</p>
                </div>
                <div className="bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 text-right">
                  <p className="text-[10px] text-blue-600 uppercase font-bold tracking-wider">Net Profit</p>
                  <p className="text-sm font-black text-blue-700 font-mono">PKR {fmtAmt(totalProfitVal)}</p>
                </div>
              </div>

              <div className="pt-2">
                {renderSingleBarChart({
                  data: monthlyProfitList,
                  getValue: d => d.profit,
                  colorPrimary: '#2563eb',
                  colorGradientStop: '#93c5fd',
                  barId: 'gMonthlyProfit'
                })}
              </div>
            </div>

            {/* 4. Monthly Sale Graph */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    Monthly Sale Graph
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">Total sales volume by period</p>
                </div>
                <div className="bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 text-right">
                  <p className="text-[10px] text-purple-600 uppercase font-bold tracking-wider">Total Sales</p>
                  <p className="text-sm font-black text-purple-700 font-mono">PKR {fmtAmt(totalSalesVal)}</p>
                </div>
              </div>

              <div className="pt-2">
                {renderSingleBarChart({
                  data: monthlySalesList,
                  getValue: d => d.amount,
                  colorPrimary: '#9333ea',
                  colorGradientStop: '#e9d5ff',
                  barId: 'gMonthlySale'
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Existing Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Overview — Clustered Column: Bills vs Orders */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Sales Overview</h3>
                <p className="text-xs text-gray-400 mt-0.5">Bills vs Orders — Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#3b82f6'}}/><span className="text-xs text-gray-500">Bills</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#f97316'}}/><span className="text-xs text-gray-500">Orders</span></div>
              </div>
            </div>
            <div className="px-1 pb-3">
              {chartsData?.labels ? (() => {
                const pL=52,pR=12,pT=20,pB=36,W=600,H=210,cW=W-pL-pR,cH=H-pT-pB;
                const n=chartsData.labels.length,grpW=cW/n,barW=Math.min(grpW*0.36,32);
                const s1=chartsData.billAmounts,s2=chartsData.orderAmounts;
                const maxV=Math.max(...s1,...s2,1);
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230">
                    <defs>
                      <linearGradient id="cc1B" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#93c5fd" stopOpacity="0.5"/></linearGradient>
                      <linearGradient id="cc1O" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#fdba74" stopOpacity="0.5"/></linearGradient>
                    </defs>
                    <line x1={pL} y1={pT} x2={pL} y2={pT+cH} stroke="#e2e8f0" strokeWidth="1"/>
                    {[0,0.25,0.5,0.75,1].map(f=>{const y=pT+cH*(1-f);return(<g key={f}><line x1={pL} y1={y} x2={W-pR} y2={y} stroke={f===0?'#e2e8f0':'#f8fafc'} strokeWidth="1" strokeDasharray={f===0?'':'3 3'}/><text x={pL-4} y={y+4} fontSize="9" fill="#cbd5e1" textAnchor="end">{fmtK(maxV*f)}</text></g>);})}
                    {chartsData.labels.map((lbl,i)=>{
                      const cx=pL+grpW*i+grpW/2,bx=cx-barW-1,ox=cx+1;
                      const h1=Math.max((s1[i]/maxV)*cH,s1[i]>0?2:0),h2=Math.max((s2[i]/maxV)*cH,s2[i]>0?2:0);
                      return(<g key={i}>
                        <rect x={bx} y={pT+cH-h1} width={barW} height={h1} rx="3" fill="url(#cc1B)"><title>Bills {lbl}: PKR {s1[i].toLocaleString()}</title></rect>
                        <rect x={ox} y={pT+cH-h2} width={barW} height={h2} rx="3" fill="url(#cc1O)"><title>Orders {lbl}: PKR {s2[i].toLocaleString()}</title></rect>
                        <text x={cx} y={H-7} fontSize="9" fill="#94a3b8" textAnchor="middle">{lbl}</text>
                      </g>);
                    })}
                  </svg>
                );
              })() : <div className="h-56 flex items-center justify-center"><TrendingUp className="w-12 h-12 text-gray-200"/></div>}
            </div>
          </div>

          {/* Orders Overview — Clustered Column: Total vs Orders */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden">
            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Transactions Overview</h3>
                <p className="text-xs text-gray-400 mt-0.5">All transactions vs Orders — Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#3b82f6'}}/><span className="text-xs text-gray-500">Total</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{background:'#f97316'}}/><span className="text-xs text-gray-500">Orders</span></div>
              </div>
            </div>
            <div className="px-1 pb-3">
              {chartsData?.labels ? (() => {
                const pL=52,pR=12,pT=20,pB=36,W=600,H=210,cW=W-pL-pR,cH=H-pT-pB;
                const n=chartsData.labels.length,grpW=cW/n,barW=Math.min(grpW*0.36,32);
                const s1=chartsData.totalCounts,s2=chartsData.orderCounts;
                const maxV=Math.max(...s1,...s2,1);
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230">
                    <defs>
                      <linearGradient id="cc2B" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#93c5fd" stopOpacity="0.5"/></linearGradient>
                      <linearGradient id="cc2O" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#fdba74" stopOpacity="0.5"/></linearGradient>
                    </defs>
                    <line x1={pL} y1={pT} x2={pL} y2={pT+cH} stroke="#e2e8f0" strokeWidth="1"/>
                    {[0,0.25,0.5,0.75,1].map(f=>{const y=pT+cH*(1-f);return(<g key={f}><line x1={pL} y1={y} x2={W-pR} y2={y} stroke={f===0?'#e2e8f0':'#f8fafc'} strokeWidth="1" strokeDasharray={f===0?'':'3 3'}/><text x={pL-4} y={y+4} fontSize="9" fill="#cbd5e1" textAnchor="end">{maxV*f>0?Math.round(maxV*f):''}</text></g>);})}
                    {chartsData.labels.map((lbl,i)=>{
                      const cx=pL+grpW*i+grpW/2,bx=cx-barW-1,ox=cx+1;
                      const h1=Math.max((s1[i]/maxV)*cH,s1[i]>0?2:0),h2=Math.max((s2[i]/maxV)*cH,s2[i]>0?2:0);
                      return(<g key={i}>
                        <rect x={bx} y={pT+cH-h1} width={barW} height={h1} rx="3" fill="url(#cc2B)"><title>Total {lbl}: {s1[i]}</title></rect>
                        {s1[i]>0&&<text x={bx+barW/2} y={pT+cH-h1-3} fontSize="8" fill="#2563eb" textAnchor="middle" fontWeight="600">{s1[i]}</text>}
                        <rect x={ox} y={pT+cH-h2} width={barW} height={h2} rx="3" fill="url(#cc2O)"><title>Orders {lbl}: {s2[i]}</title></rect>
                        {s2[i]>0&&<text x={ox+barW/2} y={pT+cH-h2-3} fontSize="8" fill="#ea580c" textAnchor="middle" fontWeight="600">{s2[i]}</text>}
                        <text x={cx} y={H-7} fontSize="9" fill="#94a3b8" textAnchor="middle">{lbl}</text>
                      </g>);
                    })}
                  </svg>
                );
              })() : <div className="h-56 flex items-center justify-center"><ShoppingCart className="w-12 h-12 text-gray-200"/></div>}
            </div>
          </div>
        </div>

        {/* Customer & Supplier Balance Charts — full width, stacked */}
        <div className="space-y-4">
          {/* Shared date-range filter bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100/50 px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Customer/Supplier Date Range</span>
            </div>
            <input
              type="date"
              value={balanceFilters.fromDate}
              onChange={e => setBalanceFilters(f => ({ ...f, fromDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={balanceFilters.toDate}
              onChange={e => setBalanceFilters(f => ({ ...f, toDate: e.target.value }))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {(balanceFilters.fromDate || balanceFilters.toDate) && (
              <button
                onClick={() => setBalanceFilters({ fromDate: '', toDate: '' })}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
              >
                Clear
              </button>
            )}
            {balanceLoading && (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Customer Balance Chart */}
          {(() => {
            const rows = balanceData.customers;
            const color = '#3b82f6', gradId = 'balCustG', light = '#eff6ff';
            const n = Math.min(rows.length, 15);
            const pL = 52, pR = 16, pT = 20, pB = 90, W = 1200, H = 260;
            const cW = W - pL - pR, cH = H - pT - pB;
            const grpW = n > 0 ? cW / n : cW;
            const barW = Math.min(grpW * 0.55, 60);
            const maxV = n > 0 ? Math.max(...rows.slice(0, n).map(r => r.balance), 1) : 1;
            const custCats = allCategories.filter(c =>
              !c.cus_cat_title.toLowerCase().includes('supplier') &&
              !c.cus_cat_title.toLowerCase().includes('cash') &&
              !c.cus_cat_title.toLowerCase().includes('bank')
            );
            return (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden">
                <div className="px-6 pt-5 pb-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">Top Customers by Balance</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {balanceFilters.fromDate || balanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <select
                      value={cusCatFilter}
                      onChange={e => setCusCatFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 min-w-[200px]"
                    >
                      <option value="">All Customer Categories</option>
                      {custCats.map(c => (
                        <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                      ))}
                    </select>
                    {cusCatFilter && (
                      <button onClick={() => setCusCatFilter('')} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                    )}
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: light, color }}>Top {n}</span>
                </div>
                <div className="px-1 pb-3">
                  {n === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                      {balanceLoading
                        ? <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                        : 'No data available'}
                    </div>
                  ) : (
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="300">
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} />
                          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
                        </linearGradient>
                      </defs>
                      <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth="1" />
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const y = pT + cH * (1 - f);
                        return (
                          <g key={f}>
                            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e2e8f0' : '#f8fafc'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '4 4'} />
                            <text x={pL - 6} y={y + 4} fontSize="11" fill="#cbd5e1" textAnchor="end">{fmtK(maxV * f)}</text>
                          </g>
                        );
                      })}
                      {rows.slice(0, n).map((r, i) => {
                        const cx = pL + grpW * i + grpW / 2;
                        const bH = Math.max((r.balance / maxV) * cH, 2);
                        const bx = cx - barW / 2;
                        const shortName = r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name;
                        return (
                          <g key={i}>
                            <rect x={bx} y={pT + cH - bH} width={barW} height={bH} rx="4" fill={`url(#${gradId})`}>
                              <title>{r.name}: PKR {r.balance.toLocaleString()}</title>
                            </rect>
                            <text x={bx + barW / 2} y={pT + cH - bH - 5} fontSize="10" fill={color} textAnchor="middle" fontWeight="700">{fmtK(r.balance)}</text>
                            <text x={cx} y={pT + cH + 10} fontSize="11" fill="#64748b" textAnchor="end" transform={`rotate(-40,${cx},${pT + cH + 10})`}>{shortName}</text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Supplier Balance Chart */}
          {(() => {
            const rows = balanceData.suppliers;
            const color = '#f97316', gradId = 'balSuppG', light = '#fff7ed';
            const n = Math.min(rows.length, 15);
            const pL = 52, pR = 16, pT = 20, pB = 90, W = 1200, H = 260;
            const cW = W - pL - pR, cH = H - pT - pB;
            const grpW = n > 0 ? cW / n : cW;
            const barW = Math.min(grpW * 0.55, 60);
            const maxV = n > 0 ? Math.max(...rows.slice(0, n).map(r => r.balance), 1) : 1;
            const supCats = allCategories.filter(c => c.cus_cat_title.toLowerCase().includes('supplier'));
            return (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 overflow-hidden">
                <div className="px-6 pt-5 pb-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">Top Suppliers by Balance</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {balanceFilters.fromDate || balanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <select
                      value={supCatFilter}
                      onChange={e => setSupCatFilter(e.target.value)}
                      className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 min-w-[200px]"
                    >
                      <option value="">All Supplier Categories</option>
                      {supCats.map(c => (
                        <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                      ))}
                    </select>
                    {supCatFilter && (
                      <button onClick={() => setSupCatFilter('')} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                    )}
                  </div>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: light, color }}>Top {n}</span>
                </div>
                <div className="px-1 pb-3">
                  {n === 0 ? (
                    <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                      {balanceLoading
                        ? <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                        : 'No data available'}
                    </div>
                  ) : (
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="300">
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} />
                          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
                        </linearGradient>
                      </defs>
                      <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth="1" />
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const y = pT + cH * (1 - f);
                        return (
                          <g key={f}>
                            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e2e8f0' : '#f8fafc'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '4 4'} />
                            <text x={pL - 6} y={y + 4} fontSize="11" fill="#cbd5e1" textAnchor="end">{fmtK(maxV * f)}</text>
                          </g>
                        );
                      })}
                      {rows.slice(0, n).map((r, i) => {
                        const cx = pL + grpW * i + grpW / 2;
                        const bH = Math.max((r.balance / maxV) * cH, 2);
                        const bx = cx - barW / 2;
                        const shortName = r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name;
                        return (
                          <g key={i}>
                            <rect x={bx} y={pT + cH - bH} width={barW} height={bH} rx="4" fill={`url(#${gradId})`}>
                              <title>{r.name}: PKR {r.balance.toLocaleString()}</title>
                            </rect>
                            <text x={bx + barW / 2} y={pT + cH - bH - 5} fontSize="10" fill={color} textAnchor="middle" fontWeight="700">{fmtK(r.balance)}</text>
                            <text x={cx} y={pT + cH + 10} fontSize="11" fill="#64748b" textAnchor="end" transform={`rotate(-40,${cx},${pT + cH + 10})`}>{shortName}</text>
                          </g>
                        );
                      })}
                    </svg>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivityData && recentActivityData.length > 0 ? (
                recentActivityData.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                    <div className={`w-3 h-3 rounded-full ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'warning' ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                    {(activity.amount || activity.customer) && (
                      <div className="text-right">
                        {activity.amount && <p className="text-sm font-medium text-gray-900">PKR {activity.amount}</p>}
                        {activity.customer && <p className="text-xs text-gray-500">{activity.customer}</p>}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No recent activities</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
          <p className="text-gray-600 mb-8">
            This page is under development. More features will be added soon.
          </p>
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
