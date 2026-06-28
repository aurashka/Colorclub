import React, { useState, useEffect } from 'react';
import { DepositRequest, WithdrawalRequest, UserProfile, DepositChannel, DepositChannelField, WithdrawalField } from '../types';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, QrCode, CreditCard, Send, Check, Landmark } from 'lucide-react';

interface WalletSectionProps {
  user: UserProfile;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  onDepositSubmit: (amount: number, utr: string, channelName?: string, fieldsData?: { [key: string]: string }) => Promise<void>;
  onWithdrawalSubmit: (amount: number, fieldsData: { [key: string]: string }) => Promise<void>;
  depositChannels: DepositChannel[];
  withdrawalFields: WithdrawalField[];
}

const PRESET_AMOUNTS = [
  { amount: 200, label: '₹200', desc: '+20% Bonus' },
  { amount: 300, label: '₹300', desc: '+20% Bonus', hot: true },
  { amount: 500, label: '₹500', desc: '+20% Bonus' },
  { amount: 1000, label: '₹1K', desc: '+20% Bonus' },
  { amount: 5000, label: '₹5K', desc: '+20% Bonus' },
  { amount: 50000, label: '₹50K', desc: '+20% Bonus' },
];

export default function WalletSection({
  user,
  deposits,
  withdrawals,
  onDepositSubmit,
  onWithdrawalSubmit,
  depositChannels = [],
  withdrawalFields,
}: WalletSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState<'deposit' | 'withdrawal' | 'history'>('deposit');
  
  // Balance refreshing animation simulation
  const [refreshing, setRefreshing] = useState(false);
  
  // Deposit States
  const [selectedChannel, setSelectedChannel] = useState<DepositChannel | null>(null);
  const [depAmount, setDepAmount] = useState<string>('300');
  const [depFieldsData, setDepFieldsData] = useState<{ [key: string]: string }>({});
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState('');
  const [depSuccess, setDepSuccess] = useState('');

  // Withdrawal States
  const [withAmount, setWithAmount] = useState<string>('');
  const [customFieldsData, setCustomFieldsData] = useState<{ [key: string]: string }>({});
  const [withLoading, setWithLoading] = useState(false);
  const [withError, setWithError] = useState('');
  const [withSuccess, setWithSuccess] = useState('');

  // Clipboard copy feedback
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Initialize selected deposit channel
  useEffect(() => {
    if (depositChannels && depositChannels.length > 0) {
      if (!selectedChannel || !depositChannels.some(c => c.id === selectedChannel.id)) {
        setSelectedChannel(depositChannels[0]);
      } else {
        const updated = depositChannels.find(c => c.id === selectedChannel.id);
        if (updated) setSelectedChannel(updated);
      }
    }
  }, [depositChannels]);

  // Initialize deposit fields when selected channel changes
  useEffect(() => {
    if (selectedChannel) {
      const initial: { [key: string]: string } = {};
      (selectedChannel.requiredFields || []).forEach((f) => {
        initial[f.id] = '';
      });
      setDepFieldsData(initial);
      setDepError('');
      setDepSuccess('');
    }
  }, [selectedChannel]);

  // Initialize custom fields data when fields config changes
  useEffect(() => {
    if (withdrawalFields && withdrawalFields.length > 0) {
      const initial: { [key: string]: string } = {};
      withdrawalFields.forEach((f) => {
        initial[f.label] = '';
      });
      setCustomFieldsData(initial);
    }
  }, [withdrawalFields]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Filter logs for user
  const userDeposits = deposits
    .filter((d) => d.userId === user.uid)
    .sort((a, b) => b.createdAt - a.createdAt);
  const userWithdrawals = withdrawals
    .filter((w) => w.userId === user.uid)
    .sort((a, b) => b.createdAt - a.createdAt);

  const getBonusMultiplier = () => {
    return selectedChannel ? selectedChannel.bonus : 0.20;
  };

  const getChannelName = () => {
    return selectedChannel ? selectedChannel.name : 'Paytm QR';
  };

  const calculatedBonus = () => {
    const amt = parseFloat(depAmount);
    if (isNaN(amt) || amt <= 0) return 0;
    return amt * getBonusMultiplier();
  };

  const calculatedTotal = () => {
    const amt = parseFloat(depAmount);
    if (isNaN(amt) || amt <= 0) return 0;
    return amt + calculatedBonus();
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepError('');
    setDepSuccess('');
    
    const amt = parseFloat(depAmount);
    if (isNaN(amt) || amt < 100) {
      setDepError('Minimum recharge amount is ₹100.');
      return;
    }

    const fields = selectedChannel?.requiredFields || [];
    for (const f of fields) {
      const val = (depFieldsData[f.id] || '').trim();
      if (f.required && !val) {
        setDepError(`Please enter ${f.label}.`);
        return;
      }
      if (f.required && (f.id.toLowerCase().includes('utr') || f.label.toLowerCase().includes('utr')) && val.length < 8) {
        setDepError(`Please enter a valid ${f.label} (minimum 8 characters).`);
        return;
      }
    }

    // Find the main reference field to act as "utr" in the database
    let mainUtr = '';
    for (const f of fields) {
      const val = depFieldsData[f.id] || '';
      if (!mainUtr && val) {
        mainUtr = val;
      }
      if (f.label.toLowerCase().includes('utr') || f.id.toLowerCase().includes('utr') || f.label.toLowerCase().includes('ref') || f.id.toLowerCase().includes('ref')) {
        mainUtr = val;
        break;
      }
    }

    setDepLoading(true);
    try {
      // Pass total credited value (amount + bonus)
      const creditableAmount = amt + (amt * getBonusMultiplier());
      await onDepositSubmit(creditableAmount, mainUtr.trim() || `txn_${Date.now()}`, getChannelName(), depFieldsData);
      setDepSuccess('Recharge request submitted successfully! Funds will be active in your balance after verification.');
      // Clear fields
      const cleared: { [key: string]: string } = {};
      fields.forEach(f => cleared[f.id] = '');
      setDepFieldsData(cleared);
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
      setWithError(`Insufficient balance. Maximum available: ₹${user.wallet.toFixed(2)}`);
      return;
    }
    if (amt < 200) {
      setWithError('Minimum withdrawal amount is ₹200.00.');
      return;
    }

    // Validate that all required custom fields are filled
    for (const field of withdrawalFields) {
      if (field.required && !customFieldsData[field.label]?.trim()) {
        setWithError(`Please fill in the required field: ${field.label}`);
        return;
      }
    }

    setWithLoading(true);
    try {
      await onWithdrawalSubmit(amt, customFieldsData);
      setWithSuccess('Withdrawal request locked! The balance has been safely held, and our payout desk will dispatch the payment.');
      setWithAmount('');
      // reset fields
      const reseted = { ...customFieldsData };
      Object.keys(reseted).forEach((k) => { reseted[k] = ''; });
      setCustomFieldsData(reseted);
    } catch (err: any) {
      setWithError(err.message || 'Failed to request withdrawal.');
    } finally {
      setWithLoading(false);
    }
  };

  const triggerBalanceRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const getStatusBadge = (status: string, holdReason?: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-2.5 w-2.5 animate-spin" />
            <span>Verifying</span>
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>Success</span>
          </span>
        );
      case 'rejected':
        return (
          <div className="flex flex-col items-start">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="h-2.5 w-2.5" />
              <span>Rejected</span>
            </span>
            {holdReason && <span className="text-[8px] text-rose-400 font-mono mt-0.5">{holdReason}</span>}
          </div>
        );
      case 'hold':
        return (
          <div className="flex flex-col items-start">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <AlertCircle className="h-2.5 w-2.5" />
              <span>On Hold</span>
            </span>
            {holdReason && <span className="text-[8px] text-purple-400 font-mono mt-0.5">{holdReason}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#0D121F] font-sans text-slate-200 p-4 space-y-5 select-none min-h-screen pb-24">
      
      {/* Golden Wallet Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#d4af37]/20 p-5 shadow-xl">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#d4af37]/10 to-transparent rounded-full blur-2xl" />
        
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-widest text-[#d4af37] font-black block">Available Balance</span>
            <div className="flex items-center space-x-3 mt-1">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                ₹{user.wallet !== undefined ? user.wallet.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
              </span>
              <button 
                onClick={triggerBalanceRefresh}
                className={`p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer ${refreshing ? 'animate-spin text-[#d4af37]' : ''}`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <Wallet className="h-8 w-8 text-[#d4af37] opacity-80" />
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/60 flex justify-between items-center text-[11px] text-slate-400">
          <span>UID: <span className="font-mono text-white">{user.uid.slice(0, 8)}</span></span>
          <span className="text-[#d4af37] font-bold">VIP Account</span>
        </div>
      </div>

      {/* Internal Tab Navigation */}
      <div className="grid grid-cols-3 p-1 bg-slate-950/60 rounded-xl border border-slate-900/80">
        <button
          onClick={() => setActiveSubTab('deposit')}
          className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
            activeSubTab === 'deposit'
              ? 'bg-gradient-to-r from-amber-500/15 to-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20'
              : 'text-slate-500 border-transparent hover:text-slate-350'
          }`}
        >
          <ArrowDownCircle className="h-4 w-4" />
          <span>Deposit</span>
        </button>

        <button
          onClick={() => setActiveSubTab('withdrawal')}
          className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
            activeSubTab === 'withdrawal'
              ? 'bg-gradient-to-r from-amber-500/15 to-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20'
              : 'text-slate-500 border-transparent hover:text-slate-350'
          }`}
        >
          <ArrowUpCircle className="h-4 w-4" />
          <span>Withdraw</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 ${
            activeSubTab === 'history'
              ? 'bg-gradient-to-r from-amber-500/15 to-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20'
              : 'text-slate-500 border-transparent hover:text-slate-350'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Logs</span>
        </button>
      </div>

      {/* -------------------- DEPOSIT VIEW -------------------- */}
      {activeSubTab === 'deposit' && (
        <form onSubmit={handleDeposit} className="space-y-4 animate-in fade-in duration-300">
          
          {/* Channel Selector Chips */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Choose Deposit Method</span>
            {depositChannels.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No deposit channels configured by admin.</p>
            ) : (
              <div className={`grid gap-2 ${depositChannels.length <= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {depositChannels.map((c) => {
                  const isSelected = selectedChannel?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedChannel(c)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-between text-center space-y-1.5 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#d4af37] bg-[#d4af37]/5 text-white shadow-lg'
                          : 'border-slate-800 bg-slate-900/30 text-slate-400 hover:text-slate-300 hover:bg-slate-900/10'
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-1">
                        {c.type === 'qr' && <QrCode className={`h-5 w-5 ${isSelected ? 'text-[#d4af37]' : 'text-slate-400'}`} />}
                        {c.type === 'upi' && <Send className={`h-5 w-5 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />}
                        {c.type === 'bank' && <CreditCard className={`h-5 w-5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />}
                        {c.type === 'custom' && <Landmark className={`h-5 w-5 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />}
                        <span className="text-[10px] font-extrabold uppercase tracking-tight line-clamp-1">{c.name}</span>
                      </div>
                      {c.bonus > 0 && (
                        <span className={`text-[8px] px-1 py-0.2 rounded font-bold font-mono ${
                          isSelected ? 'text-[#d4af37] bg-[#d4af37]/10' : 'text-slate-400 bg-slate-800'
                        }`}>
                          +{Math.round(c.bonus * 100)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Amount Selection Grid */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Select Recharge Amount</span>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p.amount}
                  type="button"
                  onClick={() => setDepAmount(p.amount.toString())}
                  className={`p-2.5 rounded-xl border relative font-mono cursor-pointer text-center transition-all ${
                    depAmount === p.amount.toString()
                      ? 'border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37] font-black shadow-lg shadow-amber-950/20'
                      : 'border-slate-800 bg-slate-900/30 text-slate-300 hover:bg-slate-850'
                  }`}
                >
                  <div className="text-xs">₹{p.amount.toLocaleString('en-IN')}</div>
                  <div className="text-[7px] text-slate-500 mt-0.5">{p.desc}</div>
                  {p.hot && (
                    <span className="absolute -top-1.5 -right-1 text-[7px] px-1 font-sans uppercase font-black bg-[#d4af37] text-slate-950 rounded tracking-wider scale-90 shadow-md">HOT</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Instructions block */}
          {selectedChannel && (
            <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl space-y-3.5">
              {selectedChannel.type === 'qr' && (
                <div className="flex flex-col items-center text-center space-y-3">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-1.5">
                    <QrCode className="h-4 w-4 text-[#d4af37]" />
                    <span>Scan QR Code to pay</span>
                  </span>
                  
                  {selectedChannel.qrCodeUrl && (
                    <div className="bg-white p-2.5 rounded-xl inline-block border-2 border-[#d4af37] shadow-lg">
                      <img 
                        src={selectedChannel.qrCodeUrl} 
                        alt="UPI QR Code" 
                        className="w-40 h-40 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {selectedChannel.upiId && (
                    <div className="space-y-1 text-xs w-full">
                      <p className="text-slate-400">Save/screenshot the QR or pay directly to UPI:</p>
                      <div className="flex items-center justify-between space-x-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 font-mono">
                        <span className="text-white text-xs select-all font-bold truncate">{selectedChannel.upiId}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedChannel.upiId || '', 'upi')}
                          className="text-[#d4af37] hover:text-white text-[10px] font-black uppercase tracking-wider pl-2 border-l border-slate-800 shrink-0"
                        >
                          {copiedText === 'upi' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedChannel.type === 'upi' && selectedChannel.upiId && (
                <div className="space-y-3">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-1.5 pb-1 border-b border-slate-900">
                    <Send className="h-4 w-4 text-[#d4af37]" />
                    <span>UPI Payment Address</span>
                  </span>
                  <div className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="space-y-0.5 font-mono">
                      <span className="text-[9px] text-slate-500 font-bold block uppercase font-sans">Payee UPI ID</span>
                      <span className="text-sm font-bold text-white truncate max-w-[180px] block">{selectedChannel.upiId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedChannel.upiId || '', 'upi_id')}
                      className="bg-[#d4af37]/10 hover:bg-[#d4af37]/20 border border-[#d4af37]/20 text-[#d4af37] px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider shrink-0"
                    >
                      {copiedText === 'upi_id' ? 'Copied!' : 'Copy ID'}
                    </button>
                  </div>
                </div>
              )}

              {selectedChannel.type === 'bank' && (
                <div className="space-y-3">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-1.5 pb-1 border-b border-slate-900">
                    <CreditCard className="h-4 w-4 text-[#d4af37]" />
                    <span>Receive Bank Account Details</span>
                  </span>
                  
                  <div className="space-y-2.5 text-xs">
                    {selectedChannel.accountHolder && (
                      <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-slate-400">Account Holder:</span>
                        <span className="font-bold text-white">{selectedChannel.accountHolder}</span>
                      </div>
                    )}

                    {selectedChannel.bankName && (
                      <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                        <span className="text-slate-400">Bank Name:</span>
                        <span className="font-bold text-white">{selectedChannel.bankName}</span>
                      </div>
                    )}

                    {selectedChannel.accountNumber && (
                      <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                        <div className="space-y-0.5">
                          <span className="text-slate-400 block">Account Number:</span>
                          <span className="font-mono font-bold text-white tracking-wider">{selectedChannel.accountNumber}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedChannel.accountNumber || '', 'acc')}
                          className="text-[#d4af37] font-black text-[10px] uppercase tracking-wider pl-3 border-l border-slate-800"
                        >
                          {copiedText === 'acc' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}

                    {selectedChannel.ifsc && (
                      <div className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border border-slate-850">
                        <div className="space-y-0.5">
                          <span className="text-slate-400 block">Bank IFSC Code:</span>
                          <span className="font-mono font-bold text-white tracking-wider">{selectedChannel.ifsc}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedChannel.ifsc || '', 'ifsc')}
                          className="text-[#d4af37] font-black text-[10px] uppercase tracking-wider pl-3 border-l border-slate-800"
                        >
                          {copiedText === 'ifsc' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedChannel.type === 'custom' && (
                <div className="space-y-2">
                  <span className="text-xs font-black text-white uppercase tracking-wider flex items-center space-x-1.5 pb-1 border-b border-slate-900">
                    <Landmark className="h-4 w-4 text-[#d4af37]" />
                    <span>Custom Method Instructions</span>
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Please transfer the funds to our custom wallet/channel. Ensure you enter the requested fields below accurately to speed up verification.
                  </p>
                </div>
              )}

              {/* Calculations Breakdown */}
              <div className="border-t border-slate-900 pt-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase text-[9px]">Recharge Base:</span>
                  <span className="font-mono text-white">₹{parseFloat(depAmount) ? parseFloat(depAmount).toFixed(2) : '0.00'}</span>
                </div>
                {getBonusMultiplier() > 0 && (
                  <div className="flex justify-between text-[#d4af37]">
                    <span className="font-bold uppercase text-[9px]">Channel Bonus (+{(getBonusMultiplier()*100).toFixed(0)}%):</span>
                    <span className="font-mono">+₹{calculatedBonus().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold border-t border-slate-900 pt-2 text-sm">
                  <span className="uppercase text-[10px] tracking-wider text-slate-300">Total credited:</span>
                  <span className="font-mono text-[#d4af37]">₹{calculatedTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {depError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{depError}</span>
            </div>
          )}
          {depSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{depSuccess}</span>
            </div>
          )}

          {/* Form Fields & Submit Button */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Recharge Amount (₹)</label>
              <input
                type="number"
                min="100"
                required
                placeholder="Minimum ₹100"
                value={depAmount}
                onChange={(e) => setDepAmount(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50 text-white text-base font-mono font-bold"
              />
            </div>

            {selectedChannel && (selectedChannel.requiredFields || []).map((f) => (
              <div key={f.id}>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  {f.label} {f.required && <span className="text-rose-500 font-bold">*</span>}
                </label>
                <input
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={depFieldsData[f.id] || ''}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (f.id.toLowerCase().includes('utr') || f.label.toLowerCase().includes('utr')) {
                      val = val.replace(/[^a-zA-Z0-9]/g, '');
                    }
                    setDepFieldsData({
                      ...depFieldsData,
                      [f.id]: val
                    });
                  }}
                  className="block w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50 text-white text-sm font-semibold font-mono"
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={depLoading || !selectedChannel}
              className="w-full bg-[#d4af37] text-slate-950 hover:bg-[#f3ca4d] hover:scale-[1.01] active:scale-[0.99] font-black py-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-lg shadow-amber-950/40"
            >
              {depLoading ? 'Submitting claims...' : 'Submit Deposit Notification'}
            </button>
          </div>
        </form>
      )}

      {/* -------------------- WITHDRAWAL VIEW -------------------- */}
      {activeSubTab === 'withdrawal' && (
        <form onSubmit={handleWithdrawal} className="space-y-4 animate-in fade-in duration-300">
          
          <div className="bg-slate-950/80 border border-slate-900 p-4 rounded-xl text-xs text-slate-400 space-y-2.5 leading-relaxed">
            <span className="font-black block text-white uppercase tracking-wider">💳 India Banking Payout Policies:</span>
            <p>• Fast withdrawals are transferred directly into your dynamic Indian bank ledger or UPI address.</p>
            <p>• Withdrawals are dispatched within 1 - 4 hours. Daily maximum: ₹1,00,000. Minimum: ₹200.00.</p>
          </div>

          {withError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{withError}</span>
            </div>
          )}
          {withSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
              <Check className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{withSuccess}</span>
            </div>
          )}

          {/* Amount input */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Amount to Withdraw (₹)</label>
            <input
              type="number"
              min="200"
              required
              placeholder="Minimum ₹200"
              value={withAmount}
              onChange={(e) => setWithAmount(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-950 border border-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#d4af37]/50 text-white text-base font-mono font-bold"
            />
          </div>

          {/* Dynamic withdrawal fields as configured by the admin */}
          <div className="space-y-4 pt-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-900 pb-1.5">Required Payout Details</span>
            
            <div className="bg-slate-900/20 border border-slate-900 p-4 rounded-xl space-y-3.5">
              {withdrawalFields.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No custom fields configured. Please ask the administrator to define withdrawal requirements.</p>
              ) : (
                withdrawalFields.map((field) => (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>{field.label}</span>
                      {field.required && <span className="text-[#d4af37] text-[8px] uppercase tracking-normal">Required</span>}
                    </label>
                    <input
                      type={field.type || 'text'}
                      required={field.required}
                      placeholder={field.placeholder || `Enter ${field.label}`}
                      value={customFieldsData[field.label] || ''}
                      onChange={(e) => setCustomFieldsData({
                        ...customFieldsData,
                        [field.label]: e.target.value
                      })}
                      className="block w-full px-3 py-2 bg-slate-950 border border-slate-900 rounded-lg text-xs font-medium text-white placeholder-slate-700 focus:outline-none focus:border-[#d4af37]/40"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={withLoading || withdrawalFields.length === 0}
            className="w-full bg-[#d4af37] text-slate-950 hover:bg-[#f3ca4d] hover:scale-[1.01] active:scale-[0.99] font-black py-4 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-lg shadow-amber-950/40"
          >
            {withLoading ? 'Processing Request...' : 'Confirm Withdrawal Request'}
          </button>
        </form>
      )}

      {/* -------------------- HISTORY VIEW -------------------- */}
      {activeSubTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Cash Deposits History */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Recharge Cash History</span>
            {userDeposits.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/30 p-4 rounded-xl border border-slate-900 italic">No deposit records found in your journal.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-900 rounded-xl bg-slate-950/40">
                <table className="min-w-full divide-y divide-slate-900 text-left text-xs">
                  <thead className="bg-slate-900/60 text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">
                    <tr>
                      <th className="px-4 py-3">Reference No</th>
                      <th className="px-4 py-3">Total (₹)</th>
                      <th className="px-4 py-3 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-300 font-mono">
                    {userDeposits.map((d) => (
                      <tr key={d.depositId} className="hover:bg-slate-900/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-200">{d.utr}</div>
                          <div className="text-[8px] text-slate-500 mt-0.5">{d.channel || 'Paytm QR'}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-400 font-mono text-sm">
                          ₹{d.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">{getStatusBadge(d.status, d.holdReason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cash Withdrawals History */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Payout Cash History</span>
            {userWithdrawals.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-900/30 p-4 rounded-xl border border-slate-900 italic">No withdrawal payouts found in your journal.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-900 rounded-xl bg-slate-950/40">
                <table className="min-w-full divide-y divide-slate-900 text-left text-xs">
                  <thead className="bg-slate-900/60 text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">
                    <tr>
                      <th className="px-4 py-3">Details / Fields</th>
                      <th className="px-4 py-3">Requested (₹)</th>
                      <th className="px-4 py-3 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60 text-slate-300 font-mono">
                    {userWithdrawals.map((w) => (
                      <tr key={w.withdrawalId} className="hover:bg-slate-900/20 transition-colors">
                        <td className="px-4 py-3 text-[10px]">
                          {w.fieldsData ? (
                            <div className="space-y-0.5 text-slate-400">
                              {Object.entries(w.fieldsData).map(([lbl, val]) => (
                                <div key={lbl} className="truncate max-w-[130px]">
                                  <span className="text-slate-600 font-bold uppercase text-[7px]">{lbl}:</span>{' '}
                                  <span className="text-slate-300">{val}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-slate-400">
                              {w.upi ? `UPI: ${w.upi}` : `Bank: ...${w.accountNumber?.slice(-4)}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-rose-400 text-sm font-mono">
                          ₹{w.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">{getStatusBadge(w.status, w.holdReason)}</td>
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
