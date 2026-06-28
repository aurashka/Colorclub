import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, BidRecord, RoomType, GamePeriod, DepositChannel, DepositChannelField, WithdrawalField } from '../types';
import { COLOR_MAP } from '../utils/gameUtils';
import { ShieldAlert, Users, Check, X, DollarSign, Search, Settings, Radio, Plus, Percent, Calendar, Trash2, Clock, Landmark, Layers, Send, QrCode, CreditCard } from 'lucide-react';

interface AdminPanelProps {
  users: UserProfile[];
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  activeBids: BidRecord[];
  activePeriodId30s: string;
  activePeriodId1m: string;
  activePeriodId3m: string;
  history: GamePeriod[];
  onUpdateUserWallet: (userKey: string, newBalance: number) => Promise<void>;
  onHandleDeposit: (depositId: string, status: 'approved' | 'rejected' | 'hold', holdReason?: string) => Promise<void>;
  onHandleWithdrawal: (withdrawalId: string, status: 'approved' | 'rejected' | 'hold', holdReason?: string) => Promise<void>;
  onSetWinningOverride: (roomId: RoomType, num: number) => Promise<void>;
  onClearWinningOverride: (roomId: RoomType) => Promise<void>;
  currentOverrides: { [roomId: string]: number };
  
  // Scheduled Future Preset Overrides
  onSetPresetResult: (roomId: RoomType, periodId: string, num: number) => Promise<void>;
  onClearPresetResult: (roomId: RoomType, periodId: string) => Promise<void>;
  presetResults: { [roomId: string]: { [periodId: string]: number } };

  // Customizable payment channels and withdrawal fields
  depositChannels: DepositChannel[];
  withdrawalFields: WithdrawalField[];
  onUpdateDepositChannels: (channels: DepositChannel[]) => Promise<void>;
  onUpdateWithdrawalConfig: (fields: WithdrawalField[]) => Promise<void>;
}

const getEmailKey = (email: string): string => {
  return email.toLowerCase().trim()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_');
};

