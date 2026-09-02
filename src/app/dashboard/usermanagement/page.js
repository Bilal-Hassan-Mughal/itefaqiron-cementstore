'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Plus, Edit, Trash2, Check, X, Mail, Lock, User, Shield, Clock, 
  Settings, Key, Layers, RefreshCw, CheckSquare, Square, Filter, Users, UserCheck, ShieldAlert, Award, Share2
} from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';
import { branchFetch, isHqPosMode } from '@/lib/branch-client';
import { isHqUser, BRANCH_ASSIGNABLE_ROLES } from '@/lib/branch-roles';
import { 
  getStaffRoleName, 
  isAdminRole, 
  canStaffAccessPath,
  SYSTEM_ROLES, 
  getRoleDefaultModules,
  getPagesBySection,
  normalizeAllowedModules,
  getAllPageIds,
} from '@/lib/staff-access';
import BranchLoginCredentialsPanel, { BranchCodeCopyChip } from '@/components/BranchLoginCredentialsPanel';

function PagePermissionGrid({ selected = [], onToggle, onToggleSection, compact = false }) {
  const sections = getPagesBySection();
  const selectedSet = new Set(normalizeAllowedModules(selected));

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
      {sections.map(({ section, pages }) => {
        const sectionIds = pages.map((p) => p.id);
        const allOn = sectionIds.every((id) => selectedSet.has(id));
        return (
          <div key={section} className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-100">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-600">{section}</span>
              <button
                type="button"
                onClick={() => onToggleSection?.(sectionIds, !allOn)}
                className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
              >
                {allOn ? 'Clear section' : 'Select all'}
              </button>
            </div>
            <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'} gap-2 p-3`}>
              {pages.map((page) => {
                const isChecked = selectedSet.has(page.id);
                return (
                  <label
                    key={page.id}
                    className={`flex items-start gap-2 cursor-pointer p-2 rounded-lg border transition-all ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggle(page.id)}
                      className="w-3.5 h-3.5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0"
                    />
                    <span className="text-[11px] font-semibold leading-snug">{page.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function UserManagementPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [loginInfoUser, setLoginInfoUser] = useState(null);

  // Active Tab: 'users' | 'roles' | 'matrix'
  const [activeTab, setActiveTab] = useState('users');

  // Role permissions template state (defaults loaded from SYSTEM_ROLES, with ability to customize)
  const [rolePermissions, setRolePermissions] = useState(() => {
    const initial = {};
    SYSTEM_ROLES.forEach(role => {
      initial[role.key] = getRoleDefaultModules(role.key);
    });
    return initial;
  });

  // Load customized role permissions from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRoles = localStorage.getItem('pos_custom_role_permissions');
      if (savedRoles) {
        try {
          const parsed = JSON.parse(savedRoles);
          const normalized = {};
          Object.keys(parsed).forEach((key) => {
            normalized[key] = normalizeAllowedModules(parsed[key]);
          });
          setRolePermissions(prev => ({ ...prev, ...normalized }));
        } catch (e) {
          console.error('Failed to parse saved role permissions:', e);
        }
      }
    }
  }, []);

  const saveRolePermissions = (updatedPermissions) => {
    setRolePermissions(updatedPermissions);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pos_custom_role_permissions', JSON.stringify(updatedPermissions));
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

  // Role Edit Modal State (Tab 2)
  const [editingRole, setEditingRole] = useState(null);
  const [roleFormModules, setRoleFormModules] = useState([]);

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

  const handleToggleRoleSection = (sectionIds, enable) => {
    setRoleFormModules((prev) => {
      const current = new Set(normalizeAllowedModules(prev));
      sectionIds.forEach((id) => (enable ? current.add(id) : current.delete(id)));
      return [...current];
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
    setShowUserForm(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    const userRole = user.role || 'SALESMAN';
    const fallbackModules = rolePermissions[userRole] || getRoleDefaultModules(userRole);
    let modulesList = fallbackModules;
    try {
      if (user.allowed_modules) {
        const raw = typeof user.allowed_modules === 'string'
          ? JSON.parse(user.allowed_modules)
          : user.allowed_modules;
        modulesList = normalizeAllowedModules(raw);
      }
    } catch (e) {
      console.error('Failed to parse allowed_modules:', e);
    }

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

        // Sync local storage if editing the logged-in user
        if (typeof window !== 'undefined') {
          const rawCurrent = localStorage.getItem('user');
          if (rawCurrent) {
            try {
              const cur = JSON.parse(rawCurrent);
              if (cur.user_id === updatedUser.user_id) {
                localStorage.setItem('user', JSON.stringify(updatedUser));
              }
            } catch (e) {
              console.error('Failed to sync current user session:', e);
            }
          }
        }

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

  const handleToggleStatus = (userId) => {
    setUsers(prev => prev.map(user => 
      user.user_id === userId 
        ? { ...user, status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
        : user
    ));
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

  // Role Edit Handlers
  const handleOpenEditRole = (role) => {
    setEditingRole(role);
    setRoleFormModules(
      normalizeAllowedModules(rolePermissions[role.key] || getRoleDefaultModules(role.key))
    );
  };

  const handleToggleRoleModule = (moduleId) => {
    setRoleFormModules((prev) => {
      const current = normalizeAllowedModules(prev);
      return current.includes(moduleId)
        ? current.filter((m) => m !== moduleId)
        : [...current, moduleId];
    });
  };

  const handleSaveRolePermissions = () => {
    if (!editingRole) return;
    const updated = {
      ...rolePermissions,
      [editingRole.key]: normalizeAllowedModules(roleFormModules),
    };
    saveRolePermissions(updated);
    setEditingRole(null);
    alert(`Permissions for role "${editingRole.name}" updated successfully!`);
  };

  // Matrix Cell Toggle Handler
  const handleToggleMatrixPermission = (roleKey, moduleId) => {
    const currentModules = normalizeAllowedModules(rolePermissions[roleKey] || []);
    const updatedModules = currentModules.includes(moduleId)
      ? currentModules.filter((m) => m !== moduleId)
      : [...currentModules, moduleId];

    const updated = {
      ...rolePermissions,
      [roleKey]: updatedModules,
    };
    saveRolePermissions(updated);
  };

  const resetAllRolesToDefault = () => {
    if (window.confirm('Reset all roles to their standard factory default permissions?')) {
      const resetState = {};
      SYSTEM_ROLES.forEach((role) => {
        resetState[role.key] = getRoleDefaultModules(role.key);
      });
      saveRolePermissions(resetState);
      alert('All role permissions reset to default successfully!');
    }
  };

  const totalPageCount = getAllPageIds().length;

  const getRoleIcon = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'ADMIN':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'MANAGER':
        return <Award className="w-4 h-4 text-purple-500" />;
      case 'ACCOUNTANT':
        return <Key className="w-4 h-4 text-emerald-500" />;
      case 'SALESMAN':
        return <User className="w-4 h-4 text-amber-500" />;
      case 'STOCK_MANAGER':
        return <Layers className="w-4 h-4 text-cyan-500" />;
      default:
        return <User className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeStyle = (roleKey) => {
    const sysRole = SYSTEM_ROLES.find(r => r.key === roleKey);
    return sysRole ? sysRole.color : 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusColor = (status) => {
    return status === 'ACTIVE' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

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
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Branch User Management</h2>
            <p className="text-gray-600 mt-1 text-sm">
              Create staff for this branch only. Each user signs in at <strong>Branch Login</strong> with your branch code.
            </p>
            {branchInfo && (
              <p className="text-sm mt-2 text-indigo-700 font-semibold flex flex-wrap items-center gap-2">
                <span>Branch: {branchInfo.branch_name} · Code for login:</span>
                <BranchCodeCopyChip branchCode={branchInfo.branch_code} />
              </p>
            )}
          </div>
          
          <button
            onClick={handleOpenAddUser}
            className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center"
          >
            <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-200" />
            Add New User
          </button>
        </div>

        {branchInfo && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 text-sm text-sky-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <strong>How staff log in:</strong> Home page → <strong>Branch Login</strong> → branch code → email &amp; password you assign here.
            </div>
            <BranchCodeCopyChip branchCode={branchInfo.branch_code} />
          </div>
        )}

        {/* Tab Navigation Header */}
        <div className="border-b border-gray-200 bg-white rounded-2xl shadow-sm p-2 flex space-x-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-150 whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users List ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-150 whitespace-nowrap ${
              activeTab === 'roles'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Role Management ({SYSTEM_ROLES.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-medium text-sm transition-all duration-150 whitespace-nowrap ${
              activeTab === 'matrix'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Permissions Matrix</span>
          </button>
        </div>

        {/* ==================================== TAB 1: USERS LIST ==================================== */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4 text-blue-600">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Users</p>
                    <p className="text-2xl font-black text-gray-900">{users.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4 text-green-600">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Users</p>
                    <p className="text-2xl font-black text-gray-900">
                      {users.filter(u => u.status === 'ACTIVE').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4 text-purple-600">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Admins / Managers</p>
                    <p className="text-2xl font-black text-gray-900">
                      {users.filter(u => ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(u.role)).length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mr-4 text-amber-600">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Verified Users</p>
                    <p className="text-2xl font-black text-gray-900">
                      {users.filter(u => u.is_verified).length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-bold text-gray-900 flex items-center">
                  <Filter className="w-4 h-4 mr-2 text-blue-600" />
                  Filter System Users
                </h3>
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                >
                  Clear All Filters
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Role Filter</label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                  >
                    <option value="all">All Roles</option>
                    {visibleSystemRoles.map(role => (
                      <option key={role.key} value={role.key}>{role.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                  >
                    <option value="all">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Verification</label>
                  <select
                    value={verifiedFilter}
                    onChange={(e) => setVerifiedFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                  >
                    <option value="all">All Status</option>
                    <option value="verified">Verified</option>
                    <option value="not-verified">Not Verified</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[550px]">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-md font-bold text-gray-900">User Accounts</h3>
                <span className="text-xs font-medium text-gray-500">
                  Showing {filteredUsers.length} of {users.length} users
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User Profile</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">System Role</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Module Access</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map((user) => {
                      let userModules = [];
                      try {
                        if (user.allowed_modules) {
                          const raw = typeof user.allowed_modules === 'string'
                            ? JSON.parse(user.allowed_modules)
                            : user.allowed_modules;
                          userModules = normalizeAllowedModules(raw);
                        }
                      } catch (e) {
                        userModules = [];
                      }
                      if (!Array.isArray(userModules) || userModules.length === 0) {
                        userModules = normalizeAllowedModules(
                          rolePermissions[user.role] || getRoleDefaultModules(user.role)
                        );
                      }

                      return (
                        <tr key={user.user_id} className="hover:bg-gray-50/80 transition-colors duration-150">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3 shadow-sm">
                                {user.full_name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{user.full_name}</div>
                                <div className="text-xs text-gray-400">ID: #{user.sequentialId}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                            {user.email}
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeStyle(user.role)}`}>
                              {getRoleIcon(user.role)}
                              <span className="ml-1.5">{user.role}</span>
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
                              {userModules.length} / {totalPageCount} Pages
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(user.status)}`}>
                              {user.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-sm">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setLoginInfoUser(user)}
                                className="text-sky-600 hover:text-sky-900 p-1.5 rounded-lg hover:bg-sky-50 transition-colors"
                                title="Share login info"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="text-blue-600 hover:text-blue-900 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                title="Edit User & Permissions"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleToggleStatus(user.user_id)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  user.status === 'ACTIVE' 
                                    ? 'text-red-600 hover:text-red-900 hover:bg-red-50' 
                                    : 'text-green-600 hover:text-green-900 hover:bg-green-50'
                                }`}
                                title={user.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                              >
                                {user.status === 'ACTIVE' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleDeleteUser(user.user_id)}
                                className="text-red-600 hover:text-red-900 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Delete User Account"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================== TAB 2: ROLE MANAGEMENT ==================================== */}
        {activeTab === 'roles' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-gray-900">System Role Definitions & Permission Templates</h3>
                  <p className="text-xs text-gray-600">Customize the default module permissions assigned when users are granted a specific system role.</p>
                </div>
              </div>
              
              <button
                onClick={resetAllRolesToDefault}
                className="text-xs bg-white text-gray-700 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 font-semibold shadow-sm flex items-center"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleSystemRoles.map(role => {
                const assignedModules = normalizeAllowedModules(
                  rolePermissions[role.key] || getRoleDefaultModules(role.key)
                );
                const assignedSet = new Set(assignedModules);
                const userCount = users.filter(u => u.role === role.key).length;
                const sectionSummaries = getPagesBySection()
                  .map(({ section, pages }) => {
                    const allowed = pages.filter((p) => assignedSet.has(p.id)).length;
                    return allowed > 0 ? { section, allowed, total: pages.length } : null;
                  })
                  .filter(Boolean);

                return (
                  <div key={role.key} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${role.color}`}>
                          {role.name}
                        </span>
                        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                          {userCount} {userCount === 1 ? 'User' : 'Users'}
                        </span>
                      </div>

                      <h4 className="text-md font-bold text-gray-900 mb-1">{role.name}</h4>
                      <p className="text-xs text-gray-500 leading-relaxed mb-4">{role.description}</p>

                      <div className="space-y-2 mb-6">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                          <span>Allowed Pages</span>
                          <span className="text-blue-600">{assignedModules.length} / {totalPageCount}</span>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {sectionSummaries.map(({ section, allowed, total }) => (
                            <span
                              key={section}
                              className="text-[10px] px-2 py-0.5 rounded-md font-medium border bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {section}: {allowed}/{total}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEditRole(role)}
                      className="w-full bg-gray-900 hover:bg-black text-white text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                      Configure Role Permissions
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================== TAB 3: PERMISSIONS MATRIX ==================================== */}
        {activeTab === 'matrix' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-md font-bold text-gray-900">Page Permissions Matrix</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Toggle individual sidebar page access for each system role.</p>
                </div>

                <button
                  onClick={resetAllRolesToDefault}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold px-3 py-2 rounded-xl transition-all flex items-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Restore Factory Defaults
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase w-1/3">Sidebar Page</th>
                      {visibleSystemRoles.map(role => (
                        <th key={role.key} className="px-3 py-3 text-center text-xs font-bold text-gray-700 uppercase">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${role.color}`}>
                            {role.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {getPagesBySection().map(({ section, pages }) => (
                      <Fragment key={section}>
                        <tr key={`section-${section}`} className="bg-slate-100/80">
                          <td
                            colSpan={visibleSystemRoles.length + 1}
                            className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-600"
                          >
                            {section}
                          </td>
                        </tr>
                        {pages.map((page) => (
                          <tr key={page.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-xs text-gray-900">{page.name}</div>
                              <div className="text-[11px] text-gray-400">{page.path}</div>
                            </td>

                            {visibleSystemRoles.map((role) => {
                              const roleModules = normalizeAllowedModules(rolePermissions[role.key] || []);
                              const isAllowed = roleModules.includes(page.id);
                              return (
                                <td key={role.key} className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => handleToggleMatrixPermission(role.key, page.id)}
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all ${
                                      isAllowed
                                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                                    }`}
                                  >
                                    {isAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================== MODAL 1: ADD / EDIT USER ==================================== */}
        {showUserForm && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm transition-opacity" 
                onClick={() => setShowUserForm(false)}
              />
              
              <div className="relative inline-block w-full max-w-3xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-3xl border border-gray-100">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mr-3">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">
                        {editingUser ? 'Edit User Profile' : 'Add New System User'}
                      </h3>
                      <p className="text-blue-100 text-xs">Configure credentials and module permissions</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowUserForm(false)} 
                    className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6">
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
                        <input
                          type="text"
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleFormChange}
                          required
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                          placeholder="e.g. Ali Ahmed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleFormChange}
                          required
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                          placeholder="user@example.com"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                          Password {editingUser ? '(leave blank to keep current)' : '*'}
                        </label>
                        <input
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleFormChange}
                          required={!editingUser}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                          placeholder="••••••••"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">User Role *</label>
                        <select
                          name="role"
                          value={formData.role}
                          onChange={handleFormChange}
                          required
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black font-semibold"
                        >
                          {formRoleOptions.map(role => (
                            <option key={role.key} value={role.key}>{role.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Account Status</label>
                        <select
                          name="status"
                          value={formData.status}
                          onChange={handleFormChange}
                          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm text-black"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </div>

                      <div className="flex items-center pt-5">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="is_verified"
                            checked={formData.is_verified}
                            onChange={handleFormChange}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold text-gray-700">Email Verified</span>
                        </label>
                      </div>
                    </div>

                    {/* Module Permissions Checklist */}
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-gray-900 flex items-center uppercase tracking-wider">
                          <Shield className="w-4 h-4 mr-1.5 text-blue-600" />
                          Page Permissions
                        </h4>

                        <button
                          type="button"
                          onClick={resetUserModulesToRoleDefault}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Reset to Role Default ({formData.role})
                        </button>
                      </div>

                      <PagePermissionGrid
                        selected={formData.allowed_modules}
                        onToggle={handleModuleToggle}
                        onToggleSection={handleToggleSectionModules}
                      />
                    </div>

                    <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setShowUserForm(false)}
                        className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center"
                      >
                        <Check className="w-4 h-4 mr-1.5" />
                        {editingUser ? 'Update User' : 'Create User'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================== MODAL 2: EDIT ROLE PERMISSIONS ==================================== */}
        {editingRole && (
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div 
                className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm transition-opacity" 
                onClick={() => setEditingRole(null)}
              />
              
              <div className="relative inline-block w-full max-w-3xl p-0 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-2xl rounded-3xl border border-gray-100">
                <div className="bg-gray-900 p-6 text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mr-3">
                      <Shield className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Configure Role: {editingRole.name}</h3>
                      <p className="text-xs text-gray-400">Set standard default module permissions for this role</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setEditingRole(null)} 
                    className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <PagePermissionGrid
                    selected={roleFormModules}
                    onToggle={handleToggleRoleModule}
                    onToggleSection={handleToggleRoleSection}
                  />

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingRole(null)}
                      className="px-5 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveRolePermissions}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md flex items-center"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Save Role Template
                    </button>
                  </div>
                </div>
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
