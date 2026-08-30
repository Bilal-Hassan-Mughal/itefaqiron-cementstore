import {
  LayoutDashboard,
  Building2,
  Users,
  BarChart3,
  Settings,
  Plus,
} from 'lucide-react';

export const HQ_NAV = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard/hq',
    icon: LayoutDashboard,
    description: 'Overview & quick stats',
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
