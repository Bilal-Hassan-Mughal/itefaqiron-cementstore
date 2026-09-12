'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { branchFetch, isHqPosMode } from '@/lib/branch-client';
import { isHqUser, BRANCH_ASSIGNABLE_ROLES } from '@/lib/branch-roles';
import { 
  canStaffAccessPath,
  SYSTEM_ROLES, 
  getRoleDefaultModules,
  getPagesBySection,
  normalizeAllowedModules,
  getAllPageIds,
  getRoleDisplayName,
  getUserRoleKeysForPermissions,
} from '@/lib/staff-access';
import {
  loadCustomRolePermissions,
  saveCustomRolePermissions,
  getFactoryRoleModules,
  notifyUserPermissionsUpdated,
  ROLE_PERMISSIONS_STORAGE_KEY,
} from '@/lib/role-permissions-store';
import BranchLoginCredentialsPanel, { BranchCodeCopyChip } from '@/components/BranchLoginCredentialsPanel';
import {
  UM,
  UmTabs,
  AccessExcelGrid,
  AccessSummaryBar,
  StaffExcelGrid,
  RoleAccessMatrix,
  X,
  Check,
} from './components/user-management-ui';

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [loginInfoUser, setLoginInfoUser] = useState(null);

  // Active Tab: 'staff' | 'access'
  const [activeTab, setActiveTab] = useState('staff');
  const [accessSectionFilter, setAccessSectionFilter] = useState('all');
  const [viewAccessUser, setViewAccessUser] = useState(null);
  const [viewAccessSection, setViewAccessSection] = useState('all');

  const [roleSyncing, setRoleSyncing] = useState(false);

  // Role permissions template state (factory defaults, overridden by User Management custom map)
  const [rolePermissions, setRolePermissions] = useState(() => {
    const initial = {};
    SYSTEM_ROLES.forEach((role) => {
      initial[role.key] = getFactoryRoleModules(role.key, SYSTEM_ROLES);
    });
    return initial;
  });

  useEffect(() => {
    const saved = loadCustomRolePermissions();
    if (saved) {
      setRolePermissions((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  const syncSessionUserIfNeeded = (updatedUser) => {
    if (typeof window === 'undefined' || !updatedUser?.user_id) return;
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return;
      const cur = JSON.parse(raw);
      if (cur.user_id === updatedUser.user_id) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
        notifyUserPermissionsUpdated(updatedUser);
      }
    } catch (e) {
      console.error('Failed to sync session user:', e);
    }
  };

  const syncRoleToUsers = async (roleKey, modules) => {
    const normalized = normalizeAllowedModules(modules);
    const targets = users.filter((u) =>
      u.role === roleKey || u.db_role === roleKey || getUserRoleKeysForPermissions(u).includes(roleKey)
    );
    if (!targets.length) return 0;

    const results = await Promise.all(
      targets.map(async (user) => {
        try {
          const response = await apiFetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: user.user_id,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              status: user.status,
              is_verified: user.is_verified,
              allowed_modules: normalized,
            }),
          });
          if (response.ok) return response.json();
          return null;
        } catch {
          return null;
        }
      })
    );

    const updated = results.filter(Boolean);
    if (updated.length) {
      setUsers((prev) => {
        const byId = new Map(updated.map((u) => [u.user_id, u]));
        return prev.map((u) => byId.get(u.user_id) || u);
      });
      updated.forEach(syncSessionUserIfNeeded);
    }
    return updated.length;
  };

  const saveRolePermissions = async (updatedPermissions, syncRoleKey = null) => {
    setRolePermissions(updatedPermissions);
    saveCustomRolePermissions(updatedPermissions);

    if (syncRoleKey && getUserRoleKeysForPermissions(currentUser).includes(syncRoleKey)) {
      const normalized = normalizeAllowedModules(updatedPermissions[syncRoleKey] || []);
      const sessionUser = { ...currentUser, allowed_modules: normalized };
      localStorage.setItem('user', JSON.stringify(sessionUser));
      setCurrentUser(sessionUser);
      notifyUserPermissionsUpdated(sessionUser);
    }

    if (!syncRoleKey || !currentUser) return;

    setRoleSyncing(true);
    try {
      const count = await syncRoleToUsers(syncRoleKey, updatedPermissions[syncRoleKey] || []);
      if (count === 0 && users.some((u) => u.role === syncRoleKey)) {
        alert('Role template saved but some staff accounts could not be updated.');
      }
    } catch (e) {
      console.error('Failed to sync role permissions:', e);
      alert('Role template saved locally but failed to update staff accounts. Please try again.');
    } finally {
      setRoleSyncing(false);
    }
  };

  const applyAllRoleTemplatesToStaff = async () => {
    if (!window.confirm('Apply current role templates to all staff accounts? This updates everyone to match the Role Access Map.')) {
      return;
    }
    setRoleSyncing(true);
    try {
      for (const role of visibleSystemRoles) {
        await syncRoleToUsers(role.key, rolePermissions[role.key] || []);
      }
      alert('All role templates applied to staff successfully.');
    } catch (e) {
      console.error('Failed to apply role templates:', e);
      alert('Failed to apply some role templates. Please try again.');
    } finally {
      setRoleSyncing(false);
    }
  };

  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'SALESMAN',
    status: 'ACTIVE',
    is_verified: false,
    allowed_modules: rolePermissions['SALESMAN'] || getRoleDefaultModules('SALESMAN')
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (!raw) {
      router.push('/');
      return;
    }
    try {
      const u = JSON.parse(raw);
      if (!canStaffAccessPath(u, '/dashboard/usermanagement')) {
        router.replace('/dashboard?access=denied');
        return;
      }
      if (isHqUser(u) && !isHqPosMode()) {
        router.replace('/dashboard/hq');
        return;
      }
      setCurrentUser(u);
      setAllowed(true);
    } catch {
      router.push('/');
    }
  }, [router]);

  const isHqActor = currentUser && isHqUser(currentUser);
  const assignableRoleKeys = isHqActor
    ? [...BRANCH_ASSIGNABLE_ROLES, 'BRANCH_SUPER_ADMIN', 'ADMIN']
    : BRANCH_ASSIGNABLE_ROLES;
  const visibleSystemRoles = SYSTEM_ROLES.filter((r) => {
    if (['HQ_SUPER_ADMIN', 'SUPER_ADMIN'].includes(r.key)) return false;
    if (!isHqActor && !assignableRoleKeys.includes(r.key) && r.key !== 'BRANCH_SUPER_ADMIN') return false;
    return true;
  });
  const assignableFormRoles = SYSTEM_ROLES.filter((r) => assignableRoleKeys.includes(r.key));
  const formRoleOptions = editingUser
    ? SYSTEM_ROLES.filter(
        (r) =>
          !['HQ_SUPER_ADMIN', 'SUPER_ADMIN'].includes(r.key) &&
          (assignableRoleKeys.includes(r.key) || r.key === editingUser.role)
      )
    : assignableFormRoles;

  const apiFetch = (url, init = {}) => branchFetch(currentUser, url, init);

  // Load users from API
  useEffect(() => {
    if (!allowed || !currentUser) return;
    fetchUsers();
  }, [allowed, currentUser]);

  const fetchUsers = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const response = await apiFetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : (data.users || []));
        setBranchInfo(data.branch || currentUser.branch || null);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChangeInUserForm = (newRole) => {
    const defaultModules = rolePermissions[newRole] || getRoleDefaultModules(newRole);
    setFormData(prev => ({
      ...prev,
      role: newRole,
      allowed_modules: defaultModules
    }));
  };

  const resetUserModulesToRoleDefault = () => {
    const defaultModules = rolePermissions[formData.role] || getRoleDefaultModules(formData.role);
    setFormData(prev => ({
      ...prev,
      allowed_modules: defaultModules
    }));
  };

  const selectFullAccessForUser = () => {
    setFormData((prev) => ({ ...prev, allowed_modules: getAllPageIds() }));
  };

  const clearAllAccessForUser = () => {
    setFormData((prev) => ({ ...prev, allowed_modules: ['dashboard'] }));
  };

  const handleModuleToggle = (moduleId) => {
    setFormData(prev => {
      const current = normalizeAllowedModules(prev.allowed_modules);
      const updated = current.includes(moduleId)
        ? current.filter(id => id !== moduleId)
        : [...current, moduleId];
      return { ...prev, allowed_modules: updated };
    });
  };

  const handleToggleSectionModules = (sectionIds, enable) => {
    setFormData(prev => {
      const current = new Set(normalizeAllowedModules(prev.allowed_modules));
      sectionIds.forEach((id) => (enable ? current.add(id) : current.delete(id)));
      return { ...prev, allowed_modules: [...current] };
    });
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          allowed_modules: normalizeAllowedModules(formData.allowed_modules),
        }),
      });

      if (response.ok) {
        const newUser = await response.json();
        setUsers(prev => [...prev, newUser]);
        setShowUserForm(false);
        const code = branchInfo?.branch_code || newUser.branch?.branch_code || newUser.login_hint?.branch_code;
        setCreatedCredentials({
          branchCode: code,
          branchName: branchInfo?.branch_name || newUser.branch?.branch_name,
          email: newUser.email,
          password: formData.password,
          fullName: newUser.full_name,
          role: newUser.role,
        });
        resetUserForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const resetUserForm = () => {
    setEditingUser(null);
    const initialRole = 'SALESMAN';
    setFormData({
      full_name: '',
      email: '',
      password: '',
      role: initialRole,
      status: 'ACTIVE',
      is_verified: false,
      allowed_modules: rolePermissions[initialRole] || getRoleDefaultModules(initialRole)
    });
  };

  const handleOpenAddUser = () => {
    resetUserForm();
    setAccessSectionFilter('all');
    setShowUserForm(true);
  };

  const resolveUserModules = (user) => {
    let modulesList = [];
    try {
      if (user.allowed_modules) {
        const raw = typeof user.allowed_modules === 'string'
          ? JSON.parse(user.allowed_modules)
          : user.allowed_modules;
        modulesList = normalizeAllowedModules(raw);
      }
    } catch {
      modulesList = [];
    }
    if (!modulesList.length) {
      modulesList = normalizeAllowedModules(
        rolePermissions[user.role] || getRoleDefaultModules(user.role)
      );
    }
    return modulesList;
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setAccessSectionFilter('all');
    const userRole = user.role || 'SALESMAN';
    const fallbackModules = rolePermissions[userRole] || getRoleDefaultModules(userRole);
    const modulesList = resolveUserModules(user);

    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: userRole,
      status: user.status || 'ACTIVE',
      is_verified: user.is_verified || false,
      allowed_modules: modulesList.length > 0 ? modulesList : fallbackModules
    });
    setShowUserForm(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await apiFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.user_id,
          ...formData,
          allowed_modules: normalizeAllowedModules(formData.allowed_modules),
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(prev => prev.map(user => 
          user.user_id === editingUser.user_id ? updatedUser : user
        ));

        syncSessionUserIfNeeded(updatedUser);

        setShowUserForm(false);
        resetUserForm();
        alert('User updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await apiFetch(`/api/users?id=${userId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setUsers(prev => prev.filter(user => user.user_id !== userId));
          alert('User deleted successfully!');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete user');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user');
      }
    }
  };

  const handleToggleStatus = async (userId) => {
    const user = users.find((u) => u.user_id === userId);
    if (!user) return;
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      let modulesList = [];
      try {
        if (user.allowed_modules) {
          const raw = typeof user.allowed_modules === 'string'
            ? JSON.parse(user.allowed_modules)
            : user.allowed_modules;
          modulesList = normalizeAllowedModules(raw);
        }
      } catch {
        modulesList = [];
      }
      if (!modulesList.length) {
        modulesList = normalizeAllowedModules(rolePermissions[user.role] || getRoleDefaultModules(user.role));
      }

      const response = await apiFetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          status: newStatus,
          is_verified: user.is_verified,
          allowed_modules: modulesList,
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers((prev) => prev.map((u) => (u.user_id === userId ? updatedUser : u)));
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'role') {
      handleRoleChangeInUserForm(value);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) return alert('Full name is required');
    if (!formData.email.trim()) return alert('Email is required');
    if (!editingUser && !formData.password.trim()) return alert('Password is required');

    if (editingUser) {
      await handleUpdateUser(e);
    } else {
      await handleAddUser(e);
    }
  };

  const handleToggleMatrixPermission = async (roleKey, moduleId) => {
    const currentModules = normalizeAllowedModules(rolePermissions[roleKey] || []);
    const updatedModules = currentModules.includes(moduleId)
      ? currentModules.filter((m) => m !== moduleId)
      : [...currentModules, moduleId];

    await saveRolePermissions(
      { ...rolePermissions, [roleKey]: updatedModules },
      roleKey
    );
  };

  const handleToggleSectionForRole = async (roleKey, sectionIds, enable) => {
    const current = new Set(normalizeAllowedModules(rolePermissions[roleKey] || []));
    sectionIds.forEach((id) => (enable ? current.add(id) : current.delete(id)));
    await saveRolePermissions({ ...rolePermissions, [roleKey]: [...current] }, roleKey);
  };

  const handleSelectAllForRole = async (roleKey) => {
    await saveRolePermissions({ ...rolePermissions, [roleKey]: getAllPageIds() }, roleKey);
  };

  const handleClearAllForRole = async (roleKey) => {
    await saveRolePermissions({ ...rolePermissions, [roleKey]: ['dashboard'] }, roleKey);
  };

  const resetAllRolesToDefault = async () => {
    if (!window.confirm('Reset all roles to factory defaults and apply to all staff accounts?')) return;

    localStorage.removeItem(ROLE_PERMISSIONS_STORAGE_KEY);
    const resetState = {};
    SYSTEM_ROLES.forEach((role) => {
      resetState[role.key] = getFactoryRoleModules(role.key, SYSTEM_ROLES);
    });
    setRolePermissions(resetState);
    saveCustomRolePermissions(resetState);

    setRoleSyncing(true);
    try {
      for (const role of visibleSystemRoles) {
        await syncRoleToUsers(role.key, resetState[role.key] || []);
      }
      alert('All roles reset to factory defaults and applied to staff.');
    } catch (e) {
      console.error('Failed to reset role permissions:', e);
      alert('Roles reset locally but some staff accounts could not be updated.');
    } finally {
      setRoleSyncing(false);
    }
  };

  const totalPageCount = getAllPageIds().length;

  // Filter users based on search and filter criteria
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
      const matchesVerified = verifiedFilter === 'all' || 
                             (verifiedFilter === 'verified' && user.is_verified) ||
                             (verifiedFilter === 'not-verified' && !user.is_verified);
      
      return matchesSearch && matchesRole && matchesStatus && matchesVerified;
    })
    .map((user, index) => ({
      ...user,
      sequentialId: index + 1
    }));

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
    setVerifiedFilter('all');
  };

  if (!allowed || loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 border-[3px] border-[#1A55E3]/20 border-t-[#1A55E3] rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading user management…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto pb-10">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-1">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">User Management</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {branchInfo ? `${branchInfo.branch_name} · Code: ${branchInfo.branch_code}` : 'Branch staff & access'}
            </p>
          </div>
          <button type="button" onClick={handleOpenAddUser} className={UM.btnPrimary}>
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <UmTabs
            active={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'staff', label: 'Staff List', count: filteredUsers.length },
              { id: 'access', label: 'Role Access Map', count: visibleSystemRoles.length },
            ]}
          />

          <div className="p-4">
            {activeTab === 'staff' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <input
                    type="text"
                    placeholder="Search name or email…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${UM.input} md:col-span-2`}
                  />
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className={UM.input}>
                    <option value="all">All roles</option>
                    {visibleSystemRoles.map((r) => (
                      <option key={r.key} value={r.key}>{r.name}</option>
                    ))}
                  </select>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={UM.input}>
                    <option value="all">All status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                  <button type="button" onClick={clearFilters} className={`${UM.btnGhost} text-xs`}>
                    Clear filters
                  </button>
                </div>

                <StaffExcelGrid
                  users={filteredUsers}
                  totalPageCount={totalPageCount}
                  rolePermissions={rolePermissions}
                  getRoleDefaultModules={getRoleDefaultModules}
                  onShare={setLoginInfoUser}
                  onViewAccess={(user) => {
                    setViewAccessUser(user);
                    setViewAccessSection('all');
                  }}
                  onEdit={handleEditUser}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDeleteUser}
                />
              </div>
            )}

            {activeTab === 'access' && (
              <RoleAccessMatrix
                roles={visibleSystemRoles}
                rolePermissions={rolePermissions}
                totalPageCount={totalPageCount}
                activeSection={accessSectionFilter}
                syncing={roleSyncing}
                onSectionChange={setAccessSectionFilter}
                onToggle={handleToggleMatrixPermission}
                onToggleSectionForRole={handleToggleSectionForRole}
                onSelectAllForRole={handleSelectAllForRole}
                onClearAllForRole={handleClearAllForRole}
                onResetDefaults={resetAllRolesToDefault}
                onApplyAllToStaff={applyAllRoleTemplatesToStaff}
              />
            )}
          </div>
        </div>

        {/* Add / Edit User */}
        {showUserForm && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowUserForm(false)} />
            <div className="relative w-full max-w-5xl max-h-[95vh] flex flex-col bg-white rounded-xl border border-slate-300 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-[#1A55E3] text-white flex items-center justify-between shrink-0">
                <h3 className="font-bold">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                <button type="button" onClick={() => setShowUserForm(false)} className="p-1 hover:bg-white/20 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-slate-200 shrink-0 bg-[#fafbfd]">
                  <div>
                    <label className={UM.label}>Full name *</label>
                    <input type="text" name="full_name" value={formData.full_name} onChange={handleFormChange} required className={UM.input} />
                  </div>
                  <div>
                    <label className={UM.label}>Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleFormChange} required className={UM.input} />
                  </div>
                  <div>
                    <label className={UM.label}>Password {editingUser ? '(blank = keep)' : '*'}</label>
                    <input type="password" name="password" value={formData.password} onChange={handleFormChange} required={!editingUser} className={UM.input} />
                  </div>
                  <div>
                    <label className={UM.label}>Role *</label>
                    <select name="role" value={formData.role} onChange={handleFormChange} className={UM.input}>
                      {formRoleOptions.map((r) => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={UM.label}>Status</label>
                    <select name="status" value={formData.status} onChange={handleFormChange} className={UM.input}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                      <input type="checkbox" name="is_verified" checked={formData.is_verified} onChange={handleFormChange} className="accent-[#1A55E3]" />
                      Email verified
                    </label>
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 overflow-hidden">
                  <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">
                    Page access — all system modules ({totalPageCount} pages)
                  </p>
                  <AccessExcelGrid
                    selected={formData.allowed_modules}
                    onToggle={handleModuleToggle}
                    onToggleSection={handleToggleSectionModules}
                    onSelectAll={selectFullAccessForUser}
                    onClearAll={clearAllAccessForUser}
                    onRoleDefault={resetUserModulesToRoleDefault}
                    roleLabel={getRoleDisplayName(formData.role)}
                    activeSection={accessSectionFilter}
                    onSectionChange={setAccessSectionFilter}
                    maxHeight="50vh"
                  />
                </div>

                <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0 bg-white">
                  <button type="button" onClick={() => setShowUserForm(false)} className={UM.btnGhost}>Cancel</button>
                  <button type="submit" className={UM.btnPrimary}>
                    <Check className="w-4 h-4" />
                    {editingUser ? 'Save' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {viewAccessUser && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setViewAccessUser(null)} />
            <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-xl border border-slate-300 shadow-2xl overflow-hidden">
              <div className="px-4 py-3 bg-[#1A55E3] text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold">{viewAccessUser.full_name} — Access</h3>
                  <p className="text-[10px] opacity-90">{getRoleDisplayName(viewAccessUser.role)} · {viewAccessUser.email}</p>
                </div>
                <button type="button" onClick={() => setViewAccessUser(null)} className="p-1 hover:bg-white/20 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto space-y-3">
                <AccessSummaryBar
                  selected={resolveUserModules(viewAccessUser)}
                  onSectionClick={setViewAccessSection}
                />
                <AccessExcelGrid
                  selected={resolveUserModules(viewAccessUser)}
                  activeSection={viewAccessSection}
                  onSectionChange={setViewAccessSection}
                  showSummary={false}
                  readOnly
                  maxHeight="45vh"
                />
              </div>
              <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setViewAccessUser(null)} className={UM.btnGhost}>Close</button>
                <button
                  type="button"
                  onClick={() => {
                    handleEditUser(viewAccessUser);
                    setViewAccessUser(null);
                  }}
                  className={UM.btnPrimary}
                >
                  Edit access
                </button>
              </div>
            </div>
          </div>
        )}

        {loginInfoUser && branchInfo && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm" onClick={() => setLoginInfoUser(null)} />
              <div className="relative w-full max-w-lg">
                <BranchLoginCredentialsPanel
                  credentials={{
                    branchCode: branchInfo.branch_code,
                    branchName: branchInfo.branch_name,
                    email: loginInfoUser.email,
                    fullName: loginInfoUser.full_name,
                    role: loginInfoUser.role,
                  }}
                  title={`Login info — ${loginInfoUser.full_name}`}
                  subtitle="Password cannot be retrieved. Edit the user to set a new password if needed."
                  compact
                  onClose={() => setLoginInfoUser(null)}
                />
              </div>
            </div>
          </div>
        )}

        {createdCredentials && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 py-8">
              <div
                className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm"
                onClick={() => setCreatedCredentials(null)}
              />
              <div className="relative w-full max-w-lg">
                <BranchLoginCredentialsPanel
                  credentials={createdCredentials}
                  title="Staff account created"
                  subtitle="Copy and share these login details with the new user. The password is shown once."
                  onClose={() => setCreatedCredentials(null)}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
