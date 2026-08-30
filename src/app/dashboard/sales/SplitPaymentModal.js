'use client';

import { X, Plus, CreditCard, Search } from 'lucide-react';
import { useState, useEffect } from 'react';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SplitPaymentModal({
  isOpen,
  onClose,
  splitPayments,
  setSplitPayments,
  netTotal,
  customers
}) {
  const [localSplitPayments, setLocalSplitPayments] = useState(splitPayments || []);

  // Account search states for each payment
  const [debitSearchTerms, setDebitSearchTerms] = useState({});
  const [creditSearchTerms, setCreditSearchTerms] = useState({});
  const [showDebitDropdowns, setShowDebitDropdowns] = useState({});
  const [showCreditDropdowns, setShowCreditDropdowns] = useState({});

  useEffect(() => {
    setLocalSplitPayments(splitPayments || []);
    // Initialize search terms from existing data
    const debitTerms = {};
    const creditTerms = {};
    (splitPayments || []).forEach((payment, index) => {
      const debitAccount = customers.find(c => c.cus_id === payment.debit_account_id);
      const creditAccount = customers.find(c => c.cus_id === payment.credit_account_id);
      if (debitAccount) debitTerms[index] = debitAccount.cus_name;
      if (creditAccount) creditTerms[index] = creditAccount.cus_name;
    });
    setDebitSearchTerms(debitTerms);
    setCreditSearchTerms(creditTerms);
  }, [splitPayments, customers]);

  // Filter customers by type
  const getCustomerAccounts = () => {
    return customers.filter(c => c.customer_category?.cus_cat_title?.toLowerCase().includes('customer'));
  };

  const getCashAccounts = () => {
    return customers.filter(c => c.customer_type?.cus_type_title === 'Cash Account');
  };

  // Filter for search
  const getFilteredCustomerAccounts = (searchTerm) => {
    const accounts = getCustomerAccounts();
    if (!searchTerm) return accounts;
    return accounts.filter(c =>
      c.cus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cus_phone_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getFilteredCashAccounts = (searchTerm) => {
    const accounts = getCashAccounts();
    if (!searchTerm) return accounts;
    return accounts.filter(c =>
      c.cus_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cus_phone_no?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const addPayment = () => {
    setLocalSplitPayments([...localSplitPayments, {
      amount: '',
      payment_type: 'CASH',
      debit_account_id: '',
      credit_account_id: '',
      reference: ''
    }]);
  };

  const removePayment = (index) => {
    setLocalSplitPayments(localSplitPayments.filter((_, i) => i !== index));
    // Clean up search terms
    const newDebitTerms = { ...debitSearchTerms };
    const newCreditTerms = { ...creditSearchTerms };
    delete newDebitTerms[index];
    delete newCreditTerms[index];
    setDebitSearchTerms(newDebitTerms);
    setCreditSearchTerms(newCreditTerms);
  };

  const updatePayment = (index, field, value) => {
    const updated = localSplitPayments.map((payment, i) =>
      i === index ? { ...payment, [field]: value } : payment
    );
    setLocalSplitPayments(updated);
  };

  const selectDebitAccount = (index, account) => {
    updatePayment(index, 'debit_account_id', account.cus_id);
    setDebitSearchTerms({ ...debitSearchTerms, [index]: account.cus_name });
    setShowDebitDropdowns({ ...showDebitDropdowns, [index]: false });
  };

  const selectCreditAccount = (index, account) => {
    updatePayment(index, 'credit_account_id', account.cus_id);
    setCreditSearchTerms({ ...creditSearchTerms, [index]: account.cus_name });
    setShowCreditDropdowns({ ...showCreditDropdowns, [index]: false });
  };

  const calculateTotal = () => {
    return localSplitPayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  };

  const handleSave = () => {
    // Validate
    if (localSplitPayments.length === 0) {
      alert('Please add at least one payment');
      return;
    }

    for (let payment of localSplitPayments) {
      if (!payment.amount || parseFloat(payment.amount) <= 0) {
        alert('All payments must have a valid amount greater than 0');
        return;
      }
      if (!payment.debit_account_id) {
        alert('All payments must have a debit account selected');
        return;
      }
      if (!payment.credit_account_id) {
        alert('All payments must have a credit account selected');
        return;
      }
    }

    const total = calculateTotal();
    if (Math.abs(total - netTotal) > 0.01) {
      alert(`Split payment total (${fmtAmt(total)}) must equal the net total (${fmtAmt(netTotal)})`);
      return;
    }

    setSplitPayments(localSplitPayments);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white bg-opacity-30 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
          <div className="flex items-center">
            <CreditCard className="w-6 h-6 text-white mr-3" />
            <h2 className="text-2xl font-bold text-white">Split Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors duration-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Net Total Amount</p>
                <p className="text-2xl font-bold text-blue-600">{fmtAmt(netTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Split Total</p>
                <p className={`text-2xl font-bold ${Math.abs(calculateTotal() - netTotal) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtAmt(calculateTotal())}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Difference</p>
                <p className={`text-2xl font-bold ${Math.abs(calculateTotal() - netTotal) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmtAmt(calculateTotal() - netTotal)}
                </p>
              </div>
            </div>
          </div>

          {/* Payments List */}
          <div className="space-y-4">
            {localSplitPayments.map((payment, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Payment {index + 1}</h3>
                  <button
                    onClick={() => removePayment(index)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors duration-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    <input
                      type="number"
                      value={payment.amount}
                      onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Payment Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Type *
                    </label>
                    <select
                      value={payment.payment_type}
                      onChange={(e) => updatePayment(index, 'payment_type', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    >
                      <option value="CASH">Cash</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                    </select>
                  </div>

                  {/* Debit Account (Customer Type) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      From Account (Debit) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={debitSearchTerms[index] || ''}
                        onChange={(e) => {
                          setDebitSearchTerms({ ...debitSearchTerms, [index]: e.target.value });
                          setShowDebitDropdowns({ ...showDebitDropdowns, [index]: true });
                          if (!e.target.value) {
                            updatePayment(index, 'debit_account_id', '');
                          }
                        }}
                        onFocus={() => setShowDebitDropdowns({ ...showDebitDropdowns, [index]: true })}
                        placeholder="Search customers..."
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute right-3 top-4" />

                      {showDebitDropdowns[index] && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredCustomerAccounts(debitSearchTerms[index]).length > 0 ? (
                            getFilteredCustomerAccounts(debitSearchTerms[index]).map((account) => (
                              <div
                                key={account.cus_id}
                                onClick={() => selectDebitAccount(index, account)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{account.cus_name}</div>
                                <div className="text-sm text-gray-500">{account.cus_phone_no}</div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              No customer accounts found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credit Account (Cash Account Type) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      To Account (Credit) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={creditSearchTerms[index] || ''}
                        onChange={(e) => {
                          setCreditSearchTerms({ ...creditSearchTerms, [index]: e.target.value });
                          setShowCreditDropdowns({ ...showCreditDropdowns, [index]: true });
                          if (!e.target.value) {
                            updatePayment(index, 'credit_account_id', '');
                          }
                        }}
                        onFocus={() => setShowCreditDropdowns({ ...showCreditDropdowns, [index]: true })}
                        placeholder="Search cash accounts..."
                        className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute right-3 top-4" />

                      {showCreditDropdowns[index] && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {getFilteredCashAccounts(creditSearchTerms[index]).length > 0 ? (
                            getFilteredCashAccounts(creditSearchTerms[index]).map((account) => (
                              <div
                                key={account.cus_id}
                                onClick={() => selectCreditAccount(index, account)}
                                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{account.cus_name}</div>
                                <div className="text-sm text-gray-500">{account.cus_phone_no}</div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-gray-500 text-center">
                              No cash accounts found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference
                    </label>
                    <input
                      type="text"
                      value={payment.reference}
                      onChange={(e) => updatePayment(index, 'reference', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                      placeholder="Optional reference"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Payment Button */}
          <button
            onClick={addPayment}
            className="mt-4 w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors duration-200 flex items-center justify-center font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Another Payment
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
          >
            Save Split Payments
          </button>
        </div>
      </div>
    </div>
  );
}

