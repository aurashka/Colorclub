import React, { useState } from 'react';
import { DepositRequest, WithdrawalRequest, UserProfile } from '../types';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface WalletSectionProps {
  user: UserProfile;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  onDepositSubmit: (amount: number, utr: string) => Promise<void>;
  onWithdrawalSubmit: (
    amount: number,
    bankName: string,
    accountNumber: string,
    ifsc: string,
    upi: string
  ) => Promise<void>;
}

export default function WalletSection({
  user,
  deposits,
  withdrawals,
  onDepositSubmit,
  onWithdrawalSubmit,
}: WalletSectionProps) {
  // Navigation inside wallet
  const [activeSubTab, setActiveSubTab] = useState<'deposit' | 'withdrawal' | 'history'>('deposit');
  
  // Deposit States
  const [depAmount, setDepAmount] = useState<string>('');
  const [depUtr, setDepUtr] = useState<string>('');
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState('');
  const [depSuccess, setDepSuccess] = useState('');

  // Withdrawal States
  const [withAmount, setWithAmount] = useState<string>('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upi, setUpi] = useState('');
  const [withLoading, setWithLoading] = useState(false);
  const [withError, setWithError] = useState('');
  const [withSuccess, setWithSuccess] = useState('');

  // Filter lists for current user only
  const userDeposits = deposits
    .filter((d) => d.userId === user.uid)
    .sort((a, b) => b.createdAt - a.createdAt);
  const userWithdrawals = withdrawals
    .filter((w) => w.userId === user.uid)
    .sort((a, b) => b.createdAt - a.createdAt);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError('');
    setDepSuccess('');
    
    const amt = parseFloat(depAmount);
    if (isNaN(amt) || amt <= 0) {
      setDepError('Please enter a valid deposit amount.');
      return;
    }
    if (!depUtr.trim() || depUtr.trim().length < 8) {
      setDepError('Please enter a valid Transaction UTR reference (at least 8 characters).');
      return;
    }

    setDepLoading(true);
    try {
      await onDepositSubmit(amt, depUtr.trim());
      setDepSuccess('Deposit request submitted successfully! An administrator will review and approve it shortly.');
      setDepAmount('');
      setDepUtr('');
    } catch (err: any) {
      setDepError(err.message || 'Failed to submit deposit.');
    } finally {
      setDepLoading(false);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithError('');
    setWithSuccess('');

    const amt = parseFloat(withAmount);
    if (isNaN(amt) || amt <= 0) {
      setWithError('Please enter a valid withdrawal amount.');
      return;
    }
    if (amt > user.wallet) {
      setWithError(`Insufficient balance. You have $${user.wallet.toFixed(2)} in your wallet.`);
      return;
    }
    if (amt < 10) {
      setWithError('Minimum withdrawal amount is $10.00.');
      return;
    }

    if (!upi.trim() && (!accountNumber.trim() || !ifsc.trim() || !bankName.trim())) {
      setWithError('Please enter either a valid UPI ID or complete bank transfer details.');
      return;
    }

    setWithLoading(true);
    try {
      await onWithdrawalSubmit(amt, bankName.trim(), accountNumber.trim(), ifsc.trim().toUpperCase(), upi.trim());
      setWithSuccess('Withdrawal request submitted! The amount has been held, and an administrator will process it shortly.');
      setWithAmount('');
      setBankName('');
      setAccountNumber('');
      setIfsc('');
      setUpi('');
    } catch (err: any) {
      setWithError(err.message || 'Failed to submit withdrawal.');
    } finally {
      setWithLoading(false);
    }
  };

  const getStatusBadge = (status: string, holdReason?: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3 animate-spin text-amber-400" />
            <span>Pending Verification</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <div className="flex flex-col items-start space-y-1">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="h-3.5 w-3.5" />
              <span>Rejected</span>
            </span>
            {holdReason && (
              <span className="text-[9px] text-rose-400 font-mono italic block max-w-[150px] truncate" title={holdReason}>
                Note: {holdReason}
              </span>
            )}
          </div>
        );
      case 'hold':
        return (
          <div className="flex flex-col items-start space-y-1">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>On Hold</span>
            </span>
            {holdReason && (
              <span className="text-[9px] text-indigo-400 font-mono italic block max-w-[150px] truncate" title={holdReason}>
                Wait: {holdReason}
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 shadow-xl font-sans space-y-6 text-slate-200">
      {/* Wallet Balance Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-slate-400 text-xs uppercase tracking-wider font-bold">
            <Wallet className="h-4 w-4 text-emerald-400" />
            <span>Available Bidding Balance</span>
          </div>
          <span className="text-4xl font-black font-mono block text-white tracking-tighter pt-1">
            ${user.wallet !== undefined ? user.wallet.toFixed(2) : '0.00'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 sm:text-right max-w-xs leading-relaxed">
          <span>Funds are managed securely in the real-time ledger. A welcome registration bonus of $20.00 was credited to your address.</span>
        </div>
      </div>

      {/* Internal Navigation Tabs */}
      <div className="flex p-1 bg-slate-900/60 rounded-xl border border-slate-800/80">
        <button
          onClick={() => setActiveSubTab('deposit')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${
            activeSubTab === 'deposit'
              ? 'bg-[#1E293B] text-emerald-400 border-emerald-500/20 shadow-md'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-center space-x-1.5">
            <ArrowDownCircle className="h-4 w-4" />
            <span>Deposit</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('withdrawal')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${
            activeSubTab === 'withdrawal'
              ? 'bg-[#1E293B] text-rose-400 border-rose-500/20 shadow-md'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-center space-x-1.5">
            <ArrowUpCircle className="h-4 w-4" />
            <span>Withdrawal</span>
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${
            activeSubTab === 'history'
              ? 'bg-[#1E293B] text-blue-400 border-blue-500/20 shadow-md'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-center space-x-1.5">
            <Clock className="h-4 w-4" />
            <span>Request Logs</span>
          </div>
        </button>
      </div>

      {/* Active Form Sections */}
      {activeSubTab === 'deposit' && (
        <form onSubmit={handleDeposit} className="space-y-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-xs text-emerald-300 space-y-2 leading-relaxed">
            <span className="font-bold block text-emerald-400">🏦 Easy Deposit Instructions:</span>
            <p>1. Transfer the desired amount to our payment address: <span className="font-mono font-bold bg-slate-950 px-2 py-0.5 rounded border border-emerald-500/20 text-white">payment@prismcolor</span></p>
            <p>2. Copy the 12-digit transaction reference ID / UTR number from your payment app receipts.</p>
            <p>3. Fill in the amount and UTR code below to submit your claim. Admin verifies and unlocks funds instantly!</p>
          </div>

          {depError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
              <span>{depError}</span>
            </div>
          )}
          {depSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-ping" />
              <span>{depSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Deposit Amount ($)</label>
              <input
                type="number"
                min="1"
                required
                placeholder="e.g. 500"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white text-base"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Transaction UTR / Ref ID</label>
              <input
                type="text"
                required
                placeholder="12-digit reference ID"
                value={depUtr}
                onChange={(e) => setDepUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                className="block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white text-base font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={depLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-lg shadow-emerald-950/20"
          >
            {depLoading ? 'Submitting claims...' : 'Submit Deposit Notification'}
          </button>
        </form>
      )}

      {activeSubTab === 'withdrawal' && (
        <form onSubmit={handleWithdrawal} className="space-y-4">
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-xs text-purple-300 leading-relaxed">
            <span className="font-bold block text-purple-400">💳 Fast Withdrawal System:</span>
            <span>Withdrawals are processed directly back to your designated Bank account or UPI identifier. Processing requires 1 to 6 hours for blockchain settlement verification. Minimum withdrawal: $10.00.</span>
          </div>

          {withError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
              <span>{withError}</span>
            </div>
          )}
          {withSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 animate-ping" />
              <span>{withSuccess}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Amount to Withdraw ($)</label>
            <input
              type="number"
              min="10"
              required
              placeholder="e.g. 100"
              value={withAmount}
              onChange={(e) => setWithAmount(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-white text-base font-mono"
            />
          </div>

          {/* Transfer Channel Selector */}
          <div className="space-y-4 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Transfer Channel Information</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <div className="space-y-3">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">Option A: UPI Transfer</span>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">UPI ID / VPA</label>
                  <input
                    type="text"
                    placeholder="e.g. mobile@upi"
                    value={upi}
                    onChange={(e) => setUpi(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block border-b border-slate-800 pb-1.5">Option B: Bank Transfer</span>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Central State Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="block w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Account Number</label>
                    <input
                      type="text"
                      placeholder="Account number"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="block w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">IFSC / Branch Code</label>
                    <input
                      type="text"
                      placeholder="e.g. IFSC999"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value)}
                      className="block w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={withLoading}
            className="w-full bg-rose-600 hover:bg-rose-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-lg shadow-rose-950/20"
          >
            {withLoading ? 'Processing Request...' : 'Confirm Withdrawal Request'}
          </button>
        </form>
      )}

      {activeSubTab === 'history' && (
        <div className="space-y-6">
          {/* Deposits Logs */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cash Deposits History</h4>
            {userDeposits.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/40 p-4 rounded-xl border border-slate-800">No deposit entries found.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                <table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">
                    <tr>
                      <th className="px-4 py-3">UTR Reference</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status Badge</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {userDeposits.map((d) => (
                      <tr key={d.depositId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-200">{d.utr}</td>
                        <td className="px-4 py-3 font-bold text-emerald-400 font-mono">${d.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">{getStatusBadge(d.status, d.holdReason)}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {new Date(d.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Withdrawals Logs */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cash Withdrawals History</h4>
            {userWithdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/40 p-4 rounded-xl border border-slate-800">No withdrawal entries found.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                <table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">
                    <tr>
                      <th className="px-4 py-3">Channel info</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status Badge</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-sans">
                    {userWithdrawals.map((w) => (
                      <tr key={w.withdrawalId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-300">
                          {w.upi ? `UPI: ${w.upi}` : `Bank: ...${w.accountNumber?.slice(-4)}`}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-400 font-mono">${w.amount.toFixed(2)}</td>
                        <td className="px-4 py-3">{getStatusBadge(w.status, w.holdReason)}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
