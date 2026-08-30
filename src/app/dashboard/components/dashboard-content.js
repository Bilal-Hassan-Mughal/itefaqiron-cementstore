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
import { SHORTCUT_PALETTE, KPI_PALETTE, QUICK_ENTRY_TONES, CHART_COLORS, REPORT } from '@/lib/brand-theme';

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

const CARD = 'relative bg-white rounded-[1.25rem] border border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_rgba(15,23,42,0.08)]';
const CARD_HOVER = 'transition-all duration-300 ease-out hover:shadow-[0_4px_8px_rgba(15,23,42,0.05),0_16px_40px_rgba(15,23,42,0.11)] hover:-translate-y-1';

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
      theme: 'green',
    },
    {
      title: 'Total Orders',
      value: analyticsData.totalOrders.value,
      change: `${analyticsData.totalOrders.changeType === 'positive' ? '+' : ''}${analyticsData.totalOrders.change}%`,
      changeType: analyticsData.totalOrders.changeType,
      icon: ShoppingCart,
      theme: 'blue',
    },
    {
      title: 'Active Customers',
      value: analyticsData.activeCustomers.value,
      change: `${analyticsData.activeCustomers.changeType === 'positive' ? '+' : ''}${analyticsData.activeCustomers.change}%`,
      changeType: analyticsData.activeCustomers.changeType,
      icon: Users,
      theme: 'periwinkle',
    },
    {
      title: 'Total Products',
      value: analyticsData.totalProducts.value,
      change: `${analyticsData.totalProducts.changeType === 'positive' ? '+' : ''}${analyticsData.totalProducts.change}%`,
      changeType: analyticsData.totalProducts.changeType,
      icon: Package,
      theme: 'cyan',
    }
  ] : [
    {
      title: 'Total Sales',
      value: '0.00',
      change: '0.0%',
      changeType: 'positive',
      icon: DollarSign,
      theme: 'green',
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: ShoppingCart,
      theme: 'blue',
    },
    {
      title: 'Active Customers',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Users,
      theme: 'periwinkle',
    },
    {
      title: 'Total Products',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Package,
      theme: 'cyan',
    }
  ];

  const quickActions = [
    { title: 'New Sale', icon: ShoppingCart, palette: 'green', path: '/dashboard/sales?view=create' },
    { title: 'New Purchase', icon: ShoppingBag, palette: 'blue', path: '/dashboard/purchases' },
    { title: 'Orders List', icon: ListOrdered, palette: 'yellow', path: '/dashboard/orders' },
    { title: 'Add Product', icon: Package, palette: 'cyan', path: '/dashboard/products' },
    { title: 'Add Customer', icon: Users, palette: 'periwinkle', path: '/dashboard/customers' },
    { title: 'Hold Bills', icon: ClipboardList, palette: 'orange', path: '/dashboard/hold-bills' },
    { title: 'Stock Transfer', icon: ArrowLeftRight, palette: 'cyan', path: '/dashboard/stock-transfer' },
    { title: 'Store Stock', icon: Warehouse, palette: 'slate', path: '/dashboard/store-stock' },
    { title: 'Expenses', icon: DollarSign, palette: 'pink', path: '/dashboard/expenses' },
    { title: 'Ledger', icon: FileText, palette: 'periwinkle', path: '/dashboard/finance' },
    { title: 'View Reports', icon: TrendingUp, palette: 'pink', path: '/dashboard/reports' },
    { title: 'Sale Return', icon: RotateCcw, palette: 'green', path: '/dashboard/sales?view=create&type=return' },
    { title: 'Purchase Return', icon: TrendingDown, palette: 'blue', path: '/dashboard/purchases?view=create&type=return' },
    { title: 'Quotations', icon: ScrollText, palette: 'blue', path: '/dashboard/quotations' },
    { title: 'Sales List', icon: Receipt, palette: 'green', path: '/dashboard/sales' },
    { title: 'Journal', icon: BookOpen, palette: 'periwinkle', path: '/dashboard/journal' },
    { title: 'Day End', icon: Clock, palette: 'cyan', path: '/dashboard/day-end' },
  ];

  const quickEntryActions = [
    { title: 'New Purchase Bill', subtitle: 'Record supplier purchase', icon: ShoppingBag, tone: 'blue', path: '/dashboard/purchases' },
    { title: 'Direct Sale Invoice', subtitle: 'Create customer sale', icon: ShoppingCart, tone: 'green', path: '/dashboard/sales?view=create' },
    { title: 'Day End / Closing', subtitle: 'Close business day', icon: Clock, tone: 'neutral', path: '/dashboard/day-end' },
    { title: 'Inventory Check', subtitle: 'View store stock levels', icon: Warehouse, tone: 'neutral', path: '/dashboard/store-stock' },
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
        <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e8ecf3" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = pT + cH * (1 - f);
          return (
            <g key={f}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e8ecf3' : '#f4f6f9'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '3 3'} />
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
                rx="6"
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
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${CARD} p-5 animate-pulse`}>
                <div className="h-20 bg-slate-100 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {kpiData.map((kpi, index) => {
              const p = KPI_PALETTE[kpi.theme] || KPI_PALETTE.blue;
              return (
                <div key={index} className={`${CARD} ${CARD_HOVER} p-5`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{kpi.title}</p>
                      <p className="text-[1.65rem] font-extrabold text-slate-900 tracking-tight leading-none">{kpi.value}</p>
                      <div className="flex items-center mt-2.5 gap-1">
                        <span className={`text-xs font-bold ${kpi.changeType === 'positive' ? 'text-[#00a868]' : 'text-[#FF0854]'}`}>
                          {kpi.change}
                        </span>
                        <span className="text-xs text-slate-400">from last month</span>
                      </div>
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <kpi.icon className={`w-5 h-5 ${p.icon}`} strokeWidth={2.25} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modules + Quick Entry */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
          {/* Business Modules */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Business Modules</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Department shortcuts & daily operations</p>
            </div>
            <div className="p-4 md:p-5 bg-[#f9fafb]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
                {quickActions.map((action, index) => {
                  const p = SHORTCUT_PALETTE[action.palette] || SHORTCUT_PALETTE.blue;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleQuickActionClick(action.path)}
                      className="group flex flex-col items-center justify-center gap-2 py-4 px-2 min-h-[96px] rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
                        <action.icon className={`w-[18px] h-[18px] ${p.icon}`} strokeWidth={2} />
                      </div>
                      <p className="text-[11px] md:text-xs font-semibold text-gray-700 text-center leading-snug px-0.5">
                        {action.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Entry Panel */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Entry</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">High-priority actions</p>
            </div>
            <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/50">
              {quickEntryActions.map((action, index) => {
                const isPrimary = action.tone === 'blue' || action.tone === 'green';
                const toneStyle = QUICK_ENTRY_TONES[action.tone] || QUICK_ENTRY_TONES.neutral;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleQuickActionClick(action.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 ${toneStyle.className}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPrimary ? 'bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]' : 'bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'}`}>
                      <action.icon className={`w-4 h-4 ${isPrimary ? 'text-white' : 'text-slate-600'}`} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold leading-tight ${isPrimary ? 'text-white' : 'text-slate-900'}`}>{action.title}</p>
                      <p className={`text-[11px] mt-0.5 truncate ${isPrimary ? 'text-white/85' : 'text-slate-500'}`}>{action.subtitle}</p>
                    </div>
                    {!isPrimary && (
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reports & Analytics — Plusadmin-style polish */}
        <div className={REPORT.section}>
          {/* Filter Bar */}
          <div className={REPORT.filterBar}>
            <div className={REPORT.filterHeader}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-bold text-white tracking-tight">
                    Monthly Analytics & Financial Performance
                  </h3>
                  <p className="text-[11px] text-white/75 mt-0.5 hidden sm:block">
                    Credit, debit, profit & sales with date filters
                  </p>
                </div>
              </div>
              {monthlyAnalyticsLoading && (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
              )}
            </div>

            <div className={REPORT.filterBody}>
              <div className={REPORT.datePill}>
                <Calendar className="w-4 h-4 text-[#1A55E3]" />
                <span className="text-xs font-semibold text-slate-500">From</span>
                <input
                  type="date"
                  value={monthlyAnalyticsFilters.fromDate}
                  onChange={e => setMonthlyAnalyticsFilters(f => ({ ...f, fromDate: e.target.value }))}
                  className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className={REPORT.datePill}>
                <Calendar className="w-4 h-4 text-[#1A55E3]" />
                <span className="text-xs font-semibold text-slate-500">To</span>
                <input
                  type="date"
                  value={monthlyAnalyticsFilters.toDate}
                  onChange={e => setMonthlyAnalyticsFilters(f => ({ ...f, toDate: e.target.value }))}
                  className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className={REPORT.presetWrap}>
                {[
                  { label: '30D', days: 30 },
                  { label: '3M', days: 90 },
                  { label: '6M', days: 180 },
                  { label: 'Year', days: 'year' },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => applyDatePreset(days)}
                    className={REPORT.presetBtn}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {(monthlyAnalyticsFilters.fromDate || monthlyAnalyticsFilters.toDate) && (
                <button
                  type="button"
                  onClick={() => setMonthlyAnalyticsFilters({ fromDate: '', toDate: '' })}
                  className="text-xs text-[#FF0854] hover:text-[#cc0644] bg-[#ffe8f0] hover:bg-[#ffd6e5] px-3 py-2 rounded-xl font-semibold transition-colors"
                >
                  Clear Filter
                </button>
              )}
            </div>
          </div>

          {/* 4 Monthly Graphs Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Monthly Credit */}
            <div className={REPORT.card}>
              <div className={`${REPORT.cardInner} flex items-start justify-between gap-4 border-b border-[#eef1f6]`}>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Credit</p>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">PKR {fmtAmt(totalCreditVal)}</p>
                  <p className="text-xs text-slate-500 mt-1">Credit / receivings by period</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: CHART_COLORS.credit.tint }}>
                  <Banknote className="w-5 h-5" style={{ color: CHART_COLORS.credit.primary }} />
                </div>
              </div>
              <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                {renderSingleBarChart({
                  data: monthlyCreditList,
                  getValue: d => d.amount,
                  colorPrimary: CHART_COLORS.credit.primary,
                  colorGradientStop: CHART_COLORS.credit.gradient,
                  barId: 'gMonthlyCredit'
                })}
              </div>
            </div>

            {/* 2. Monthly Debit */}
            <div className={REPORT.card}>
              <div className={`${REPORT.cardInner} flex items-start justify-between gap-4 border-b border-[#eef1f6]`}>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Debit</p>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">PKR {fmtAmt(totalDebitVal)}</p>
                  <p className="text-xs text-slate-500 mt-1">Debit / payments by period</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: CHART_COLORS.debit.tint }}>
                  <CreditCard className="w-5 h-5" style={{ color: CHART_COLORS.debit.primary }} />
                </div>
              </div>
              <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                {renderSingleBarChart({
                  data: monthlyDebitList,
                  getValue: d => d.amount,
                  colorPrimary: CHART_COLORS.debit.primary,
                  colorGradientStop: CHART_COLORS.debit.gradient,
                  barId: 'gMonthlyDebit'
                })}
              </div>
            </div>

            {/* 3. Monthly Profit */}
            <div className={REPORT.card}>
              <div className={`${REPORT.cardInner} flex items-start justify-between gap-4 border-b border-[#eef1f6]`}>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Profit</p>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">PKR {fmtAmt(totalProfitVal)}</p>
                  <p className="text-xs text-slate-500 mt-1">Net profit performance</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: CHART_COLORS.profit.tint }}>
                  <TrendingUp className="w-5 h-5" style={{ color: CHART_COLORS.profit.primary }} />
                </div>
              </div>
              <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                {renderSingleBarChart({
                  data: monthlyProfitList,
                  getValue: d => d.profit,
                  colorPrimary: CHART_COLORS.profit.primary,
                  colorGradientStop: CHART_COLORS.profit.gradient,
                  barId: 'gMonthlyProfit'
                })}
              </div>
            </div>

            {/* 4. Monthly Sales */}
            <div className={REPORT.card}>
              <div className={`${REPORT.cardInner} flex items-start justify-between gap-4 border-b border-[#eef1f6]`}>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Monthly Sales</p>
                  <p className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">PKR {fmtAmt(totalSalesVal)}</p>
                  <p className="text-xs text-slate-500 mt-1">Total sales volume by period</p>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: CHART_COLORS.sales.tint }}>
                  <ShoppingCart className="w-5 h-5" style={{ color: CHART_COLORS.sales.primary }} />
                </div>
              </div>
              <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                {renderSingleBarChart({
                  data: monthlySalesList,
                  getValue: d => d.amount,
                  colorPrimary: CHART_COLORS.sales.primary,
                  colorGradientStop: CHART_COLORS.sales.gradient,
                  barId: 'gMonthlySale'
                })}
              </div>
            </div>
          </div>

        {/* Weekly Overview Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Sales Overview — Bills vs Orders */}
          <div className={REPORT.card}>
            <div className={`${REPORT.cardInner} pb-3 flex items-center justify-between border-b border-[#eef1f6]`}>
              <div>
                <h3 className="text-base font-bold text-slate-900">Sales Overview</h3>
                <p className="text-xs text-slate-500 mt-0.5">Bills vs Orders — Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.bills.primary }} /><span className="text-xs text-slate-500 font-medium">Bills</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.orders.primary }} /><span className="text-xs text-slate-500 font-medium">Orders</span></div>
              </div>
            </div>
            <div className={`${REPORT.chartArea} mx-4 mb-4`}>
              {chartsData?.labels ? (() => {
                const pL=52,pR=12,pT=20,pB=36,W=600,H=210,cW=W-pL-pR,cH=H-pT-pB;
                const n=chartsData.labels.length,grpW=cW/n,barW=Math.min(grpW*0.36,32);
                const s1=chartsData.billAmounts,s2=chartsData.orderAmounts;
                const maxV=Math.max(...s1,...s2,1);
                const c1=CHART_COLORS.bills.primary,c1g=CHART_COLORS.bills.gradient;
                const c2=CHART_COLORS.orders.primary,c2g=CHART_COLORS.orders.gradient;
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230">
                    <defs>
                      <linearGradient id="cc1B" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c1g} stopOpacity="0.45"/></linearGradient>
                      <linearGradient id="cc1O" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c2}/><stop offset="100%" stopColor={c2g} stopOpacity="0.45"/></linearGradient>
                    </defs>
                    <line x1={pL} y1={pT} x2={pL} y2={pT+cH} stroke="#e8ecf3" strokeWidth="1"/>
                    {[0,0.25,0.5,0.75,1].map(f=>{const y=pT+cH*(1-f);return(<g key={f}><line x1={pL} y1={y} x2={W-pR} y2={y} stroke={f===0?'#e8ecf3':'#f4f6f9'} strokeWidth="1" strokeDasharray={f===0?'':'3 3'}/><text x={pL-4} y={y+4} fontSize="9" fill="#94a3b8" textAnchor="end">{fmtK(maxV*f)}</text></g>);})}
                    {chartsData.labels.map((lbl,i)=>{
                      const cx=pL+grpW*i+grpW/2,bx=cx-barW-1,ox=cx+1;
                      const h1=Math.max((s1[i]/maxV)*cH,s1[i]>0?2:0),h2=Math.max((s2[i]/maxV)*cH,s2[i]>0?2:0);
                      return(<g key={i}>
                        <rect x={bx} y={pT+cH-h1} width={barW} height={h1} rx="5" fill="url(#cc1B)"><title>Bills {lbl}: PKR {s1[i].toLocaleString()}</title></rect>
                        <rect x={ox} y={pT+cH-h2} width={barW} height={h2} rx="5" fill="url(#cc1O)"><title>Orders {lbl}: PKR {s2[i].toLocaleString()}</title></rect>
                        <text x={cx} y={H-7} fontSize="9" fill="#64748b" textAnchor="middle">{lbl}</text>
                      </g>);
                    })}
                  </svg>
                );
              })() : <div className="h-56 flex items-center justify-center"><TrendingUp className="w-12 h-12 text-slate-200"/></div>}
            </div>
          </div>

          {/* Transactions Overview */}
          <div className={REPORT.card}>
            <div className={`${REPORT.cardInner} pb-3 flex items-center justify-between border-b border-[#eef1f6]`}>
              <div>
                <h3 className="text-base font-bold text-slate-900">Transactions Overview</h3>
                <p className="text-xs text-slate-500 mt-0.5">All transactions vs Orders — Last 7 days</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.sales.primary }} /><span className="text-xs text-slate-500 font-medium">Total</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: CHART_COLORS.profit.primary }} /><span className="text-xs text-slate-500 font-medium">Orders</span></div>
              </div>
            </div>
            <div className={`${REPORT.chartArea} mx-4 mb-4`}>
              {chartsData?.labels ? (() => {
                const pL=52,pR=12,pT=20,pB=36,W=600,H=210,cW=W-pL-pR,cH=H-pT-pB;
                const n=chartsData.labels.length,grpW=cW/n,barW=Math.min(grpW*0.36,32);
                const s1=chartsData.totalCounts,s2=chartsData.orderCounts;
                const maxV=Math.max(...s1,...s2,1);
                const c1=CHART_COLORS.sales.primary,c1g=CHART_COLORS.sales.gradient;
                const c2=CHART_COLORS.profit.primary,c2g=CHART_COLORS.profit.gradient;
                return (
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230">
                    <defs>
                      <linearGradient id="cc2B" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c1}/><stop offset="100%" stopColor={c1g} stopOpacity="0.45"/></linearGradient>
                      <linearGradient id="cc2O" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={c2}/><stop offset="100%" stopColor={c2g} stopOpacity="0.45"/></linearGradient>
                    </defs>
                    <line x1={pL} y1={pT} x2={pL} y2={pT+cH} stroke="#e8ecf3" strokeWidth="1"/>
                    {[0,0.25,0.5,0.75,1].map(f=>{const y=pT+cH*(1-f);return(<g key={f}><line x1={pL} y1={y} x2={W-pR} y2={y} stroke={f===0?'#e8ecf3':'#f4f6f9'} strokeWidth="1" strokeDasharray={f===0?'':'3 3'}/><text x={pL-4} y={y+4} fontSize="9" fill="#94a3b8" textAnchor="end">{maxV*f>0?Math.round(maxV*f):''}</text></g>);})}
                    {chartsData.labels.map((lbl,i)=>{
                      const cx=pL+grpW*i+grpW/2,bx=cx-barW-1,ox=cx+1;
                      const h1=Math.max((s1[i]/maxV)*cH,s1[i]>0?2:0),h2=Math.max((s2[i]/maxV)*cH,s2[i]>0?2:0);
                      return(<g key={i}>
                        <rect x={bx} y={pT+cH-h1} width={barW} height={h1} rx="5" fill="url(#cc2B)"><title>Total {lbl}: {s1[i]}</title></rect>
                        {s1[i]>0&&<text x={bx+barW/2} y={pT+cH-h1-3} fontSize="8" fill={c1} textAnchor="middle" fontWeight="600">{s1[i]}</text>}
                        <rect x={ox} y={pT+cH-h2} width={barW} height={h2} rx="5" fill="url(#cc2O)"><title>Orders {lbl}: {s2[i]}</title></rect>
                        {s2[i]>0&&<text x={ox+barW/2} y={pT+cH-h2-3} fontSize="8" fill={c2} textAnchor="middle" fontWeight="600">{s2[i]}</text>}
                        <text x={cx} y={H-7} fontSize="9" fill="#64748b" textAnchor="middle">{lbl}</text>
                      </g>);
                    })}
                  </svg>
                );
              })() : <div className="h-56 flex items-center justify-center"><ShoppingCart className="w-12 h-12 text-slate-200"/></div>}
            </div>
          </div>
        </div>

        {/* Customer & Supplier Balance Charts */}
        <div className="space-y-5">
          <div className={`${REPORT.filterBar} ${REPORT.filterBody}`}>
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4 text-[#1A55E3]" />
              <span className="text-sm font-semibold">Customer / Supplier Date Range</span>
            </div>
            <input
              type="date"
              value={balanceFilters.fromDate}
              onChange={e => setBalanceFilters(f => ({ ...f, fromDate: e.target.value }))}
              className={REPORT.input}
            />
            <span className="text-slate-400 text-sm font-medium">to</span>
            <input
              type="date"
              value={balanceFilters.toDate}
              onChange={e => setBalanceFilters(f => ({ ...f, toDate: e.target.value }))}
              className={REPORT.input}
            />
            {(balanceFilters.fromDate || balanceFilters.toDate) && (
              <button
                type="button"
                onClick={() => setBalanceFilters({ fromDate: '', toDate: '' })}
                className="text-xs text-[#FF0854] hover:text-[#cc0644] bg-[#ffe8f0] px-3 py-2 rounded-xl font-semibold transition-colors"
              >
                Clear
              </button>
            )}
            {balanceLoading && (
              <div className="w-4 h-4 border-2 border-[#1A55E3] border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Customer Balance Chart */}
          {(() => {
            const rows = balanceData.customers;
            const color = CHART_COLORS.customer.primary;
            const gradId = 'balCustG';
            const light = CHART_COLORS.customer.tint;
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
              <div className={REPORT.card}>
                <div className={`${REPORT.cardInner} pb-4 flex flex-wrap items-center gap-4 border-b border-[#eef1f6]`}>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900">Top Customers by Balance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {balanceFilters.fromDate || balanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#5E6EED] flex-shrink-0" />
                    <select
                      value={cusCatFilter}
                      onChange={e => setCusCatFilter(e.target.value)}
                      className={`${REPORT.input} min-w-[200px] py-2`}
                    >
                      <option value="">All Customer Categories</option>
                      {custCats.map(c => (
                        <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                      ))}
                    </select>
                    {cusCatFilter && (
                      <button type="button" onClick={() => setCusCatFilter('')} className="text-slate-400 hover:text-[#FF0854] text-lg leading-none">×</button>
                    )}
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: light, color }}>Top {n}</span>
                </div>
                <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                  {n === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                      {balanceLoading
                        ? <div className="w-8 h-8 border-2 border-[#5E6EED] border-t-transparent rounded-full animate-spin" />
                        : 'No data available'}
                    </div>
                  ) : (
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="300">
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} />
                          <stop offset="100%" stopColor={CHART_COLORS.customer.gradient} stopOpacity="0.35" />
                        </linearGradient>
                      </defs>
                      <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e8ecf3" strokeWidth="1" />
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const y = pT + cH * (1 - f);
                        return (
                          <g key={f}>
                            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e8ecf3' : '#f4f6f9'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '4 4'} />
                            <text x={pL - 6} y={y + 4} fontSize="11" fill="#94a3b8" textAnchor="end">{fmtK(maxV * f)}</text>
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
                            <rect x={bx} y={pT + cH - bH} width={barW} height={bH} rx="5" fill={`url(#${gradId})`}>
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
            const color = CHART_COLORS.supplier.primary;
            const gradId = 'balSuppG';
            const light = CHART_COLORS.supplier.tint;
            const n = Math.min(rows.length, 15);
            const pL = 52, pR = 16, pT = 20, pB = 90, W = 1200, H = 260;
            const cW = W - pL - pR, cH = H - pT - pB;
            const grpW = n > 0 ? cW / n : cW;
            const barW = Math.min(grpW * 0.55, 60);
            const maxV = n > 0 ? Math.max(...rows.slice(0, n).map(r => r.balance), 1) : 1;
            const supCats = allCategories.filter(c => c.cus_cat_title.toLowerCase().includes('supplier'));
            return (
              <div className={REPORT.card}>
                <div className={`${REPORT.cardInner} pb-4 flex flex-wrap items-center gap-4 border-b border-[#eef1f6]`}>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-slate-900">Top Suppliers by Balance</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {balanceFilters.fromDate || balanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[#1A55E3] flex-shrink-0" />
                    <select
                      value={supCatFilter}
                      onChange={e => setSupCatFilter(e.target.value)}
                      className={`${REPORT.input} min-w-[200px] py-2`}
                    >
                      <option value="">All Supplier Categories</option>
                      {supCats.map(c => (
                        <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                      ))}
                    </select>
                    {supCatFilter && (
                      <button type="button" onClick={() => setSupCatFilter('')} className="text-slate-400 hover:text-[#FF0854] text-lg leading-none">×</button>
                    )}
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0" style={{ background: light, color }}>Top {n}</span>
                </div>
                <div className={`${REPORT.chartArea} mx-4 mb-4`}>
                  {n === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
                      {balanceLoading
                        ? <div className="w-8 h-8 border-2 border-[#1A55E3] border-t-transparent rounded-full animate-spin" />
                        : 'No data available'}
                    </div>
                  ) : (
                    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="300">
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} />
                          <stop offset="100%" stopColor={CHART_COLORS.supplier.gradient} stopOpacity="0.35" />
                        </linearGradient>
                      </defs>
                      <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e8ecf3" strokeWidth="1" />
                      {[0, 0.25, 0.5, 0.75, 1].map(f => {
                        const y = pT + cH * (1 - f);
                        return (
                          <g key={f}>
                            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e8ecf3' : '#f4f6f9'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '4 4'} />
                            <text x={pL - 6} y={y + 4} fontSize="11" fill="#94a3b8" textAnchor="end">{fmtK(maxV * f)}</text>
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
                            <rect x={bx} y={pT + cH - bH} width={barW} height={bH} rx="5" fill={`url(#${gradId})`}>
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
        <div className={REPORT.card}>
          <div className="px-5 py-4 border-b border-[#eef1f6] bg-gradient-to-r from-[#fafbfd] to-white">
            <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest sales & purchases</p>
          </div>
          <div className="p-4 md:p-5">
            <div className="space-y-1.5">
              {recentActivityData && recentActivityData.length > 0 ? (
                recentActivityData.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[#f4f6f9] transition-colors duration-200 border border-transparent hover:border-[#e8ecf3]">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activity.status === 'success' ? 'bg-[#00D284]' :
                      activity.status === 'warning' ? 'bg-[#0DCAF0]' :
                      'bg-[#1A55E3]'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                    {(activity.amount || activity.customer) && (
                      <div className="text-right flex-shrink-0">
                        {activity.amount && <p className="text-sm font-semibold text-slate-900">PKR {activity.amount}</p>}
                        {activity.customer && <p className="text-xs text-slate-500">{activity.customer}</p>}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-500">No recent activities</p>
                </div>
              )}
            </div>
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