export default function AdminPanel({
  users,
  deposits,
  withdrawals,
  activeBids,
  activePeriodId30s,
  activePeriodId1m,
  activePeriodId3m,
  history,
  onUpdateUserWallet,
  onHandleDeposit,
  onHandleWithdrawal,
  onSetWinningOverride,
  onClearWinningOverride,
  currentOverrides,
  onSetPresetResult,
  onClearPresetResult,
  presetResults,
  depositChannels = [],
  withdrawalFields = [],
  onUpdateDepositChannels,
  onUpdateWithdrawalConfig,
}: AdminPanelProps) {
  // Navigation
  const [adminTab, setAdminTab] = useState<'transactions' | 'users' | 'manipulate' | 'payments'>('transactions');
  
  // Search State
  const [userSearch, setUserSearch] = useState('');
  
  // Balance Adjuster State
  const [editingUserKey, setEditingUserKey] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');

  // Future Preset Form State
  const [presetRoom, setPresetRoom] = useState<RoomType>('30s');
  const [presetPeriodId, setPresetPeriodId] = useState('');
  const [presetNumber, setPresetNumber] = useState<number | null>(null);

  // Reason Modal State
  const [reasonModal, setReasonModal] = useState<{
    type: 'deposit' | 'withdrawal';
    id: string;
    action: 'rejected' | 'hold';
  } | null>(null);
  const [customReason, setCustomReason] = useState('');

  // ---------------- Deposit Channels Configuration State ----------------
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    depositChannels && depositChannels.length > 0 ? depositChannels[0].id : ''
  );

  // Auto select first channel if none is selected
  React.useEffect(() => {
    if (depositChannels && depositChannels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(depositChannels[0].id);
    }
  }, [depositChannels, selectedChannelId]);

  // Selected channel object derived from state
  const currentChan = depositChannels.find(c => c.id === selectedChannelId) || null;

  // New Deposit Channel Form State
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [newChanName, setNewChanName] = useState('');
  const [newChanType, setNewChanType] = useState<'qr' | 'upi' | 'bank' | 'custom'>('qr');
  const [newChanBonus, setNewChanBonus] = useState<string>('0.20');

  // Dynamic field addition state for selected deposit channel
  const [depFieldLabel, setDepFieldLabel] = useState('');
  const [depFieldPlaceholder, setDepFieldPlaceholder] = useState('');
  const [depFieldType, setDepFieldType] = useState<'text' | 'number'>('text');
  const [depFieldRequired, setDepFieldRequired] = useState(true);

  // General Notification Alert State
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState('');
  const [paymentErrorMsg, setPaymentErrorMsg] = useState('');

  // ---------------- Withdrawal Custom Fields Form State ----------------
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldPlaceholder, setNewFieldPlaceholder] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number'>('text');
  const [newFieldRequired, setNewFieldRequired] = useState(true);

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
      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.phone && u.phone.includes(userSearch)) ||
      (u.nickname && u.nickname.toLowerCase().includes(userSearch.toLowerCase()))
  );

  // Manipulator stats: calculate total bidding amount for current active period (30s / 1m / 3m)
  const getBiddingPoolStats = (roomId: RoomType) => {
    const periodId = roomId === '30s' ? activePeriodId30s : roomId === '1m' ? activePeriodId1m : activePeriodId3m;
    const roomBids = activeBids.filter((b) => b.roomId === roomId && b.periodId === periodId);
    
    let redTotal = 0;
    let greenTotal = 0;
    let violetTotal = 0;
    let bigTotal = 0;
    let smallTotal = 0;
    const numTotals = Array(10).fill(0);

    roomBids.forEach((b) => {
      if (b.selection === 'red') redTotal += b.amount;
      else if (b.selection === 'green') greenTotal += b.amount;
      else if (b.selection === 'violet') violetTotal += b.amount;
      else if (b.selection === 'big') bigTotal += b.amount;
      else if (b.selection === 'small') smallTotal += b.amount;
      else {
        const n = Number(b.selection);
        if (!isNaN(n)) numTotals[n] += b.amount;
      }
    });

    const totalPool = roomBids.reduce((acc, b) => acc + b.amount, 0);

    // Find previous result
    const roomHistory = history.filter((h) => h.roomId === roomId).sort((a, b) => b.timestamp - a.timestamp);
    const previousResult = roomHistory.length > 0 ? roomHistory[0] : null;

    return {
      periodId,
      totalPool,
      redTotal,
      greenTotal,
      violetTotal,
      bigTotal,
      smallTotal,
      numTotals,
      bidsCount: roomBids.length,
      previousResult
    };
  };

  const roomStats30s = getBiddingPoolStats('30s');
  const roomStats1m = getBiddingPoolStats('1m');
  const roomStats3m = getBiddingPoolStats('3m');

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

  const handleBalanceUpdate = async (userKey: string) => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt)) return;
    try {
      await onUpdateUserWallet(userKey, amt);
      setEditingUserKey(null);
      setAdjustAmount('');
    } catch (err) {
      alert('Failed to update balance');
    }
  };

  const handleAddPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetPeriodId.trim()) {
      alert('Please enter a valid Period ID.');
      return;
    }
    if (presetNumber === null) {
      alert('Please choose a winning number.');
      return;
    }
    try {
      await onSetPresetResult(presetRoom, presetPeriodId.trim(), presetNumber);
      setPresetPeriodId('');
      setPresetNumber(null);
    } catch (err) {
      alert('Failed to save preset force result');
    }
  };

  const handleAddNewDepositChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSuccessMsg('');
    setPaymentErrorMsg('');
    if (!newChanName.trim()) {
      setPaymentErrorMsg('Channel name is required.');
      return;
    }
    try {
      const bonusVal = parseFloat(newChanBonus);
      const newChannel: DepositChannel = {
        id: `chan_${Date.now()}`,
        name: newChanName.trim(),
        type: newChanType,
        bonus: isNaN(bonusVal) ? 0.20 : bonusVal,
        requiredFields: [
          { id: 'utr', label: 'UTR Number / Txn Reference (12 digits)', placeholder: 'Enter 12-digit UPI/UTR number', type: 'text', required: true }
        ]
      };
      // Populate defaults based on type
      if (newChanType === 'qr' || newChanType === 'upi') {
        newChannel.upiId = 'payee@upi';
      }
      if (newChanType === 'qr') {
        newChannel.qrCodeUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=payee@upi&pn=WinGo';
      }
      if (newChanType === 'bank') {
        newChannel.bankName = 'HDFC Bank';
        newChannel.accountHolder = 'PRISM TECH PVT LTD';
        newChannel.accountNumber = '5010092837112';
        newChannel.ifsc = 'HDFC0000123';
      }
      const updated = [...depositChannels, newChannel];
      await onUpdateDepositChannels(updated);
      setSelectedChannelId(newChannel.id);
      setNewChanName('');
      setIsAddingChannel(false);
      setPaymentSuccessMsg(`Deposit channel "${newChannel.name}" added successfully!`);
    } catch (err: any) {
      setPaymentErrorMsg(err.message || 'Failed to add deposit channel.');
    }
  };

  const handleSaveSelectedChannel = async (updatedFields: Partial<DepositChannel>) => {
    setPaymentSuccessMsg('');
    setPaymentErrorMsg('');
    if (!selectedChannelId) return;
    try {
      const updated = depositChannels.map((c) => {
        if (c.id === selectedChannelId) {
          return { ...c, ...updatedFields };
        }
        return c;
      });
      await onUpdateDepositChannels(updated);
      setPaymentSuccessMsg('Deposit channel properties saved successfully!');
    } catch (err: any) {
      setPaymentErrorMsg(err.message || 'Failed to update channel properties.');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    setPaymentSuccessMsg('');
    setPaymentErrorMsg('');
    if (depositChannels.length <= 1) {
      setPaymentErrorMsg('You must keep at least one active deposit channel.');
      return;
    }
    if (!confirm('Are you sure you want to delete this deposit channel? This will remove all config associated with it.')) {
      return;
    }
    try {
      const updated = depositChannels.filter((c) => c.id !== id);
      await onUpdateDepositChannels(updated);
      setSelectedChannelId(updated[0].id);
      setPaymentSuccessMsg('Deposit channel deleted successfully.');
    } catch (err: any) {
      setPaymentErrorMsg(err.message || 'Failed to delete deposit channel.');
    }
  };

  const handleAddChannelField = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSuccessMsg('');
    setPaymentErrorMsg('');
    if (!selectedChannelId || !currentChan) return;
    if (!depFieldLabel.trim()) {
      setPaymentErrorMsg('Field label is required.');
      return;
    }
    try {
      const newField: DepositChannelField = {
        id: `f_${Date.now()}`,
        label: depFieldLabel.trim(),
        placeholder: depFieldPlaceholder.trim(),
        type: depFieldType,
        required: depFieldRequired
      };
      const updatedFields = [...(currentChan.requiredFields || []), newField];
      await handleSaveSelectedChannel({ requiredFields: updatedFields });
      setDepFieldLabel('');
      setDepFieldPlaceholder('');
      setPaymentSuccessMsg(`Field "${newField.label}" added successfully to channel!`);
    } catch (err: any) {
      setPaymentErrorMsg(err.message || 'Failed to add field.');
    }
  };

  const handleDeleteChannelField = async (fieldId: string) => {
    setPaymentSuccessMsg('');
    setPaymentErrorMsg('');
    if (!selectedChannelId || !currentChan) return;
    try {
      const updatedFields = (currentChan.requiredFields || []).filter(f => f.id !== fieldId);
      await handleSaveSelectedChannel({ requiredFields: updatedFields });
      setPaymentSuccessMsg('Channel required field removed successfully.');
    } catch (err: any) {
      setPaymentErrorMsg(err.message || 'Failed to remove field.');
    }
  };

  const handleWithdrawalConfigAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldLabel.trim()) {
      alert('Please provide a field label.');
      return;
    }
    try {
      const newField: WithdrawalField = {
        id: `field_${Date.now()}`,
        label: newFieldLabel.trim(),
        placeholder: newFieldPlaceholder.trim(),
        type: newFieldType,
        required: newFieldRequired,
      };
      const currentFields = withdrawalFields ? [...withdrawalFields] : [];
      await onUpdateWithdrawalConfig([...currentFields, newField]);
      setNewFieldLabel('');
      setNewFieldPlaceholder('');
    } catch (err) {
      alert('Failed to add custom field.');
    }
  };

  const handleWithdrawalConfigDeleteField = async (id: string) => {
    try {
      const currentFields = withdrawalFields ? [...withdrawalFields] : [];
      const updated = currentFields.filter((f) => f.id !== id);
      await onUpdateWithdrawalConfig(updated);
    } catch (err) {
      alert('Failed to remove custom field.');
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
            Outcome Overrides & Schedule
          </button>
          <button
            onClick={() => setAdminTab('payments')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'payments'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Payment Gateways & Forms
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
        <div className="space-y-8">
          {/* Deposits Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
              <span>Pending & Held Deposits ({pendingDeposits.length})</span>
            </h4>
            
            {pendingDeposits.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-900/20 p-4 rounded-xl border border-slate-800/60">No pending or held deposits found.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                <table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-widest font-bold font-mono">
                    <tr>
                      <th className="px-5 py-3">Nick / Contacts</th>
                      <th className="px-5 py-3">UTR Reference No.</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {pendingDeposits.map((d) => (
                      <tr key={d.depositId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-bold text-white">{d.nickname}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{d.phone || 'N/A'}</div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-mono font-bold text-purple-400">{d.utr}</div>
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-emerald-400 text-sm">${d.amount.toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            d.status === 'hold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-500">{new Date(d.createdAt).toLocaleTimeString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => onHandleDeposit(d.depositId, 'approved')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg cursor-pointer transition-colors"
                              title="Approve Deposit"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setReasonModal({ type: 'deposit', id: d.depositId, action: 'rejected' })}
                              className="bg-rose-600 hover:bg-rose-500 text-white p-1.5 rounded-lg cursor-pointer transition-colors"
                              title="Reject Deposit"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            {d.status !== 'hold' && (
                              <button
                                onClick={() => setReasonModal({ type: 'deposit', id: d.depositId, action: 'hold' })}
                                className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg cursor-pointer font-bold uppercase text-[9px] tracking-wider transition-colors"
                              >
                                Hold
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Withdrawals Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center space-x-2">
              <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0" />
              <span>Pending & Held Withdrawals ({pendingWithdrawals.length})</span>
            </h4>
            
            {pendingWithdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-slate-900/20 p-4 rounded-xl border border-slate-800/60">No pending or held withdrawals found.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
                <table className="min-w-full divide-y divide-slate-800 text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase tracking-widest font-bold font-mono">
                    <tr>
                      <th className="px-5 py-3">Nick / Contacts</th>
                      <th className="px-5 py-3">Account Details</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Time</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {pendingWithdrawals.map((w) => (
                      <tr key={w.withdrawalId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-bold text-white">{w.nickname}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{w.phone || 'N/A'}</div>
                        </td>
                        <td className="px-5 py-3 space-y-0.5 text-[10px] font-mono leading-relaxed">
                          {w.upi ? (
                            <div><span className="text-slate-500 font-bold uppercase">UPI:</span> <span className="text-slate-300">{w.upi}</span></div>
                          ) : (
                            <>
                              <div><span className="text-slate-500 font-bold uppercase">BANK:</span> <span className="text-slate-300">{w.bankName}</span></div>
                              <div><span className="text-slate-500 font-bold uppercase">A/C:</span> <span className="text-slate-300">{w.accountNumber}</span></div>
                              <div><span className="text-slate-500 font-bold uppercase">IFSC:</span> <span className="text-slate-300">{w.ifsc}</span></div>
                            </>
                          )}
                        </td>
                        <td className="px-5 py-3 font-mono font-bold text-rose-400 text-sm">${w.amount.toFixed(2)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            w.status === 'hold' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-mono text-slate-500">{new Date(w.createdAt).toLocaleTimeString()}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => onHandleWithdrawal(w.withdrawalId, 'approved')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded-lg cursor-pointer transition-colors"
                              title="Mark Paid / Settled"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setReasonModal({ type: 'withdrawal', id: w.withdrawalId, action: 'rejected' })}
                              className="bg-rose-600 hover:bg-rose-500 text-white p-1.5 rounded-lg cursor-pointer transition-colors"
                              title="Reject and Refund"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            {w.status !== 'hold' && (
                              <button
                                onClick={() => setReasonModal({ type: 'withdrawal', id: w.withdrawalId, action: 'hold' })}
                                className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1.5 rounded-lg cursor-pointer font-bold uppercase text-[9px] tracking-wider transition-colors"
                              >
                                Hold
                              </button>
                            )}
                          </div>
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

      {/* Tab Contents: users */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
              <Search className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <input
              type="text"
              placeholder="Search user profile database by email, phone, or nickname..."
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
                  <th className="px-6 py-4">Email / Contacts</th>
                  <th className="px-6 py-4">Password</th>
                  <th className="px-6 py-4">Wallet Balance</th>
                  <th className="px-6 py-4">Role / Group</th>
                  <th className="px-6 py-4 text-center">Credit Ledger Operation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredUsers.map((u) => {
                  const uKey = u.email ? getEmailKey(u.email) : (u.phone || u.uid);
                  return (
                    <tr key={u.uid} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{u.nickname}</td>
                      <td className="px-6 py-4 leading-relaxed">
                        <div className="font-mono text-slate-300">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-slate-500 font-mono">Phone: {u.phone}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-500">{u.password || '••••'}</td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-400">${u.wallet !== undefined ? u.wallet.toFixed(2) : '0.00'}</td>
                      <td className="px-6 py-4">
                        {u.role === 'admin' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">Admin</span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">User</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center">
                          {editingUserKey === uKey ? (
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
                                onClick={() => handleBalanceUpdate(uKey)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded cursor-pointer transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingUserKey(null)}
                                className="bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded cursor-pointer hover:bg-slate-750 transition-colors"
                              >
                                X
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingUserKey(uKey);
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Contents: manipulate */}
      {adminTab === 'manipulate' && (
        <div className="space-y-8">
          {/* Preset / Future Schedule Formulation Block */}
          <div className="bg-slate-900/60 rounded-2xl p-6 border border-slate-800 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <span className="inline-flex items-center space-x-1.5 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Calendar className="h-4.5 w-4.5" />
                <span>Schedule Future Game Result</span>
              </span>
              <h4 className="text-base font-extrabold text-white mt-1">Preset Specific Period ID Outcome</h4>
              <p className="text-xs text-slate-400 mt-0.5">Preset precise results for specific future periods (which will trigger exactly on time). Sells same fixed results to everyone.</p>
            </div>

            <form onSubmit={handleAddPreset} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Game Room</label>
                <select
                  value={presetRoom}
                  onChange={(e) => setPresetRoom(e.target.value as RoomType)}
                  className="w-full pl-3 pr-8 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-xs"
                >
                  <option value="30s">30s Arena</option>
                  <option value="1m">1m Arena</option>
                  <option value="3m">3m Arena</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Period ID (Block Code)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 202606280045"
                  value={presetPeriodId}
                  onChange={(e) => setPresetPeriodId(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Forced Winning Number</label>
                <div className="grid grid-cols-5 gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPresetNumber(i)}
                      className={`py-1 rounded font-mono font-bold text-xs border ${
                        presetNumber === i
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-850'
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer shadow-lg shadow-purple-950/25 transition-all"
              >
                Schedule Preset
              </button>
            </form>

            {/* List of Scheduled Presets */}
            <div className="pt-3 border-t border-slate-800/60">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-widest mb-3">Currently Scheduled Overrides</span>
              
              {Object.keys(presetResults).length === 0 || 
               Object.values(presetResults).every(roomObj => !roomObj || Object.keys(roomObj).length === 0) ? (
                <p className="text-[11px] text-slate-500 italic">No future results are scheduled. Settle engine running organic choice.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(['30s', '1m', '3m'] as RoomType[]).map((rId) => {
                    const roomPresets = presetResults[rId] || {};
                    const periodIds = Object.keys(roomPresets).sort();
                    if (periodIds.length === 0) return null;

                    return (
                      <div key={rId} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <span className="text-[9px] font-bold text-purple-400 block uppercase tracking-widest">{rId} Scheduled list</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {periodIds.map((pId) => {
                            const num = roomPresets[pId];
                            const mapping = COLOR_MAP[num as keyof typeof COLOR_MAP];
                            const isBig = num >= 5;
                            return (
                              <div key={pId} className="flex justify-between items-center bg-slate-900 border border-slate-800 px-3 py-1.5 rounded text-xs font-mono">
                                <div className="space-y-0.5">
                                  <div className="text-[11px] text-white font-bold">{pId}</div>
                                  <div className="text-[9px] text-slate-500">
                                    Forces: <span className="font-bold text-purple-400">{num}</span> ({mapping.premiumColor} / {isBig ? 'Big' : 'Small'})
                                  </div>
                                </div>
                                <button
                                  onClick={() => onClearPresetResult(rId, pId)}
                                  className="text-rose-500 hover:text-rose-400 p-1 cursor-pointer"
                                  title="Remove Override"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Arenas Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Arena Item Renderer */}
            {(['30s', '1m', '3m'] as RoomType[]).map((rKey) => {
              const stats = rKey === '30s' ? roomStats30s : rKey === '1m' ? roomStats1m : roomStats3m;
              const title = rKey === '30s' ? '30 Seconds Arena' : rKey === '1m' ? '1 Minute Arena' : '3 Minutes Arena';
              const activeColorClass = rKey === '30s' ? 'text-amber-400' : rKey === '1m' ? 'text-emerald-400' : 'text-purple-400';

              return (
                <div key={rKey} className="bg-slate-900/40 rounded-2xl p-5 border border-slate-800 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-start pb-3 border-b border-slate-800">
                      <div>
                        <span className={`inline-flex items-center space-x-1.5 ${activeColorClass} text-xs font-bold uppercase tracking-wider`}>
                          <Radio className="h-3.5 w-3.5 animate-pulse" />
                          <span>{title}</span>
                        </span>
                        <h4 className="text-sm font-extrabold text-white mt-1">Block ID: {stats.periodId}</h4>
                      </div>
                      <span className="text-[9px] font-bold uppercase text-slate-500 bg-slate-950 border border-slate-800 px-2 py-1 rounded font-mono shrink-0">
                        {stats.bidsCount} Active
                      </span>
                    </div>

                    {/* Previous Result Showcase */}
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 flex justify-between items-center text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">Previous Result</span>
                        {stats.previousResult ? (
                          <div className="font-mono text-slate-300 font-bold text-[11px]">Period {stats.previousResult.periodId}</div>
                        ) : (
                          <div className="text-slate-600 italic text-[10px]">No historical blocks found</div>
                        )}
                      </div>
                      {stats.previousResult && (
                        <div className="flex items-center space-x-2">
                          <span className="h-6 w-6 rounded-full bg-slate-900 border border-slate-800 text-white font-mono font-black flex items-center justify-center text-xs">
                            {stats.previousResult.number}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {stats.previousResult.premiumColor.split(' ')[0]} / {stats.previousResult.number >= 5 ? 'Big' : 'Small'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Pool Statistics summary */}
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                      <span className="text-[9px] font-bold text-slate-500 block uppercase tracking-widest">Bidding Pool Totals</span>
                      
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-rose-500/5 p-1.5 rounded border border-rose-500/10 text-center">
                          <span className="text-[8px] text-rose-400 block font-bold uppercase">RED</span>
                          <span className="font-mono font-black text-white block mt-0.5">${stats.redTotal.toFixed(1)}</span>
                        </div>
                        <div className="bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10 text-center">
                          <span className="text-[8px] text-emerald-400 block font-bold uppercase">GREEN</span>
                          <span className="font-mono font-black text-white block mt-0.5">${stats.greenTotal.toFixed(1)}</span>
                        </div>
                        <div className="bg-violet-500/5 p-1.5 rounded border border-violet-500/10 text-center">
                          <span className="text-[8px] text-violet-400 block font-bold uppercase">VIOLET</span>
                          <span className="font-mono font-black text-white block mt-0.5">${stats.violetTotal.toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-800/40 pt-2">
                        <div className="bg-purple-500/5 p-1.5 rounded border border-purple-500/10 text-center">
                          <span className="text-[8px] text-purple-400 block font-bold uppercase">BIG (5-9)</span>
                          <span className="font-mono font-black text-white block mt-0.5">${stats.bigTotal.toFixed(1)}</span>
                        </div>
                        <div className="bg-amber-500/5 p-1.5 rounded border border-amber-500/10 text-center">
                          <span className="text-[8px] text-amber-400 block font-bold uppercase">SMALL (0-4)</span>
                          <span className="font-mono font-black text-white block mt-0.5">${stats.smallTotal.toFixed(1)}</span>
                        </div>
                      </div>

                      {/* Numbers pool distribution */}
                      <div className="pt-2 border-t border-slate-800/40">
                        <span className="text-[8px] font-bold text-slate-500 block uppercase tracking-widest mb-1.5">Individual Numbers</span>
                        <div className="grid grid-cols-5 gap-1 text-[9px] font-mono">
                          {stats.numTotals.map((sum, i) => (
                            <div key={i} className="bg-slate-900 border border-slate-800 py-1 rounded text-center">
                              <span className="text-slate-500 font-bold block">No.{i}</span>
                              <span className="text-white font-bold block">${sum.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-[11px]">
                        <span className="font-semibold text-slate-400">Total Round Bets:</span>
                        <span className="font-mono font-black text-purple-400">${stats.totalPool.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Overrides Controls */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-widest">Immediate Force Outcome:</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {Array.from({ length: 10 }).map((_, i) => {
                        const mapping = COLOR_MAP[i as keyof typeof COLOR_MAP];
                        const isCurrent = currentOverrides[rKey] === i;
                        return (
                          <button
                            key={i}
                            onClick={() => onSetWinningOverride(rKey, i)}
                            className={`py-1 rounded font-bold text-xs transition-all cursor-pointer border ${
                              isCurrent
                                ? 'bg-purple-600 border-purple-500 text-white shadow-lg'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                            }`}
                          >
                            <span className="block font-mono text-sm">{i}</span>
                            <span className="text-[7px] opacity-60 uppercase font-mono block">
                              {mapping.premiumColor.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {currentOverrides[rKey] !== undefined ? (
                      <div className="flex justify-between items-center bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20 text-[10px]">
                        <span className="text-purple-300 font-medium leading-relaxed">
                          🔥 Outcome is forced to: <span className="font-black text-white">No.{currentOverrides[rKey]}</span>
                        </span>
                        <button
                          onClick={() => onClearWinningOverride(rKey)}
                          className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer underline text-[10px] shrink-0 ml-2"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <p className="text-[9px] text-slate-500 italic leading-relaxed">No quick override active. Settle engine running organically.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Contents: payments */}
      {adminTab === 'payments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
          
          {/* LEFT COLUMN: Deposit Channels Management */}
          <div className="bg-slate-900/60 rounded-2xl p-6 border border-slate-800 space-y-6">
            <div className="pb-3 border-b border-slate-800 flex justify-between items-start">
              <div>
                <span className="inline-flex items-center space-x-1.5 text-purple-400 text-xs font-bold uppercase tracking-wider">
                  <Landmark className="h-4.5 w-4.5" />
                  <span>Deposit Channels Control</span>
                </span>
                <h4 className="text-base font-extrabold text-white mt-1">Multi-Channel Deposit Systems</h4>
                <p className="text-xs text-slate-400 mt-0.5">Add, edit, or delete deposit methods (QR, UPI, Bank) and their required fields.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingChannel(!isAddingChannel)}
                className="bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/20 text-purple-400 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{isAddingChannel ? 'View Channels' : 'Add New'}</span>
              </button>
            </div>

            {paymentSuccessMsg && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2">
                <Check className="h-4 w-4 shrink-0" />
                <span>{paymentSuccessMsg}</span>
              </div>
            )}
            {paymentErrorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs font-medium flex items-center space-x-2">
                <X className="h-4 w-4 shrink-0" />
                <span>{paymentErrorMsg}</span>
              </div>
            )}

            {isAddingChannel ? (
              /* ADD NEW CHANNEL FORM */
              <form onSubmit={handleAddNewDepositChannel} className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">Create New Deposit Channel</span>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Channel Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UPI Express, Paytm Direct QR"
                    value={newChanName}
                    onChange={(e) => setNewChanName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Gateway Type</label>
                    <select
                      value={newChanType}
                      onChange={(e) => setNewChanType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs text-white"
                    >
                      <option value="qr">QR Image Scan</option>
                      <option value="upi">Direct UPI ID</option>
                      <option value="bank">Instant Bank Details</option>
                      <option value="custom">Custom Fields Form</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recharge Bonus (e.g. 0.20 = 20%)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 0.20"
                      value={newChanBonus}
                      onChange={(e) => setNewChanBonus(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Create Channel & Set Up Details
                </button>
              </form>
            ) : (
              /* CHANNELS LIST & DETAILED CONFIG */
              <div className="space-y-6">
                {/* Selector Pills */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Select Channel to Configure</span>
                  <div className="flex flex-wrap gap-1.5">
                    {depositChannels.map((c) => {
                      const isSelected = selectedChannelId === c.id;
                      return (
                        <div key={c.id} className="relative flex items-center">
                          <button
                            type="button"
                            onClick={() => setSelectedChannelId(c.id)}
                            className={`px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600 border-purple-500 text-white'
                                : 'bg-slate-950 border-slate-900 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {c.name} (+{Math.round(c.bonus * 100)}%)
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {currentChan && (
                  <div className="space-y-5 bg-slate-950/40 p-4 rounded-xl border border-slate-900">
                    <div className="flex justify-between items-center border-b border-slate-900 pb-2">
                      <span className="text-xs font-black uppercase text-purple-400">Edit "{currentChan.name}" Details</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteChannel(currentChan.id)}
                        className="text-rose-500 hover:text-rose-400 text-[10px] font-extrabold uppercase tracking-wide flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete Channel</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Name & Bonus */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Channel Name</label>
                          <input
                            type="text"
                            value={currentChan.name}
                            onChange={(e) => handleSaveSelectedChannel({ name: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bonus Rate (e.g. 0.2 = 20%)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={currentChan.bonus}
                            onChange={(e) => handleSaveSelectedChannel({ bonus: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>

                      {/* Type-Specific Payment Settings */}
                      {(currentChan.type === 'qr' || currentChan.type === 'upi') && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recipient UPI ID (VPA)</label>
                          <input
                            type="text"
                            placeholder="e.g. pay@upi"
                            value={currentChan.upiId || ''}
                            onChange={(e) => handleSaveSelectedChannel({ upiId: e.target.value.trim() })}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                      )}

                      {currentChan.type === 'qr' && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">QR Code Image URL</label>
                          <input
                            type="text"
                            placeholder="e.g. https://domain.com/qr.png"
                            value={currentChan.qrCodeUrl || ''}
                            onChange={(e) => handleSaveSelectedChannel({ qrCodeUrl: e.target.value.trim() })}
                            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                          />
                        </div>
                      )}

                      {currentChan.type === 'bank' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-900/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Account Holder Name</label>
                            <input
                              type="text"
                              value={currentChan.accountHolder || ''}
                              onChange={(e) => handleSaveSelectedChannel({ accountHolder: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bank Name</label>
                            <input
                              type="text"
                              value={currentChan.bankName || ''}
                              onChange={(e) => handleSaveSelectedChannel({ bankName: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Account Number</label>
                            <input
                              type="text"
                              value={currentChan.accountNumber || ''}
                              onChange={(e) => handleSaveSelectedChannel({ accountNumber: e.target.value })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Bank IFSC Code</label>
                            <input
                              type="text"
                              value={currentChan.ifsc || ''}
                              onChange={(e) => handleSaveSelectedChannel({ ifsc: e.target.value.toUpperCase() })}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Channel Fields List */}
                    <div className="space-y-3 pt-3 border-t border-slate-900/60">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Required fields when user deposits ({currentChan.requiredFields?.length || 0})</span>
                      <div className="space-y-1.5">
                        {(currentChan.requiredFields || []).map((f) => (
                          <div key={f.id} className="flex justify-between items-center bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-900 text-[11px]">
                            <div className="space-y-0.5">
                              <span className="font-bold text-white">{f.label}</span>
                              <span className="text-[9px] text-slate-500 block font-mono">Type: {f.type} | Required: {f.required ? 'Yes' : 'No'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteChannelField(f.id)}
                              className="text-rose-500 hover:text-rose-400 font-bold text-[10px] uppercase cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Add Field Form */}
                      <form onSubmit={handleAddChannelField} className="bg-slate-950/60 border border-slate-900/80 p-3 rounded-lg space-y-3">
                        <span className="text-[9px] font-black text-purple-400 uppercase block">Add Required Field to {currentChan.name}</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Field Label</label>
                            <input
                              type="text"
                              placeholder="e.g. Your UPI ID, UTR Number"
                              value={depFieldLabel}
                              onChange={(e) => setDepFieldLabel(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Placeholder text</label>
                            <input
                              type="text"
                              placeholder="e.g. 12-digit number"
                              value={depFieldPlaceholder}
                              onChange={(e) => setDepFieldPlaceholder(e.target.value)}
                              className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded text-[10px] text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <input
                              id="depFieldReqToggle"
                              type="checkbox"
                              checked={depFieldRequired}
                              onChange={(e) => setDepFieldRequired(e.target.checked)}
                              className="h-3.5 w-3.5 bg-slate-950 border-slate-800 rounded"
                            />
                            <label htmlFor="depFieldReqToggle" className="text-[9px] font-bold text-slate-350 uppercase tracking-wide cursor-pointer">Required</label>
                          </div>
                          <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[8px] uppercase tracking-wider py-1.5 px-3 rounded cursor-pointer"
                          >
                            Add Field
                          </button>
                        </div>
                      </form>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Withdrawal Custom Form Fields Manager */}
          <div className="bg-slate-900/60 rounded-2xl p-6 border border-slate-800 space-y-6">
            <div className="pb-3 border-b border-slate-800">
              <span className="inline-flex items-center space-x-1.5 text-purple-400 text-xs font-bold uppercase tracking-wider">
                <Layers className="h-4.5 w-4.5" />
                <span>Withdrawal Fields Builder</span>
              </span>
              <h4 className="text-base font-extrabold text-white mt-1">Configure Required Payout Fields</h4>
              <p className="text-xs text-slate-400 mt-0.5">Control the exact details and input fields requested from users when they withdraw.</p>
            </div>

            {/* List of current fields */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">Current Required Fields ({withdrawalFields ? withdrawalFields.length : 0})</span>
              
              {!withdrawalFields || withdrawalFields.length === 0 ? (
                <p className="text-xs text-slate-500 italic bg-slate-950/40 p-4 rounded-xl border border-slate-900/40">No payout fields defined yet. Add fields below to build your withdrawal form.</p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {withdrawalFields.map((field) => (
                    <div key={field.id} className="flex justify-between items-center bg-slate-950 border border-slate-850 p-3.5 rounded-xl text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs">{field.label}</span>
                          {field.required && (
                            <span className="px-1.5 py-0.2 bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase rounded">Required</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Placeholder: <span className="text-slate-400">"{field.placeholder}"</span> | Type: <span className="text-slate-400">{field.type}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleWithdrawalConfigDeleteField(field.id)}
                        className="text-rose-500 hover:text-rose-400 p-1.5 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                        title="Remove Field"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add field form */}
            <form onSubmit={handleWithdrawalConfigAddField} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-4">
              <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block pb-1 border-b border-slate-900">Add Custom Field to Withdrawal Form</span>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Field Name / Label</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GooglePay Number, UPI ID"
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Input Placeholder text</label>
                  <input
                    type="text"
                    placeholder="e.g. Enter registered number"
                    value={newFieldPlaceholder}
                    onChange={(e) => setNewFieldPlaceholder(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Field Type</label>
                  <select
                    value={newFieldType}
                    onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number')}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="text">Alphanumeric text</option>
                    <option value="number">Numeric digits only</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 pt-5 pl-2">
                  <input
                    id="newFieldReqToggle"
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                    className="h-4 w-4 bg-slate-950 border-slate-800 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  />
                  <label htmlFor="newFieldReqToggle" className="text-xs font-bold text-slate-300 uppercase tracking-wide cursor-pointer">
                    Toggle Required
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#1E293B] border border-purple-500/20 hover:bg-slate-800 text-purple-400 font-bold py-2 px-4 rounded-lg text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Custom Field</span>
              </button>
            </form>
          </div>

        </div>
      )}
    </div>
  );
}
