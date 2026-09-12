import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Settings,
  Plus,
  FileBarChart,
  ShoppingCart,
  Wallet,
  TrendingUp,
  Truck,
  Package,
  Receipt,
} from 'lucide-react';
import { HQ_REPORTS } from '@/lib/hq-report-catalog';

const REPORT_ICONS = {
  sales: ShoppingCart,
  purchases: Package,
  payments: Wallet,
  profit: TrendingUp,
  'customers-balance': Users,
  'suppliers-balance': Truck,
  'customers-activity': Users,
  'suppliers-activity': Truck,
  expenses: Receipt,
};

export const HQ_NAV = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard/hq',
    icon: LayoutDashboard,
    description: 'Overview & reports',
  },
  {
    id: 'branches',
    label: 'Branches',
    href: '/dashboard/hq/branches',
    icon: Building2,
    description: 'Create & manage branches',
  },
  {
    id: 'users',
    label: 'Branch Users',
    href: '/dashboard/hq/users',
    icon: Users,
    description: 'All branch staff accounts',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/dashboard/hq/reports',
    icon: FileBarChart,
    description: 'Sales, profit & more',
    children: HQ_REPORTS.map((r) => ({
      id: r.id,
      label: r.title,
      href: r.href,
      icon: REPORT_ICONS[r.id] || FileBarChart,
      description: r.short,
    })),
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    href: '/dashboard/hq/monitoring',
    icon: BarChart3,
    description: 'Compare branch activity',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/dashboard/hq/settings',
    icon: Settings,
    description: 'HQ preferences',
  },
];

export const HQ_QUICK_ACTION = {
  label: 'New Branch',
  href: '/dashboard/hq/branches?create=1',
  icon: Plus,
};

export function isHqNavActive(pathname, href) {
  if (href === '/dashboard/hq') {
    return pathname === '/dashboard/hq';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
