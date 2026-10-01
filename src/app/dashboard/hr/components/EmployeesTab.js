'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Box, Typography, Button, Dialog, DialogActions, Alert, Snackbar, CircularProgress,
} from '@mui/material';
import { useHrRefresh } from '../context/HrRefreshContext';
import { useHrEmployees } from '../hooks/useHrEmployees';
import EmployeeRegisterList from './employees/EmployeeRegisterList';
import {
  EMPTY_FORM,
  defaultJoinDate,
  employeeToFormData,
  formDataToEmployeeRow,
} from './employees/employeeRegisterShared';

const EmployeeRegisterFormDialog = dynamic(
  () => import('./employees/EmployeeRegisterFormDialog'),
  { loading: () => null }
);

export default function EmployeesTab() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const {
    employees,
    stats,
    total,
    hasMore,
    loading,
    loadingMore,
    refreshing,
    error,
    loadMore,
    replaceLocal,
    mergeServerRow,
    removeLocal,
    softSync,
  } = useHrEmployees({ status: statusFilter, search });
  const { invalidateEmployeeRegisterSave } = useHrRefresh();
  const router = useRouter();

  const [formState, setFormState] = useState({ open: false, mode: 'add', data: EMPTY_FORM });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const syncOtherHrTabs = useCallback(() => {
    invalidateEmployeeRegisterSave();
  }, [invalidateEmployeeRegisterSave]);

  const viewEmployeeLedger = useCallback((emp) => {
    if (!emp?.emp_id || String(emp.emp_id).startsWith('temp-')) return;
    router.push(`/dashboard/hr?module=employee-ledger&emp_id=${emp.emp_id}`, { scroll: false });
  }, [router]);

  const openAdd = () => {
    setFormState({
      open: true,
      mode: 'add',
      data: {
        ...EMPTY_FORM,
        join_date: defaultJoinDate(),
        allowed_leaves_per_month: '2',
        allowed_absents_per_month: '0',
      },
    });
  };

  const openEdit = (emp) => {
    setFormState({
      open: true,
      mode: 'edit',
      data: employeeToFormData(emp),
    });
  };

  const closeForm = () => {
    if (!saving) setFormState((s) => ({ ...s, open: false }));
  };

  const handleSubmit = async (formData) => {
    if (!formData.emp_name?.trim()) {
      setSnack({ open: true, msg: 'Name is required', severity: 'error' });
      return;
    }

    const mode = formState.mode;
    const tempId = mode === 'add' ? `temp-${Date.now()}` : null;
    const previous = mode === 'edit'
      ? employees.find((e) => e.emp_id === formData.emp_id)
      : null;
    const snapshot = employees;

    const optimistic = formDataToEmployeeRow(formData, { previous });
    if (tempId) optimistic.emp_id = tempId;

    if (mode === 'add') {
      replaceLocal([...employees, optimistic].sort((a, b) => a.emp_name.localeCompare(b.emp_name)));
    } else {
      replaceLocal(
        employees.map((e) => (e.emp_id === formData.emp_id ? optimistic : e))
      );
    }

    setSaving(true);

    try {
      const res = await fetch('/api/employees', {
        method: mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) {
        replaceLocal(snapshot);
        setFormState((s) => ({ ...s, open: true, data: formData }));
        setSnack({ open: true, msg: json.error || 'Save failed', severity: 'error' });
        return;
      }
      mergeServerRow(json, tempId || formData.emp_id);
      setFormState((s) => ({ ...s, open: false }));
      setSnack({
        open: true,
        msg: mode === 'add' ? 'Employee added' : 'Employee updated',
        severity: 'success',
      });
      syncOtherHrTabs();
    } catch {
      replaceLocal(snapshot);
      setSnack({ open: true, msg: 'Network error', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const { id } = deleteDialog;
    if (!id) return;
    const snapshot = employees;
    removeLocal(id);
    setDeleteDialog({ open: false, id: null, name: '' });
    setDeleting(true);

    try {
      const res = await fetch(`/api/employees?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        replaceLocal(snapshot);
        setSnack({ open: true, msg: 'Delete failed', severity: 'error' });
        return;
      }
      setSnack({ open: true, msg: 'Employee deleted', severity: 'success' });
      syncOtherHrTabs();
    } catch {
      replaceLocal(snapshot);
      setSnack({ open: true, msg: 'Network error', severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => softSync()}>
          {error} — tap to retry sync
        </Alert>
      )}

      <EmployeeRegisterList
        employees={employees}
        stats={stats}
        total={total}
        loading={loading}
        loadingMore={loadingMore}
        refreshing={refreshing}
        hasMore={hasMore}
        onLoadMore={loadMore}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onAdd={openAdd}
        onEdit={openEdit}
        onDelete={(emp) => setDeleteDialog({ open: true, id: emp.emp_id, name: emp.emp_name })}
        onViewLedger={viewEmployeeLedger}
      />

      {formState.open && (
        <EmployeeRegisterFormDialog
          open={formState.open}
          mode={formState.mode}
          initialData={formState.data}
          saving={saving}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onHelp={() => setSnack({
            open: true,
            severity: 'info',
            msg: 'Fill personal and job details, then salary and leave limits. Active staff appear in attendance and payroll.',
          })}
        />
      )}

      <Dialog
        open={deleteDialog.open}
        onClose={() => !deleting && setDeleteDialog({ open: false, id: null, name: '' })}
        PaperProps={{ sx: { borderRadius: '14px', minWidth: 360 } }}
      >
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Delete Employee</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 1 }}>
            Remove <strong>{deleteDialog.name}</strong> from the system? This cannot be undone.
          </Typography>
        </Box>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setDeleteDialog({ open: false, id: null, name: '' })}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
