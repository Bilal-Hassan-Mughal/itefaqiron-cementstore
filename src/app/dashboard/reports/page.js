'use client';

import { useRouter } from 'next/navigation';
import {
  Calendar,
  Users,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  FileText,
  TrendingUp,
  BarChart3,
  Banknote,
  Building2,
  Package,
  Receipt,
  PieChart,
  Scale
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

export default function ReportsPage() {
  const router = useRouter();

  const reports = [
    {
      id: 'cash-report',
      title: 'Cash Report',
      description: 'View all cash transactions',
      icon: Banknote,
      color: 'from-green-600 to-green-800',
      path: '/dashboard/reports/cash-report'
    },
    {
      id: 'bank-report',
      title: 'Bank Report',
      description: 'View all bank transactions',
      icon: Building2,
      color: 'from-blue-600 to-blue-800',
      path: '/dashboard/reports/bank-report'
    },
    {
      id: 'order-report',
      title: 'Order Report',
      description: 'View all orders',
      icon: Receipt,
      color: 'from-purple-600 to-purple-800',
      path: '/dashboard/reports/order-report'
    },
    {
      id: 'stock-report',
      title: 'Stock Report',
      description: 'View current stock levels',
      icon: Package,
      color: 'from-orange-600 to-orange-800',
      path: '/dashboard/reports/stock-report'
    },
    {
      id: 'sale-report',
      title: 'Sale Report',
      description: 'View all sales transactions',
      icon: ShoppingCart,
      color: 'from-cyan-600 to-cyan-800',
      path: '/dashboard/reports/sale-report'
    },
    {
      id: 'profit-report',
      title: 'Profit Report',
      description: 'View profit and loss analysis',
      icon: TrendingUp,
      color: 'from-emerald-600 to-emerald-800',
      path: '/dashboard/reports/profit-report'
    },
    {
      id: 'purchase-report',
      title: 'Purchase Report',
      description: 'View all purchase transactions',
      icon: ShoppingBag,
      color: 'from-red-600 to-red-800',
      path: '/dashboard/reports/purchase-report'
    },
    {
      id: 'balance-sheet',
      title: 'Balance Sheet',
      description: 'Financial position overview',
      icon: Scale,
      color: 'from-gray-600 to-gray-800',
      path: '/dashboard/reports/balance-sheet'
    },
    {
      id: 'sales-by-date',
      title: 'Sales (By Date)',
      description: 'View sales within date range',
      icon: Calendar,
      color: 'from-blue-500 to-cyan-500',
      path: '/dashboard/reports/sales-by-date'
    },
    {
      id: 'sales-by-customer',
      title: 'Sales (Customer Wise)',
      description: 'View sales grouped by customers',
      icon: Users,
      color: 'from-purple-500 to-pink-500',
      path: '/dashboard/reports/sales-by-customer'
    },
    {
      id: 'customer-balance-report',
      title: 'Customer Balance Report',
      description: 'Advanced balance report with aging and activity filters',
      icon: Users,
      color: 'from-indigo-600 to-indigo-800',
      path: '/dashboard/reports/customer-balance-report'
    },
    {
      id: 'customers-balance',
      title: 'Customers Balance (Basic)',
      description: 'View all customers with balance',
      icon: Users,
      color: 'from-green-500 to-emerald-500',
      path: '/dashboard/reports/customers-balance'
    },
    {
      id: 'customer-ledger',
      title: 'Customer Ledger',
      description: 'View ledger for specific customer',
      icon: FileText,
      color: 'from-indigo-500 to-blue-500',
      path: '/dashboard/reports/customer-ledger'
    },
    {
      id: 'purchases-by-date',
      title: 'Purchases (By Date)',
      description: 'View purchases within date range',
      icon: ShoppingBag,
      color: 'from-orange-500 to-red-500',
      path: '/dashboard/reports/purchases-by-date'
    },
    {
      id: 'purchases-by-supplier',
      title: 'Purchases (Supplier Wise)',
      description: 'View purchases by suppliers',
      icon: ShoppingCart,
      color: 'from-yellow-500 to-orange-500',
      path: '/dashboard/reports/purchases-by-supplier'
    },
    {
      id: 'expenses-by-date',
      title: 'Expense Report',
      description: 'View expenses within date range',
      icon: DollarSign,
      color: 'from-red-500 to-pink-500',
      path: '/dashboard/reports/expenses-by-date'
    },
    {
      id: 'rebate-report',
      title: 'Rebate Report',
      description: 'View products purchased from supplier',
      icon: PieChart,
      color: 'from-teal-500 to-cyan-500',
      path: '/dashboard/reports/rebate'
    }
  ];

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Reports Dashboard</h2>
              <p className="text-gray-600 text-sm">Generate and view business reports</p>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {reports.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => router.push(report.path)}
                  className="group bg-white rounded-lg shadow border border-gray-200 p-4 hover:shadow-md transition-all duration-200 text-left"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-10 h-10 bg-gradient-to-r ${report.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {report.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}


