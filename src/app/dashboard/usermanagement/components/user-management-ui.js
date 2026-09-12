'use client';

import { Fragment } from 'react';
import { Check, X, Edit, Trash2, Share2, Eye, User, Users, Shield, Layers } from 'lucide-react';
import {
  getPagesBySection,
  PAGE_SECTIONS,
  normalizeAllowedModules,
  getRoleDisplayName,
  getAccessSummaryBySection,
} from '@/lib/staff-access';

/** Excel-style grid tokens */
export const XL = {
  wrap: 'overflow-auto border border-slate-300 rounded-lg bg-white shadow-sm',
  table: 'w-full border-collapse text-xs table-fixed min-w-[640px]',
  th: 'border border-slate-300 bg-[#1A55E3] text-white font-bold text-[10px] uppercase tracking-wide px-2 py-2 text-left sticky top-0 z-10',
  thCenter: 'border border-slate-300 bg-[#1A55E3] text-white font-bold text-[10px] uppercase tracking-wide px-1 py-2 text-center sticky top-0 z-10',
  thSection: 'border border-slate-300 bg-[#dce6f7] text-[#1347c4] font-extrabold text-[10px] uppercase tracking-wider px-2 py-1.5',
  td: 'border border-slate-200 px-2 py-1.5 text-slate-800 align-middle',
  tdCenter: 'border border-slate-200 px-1 py-1 text-center align-middle',
  tdNum: 'border border-slate-200 px-2 py-1.5 text-slate-500 text-center tabular-nums w-10',
  rowAlt: 'bg-[#fafbfd]',
  rowHover: 'hover:bg-[#e8effd]/50',
  toolbar: 'flex flex-wrap items-center gap-2 px-3 py-2 bg-[#f4f6f9] border-b border-slate-300 rounded-t-lg',
  btnSm:
    'px-2.5 py-1 rounded text-[10px] font-bold border transition-colors',
  btnGreen: 'bg-[#e6fff4] text-[#00a868] border-[#00a868]/30 hover:bg-[#d4fbea]',
  btnBlue: 'bg-[#e8effd] text-[#1A55E3] border-[#1A55E3]/30 hover:bg-[#dce8fc]',
  btnRed: 'bg-[#ffe8f0] text-[#FF0854] border-[#FF0854]/30 hover:bg-[#ffd6e5]',
  btnGray: 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50',
};

export const UM = {
  input:
    'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/30 focus:border-[#1A55E3]',
  label: 'block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1',
  btnPrimary:
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1A55E3] hover:bg-[#1347c4] transition-colors',
  btnGhost:
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 border border-slate-300 bg-white hover:bg-slate-50 transition-colors',
};

function formatSectionCount(count) {
  if (count == null) return null;
  if (typeof count === 'object') return `${count.granted}/${count.total}`;
  return String(count);
}

