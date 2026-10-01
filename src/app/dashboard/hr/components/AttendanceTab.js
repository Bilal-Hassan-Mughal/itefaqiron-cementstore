'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Card, CardContent, Alert, Snackbar, CircularProgress, Skeleton,
} from '@mui/material';
import { useHrRefresh, HR_KEYS } from '../context/HrRefreshContext';
import { useHrAttendanceSheet } from '../hooks/useHrAttendanceSheet';
import { saveHrAttendanceBatch } from '../lib/hr-fetch';
import AttendanceSheetToolbar from './attendance/AttendanceSheetToolbar';
import AttendanceSheetGrid from './attendance/AttendanceSheetGrid';
import AttendanceStatusPicker from './attendance/AttendanceStatusPicker';
import {
  PRIMARY,
  CLEAR_SENTINEL,
  cellKey,
  isBeforeJoin,
  isFutureDay,
  isToday,
  isPastDay,
  canEditCell,
  buildDayMeta,
  statusMeta,
  mergeEditsIntoSheet,
  buildSavePayload,
  MONTHS_FULL,
  NAVY,
  OFF_HEADER,
  COMPANY,
} from './attendance/attendanceSheetShared';

export default function AttendanceTab() {
  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date();
    return { month: n.getMonth() + 1, year: n.getFullYear() };
  });
  const [designationFilter, setDesignationFilter] = useState('ALL');
  const [sheetEdits, setSheetEdits] = useState({});
  const [offDayEdits, setOffDayEdits] = useState({});
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [statusPicker, setStatusPicker] = useState(null);
  const [fadeIn, setFadeIn] = useState(true);
  const scrollContainerRef = useRef(null);

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });
  const { invalidate } = useHrRefresh();
  const { sheetData, loading, refreshing, error, replaceLocalSheet } = useHrAttendanceSheet(monthYear);

  const { month, year } = monthYear;

  useEffect(() => {
    setSheetEdits({});
    setOffDayEdits({});
  }, [month, year]);

  const dayMeta = useMemo(
    () => buildDayMeta(month, year, sheetData?.dayMeta),
    [month, year, sheetData?.dayMeta],
  );

  const scrollToDay = useCallback((day, smooth = true) => {
    setTimeout(() => {
      const el = scrollContainerRef.current?.querySelector(`[data-att-day="${day}"]`);
      el?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
    }, 200);
  }, []);

  useEffect(() => {
    if (loading) return;
    const now = new Date();
    if (now.getFullYear() !== year || now.getMonth() + 1 !== month) return;
    scrollToDay(now.getDate());
  }, [loading, month, year, scrollToDay]);

  const allEmployees = sheetData?.employees || [];

  const designations = useMemo(() => {
    const set = new Set(allEmployees.map((e) => e.designation || 'Unassigned').filter(Boolean));
    return ['ALL', ...Array.from(set).sort()];
  }, [allEmployees]);

  const filteredEmployees = useMemo(() => {
    if (designationFilter === 'ALL') return allEmployees;
    if (designationFilter === 'Unassigned') return allEmployees.filter((e) => !e.designation);
    return allEmployees.filter((e) => (e.designation || 'Unassigned') === designationFilter);
  }, [allEmployees, designationFilter]);

  const isOffDay = useCallback((day) => {
    if (offDayEdits[day] !== undefined) return offDayEdits[day];
    return (sheetData?.offDays || []).includes(day);
  }, [offDayEdits, sheetData?.offDays]);

  const getRawCellStatus = useCallback((empId, day) => {
    const key = cellKey(empId, day);
    if (sheetEdits[key] === CLEAR_SENTINEL) return null;
    if (sheetEdits[key] !== undefined) return sheetEdits[key];
    const record = sheetData?.grid?.[empId]?.[day];
    return record?.status || null;
  }, [sheetEdits, sheetData]);

  const getEffectiveStatus = useCallback((empId, day, empJoinDate) => {
    const raw = getRawCellStatus(empId, day);
    if (raw) return raw;
    if (isBeforeJoin(month, year, day, empJoinDate)) return null;
    if (isOffDay(day)) return 'HOLIDAY';
    return null;
  }, [month, year, getRawCellStatus, isOffDay]);

  const handleCellClick = (event, emp, day) => {
    if (!canEditCell(month, year, day)) return;
    setStatusPicker({
      anchorEl: event.currentTarget,
      empId: emp.emp_id,
      empName: emp.emp_name,
      day,
      joinDate: emp.join_date,
    });
  };

  const closeStatusPicker = () => setStatusPicker(null);

  const applyCellStatusChoice = (statusValue) => {
    if (!statusPicker) return;
    const { empId, day } = statusPicker;
    setSheetEdits((prev) => ({ ...prev, [cellKey(empId, day)]: statusValue }));
    closeStatusPicker();
  };

  const pickerSelectedValue = useMemo(() => {
    if (!statusPicker) return CLEAR_SENTINEL;
    const raw = getRawCellStatus(statusPicker.empId, statusPicker.day);
    if (raw) return raw;
    if (isOffDay(statusPicker.day)) return 'HOLIDAY';
    return CLEAR_SENTINEL;
  }, [statusPicker, getRawCellStatus, isOffDay]);

  const toggleOffDay = (day) => {
    if (isFutureDay(month, year, day)) {
      showSnack('Cannot set off day on a future date', 'info');
      return;
    }
    const willBeOff = !isOffDay(day);
    setOffDayEdits((prev) => ({ ...prev, [day]: willBeOff }));

    setSheetEdits((prev) => {
      const next = { ...prev };
      allEmployees.forEach((emp) => {
        if (isBeforeJoin(month, year, day, emp.join_date)) return;
        const key = cellKey(emp.emp_id, day);
        const raw = prev[key] === CLEAR_SENTINEL
          ? null
          : (prev[key] ?? sheetData?.grid?.[emp.emp_id]?.[day]?.status ?? null);

        if (willBeOff) {
          if (!raw || raw === 'HOLIDAY') next[key] = 'HOLIDAY';
        } else if (raw === 'HOLIDAY' || prev[key] === 'HOLIDAY') {
          next[key] = CLEAR_SENTINEL;
        }
      });
      return next;
    });

    showSnack(willBeOff ? `Day ${day} marked as off for all staff` : `Day ${day} off removed`, 'info');
  };

  const shiftMonth = (delta) => {
    setFadeIn(false);
    setTimeout(() => {
      setMonthYear((m) => {
        let newMonth = m.month + delta;
        let newYear = m.year;
        if (newMonth < 1) { newMonth = 12; newYear -= 1; }
        if (newMonth > 12) { newMonth = 1; newYear += 1; }
        return { month: newMonth, year: newYear };
      });
      setFadeIn(true);
    }, 120);
  };

  const goToToday = () => {
    const now = new Date();
    setMonthYear({ month: now.getMonth() + 1, year: now.getFullYear() });
    scrollToDay(now.getDate());
  };

  const markAllPresentToday = () => {
    const today = new Date().getDate();
    if (!isToday(month, year, today)) {
      showSnack('Switch to current month first', 'info');
      return;
    }
    const updates = {};
    filteredEmployees.forEach((emp) => {
      if (isBeforeJoin(month, year, today, emp.join_date)) return;
      updates[cellKey(emp.emp_id, today)] = 'PRESENT';
    });
    if (Object.keys(updates).length === 0) return;
    setSheetEdits((prev) => ({ ...prev, ...updates }));
    showSnack(`Marked ${Object.keys(updates).length} employee(s) present for today`, 'success');
  };

  async function saveSheet() {
    setSaving(true);
    try {
      const payload = buildSavePayload(sheetEdits, sheetData, month, year);

      if (payload.length === 0) {
        showSnack('No changes to save', 'info');
        return;
      }

      const result = await saveHrAttendanceBatch(payload);
      const savedCount = result?.saved ?? payload.length;

      replaceLocalSheet((prev) => mergeEditsIntoSheet(prev, sheetEdits), { markSynced: true });
      setSheetEdits({});
      setOffDayEdits({});
      showSnack(`Saved ${savedCount} attendance record(s)`);
      invalidate([HR_KEYS.payroll, HR_KEYS.summary]);
    } catch (err) {
      showSnack(err?.message || 'Failed to save sheet', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handlePrintSheet() {
    const emps = filteredEmployees;
    const period = `${MONTHS_FULL[month - 1]} ${year}`;
    const headDays = dayMeta.map((d) => {
      const todayCol = isToday(month, year, d.day);
      const off = isOffDay(d.day);
      const cls = [todayCol ? 'today' : '', off ? 'off' : ''].filter(Boolean).join(' ');
      const label = off ? '<small>OFF</small>' : todayCol ? '<small>TODAY</small>' : '';
      return `<th class="${cls}"><small>${d.weekdayLabel}</small>${label}${d.day}</th>`;
    }).join('');

    const bodyRows = emps.map((emp) => {
      const cells = dayMeta.map(({ day }) => {
        const beforeJoin = isBeforeJoin(month, year, day, emp.join_date);
        const future = isFutureDay(month, year, day);
        const status = getEffectiveStatus(emp.emp_id, day, emp.join_date);
        const meta = statusMeta(status, future, beforeJoin, isPastDay(month, year, day));
        return `<td><span class="badge" style="background:${meta.bg};color:${meta.color}">${meta.label}</span></td>`;
      }).join('');
      return `<tr>
        <td class="worker"><strong>${emp.emp_name}</strong><small>${(emp.designation || '—').toUpperCase()}</small></td>
        ${cells}
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Attendance — ${period}</title>
<style>
  @page { size: landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; }
  h1 { font-size: 14px; margin: 0 0 4px; }
  .sub { color: #64748b; margin-bottom: 10px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${NAVY}; color: #fff; padding: 6px 3px; font-size: 10px; }
  th small { display: block; font-size: 7px; opacity: 0.8; }
  th.today { background: ${PRIMARY}; }
  th.off { background: ${OFF_HEADER}; }
  td { border-bottom: 1px solid #e2e8f0; padding: 5px 2px; text-align: center; }
  td.worker { text-align: left; min-width: 130px; padding-left: 8px; }
  td.worker small { display: block; color: #64748b; font-size: 8px; margin-top: 2px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { display: inline-block; min-width: 20px; padding: 2px 4px; border-radius: 4px; font-weight: 800; font-size: 9px; }
</style></head><body>
  <h1>${COMPANY.nameShort} — Monthly Attendance Sheet</h1>
  <div class="sub">${period} · ${emps.length} worker(s)</div>
  <table><thead><tr><th>Employee</th>${headDays}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const editCount = Object.keys(sheetEdits).length;
  const isCurrentMonth = (() => {
    const n = new Date();
    return n.getFullYear() === year && n.getMonth() + 1 === month;
  })();

  const showInitialLoad = loading && !sheetData;
  const showGrid = sheetData && allEmployees.length > 0;

  return (
    <Box>
      <Card elevation={0} sx={{ borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: 'transparent', overflow: 'hidden' }}>
        <AttendanceSheetToolbar
          month={month}
          year={year}
          dayCount={dayMeta.length}
          workerCount={filteredEmployees.length}
          designationFilter={designationFilter}
          designations={designations}
          allEmployeeCount={allEmployees.length}
          allEmployees={allEmployees}
          isCurrentMonth={isCurrentMonth}
          editCount={editCount}
          saving={saving}
          refreshing={refreshing}
          onShiftMonth={shiftMonth}
          onGoToday={goToToday}
          onDesignationChange={setDesignationFilter}
          onMarkAllPresentToday={markAllPresentToday}
          onPrint={handlePrintSheet}
          onSave={saveSheet}
        />

        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, position: 'relative' }}>
          {error && (
            <Alert severity="error" sx={{ m: 2, borderRadius: '12px' }}>
              {error}
            </Alert>
          )}
          {showInitialLoad ? (
            <Box sx={{ py: 4, px: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                <CircularProgress sx={{ color: PRIMARY }} size={36} />
              </Box>
              <Skeleton variant="rounded" height={420} sx={{ borderRadius: '12px' }} />
            </Box>
          ) : allEmployees.length === 0 ? (
            <Alert severity="warning" sx={{ m: 2, borderRadius: '12px' }}>
              No active employees found. Add staff in Employee Register first.
            </Alert>
          ) : showGrid ? (
            <AttendanceSheetGrid
              ref={scrollContainerRef}
              month={month}
              year={year}
              dayMeta={dayMeta}
              filteredEmployees={filteredEmployees}
              sheetEdits={sheetEdits}
              getEffectiveStatus={getEffectiveStatus}
              isOffDay={isOffDay}
              onToggleOffDay={toggleOffDay}
              onCellClick={handleCellClick}
              fadeIn={fadeIn}
            />
          ) : null}
        </CardContent>
      </Card>

      <AttendanceStatusPicker
        open={Boolean(statusPicker?.anchorEl)}
        anchorEl={statusPicker?.anchorEl}
        onClose={closeStatusPicker}
        statusPicker={statusPicker}
        month={month}
        year={year}
        pickerSelectedValue={pickerSelectedValue}
        isOffDay={statusPicker ? isOffDay(statusPicker.day) : false}
        isBeforeJoinDay={statusPicker ? isBeforeJoin(month, year, statusPicker.day, statusPicker.joinDate) : false}
        onChoose={applyCellStatusChoice}
      />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
