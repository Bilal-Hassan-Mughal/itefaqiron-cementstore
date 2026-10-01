'use client';

import { forwardRef } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import AttendanceCellButton from './AttendanceCellButton';
import {
  NAVY, NAVY_MID, PRIMARY, TODAY_RING, OFF_HEADER,
  DAY_COL_WIDTH, NAME_COL_WIDTH,
  cellKey, isBeforeJoin, isFutureDay, isToday, isPastDay, canEditCell,
  statusMeta, colBg,
} from './attendanceSheetShared';

const dayColSx = {
  minWidth: DAY_COL_WIDTH,
  width: DAY_COL_WIDTH,
  maxWidth: DAY_COL_WIDTH,
  px: 0.25,
  boxSizing: 'border-box',
};

const AttendanceSheetGrid = forwardRef(function AttendanceSheetGrid(
  {
    month,
    year,
    dayMeta,
    filteredEmployees,
    sheetEdits,
    getEffectiveStatus,
    isOffDay,
    onToggleOffDay,
    onCellClick,
    fadeIn,
  },
  ref,
) {
  return (
    <Box sx={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.2s ease' }}>
      <TableContainer
        ref={ref}
        sx={{
          maxHeight: 580,
          overflowX: 'auto',
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          width: '100%',
          '&::-webkit-scrollbar': { height: 10, width: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: '#f1f5f9' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 5, '&:hover': { bgcolor: '#94a3b8' } },
        }}
      >
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: NAME_COL_WIDTH + dayMeta.length * DAY_COL_WIDTH }}>
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 6,
                  width: NAME_COL_WIDTH,
                  minWidth: NAME_COL_WIDTH,
                  bgcolor: NAVY,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.65rem',
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  borderBottom: 'none',
                  py: 1.75,
                  boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
                }}
              >
                Employee
              </TableCell>
              {dayMeta.map((d) => {
                const today = isToday(month, year, d.day);
                const off = isOffDay(d.day);
                let headerBg = NAVY_MID;
                if (today) headerBg = PRIMARY;
                else if (off) headerBg = OFF_HEADER;
                const future = isFutureDay(month, year, d.day);

                return (
                  <TableCell
                    key={d.day}
                    data-att-day={d.day}
                    align="center"
                    onClick={() => { if (!future) onToggleOffDay(d.day); }}
                    sx={{
                      ...dayColSx,
                      bgcolor: headerBg,
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      py: today || off ? 0.9 : 1.4,
                      borderBottom: 'none',
                      lineHeight: 1.1,
                      cursor: future ? 'default' : 'pointer',
                      userSelect: 'none',
                      opacity: future ? 0.55 : 1,
                      transition: 'background-color 0.15s ease',
                      boxShadow: today ? `inset 0 -3px 0 ${TODAY_RING}` : 'none',
                      '&:hover': { filter: future ? 'none' : 'brightness(1.12)' },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>
                      {d.weekdayLabel}
                    </Typography>
                    {off && (
                      <Typography component="div" sx={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                        OFF
                      </Typography>
                    )}
                    {today && !off && (
                      <Typography component="div" sx={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                        NOW
                      </Typography>
                    )}
                    {d.day}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredEmployees.map((emp, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
              return (
                <TableRow key={emp.emp_id} sx={{ '&:hover': { bgcolor: '#f1f5f9' } }}>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      width: NAME_COL_WIDTH,
                      minWidth: NAME_COL_WIDTH,
                      bgcolor: rowBg,
                      borderBottom: '1px solid #eef2f6',
                      borderRight: '1px solid #e8edf4',
                      py: 1.25,
                      boxShadow: '3px 0 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: NAVY, lineHeight: 1.2, noWrap: true, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.emp_name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.04em', mt: 0.25, textTransform: 'uppercase' }}>
                      {emp.designation || '—'}
                    </Typography>
                  </TableCell>
                  {dayMeta.map((d) => {
                    const { day } = d;
                    const beforeJoin = isBeforeJoin(month, year, day, emp.join_date);
                    const future = isFutureDay(month, year, day);
                    const editable = canEditCell(month, year, day);
                    const status = getEffectiveStatus(emp.emp_id, day, emp.join_date);
                    const meta = statusMeta(status, future, beforeJoin, isPastDay(month, year, day));
                    const edited = sheetEdits[cellKey(emp.emp_id, day)] !== undefined;
                    const todayCol = isToday(month, year, day);
                    const offCol = isOffDay(day);
                    const pastCol = isPastDay(month, year, day);

                    return (
                      <TableCell
                        key={day}
                        data-att-day={day}
                        align="center"
                        sx={{
                          ...dayColSx,
                          py: 0.75,
                          borderBottom: '1px solid #eef2f6',
                          bgcolor: colBg({ today: todayCol, off: offCol, rowBg }),
                          ...(todayCol && { boxShadow: `inset 0 0 0 1px ${TODAY_RING}` }),
                          ...(pastCol && !todayCol && editable && { bgcolor: 'rgba(100, 116, 139, 0.04)' }),
                        }}
                      >
                        {editable ? (
                          <AttendanceCellButton
                            meta={meta}
                            edited={edited}
                            clickable
                            isTodayCol={todayCol}
                            isPastCol={pastCol}
                            onClick={(e) => onCellClick(e, emp, day)}
                          />
                        ) : (
                          <AttendanceCellButton meta={meta} edited={false} clickable={false} isTodayCol={false} isPastCol={false} />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
});

export default AttendanceSheetGrid;
