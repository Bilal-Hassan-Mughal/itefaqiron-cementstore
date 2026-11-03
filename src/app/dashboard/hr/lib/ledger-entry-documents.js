/** Parse employee-ledger bill_no → document id for receipt / voucher actions. */

export function parseLedgerDocument(row) {
  const t = String(row?.trnx_type || '').toUpperCase();
  const bill = String(row?.bill_no || '');

  if (t === 'RECEIPT') {
    const m = bill.match(/^EMP-RCV-(\d+)$/i);
    return m ? { kind: 'receive', id: parseInt(m[1], 10), empId: row.emp_id } : null;
  }
  if (t === 'ADVANCE') {
    const m = bill.match(/^EMP-ADV-(\d+)$/i);
    return m ? { kind: 'advance', id: parseInt(m[1], 10), empId: row.emp_id } : null;
  }
  if (t === 'SALARY_PAYMENT') {
    const m = bill.match(/^EMP-PAYROLL-(\d+)-SALARY$/i);
    return m ? { kind: 'salary', id: parseInt(m[1], 10), empId: row.emp_id } : null;
  }
  return null;
}

export async function fetchEmployeeReceiveReceiptById(receiptId) {
  const res = await fetch(`/api/employee-receipts?id=${receiptId}`, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Receipt not found');
  }
  return res.json();
}

export async function fetchEmployeeAdvanceById(advanceId, empId) {
  const res = await fetch(`/api/employee-advances?emp_id=${empId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load advance');
  const list = await res.json();
  const row = (Array.isArray(list) ? list : []).find(
    (a) => Number(a.advance_id) === Number(advanceId)
  );
  if (!row) throw new Error('Advance record not found');
  return row;
}

export async function fetchPaidPayrollById(payrollId) {
  const res = await fetch(`/api/payroll?id=${payrollId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load salary payment');
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.status !== 'PAID') throw new Error('Paid salary receipt not available for this entry');
  return row;
}
