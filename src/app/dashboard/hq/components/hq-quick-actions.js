'use client';

import { useRouter } from 'next/navigation';
import { Building2, Users, BarChart3, Settings, Plus } from 'lucide-react';
import { HQ_SHORTCUT_PALETTE, HQ_UI } from '@/lib/brand-theme';

const ACTIONS = [
  { title: 'Manage Branches', palette: 'indigo', path: '/dashboard/hq/branches', icon: Building2 },
  { title: 'Branch Users', palette: 'cyan', path: '/dashboard/hq/users', icon: Users },
  { title: 'Monitoring', palette: 'green', path: '/dashboard/hq/monitoring', icon: BarChart3 },
  { title: 'HQ Settings', palette: 'slate', path: '/dashboard/hq/settings', icon: Settings },
  { title: 'Create Branch', palette: 'gold', path: '/dashboard/hq/branches?create=1', icon: Plus },
];

export default function HqQuickActions() {
  const router = useRouter();

  return (
    <div className={`${HQ_UI.card} overflow-hidden`}>
      <div className={HQ_UI.sectionHeader}>
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight">HQ Modules</h3>
        <p className="text-xs text-slate-500 mt-0.5 font-medium">Branch management & administration</p>
      </div>
      <div className={HQ_UI.moduleGrid}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
          {ACTIONS.map((action) => {
            const p = HQ_SHORTCUT_PALETTE[action.palette] || HQ_SHORTCUT_PALETTE.indigo;
            const Icon = action.icon;
            return (
              <button
                key={action.title}
                type="button"
                onClick={() => router.push(action.path)}
                className="group flex flex-col items-center justify-center gap-2 py-4 px-2 min-h-[96px] rounded-xl bg-white border border-gray-200/90 shadow-sm hover:shadow-lg hover:border-indigo-200/80 active:scale-[0.98] transition-all duration-200 cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shadow-sm`}>
                  <Icon className={`w-[18px] h-[18px] ${p.icon}`} strokeWidth={2.25} />
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
  );
}