/** Horizontal section tabs — Dashboard, Quick Access, Reports, etc. */
export function UmSectionTabs({ sections, active, onChange, counts = {} }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
      <button
        type="button"
        onClick={() => onChange('all')}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
          active === 'all'
            ? 'bg-[#1A55E3] text-white border-[#1A55E3]'
            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
        }`}
      >
        All sections
        {counts.all != null && (
          <span className="ml-1 opacity-80 tabular-nums">({formatSectionCount(counts.all)})</span>
        )}
      </button>
      {sections.map((section) => {
        const c = counts[section];
        const label = c != null ? `${section} (${c.granted}/${c.total})` : section;
        const isActive = active === section;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onChange(section)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-[#1A55E3] text-white border-[#1A55E3]'
                : c?.granted === c?.total && c?.total > 0
                  ? 'bg-[#e6fff4] text-[#00a868] border-[#00a868]/30'
                  : c?.granted > 0
                    ? 'bg-[#e8effd] text-[#1A55E3] border-[#1A55E3]/30'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact summary — what user/role can access per section */
export function AccessSummaryBar({ selected = [], onSectionClick }) {
  const summary = getAccessSummaryBySection(selected);
  const totalGranted = summary.reduce((n, s) => n + s.granted, 0);
  const totalPages = summary.reduce((n, s) => n + s.total, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-[#fafbfd] p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 tabular-nums">
          Total access: {totalGranted} / {totalPages} pages
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
        {summary.map(({ section, granted, total }) => (
          <button
            key={section}
            type="button"
            onClick={() => onSectionClick?.(section)}
            className={`text-left px-2 py-1.5 rounded border text-[10px] font-semibold transition-colors ${
              granted === total && total > 0
                ? 'bg-[#e6fff4] border-[#00a868]/30 text-[#00a868]'
                : granted > 0
                  ? 'bg-[#e8effd] border-[#1A55E3]/30 text-[#1A55E3]'
                  : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <div className="truncate">{section}</div>
            <div className="tabular-nums font-bold">{granted}/{total}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function UmTabs({ tabs, active, onChange }) {
  return (
    <div className="flex border-b-2 border-slate-200 bg-white rounded-t-xl overflow-hidden">
      {tabs.map((tab) => {
        const activeTab = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 min-w-0 px-4 py-3 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
              activeTab
                ? 'border-[#1A55E3] text-[#1A55E3] bg-[#e8effd]/40'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${activeTab ? 'bg-[#1A55E3] text-white' : 'bg-slate-200 text-slate-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function RoleBadge({ roleKey }) {
  const colors = {
    ADMIN: 'bg-blue-100 text-blue-800',
    MANAGER: 'bg-purple-100 text-purple-800',
    ACCOUNTANT: 'bg-emerald-100 text-emerald-800',
    SALESMAN: 'bg-amber-100 text-amber-800',
    STOCK_MANAGER: 'bg-cyan-100 text-cyan-800',
    BRANCH_SUPER_ADMIN: 'bg-indigo-100 text-indigo-800',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${colors[roleKey] || 'bg-slate-100 text-slate-700'}`}>
      {getRoleDisplayName(roleKey)}
    </span>
  );
}

/** Excel grid — every system page with allow checkbox (user / role form) */
export function AccessExcelGrid({
  selected = [],
  onToggle,
  onToggleSection,
  onSelectAll,
  onClearAll,
  onRoleDefault,
  roleLabel,
  activeSection = 'all',
  onSectionChange,
  showSummary = true,
  readOnly = false,
  maxHeight = '420px',
}) {
  const sections = getPagesBySection();
  const selectedSet = new Set(normalizeAllowedModules(selected));
  const totalPages = sections.reduce((n, s) => n + s.pages.length, 0);
  const selectedCount = [...selectedSet].filter((id) =>
    sections.some((s) => s.pages.some((p) => p.id === id))
  ).length;

  const sectionCounts = Object.fromEntries(
    getAccessSummaryBySection(selected).map((s) => [s.section, { granted: s.granted, total: s.total }])
  );
  sectionCounts.all = { granted: selectedCount, total: totalPages };

  const visibleSections =
    activeSection === 'all'
      ? sections
      : sections.filter((s) => s.section === activeSection);

  let rowNum = 0;

  return (
    <div className="space-y-2">
      {showSummary && (
        <AccessSummaryBar
          selected={selected}
          onSectionClick={onSectionChange}
        />
      )}
      {onSectionChange && (
        <UmSectionTabs
          sections={PAGE_SECTIONS}
          active={activeSection}
          onChange={onSectionChange}
          counts={sectionCounts}
        />
      )}
    <div className={XL.wrap} style={{ maxHeight }}>
      <div className={XL.toolbar}>
        <span className="text-[10px] font-bold text-slate-600 mr-auto tabular-nums">
          {activeSection === 'all' ? `${selectedCount} / ${totalPages}` : `${sectionCounts[activeSection]?.granted ?? 0} / ${sectionCounts[activeSection]?.total ?? 0}`} pages selected
          {activeSection !== 'all' && <span className="text-slate-400 font-normal ml-1">· {activeSection}</span>}
        </span>
        {!readOnly && onSelectAll && (
          <button type="button" onClick={onSelectAll} className={`${XL.btnSm} ${XL.btnGreen}`}>
            Full system access
          </button>
        )}
        {!readOnly && onRoleDefault && roleLabel && (
          <button type="button" onClick={onRoleDefault} className={`${XL.btnSm} ${XL.btnBlue}`}>
            {roleLabel} default
          </button>
        )}
        {!readOnly && onClearAll && (
          <button type="button" onClick={onClearAll} className={`${XL.btnSm} ${XL.btnRed}`}>
            Clear all
          </button>
        )}
      </div>
      <div className="overflow-auto" style={{ maxHeight: `calc(${maxHeight} - 42px)` }}>
        <table className={XL.table}>
          <thead>
            <tr>
              <th className={`${XL.th} w-10 text-center`}>#</th>
              <th className={`${XL.th} w-[120px]`}>Section</th>
              <th className={XL.th}>Module / Page</th>
              <th className={`${XL.thCenter} w-16`}>Allow</th>
            </tr>
          </thead>
          <tbody>
            {visibleSections.map(({ section, pages }) => {
              const sectionIds = pages.map((p) => p.id);
              const secOn = sectionIds.filter((id) => selectedSet.has(id)).length;
              const secAll = secOn === sectionIds.length;
              return (
                <Fragment key={section}>
                  <tr>
                    <td colSpan={3} className={XL.thSection}>
                      {section} ({secOn}/{sectionIds.length})
                    </td>
                    <td className={`${XL.thSection} text-center`}>
                      {readOnly ? (
                        <span className="text-[10px] font-bold tabular-nums">{secOn}/{sectionIds.length}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleSection?.(sectionIds, !secAll)}
                          className={`${XL.btnSm} ${secAll ? XL.btnRed : XL.btnBlue} mx-auto`}
                        >
                          {secAll ? 'Clear' : 'All'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {pages.map((page, pi) => {
                    rowNum += 1;
                    const on = selectedSet.has(page.id);
                    return (
                      <tr key={page.id} className={`${pi % 2 ? XL.rowAlt : ''} ${XL.rowHover}`}>
                        <td className={XL.tdNum}>{rowNum}</td>
                        <td className={`${XL.td} text-[10px] text-slate-500`}>{section}</td>
                        <td className={XL.td}>
                          <div className="font-semibold text-slate-900">{page.name}</div>
                          {page.description && (
                            <div className="text-[9px] text-slate-500 mt-0.5">{page.description}</div>
                          )}
                          <div className="text-[9px] text-slate-400 truncate">{page.path}</div>
                        </td>
                        <td className={XL.tdCenter}>
                          {readOnly ? (
                            on ? (
                              <Check className="w-4 h-4 text-[#00a868] mx-auto" />
                            ) : (
                              <X className="w-4 h-4 text-slate-300 mx-auto" />
                            )
                          ) : (
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => onToggle(page.id)}
                              className="w-4 h-4 accent-[#1A55E3] cursor-pointer"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

/** Staff list — Excel sheet */
export function StaffExcelGrid({
  users,
  totalPageCount,
  rolePermissions,
  getRoleDefaultModules,
  onShare,
  onViewAccess,
  onEdit,
  onToggleStatus,
  onDelete,
}) {
  if (!users.length) {
    return (
      <div className="py-16 text-center text-sm text-slate-500 border border-slate-300 rounded-lg bg-white">
        No staff found. Adjust filters or add a new user.
      </div>
    );
  }

  return (
    <div className={XL.wrap}>
      <table className={XL.table}>
        <thead>
          <tr>
            <th className={`${XL.th} w-10 text-center`}>#</th>
            <th className={XL.th}>Name</th>
            <th className={XL.th}>Email</th>
            <th className={`${XL.th} w-[130px]`}>Role</th>
            <th className={`${XL.thCenter} w-20`}>Pages</th>
            <th className={`${XL.thCenter} w-20`}>Status</th>
            <th className={`${XL.thCenter} w-[100px]`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => {
            let mods = [];
            try {
              if (user.allowed_modules) {
                const raw = typeof user.allowed_modules === 'string' ? JSON.parse(user.allowed_modules) : user.allowed_modules;
                mods = normalizeAllowedModules(raw);
              }
            } catch {
              mods = [];
            }
            if (!mods.length) {
              mods = normalizeAllowedModules(rolePermissions[user.role] || getRoleDefaultModules(user.role));
            }
            return (
              <tr key={user.user_id} className={`${i % 2 ? XL.rowAlt : ''} ${XL.rowHover}`}>
                <td className={XL.tdNum}>{user.sequentialId ?? i + 1}</td>
                <td className={XL.td}>
                  <span className="font-semibold">{user.full_name}</span>
                </td>
                <td className={`${XL.td} text-slate-600`}>{user.email}</td>
                <td className={XL.td}>
                  <RoleBadge roleKey={user.role} />
                </td>
                <td className={XL.tdCenter}>
                  <button
                    type="button"
                    title="View access"
                    onClick={() => onViewAccess?.(user)}
                    className="font-bold tabular-nums text-[#1A55E3] hover:underline"
                  >
                    {mods.length}/{totalPageCount}
                  </button>
                </td>
                <td className={XL.tdCenter}>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {user.status}
                  </span>
                </td>
                <td className={XL.tdCenter}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button type="button" title="View access" onClick={() => onViewAccess?.(user)} className="p-1 text-[#1A55E3] hover:bg-[#e8effd] rounded">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Login info" onClick={() => onShare(user)} className="p-1 text-sky-600 hover:bg-sky-50 rounded">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Edit" onClick={() => onEdit(user)} className="p-1 text-[#1A55E3] hover:bg-[#e8effd] rounded">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" title="Toggle status" onClick={() => onToggleStatus(user.user_id)} className="p-1 text-amber-600 hover:bg-amber-50 rounded">
                      {user.status === 'ACTIVE' ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" title="Delete" onClick={() => onDelete(user.user_id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Role × Page matrix — Excel sheet (all tabs / pages × roles) */
export function RoleAccessMatrix({
  roles,
  rolePermissions,
  totalPageCount,
  activeSection = 'all',
  syncing = false,
  onSectionChange,
  onToggle,
  onToggleSectionForRole,
  onSelectAllForRole,
  onClearAllForRole,
  onResetDefaults,
  onApplyAllToStaff,
}) {
  const sections = getPagesBySection();
  const allPageIds = sections.flatMap((s) => s.pages.map((p) => p.id));
  const visibleSections =
    activeSection === 'all'
      ? sections
      : sections.filter((s) => s.section === activeSection);

  const countForRole = (roleKey) => {
    const mods = new Set(normalizeAllowedModules(rolePermissions[roleKey] || []));
    return allPageIds.filter((id) => mods.has(id)).length;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-xs text-slate-600">
          Set <strong>page access per role</strong>. Each change is saved and applied to all staff with that role immediately.
          {syncing && <span className="ml-2 text-[#1A55E3] font-semibold">Updating staff…</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {onApplyAllToStaff && (
            <button
              type="button"
              onClick={onApplyAllToStaff}
              disabled={syncing}
              className={`${XL.btnSm} ${XL.btnGreen} disabled:opacity-50`}
            >
              Apply all to staff
            </button>
          )}
          {onResetDefaults && (
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={syncing}
              className={`${XL.btnSm} ${XL.btnGray} disabled:opacity-50`}
            >
              Reset all to factory default
            </button>
          )}
        </div>
      </div>
      {onSectionChange && (
        <UmSectionTabs
          sections={PAGE_SECTIONS}
          active={activeSection}
          onChange={onSectionChange}
        />
      )}
      <div className={`${XL.wrap} max-h-[72vh]`}>
        <div className={XL.toolbar}>
          <span className="text-[10px] font-bold text-slate-600 mr-auto">
            {activeSection === 'all' ? totalPageCount : visibleSections.reduce((n, s) => n + s.pages.length, 0)} pages
            {activeSection !== 'all' && ` · ${activeSection}`} · {roles.length} roles
          </span>
          {roles.map((role) => (
            <div key={role.key} className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-slate-500 hidden sm:inline">{role.name}:</span>
              {onSelectAllForRole && (
                <button type="button" onClick={() => onSelectAllForRole(role.key)} className={`${XL.btnSm} ${XL.btnGreen}`}>
                  Full
                </button>
              )}
              {onClearAllForRole && (
                <button type="button" onClick={() => onClearAllForRole(role.key)} className={`${XL.btnSm} ${XL.btnRed}`}>
                  Clear
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="overflow-auto max-h-[calc(72vh-42px)]">
        <table className={`${XL.table} min-w-[900px]`}>
          <thead>
            <tr>
              <th className={`${XL.th} w-8 text-center sticky left-0 z-20`}>#</th>
              <th className={`${XL.th} w-[100px] sticky left-[34px] z-20`}>Section</th>
              <th className={`${XL.th} min-w-[180px] sticky left-[134px] z-20`}>Page</th>
              {roles.map((role) => (
                <th key={role.key} className={`${XL.thCenter} min-w-[80px] text-[9px] leading-tight`}>
                  <div>{role.name}</div>
                  <div className="text-[8px] font-normal opacity-90 mt-0.5 tabular-nums">
                    {countForRole(role.key)}/{totalPageCount}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let n = 0;
              return visibleSections.map(({ section, pages }) => {
                const sectionIds = pages.map((p) => p.id);
                return (
                <Fragment key={section}>
                  <tr>
                    <td colSpan={3 + roles.length} className={XL.thSection}>
                      {section} ({sectionIds.length} pages)
                    </td>
                  </tr>
                  {pages.map((page, pi) => {
                    n += 1;
                    return (
                      <tr key={page.id} className={`${pi % 2 ? XL.rowAlt : ''} ${XL.rowHover}`}>
                        <td className={`${XL.tdNum} sticky left-0 bg-inherit z-[5]`}>{n}</td>
                        <td className={`${XL.td} text-[10px] sticky left-[34px] bg-inherit z-[5]`}>{section}</td>
                        <td className={`${XL.td} sticky left-[134px] bg-inherit z-[5]`}>
                          <span className="font-semibold">{page.name}</span>
                        </td>
                        {roles.map((role) => {
                          const mods = normalizeAllowedModules(rolePermissions[role.key] || []);
                          const on = mods.includes(page.id);
                          return (
                            <td key={role.key} className={XL.tdCenter}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => onToggle(role.key, page.id)}
                                className="w-4 h-4 accent-[#1A55E3] cursor-pointer"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
              });
            })()}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

export { User, Users, Shield, Layers, X, Check };
