import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, BidRecord, RoomType } from '../types';
import { COLOR_MAP } from '../utils/gameUtils';
import { ShieldAlert, Users, Check, X, Hand, DollarSign, Eye, EyeOff, Search, Settings, Radio, Plus, Percent } from 'lucide-react';

interface AdminPanelProps {
  users: UserProfile[];
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  activeBids: BidRecord[];
  activePeriodIdParity: string;
  activePeriodIdSapre: string;
  onUpdateUserWallet: (phone: string, newBalance: number) => Promise<void>;
  onHandleDeposit: (depositId: string, status: 'approved' | 'rejected' | 'hold', holdReason?: string) => Promise<void>;
  onHandleWithdrawal: (withdrawalId: string, status: 'approved' | 'rejected' | 'hold', holdReason?: string) => Promise<void>;
  onSetWinningOverride: (roomId: RoomType, num: number) => Promise<void>;
  onClearWinningOverride: (roomId: RoomType) => Promise<void>;
  currentOverrides: { [roomId: string]: number };
}

export default function AdminPanel({
  users,
  deposits,
  withdrawals,
  activeBids,
  activePeriodIdParity,
  activePeriodIdSapre,
  onUpdateUserWallet,
  onHandleDeposit,
  onHandleWithdrawal,
  onSetWinningOverride,
  onClearWinningOverride,
  currentOverrides,
}: AdminPanelProps) {
  // Navigation
  const [adminTab, setAdminTab] = useState<'transactions' | 'users' | 'manipulate'>('transactions');
  
  // Search State
  const [userSearch, setUserSearch] = useState('');
  
  // Balance Adjuster State
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  // Reason Modal State
  const [reasonModal, setReasonModal] = useState<{
    type: 'deposit' | 'withdrawal';
    id: string;
    action: 'rejected' | 'hold';
  } | null>(null);
  const [customReason, setCustomReason] = useState('');

  // Stats calculation
  const approvedDeposits = deposits.filter((d) => d.status === 'approved');
  const approvedWithdrawals = withdrawals.filter((w) => w.status === 'approved');
  const totalDeposited = approvedDeposits.reduce((acc, d) => acc + d.amount, 0);
  const totalWithdrawn = approvedWithdrawals.reduce((acc, w) => acc + w.amount, 0);
  const netProfit = totalDeposited - totalWithdrawn;

  // Filtered lists
  const pendingDeposits = deposits.filter((d) => d.status === 'pending' || d.status === 'hold');
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'pending' || w.status === 'hold');
  
  const filteredUsers = users.filter(
    (u) =>
      u.phone.includes(userSearch) ||
      u.nickname.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Manipulator stats: calculate total bidding amount for current active period (Parity / Sapre)
  const getBiddingPoolStats = (roomId: RoomType) => {
    const periodId = roomId === 'parity' ? activePeriodIdParity : activePeriodIdSapre;
    const roomBids = activeBids.filter((b) => b.roomId === roomId && b.periodId === periodId);
    
    let redTotal = 0;
    let greenTotal = 0;
    let violetTotal = 0;
    const numTotals = Array(10).fill(0);

    roomBids.forEach((b) => {
      if (b.selection === 'red') redTotal += b.amount;
      else if (b.selection === 'green') greenTotal += b.amount;
      else if (b.selection === 'violet') violetTotal += b.amount;
      else {
        const n = Number(b.selection);
        if (!isNaN(n)) numTotals[n] += b.amount;
      }
    });

    const totalPool = roomBids.reduce((acc, b) => acc + b.amount, 0);

    return {
      periodId,
      totalPool,
      redTotal,
      greenTotal,
      violetTotal,
      numTotals,
      bidsCount: roomBids.length
    };
  };

  const parityStats = getBiddingPoolStats('parity');
  const sapreStats = getBiddingPoolStats('sapre');

  const handleReasonSubmit = async () => {
    if (!reasonModal) return;
    try {
      if (reasonModal.type === 'deposit') {
        await onHandleDeposit(reasonModal.id, reasonModal.action, customReason.trim() || '');
      } else {
        await onHandleWithdrawal(reasonModal.id, reasonModal.action, customReason.trim() || '');
      }
      setReasonModal(null);
      setCustomReason('');
    } catch (err) {
      alert('Error updating request status');
    }
  };

  const handleBalanceUpdate = async (phone: string) => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) return;
    try {
      await onUpdateUserWallet(phone, amt);
      setEditingPhone(null);
      setAdjustAmount('');
    } catch (err) {
      alert('Failed to update balance');
    }
  };

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 shadow-xl font-sans space-y-8 text-slate-200">
      {/* Admin Title Bar */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide uppercase flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-purple-400 animate-pulse" />
            <span>Administrator Control Console</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Control live transactions, adjust credit ledgers, and manage game prediction states.</p>
        </div>

        {/* Admin Navigation */}
        <div className="flex p-1 bg-slate-900/60 rounded-xl border border-slate-800/80 w-full xl:w-auto overflow-x-auto">
          <button
            onClick={() => setAdminTab('transactions')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'transactions'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Deposits & Withdrawals ({pendingDeposits.length + pendingWithdrawals.length})
          </button>
          <button
            onClick={() => setAdminTab('users')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'users'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            User Database ({users.length})
          </button>
          <button
            onClick={() => setAdminTab('manipulate')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'manipulate'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Outcome Overrides
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-purple-400 bg-purple-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Approved Deposits</span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">${totalDeposited.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-rose-400 bg-rose-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Paid Withdrawals</span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">${totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-emerald-400 bg-emerald-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Net System Margin</span>
            <span className={`text-xl font-black font-mono block mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* REASON MODAL POPUP */}
      {reasonModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1E293B] rounded-2xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl space-y-4 text-slate-200">
            <div>
              <span className="text-[10px] font-bold text-purple-400 block uppercase tracking-widest">Provide Verification Note</span>
              <h4 className="text-base font-bold text-white mt-1">
                Reason for {reasonModal.action === 'rejected' ? 'Rejection' : 'Holding'}
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">This reason is shown directly on the user's Transaction Log widget.</p>
            </div>

            <textarea
              placeholder="e.g. Invalid transaction reference code / Bank gateway failed."
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-slate-600"
            />

            <div className="flex space-x-3">
              <button
                onClick={() => setReasonModal(null)}
                className="flex-1 border border-slate-700 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReasonSubmit}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Apply State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Contents: transactions */}
      {adminTab === 'transactions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Cash Deposits Queue */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-purple-400 flex items-center space-x-1.5 bg-purple-950/40 p-3 rounded-lg border border-purple-500/20">
              <span>📩 Deposit Requests Queue ({pendingDeposits.length})</span>
            </h4>
            {pendingDeposits.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/40 p-4 rounded-xl border border-slate-800">No pending deposit notifications.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {pendingDeposits.map((d) => (
                  <div key={d.depositId} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs hover:border-slate-700/60 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white block">{d.nickname}</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{d.phone}</span>
                        <span className="text-xs font-mono font-bold text-purple-400 block mt-1 bg-purple-500/5 border border-purple-500/20 px-2 py-0.5 rounded">UTR: {d.utr}</span>
                        {d.status === 'hold' && (
                          <div className="mt-1 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] rounded">
                            <span className="font-bold block">On Hold Reason:</span>
                            <span>{d.holdReason || 'Awaiting document verify.'}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold font-mono text-emerald-400 block">${d.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{new Date(d.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => onHandleDeposit(d.depositId, 'approved')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => setReasonModal({ type: 'deposit', id: d.depositId, action: 'rejected' })}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <X className="h-3 w-3" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => setReasonModal({ type: 'deposit', id: d.depositId, action: 'hold' })}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Hand className="h-3 w-3" />
                        <span>Hold</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cash Withdrawals Queue */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-rose-400 flex items-center space-x-1.5 bg-rose-950/40 p-3 rounded-lg border border-rose-500/20">
              <span>📤 Withdrawal Requests Queue ({pendingWithdrawals.length})</span>
            </h4>
            {pendingWithdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/40 p-4 rounded-xl border border-slate-800">No pending withdrawal requests.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {pendingWithdrawals.map((w) => (
                  <div key={w.withdrawalId} className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3 shadow-xs hover:border-slate-700/60 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-white block">{w.nickname}</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{w.phone}</span>
                        {w.upi ? (
                          <span className="text-xs font-semibold text-slate-300 block mt-1.5 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">UPI ID: {w.upi}</span>
                        ) : (
                          <div className="text-[10px] text-slate-400 font-mono space-y-0.5 block mt-1.5 bg-slate-950 p-2 rounded border border-slate-800">
                            <span className="block"><strong className="text-slate-500">Bank:</strong> {w.bankName}</span>
                            <span className="block"><strong className="text-slate-500">Acc:</strong> {w.accountNumber}</span>
                            <span className="block"><strong className="text-slate-500">IFSC:</strong> {w.ifsc}</span>
                          </div>
                        )}
                        {w.status === 'hold' && (
                          <div className="mt-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] rounded">
                            <span className="font-bold block">On Hold Reason:</span>
                            <span>{w.holdReason || 'Verifying credentials with ledger.'}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-base font-extrabold font-mono text-rose-400 block">${w.amount.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">{new Date(w.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => onHandleWithdrawal(w.withdrawalId, 'approved')}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Check className="h-3 w-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => setReasonModal({ type: 'withdrawal', id: w.withdrawalId, action: 'rejected' })}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <X className="h-3 w-3" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => setReasonModal({ type: 'withdrawal', id: w.withdrawalId, action: 'hold' })}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Hand className="h-3 w-3" />
                        <span>Hold</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Contents: users */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <input
              type="text"
              placeholder="Search user profile database by phone number or nickname..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-sm text-white placeholder-slate-600"
            />
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-widest font-bold font-mono">
                <tr>
                  <th className="px-6 py-4">Nickname</th>
                  <th className="px-6 py-4">Phone Number</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Wallet Balance</th>
                  <th className="px-6 py-4">Is Admin</th>
                  <th className="px-6 py-4 text-center">Credit Ledger Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{u.nickname}</td>
                    <td className="px-6 py-4 font-mono font-semibold text-slate-400">{u.phone}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{u.password || '••••'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">${u.wallet !== undefined ? u.wallet.toFixed(2) : '0.00'}</td>
                    <td className="px-6 py-4">
                      {u.isAdmin ? (
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">Admin</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">User</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center">
                        {editingPhone === u.phone ? (
                          <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="New balance"
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                              className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-white focus:outline-none"
                            />
                            <button
                              onClick={() => handleBalanceUpdate(u.phone)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded cursor-pointer transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingPhone(null)}
                              className="bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-750 transition-colors"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingPhone(u.phone);
                              setAdjustAmount(u.wallet.toString());
                            }}
                            className="text-purple-400 hover:text-white text-[10px] font-bold uppercase tracking-widest border border-slate-800 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer transition-all"
                          >
                            <Settings className="h-3 w-3" />
                            <span>Modify Credit Ledger</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Contents: manipulate */}
      {adminTab === 'manipulate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Parity manip */}
          <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <span className="inline-flex items-center space-x-1.5 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <Radio className="h-3 w-3 animate-pulse" />
                  <span>Parity Arena (1 min)</span>
                </span>
                <h4 className="text-base font-extrabold text-white mt-1">Active Block ID: {parityStats.periodId}</h4>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono">{parityStats.bidsCount} Active Bids</span>
            </div>

            {/* Pool Statistics summary */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Active Bidding Pool Allocation</span>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                  <span className="text-[9px] text-rose-400 block font-bold uppercase tracking-wider">RED POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${parityStats.redTotal.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                  <span className="text-[9px] text-emerald-400 block font-bold uppercase tracking-wider">GREEN POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${parityStats.greenTotal.toFixed(2)}</span>
                </div>
                <div className="bg-violet-500/5 p-2 rounded-lg border border-violet-500/10">
                  <span className="text-[9px] text-violet-400 block font-bold uppercase tracking-wider">VIOLET POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${parityStats.violetTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Numbers pool distribution */}
              <div className="pt-2">
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest mb-2">Specific Numbers Distribution</span>
                <div className="grid grid-cols-5 gap-2 text-[10px] font-mono">
                  {parityStats.numTotals.map((sum, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                      <span className="text-slate-500 font-bold block mb-0.5">No.{i}</span>
                      <span className="text-white font-bold block">${sum.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-400">Total Round Bets:</span>
                <span className="font-mono font-black text-purple-400 text-sm">${parityStats.totalPool.toFixed(2)}</span>
              </div>
            </div>

            {/* Overrides Controls */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">Force Winning Outcome:</span>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => {
                  const mapping = COLOR_MAP[i as keyof typeof COLOR_MAP];
                  const isCurrent = currentOverrides['parity'] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => onSetWinningOverride('parity', i)}
                      className={`py-2 rounded-xl font-bold text-sm transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <span className="block text-base font-mono">{i}</span>
                      <span className="text-[8px] opacity-60 uppercase font-mono block">
                        {mapping.premiumColor.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {currentOverrides['parity'] !== undefined ? (
                <div className="flex justify-between items-center bg-purple-500/10 p-3.5 rounded-xl border border-purple-500/20 text-xs">
                  <span className="text-purple-300 font-medium">
                    🔥 Manipulating outcome to: <span className="font-black text-white">Number {currentOverrides['parity']}</span> ({COLOR_MAP[currentOverrides['parity'] as keyof typeof COLOR_MAP].premiumColor})
                  </span>
                  <button
                    onClick={() => onClearWinningOverride('parity')}
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer underline text-[11px]"
                  >
                    Clear Override
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">No override active. Round will settle organically using standard blockchain-like random choice.</p>
              )}
            </div>
          </div>

          {/* Sapre manip */}
          <div className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <span className="inline-flex items-center space-x-1.5 text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <Radio className="h-3 w-3 animate-pulse" />
                  <span>Sapre Arena (3 min)</span>
                </span>
                <h4 className="text-base font-extrabold text-white mt-1">Active Block ID: {sapreStats.periodId}</h4>
              </div>
              <span className="text-[10px] font-bold uppercase text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono">{sapreStats.bidsCount} Active Bids</span>
            </div>

            {/* Pool Statistics summary */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Active Bidding Pool Allocation</span>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                  <span className="text-[9px] text-rose-400 block font-bold uppercase tracking-wider">RED POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${sapreStats.redTotal.toFixed(2)}</span>
                </div>
                <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                  <span className="text-[9px] text-emerald-400 block font-bold uppercase tracking-wider">GREEN POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${sapreStats.greenTotal.toFixed(2)}</span>
                </div>
                <div className="bg-violet-500/5 p-2 rounded-lg border border-violet-500/10">
                  <span className="text-[9px] text-violet-400 block font-bold uppercase tracking-wider">VIOLET POOL</span>
                  <span className="font-mono font-black text-white block mt-0.5">${sapreStats.violetTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Numbers pool distribution */}
              <div className="pt-2">
                <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest mb-2">Specific Numbers Distribution</span>
                <div className="grid grid-cols-5 gap-2 text-[10px] font-mono">
                  {sapreStats.numTotals.map((sum, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 p-2 rounded text-center">
                      <span className="text-slate-500 font-bold block mb-0.5">No.{i}</span>
                      <span className="text-white font-bold block">${sum.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-400">Total Round Bets:</span>
                <span className="font-mono font-black text-purple-400 text-sm">${sapreStats.totalPool.toFixed(2)}</span>
              </div>
            </div>

            {/* Overrides Controls */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest">Force Winning Outcome:</span>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }).map((_, i) => {
                  const mapping = COLOR_MAP[i as keyof typeof COLOR_MAP];
                  const isCurrent = currentOverrides['sapre'] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => onSetWinningOverride('sapre', i)}
                      className={`py-2 rounded-xl font-bold text-sm transition-all cursor-pointer border ${
                        isCurrent
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <span className="block text-base font-mono">{i}</span>
                      <span className="text-[8px] opacity-60 uppercase font-mono block">
                        {mapping.premiumColor.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {currentOverrides['sapre'] !== undefined ? (
                <div className="flex justify-between items-center bg-purple-500/10 p-3.5 rounded-xl border border-purple-500/20 text-xs">
                  <span className="text-purple-300 font-medium">
                    🔥 Manipulating outcome to: <span className="font-black text-white">Number {currentOverrides['sapre']}</span> ({COLOR_MAP[currentOverrides['sapre'] as keyof typeof COLOR_MAP].premiumColor})
                  </span>
                  <button
                    onClick={() => onClearWinningOverride('sapre')}
                    className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer underline text-[11px]"
                  >
                    Clear Override
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-slate-500 italic">No override active. Round will settle organically using standard blockchain-like random choice.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
