import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, BidRecord, RoomType, GamePeriod, DepositChannel, DepositChannelField, WithdrawalField, AppConfig } from '../types';
import { COLOR_MAP } from '../utils/gameUtils';
import { ShieldAlert, Users, Check, X, DollarSign, Search, Settings, Radio, Plus, Percent, Calendar, Trash2, Clock, Landmark, Layers, Send, QrCode, CreditCard, Sparkles, Mail, MessageSquare, Ban, Edit, Ticket, UserCheck, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { ref, set, update, push, onValue, get, remove } from 'firebase/database';
import { db } from '../firebase';

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
  appConfig: AppConfig;
  onUpdateAppConfig: (config: AppConfig) => Promise<void>;
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
  appConfig,
  onUpdateAppConfig,
}: AdminPanelProps) {
  // Navigation
  const [adminTab, setAdminTab] = useState<'transactions' | 'users' | 'manipulate' | 'payments' | 'appConfig' | 'coupons' | 'supportChat'>('transactions');
  
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

  // App Configuration Form States
  const [cfgAppName, setCfgAppName] = useState(appConfig.appName || '');
  const [cfgCurrencySymbol, setCfgCurrencySymbol] = useState(appConfig.currencySymbol || '₹');
  const [cfgCurrencyName, setCfgCurrencyName] = useState(appConfig.currencyName || 'INR');
  const [cfgMinDep, setCfgMinDep] = useState((appConfig.minDeposit || 100).toString());
  const [cfgMaxDep, setCfgMaxDep] = useState((appConfig.maxDeposit || 100000).toString());
  const [cfgMinWith, setCfgMinWith] = useState((appConfig.minWithdrawal || 110).toString());
  const [cfgMaxWith, setCfgMaxWith] = useState((appConfig.maxWithdrawal || 100000).toString());
  const [cfgTg, setCfgTg] = useState(appConfig.telegramSupport || '');
  const [cfgWa, setCfgWa] = useState(appConfig.whatsappSupport || '');
  const [cfgInterestRate, setCfgInterestRate] = useState((appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03).toString());
  const [cfgSupportEmail, setCfgSupportEmail] = useState(appConfig.supportEmail || 'support@lottery7.vip');
  const [cfgSupportChatLink, setCfgSupportChatLink] = useState(appConfig.supportChatLink || '');
  const [cfgReferralDomain, setCfgReferralDomain] = useState(appConfig.referralDomain || '');
  const [interestLoading, setInterestLoading] = useState(false);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSuccess, setCfgSuccess] = useState('');
  const [cfgError, setCfgError] = useState('');

  // Coupons and Support Chats local states
  const [coupons, setCoupons] = useState<any[]>([]);
  const [supportChats, setSupportChats] = useState<any[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Coupon Creation Form States
  const [couponCode, setCouponCode] = useState('');
  const [couponAmount, setCouponAmount] = useState('');
  const [couponExpiryType, setCouponExpiryType] = useState<'hours' | 'days' | 'unlimited'>('unlimited');
  const [couponExpiryValue, setCouponExpiryValue] = useState('');
  const [couponAudienceType, setCouponAudienceType] = useState<'everyone' | 'single_user'>('everyone');
  const [couponTargetEmail, setCouponTargetEmail] = useState('');
  const [couponMaxClaims, setCouponMaxClaims] = useState<'unlimited' | 'single' | 'custom'>('unlimited');
  const [couponMaxClaimsValue, setCouponMaxClaimsValue] = useState<string>('1');
  const [viewingClaimsCoupon, setViewingClaimsCoupon] = useState<any | null>(null);

  // Active Support Chat State
  const [activeSupportChatKey, setActiveSupportChatKey] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [supportChatFilter, setSupportChatFilter] = useState<'all' | 'unread' | 'blocked'>('all');
  const [supportChatSearch, setSupportChatSearch] = useState('');

  // Fetch Coupons
  React.useEffect(() => {
    const couponsRef = ref(db, 'admin_control/gift_coupons');
    const unsubscribe = onValue(couponsRef, (snapshot) => {
      const list: any[] = [];
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          list.push({ ...child.val(), id: child.key });
        });
      }
      setCoupons(list);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Support Chats
  React.useEffect(() => {
    const chatsRef = ref(db, 'support_chats');
    const unsubscribe = onValue(chatsRef, (snapshot) => {
      const list: any[] = [];
      let unreadCount = 0;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          const chatVal = child.val();
          list.push({ ...chatVal, userKey: child.key });
          if (chatVal.unreadCountForAdmin > 0) {
            unreadCount++;
          }
        });
      }
      // Sort: newest messages first
      list.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
      setSupportChats(list);
      setUnreadChatCount(unreadCount);
    });
    return () => unsubscribe();
  }, []);

  // Sync state if prop changes
  React.useEffect(() => {
    setCfgAppName(appConfig.appName || '');
    setCfgCurrencySymbol(appConfig.currencySymbol || '₹');
    setCfgCurrencyName(appConfig.currencyName || 'INR');
    setCfgMinDep((appConfig.minDeposit || 100).toString());
    setCfgMaxDep((appConfig.maxDeposit || 100000).toString());
    setCfgMinWith((appConfig.minWithdrawal || 110).toString());
    setCfgMaxWith((appConfig.maxWithdrawal || 100000).toString());
    setCfgTg(appConfig.telegramSupport || '');
    setCfgWa(appConfig.whatsappSupport || '');
    setCfgInterestRate((appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03).toString());
    setCfgSupportEmail(appConfig.supportEmail || 'support@lottery7.vip');
    setCfgSupportChatLink(appConfig.supportChatLink || '');
    setCfgReferralDomain(appConfig.referralDomain || '');
  }, [appConfig]);

  const handleAppConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgSuccess('');
    setCfgError('');
    setCfgLoading(true);

    try {
      await onUpdateAppConfig({
        appName: (cfgAppName || '').trim(),
        minDeposit: Number(cfgMinDep),
        maxDeposit: Number(cfgMaxDep),
        minWithdrawal: Number(cfgMinWith),
        maxWithdrawal: Number(cfgMaxWith),
        telegramSupport: (cfgTg || '').trim(),
        whatsappSupport: (cfgWa || '').trim(),
        currencySymbol: (cfgCurrencySymbol || '').trim(),
        currencyName: (cfgCurrencyName || '').trim(),
        interestRate: Number(cfgInterestRate),
        supportEmail: (cfgSupportEmail || '').trim(),
        supportChatLink: (cfgSupportChatLink || '').trim(),
        referralDomain: (cfgReferralDomain || '').trim()
      });
      setCfgSuccess('Global App Configuration and Currency settings updated successfully!');
    } catch (err: any) {
      setCfgError('Failed to update: ' + err.message);
    } finally {
      setCfgLoading(false);
    }
  };

  const handleDistributeInterest = async () => {
    if (users.length === 0) {
      alert('No users found in the system.');
      return;
    }
    
    const rate = Number(cfgInterestRate);
    if (isNaN(rate) || rate <= 0) {
      alert('Please configure a valid daily interest rate (> 0) first.');
      return;
    }

    if (!confirm(`Are you sure you want to distribute a daily interest of ${rate}% to ALL users? This will update their wallets instantly based on their current balances.`)) {
      return;
    }

    setInterestLoading(true);
    setCfgSuccess('');
    setCfgError('');

    try {
      const updates: { [key: string]: any } = {};
      const timestamp = Date.now();
      const dateString = new Date().toDateString();

      for (const u of users) {
        if (u.wallet > 0) {
          const interest = u.wallet * (rate / 100);
          if (interest > 0) {
            const emailKey = getEmailKey(u.email);
            const newWallet = u.wallet + interest;
            const newInterestEarned = (u.interestEarned || 0) + interest;

            updates[`users/${emailKey}/wallet`] = newWallet;
            updates[`users/${emailKey}/interestEarned`] = newInterestEarned;

            // Generate a unique push key for interest history
            const historyRef = ref(db, `users/${emailKey}/interest_history`);
            const newHistoryKey = push(historyRef).key;
            if (newHistoryKey) {
              updates[`users/${emailKey}/interest_history/${newHistoryKey}`] = {
                amount: interest,
                rate: rate,
                date: dateString,
                timestamp: timestamp
              };
            }
          }
        }
      }

      updates['admin_control/app_config/lastInterestDistributed'] = timestamp;

      await update(ref(db), updates);
      setCfgSuccess(`Successfully distributed daily interest of ${rate}% to all active user wallets!`);
    } catch (err: any) {
      setCfgError('Interest distribution failed: ' + err.message);
    } finally {
      setInterestLoading(false);
    }
  };

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

  const isInterestPaidToday = () => {
    if (!appConfig.lastInterestDistributed) return false;
    const lastDate = new Date(appConfig.lastInterestDistributed).toDateString();
    const todayDate = new Date().toDateString();
    return lastDate === todayDate;
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
          <button
            onClick={() => setAdminTab('coupons')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'coupons'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            Gift Coupons ({coupons.length})
          </button>
          <button
            onClick={() => setAdminTab('supportChat')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border relative ${
              adminTab === 'supportChat'
                ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span>Live Help Support</span>
            {unreadChatCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white font-black rounded-full text-[8px] animate-bounce inline-block">
                {unreadChatCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setAdminTab('appConfig')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer min-w-max border ${
              adminTab === 'appConfig'
                ? 'bg-[#1E293B] text-[#d4af37] border-[#d4af37]/20 shadow-md'
                : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            App Configuration
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-purple-400 bg-purple-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Approved Deposits</span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">{appConfig.currencySymbol}{totalDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-rose-400 bg-rose-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Paid Withdrawals</span>
            <span className="text-xl font-black font-mono text-white block mt-0.5">{appConfig.currencySymbol}{totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center space-x-3.5">
          <DollarSign className="h-8 w-8 text-emerald-400 bg-emerald-500/10 p-1.5 rounded-lg shrink-0" />
          <div>
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Net System Margin</span>
            <span className={`text-xl font-black font-mono block mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {appConfig.currencySymbol}{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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

      {/* -------------------- APP CONFIGURATION TAB -------------------- */}
      {adminTab === 'appConfig' && (
        <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl space-y-6 animate-in fade-in duration-300">
          <div>
            <h4 className="text-sm font-bold text-white tracking-wider uppercase flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-[#d4af37]" />
              <span>Real-time App &amp; Currency Settings</span>
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              Changes applied here instantly synchronize to all users via Firebase Realtime Database.
            </p>
          </div>

          <form onSubmit={handleAppConfigSubmit} className="space-y-6">
            {cfgSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs flex items-center space-x-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>{cfgSuccess}</span>
              </div>
            )}
            {cfgError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs flex items-center space-x-2">
                <X className="h-4 w-4 text-rose-400" />
                <span>{cfgError}</span>
              </div>
            )}

            {/* Grid for settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* App Settings Group */}
              <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] font-black uppercase text-slate-500 block border-b border-slate-900 pb-1.5">Brand & Metadata</span>
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Application Name</label>
                  <input
                    type="text"
                    required
                    value={cfgAppName}
                    onChange={(e) => setCfgAppName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                    placeholder="e.g. My VIP Game"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Currency Symbol</label>
                  <input
                    type="text"
                    required
                    value={cfgCurrencySymbol}
                    onChange={(e) => setCfgCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    placeholder="e.g. ₹ or $"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Currency Name (Code)</label>
                  <input
                    type="text"
                    required
                    value={cfgCurrencyName}
                    onChange={(e) => setCfgCurrencyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    placeholder="e.g. INR or USD"
                  />
                </div>
              </div>

              {/* Transaction Limits Group */}
              <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl">
                <span className="text-[10px] font-black uppercase text-slate-500 block border-b border-slate-900 pb-1.5">Deposit & Payout Limits</span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Min Deposit</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMinDep}
                      onChange={(e) => setCfgMinDep(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Max Deposit</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMaxDep}
                      onChange={(e) => setCfgMaxDep(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Min Withdrawal</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMinWith}
                      onChange={(e) => setCfgMinWith(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Max Withdrawal</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMaxWith}
                      onChange={(e) => setCfgMaxWith(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Support Links Group */}
              <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl md:col-span-2">
                <span className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-900 pb-1.5">Support Channels & Help Options</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Telegram Support Username / Link</label>
                    <input
                      type="text"
                      value={cfgTg}
                      onChange={(e) => setCfgTg(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                      placeholder="e.g. Telegram username or link"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">WhatsApp Support Number / Link</label>
                    <input
                      type="text"
                      value={cfgWa}
                      onChange={(e) => setCfgWa(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                      placeholder="e.g. WhatsApp phone or api link"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Support Email Address</label>
                    <input
                      type="email"
                      value={cfgSupportEmail}
                      onChange={(e) => setCfgSupportEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                      placeholder="support@lottery7.vip"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Support Live Chat Link</label>
                    <input
                      type="text"
                      value={cfgSupportChatLink}
                      onChange={(e) => setCfgSupportChatLink(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                      placeholder="Custom link, if any, or leave empty for built-in support chat"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Custom Referral Domain / URL Base</label>
                    <input
                      type="text"
                      value={cfgReferralDomain}
                      onChange={(e) => setCfgReferralDomain(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none"
                      placeholder="e.g. https://mycustomdomain.com"
                    />
                    <p className="text-[9px] text-slate-500 mt-1">If set, users' invite links will use this domain instead of the default current domain.</p>
                  </div>
                </div>
              </div>

              {/* Daily Interest & Distribution Control */}
              <div className="space-y-4 bg-slate-950/40 p-4 border border-slate-900 rounded-xl md:col-span-2">
                <span className="text-[10px] font-black uppercase text-[#d4af37] block border-b border-[#d4af37]/20 pb-1.5 flex items-center space-x-1">
                  <Percent className="h-3 w-3 text-amber-400" />
                  <span>Daily Interest Distribution Control</span>
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Daily Interest Rate (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        required
                        value={cfgInterestRate}
                        onChange={(e) => setCfgInterestRate(e.target.value)}
                        className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-[#d4af37]/50 focus:outline-none font-mono"
                        placeholder="e.g. 0.03"
                      />
                      <span className="absolute right-3 top-2 text-xs text-slate-500">%</span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Increases every user's wallet dynamically by this daily % rate.
                    </p>
                  </div>

                  <div>
                    {isInterestPaidToday() ? (
                      <div className="bg-slate-900/60 border border-emerald-500/20 text-slate-400 p-2 rounded-xl text-center text-xs flex items-center justify-center space-x-2">
                        <Check className="h-4 w-4 text-emerald-400 animate-pulse" />
                        <span>Interest distributed today at {new Date(appConfig.lastInterestDistributed!).toLocaleTimeString()}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleDistributeInterest}
                        disabled={interestLoading}
                        className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black py-2 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-amber-950/20 active:scale-95 disabled:opacity-50"
                      >
                        {interestLoading ? (
                          <span>Processing distribution...</span>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-slate-950 animate-pulse" />
                            <span>Distribute {cfgInterestRate}% Interest to All Users Now</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>

            <button
              type="submit"
              disabled={cfgLoading}
              className="w-full bg-[#d4af37] text-slate-950 hover:bg-[#ebd06a] font-black py-3 px-4 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
            >
              {cfgLoading ? (
                <span>Saving modifications...</span>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Update Firebase Realtime Database</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 6. GIFT COUPONS TAB */}
      {adminTab === 'coupons' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase text-purple-400 tracking-wider flex items-center space-x-1.5">
                <Ticket className="h-4 w-4" />
                <span>Gift Card & Promo Coupon Management</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">Create custom vouchers, set restrictions & track real-time claims list</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Create Coupon Form */}
            <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
              <span className="text-[10px] font-black uppercase text-purple-400 block border-b border-purple-500/10 pb-2 flex items-center space-x-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>Create Custom Voucher Code</span>
              </span>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const codeUpper = couponCode.trim().toUpperCase();
                if (!codeUpper) {
                  alert('Please enter a custom voucher code!');
                  return;
                }
                const amt = parseFloat(couponAmount);
                if (isNaN(amt) || amt <= 0) {
                  alert('Voucher amount must be greater than zero.');
                  return;
                }

                let expiryTimestamp = 9999999999999;
                if (couponExpiryType === 'hours') {
                  const val = parseFloat(couponExpiryValue);
                  if (isNaN(val) || val <= 0) {
                    alert('Please enter a valid expiry hours.');
                    return;
                  }
                  expiryTimestamp = Date.now() + val * 60 * 60 * 1000;
                } else if (couponExpiryType === 'days') {
                  const val = parseFloat(couponExpiryValue);
                  if (isNaN(val) || val <= 0) {
                    alert('Please enter a valid expiry days.');
                    return;
                  }
                  expiryTimestamp = Date.now() + val * 24 * 60 * 60 * 1000;
                }

                let maxClaimsLimit: number | null = null;
                if (couponMaxClaims === 'single') {
                  maxClaimsLimit = 1;
                } else if (couponMaxClaims === 'custom') {
                  const lim = parseInt(couponMaxClaimsValue);
                  if (isNaN(lim) || lim <= 0) {
                    alert('Please enter a valid claims limit greater than 0.');
                    return;
                  }
                  maxClaimsLimit = lim;
                }

                try {
                  const couponData = {
                    code: codeUpper,
                    amount: amt,
                    expiryType: couponExpiryType,
                    expiryDuration: couponExpiryType !== 'unlimited' ? parseFloat(couponExpiryValue) : null,
                    expiryTimestamp,
                    audienceType: couponAudienceType,
                    targetUserEmail: couponAudienceType === 'single_user' ? couponTargetEmail.trim().toLowerCase() : null,
                    maxClaimsLimit,
                    createdAt: Date.now()
                  };

                  await set(ref(db, `admin_control/gift_coupons/${codeUpper}`), couponData);
                  alert(`Coupon "${codeUpper}" created successfully!`);
                  setCouponCode('');
                  setCouponAmount('');
                  setCouponExpiryValue('');
                  setCouponTargetEmail('');
                  setCouponExpiryType('unlimited');
                  setCouponAudienceType('everyone');
                  setCouponMaxClaims('unlimited');
                  setCouponMaxClaimsValue('1');
                } catch (err: any) {
                  alert('Failed to save coupon: ' + err.message);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Custom Code Name</label>
                  <input
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white uppercase font-mono tracking-widest focus:outline-none focus:border-purple-500/30"
                    placeholder="e.g. WELCOME100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Voucher Wallet Amount ({appConfig.currencySymbol || '₹'})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={couponAmount}
                    onChange={(e) => setCouponAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500/30"
                    placeholder="e.g. 100.00"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Expiry Type</label>
                    <select
                      value={couponExpiryType}
                      onChange={(e: any) => setCouponExpiryType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30"
                    >
                      <option value="unlimited">Unlimited Duration</option>
                      <option value="hours">Hours Expiry</option>
                      <option value="days">Days Expiry</option>
                    </select>
                  </div>

                  {couponExpiryType !== 'unlimited' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Duration</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={couponExpiryValue}
                        onChange={(e) => setCouponExpiryValue(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500/30"
                        placeholder={couponExpiryType === 'hours' ? 'e.g. 12' : 'e.g. 7'}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Target Audience Limit</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCouponAudienceType('everyone')}
                        className={`py-2 text-center text-xs font-bold rounded-lg border uppercase ${
                          couponAudienceType === 'everyone'
                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                            : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Everyone
                      </button>
                      <button
                        type="button"
                        onClick={() => setCouponAudienceType('single_user')}
                        className={`py-2 text-center text-xs font-bold rounded-lg border uppercase ${
                          couponAudienceType === 'single_user'
                            ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                            : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        Single User Only
                      </button>
                    </div>
                  </div>

                  {couponAudienceType === 'single_user' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Target User Email Address</label>
                      <input
                        type="email"
                        required
                        value={couponTargetEmail}
                        onChange={(e) => setCouponTargetEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500/30"
                        placeholder="e.g. buyer@gmail.com"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Max Claims Limit (Global Usage)</label>
                    <select
                      value={couponMaxClaims}
                      onChange={(e: any) => setCouponMaxClaims(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30"
                    >
                      <option value="unlimited">Unlimited claims (1 claim per user)</option>
                      <option value="single">Single Use (1 claim total globally)</option>
                      <option value="custom">Custom claims limit (Custom total uses count)</option>
                    </select>
                  </div>

                  {couponMaxClaims === 'custom' && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Custom Claims Limit Count</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={couponMaxClaimsValue}
                        onChange={(e) => setCouponMaxClaimsValue(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-purple-500/30"
                        placeholder="e.g. 10"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-purple-500 hover:bg-purple-400 text-slate-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 shadow-md active:scale-98 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>Generate Voucher Coupon</span>
                </button>
              </form>
            </div>

            {/* Right Column: Existing Coupons List */}
            <div className="lg:col-span-7 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-4">
              <span className="text-[10px] font-black uppercase text-purple-400 block border-b border-purple-500/10 pb-2">
                Active Vouchers & Promo Cards ({coupons.length})
              </span>

              {coupons.length === 0 ? (
                <div className="bg-slate-950/30 border border-slate-900 p-8 rounded-xl text-center text-xs text-slate-600">
                  No coupons found. Create your very first promo voucher code in the panel on the left.
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {coupons.map((c) => {
                    const isExpired = Date.now() > c.expiryTimestamp;
                    const claimsCount = c.claimedUsers ? Object.keys(c.claimedUsers).length : 0;
                    return (
                      <div key={c.code} className="bg-slate-950/40 border border-slate-850 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-black text-white tracking-widest">{c.code}</span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${
                              isExpired ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                            }`}>
                              {isExpired ? 'Expired' : 'Active'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] text-slate-500">
                            <div>Amount: <strong className="text-purple-400 font-mono">{appConfig.currencySymbol}{c.amount.toFixed(2)}</strong></div>
                            <div>Limit: <strong className="text-slate-300 capitalize">{c.audienceType === 'single_user' ? 'Single email' : 'Everyone'}</strong></div>
                            <div>Uses Limit: <strong className="text-amber-400 font-mono">{c.maxClaimsLimit ? `${claimsCount} / ${c.maxClaimsLimit}` : 'Unlimited'}</strong></div>
                            
                            <div className="col-span-2 mt-0.5">
                              Expiry: <span className="text-slate-400 font-mono">
                                {c.expiryTimestamp > 9999999999990 ? 'Unlimited Duration' : new Date(c.expiryTimestamp).toLocaleString()}
                              </span>
                            </div>
                            {c.targetUserEmail && (
                              <div className="col-span-2 text-rose-400 font-mono">Restricted Email: {c.targetUserEmail}</div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => setViewingClaimsCoupon(c)}
                            className="bg-slate-900 border border-slate-800 text-slate-300 font-black text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg hover:bg-slate-850 cursor-pointer"
                          >
                            Claims ({claimsCount})
                          </button>
                          
                          <button
                            onClick={async () => {
                              if (confirm(`Do you wish to delete and disable coupon code "${c.code}"? This will prevent any further claims.`)) {
                                await remove(ref(db, `admin_control/gift_coupons/${c.code}`));
                                alert('Coupon deleted.');
                              }
                            }}
                            className="bg-red-500/10 border border-red-500/25 text-red-400 p-1.5 rounded-lg hover:bg-red-500/20 cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Dialog modal for viewing voucher claimed users */}
          {viewingClaimsCoupon && (
            <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
                <button
                  onClick={() => setViewingClaimsCoupon(null)}
                  className="absolute right-4 top-4 text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <div>
                  <h4 className="text-xs font-black uppercase text-purple-400 tracking-wider">Voucher Claim logs</h4>
                  <span className="text-[10px] text-slate-500 font-mono block mt-0.5">Voucher Code: {viewingClaimsCoupon.code}</span>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {viewingClaimsCoupon.claimedUsers ? (
                    Object.values(viewingClaimsCoupon.claimedUsers).map((claim: any, idx: number) => (
                      <div key={idx} className="bg-slate-900/60 p-3 rounded-xl border border-slate-850 flex justify-between items-center text-[10px]">
                        <div>
                          <p className="text-white font-extrabold">{claim.nickname || 'Gamer'}</p>
                          <p className="text-slate-500 font-mono mt-0.5">{claim.email}</p>
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(claim.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-600 font-medium">
                      No users have claimed this voucher code yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. LIVE SUPPORT HELPCHAT TAB */}
      {adminTab === 'supportChat' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase text-purple-400 tracking-wider flex items-center space-x-1.5">
                <MessageSquare className="h-4 w-4" />
                <span>Live Help Desk Support</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                {activeSupportChatKey ? 'Active Conversation' : 'Inbound Support Inbox & Filters'}
              </p>
            </div>
          </div>

          {/* Quick Email configurations inside Support Chat tab */}
          {!activeSupportChatKey && (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await update(ref(db, 'app_config'), { supportEmail: cfgSupportEmail });
                  alert('Support email edited successfully.');
                } catch (err: any) {
                  alert('Error editing support email: ' + err.message);
                }
              }} className="flex flex-col sm:flex-row items-end gap-3">
                <div className="flex-1">
                  <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Admin Support Email (Displays on help page)</label>
                  <input
                    type="email"
                    required
                    value={cfgSupportEmail}
                    onChange={(e) => setCfgSupportEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30 font-mono"
                    placeholder="e.g. support@colorclub.win"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer shrink-0"
                >
                  Save Email
                </button>
              </form>
            </div>
          )}

          {/* Split view: Either User List Page OR Chat Page */}
          {!activeSupportChatKey ? (
            /* PAGE 1: CHAT USER LIST (FULL WIDTH INBOX) */
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 flex flex-col space-y-4">
              {/* Header with Search and Filter tabs */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-850">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase text-purple-400">
                    Active Threads ({supportChats.length})
                  </span>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setSupportChatFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                      supportChatFilter === 'all'
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSupportChatFilter('unread')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer relative ${
                      supportChatFilter === 'unread'
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Unread Only</span>
                    {unreadChatCount > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-[8px] font-black px-1 rounded-full">{unreadChatCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => setSupportChatFilter('blocked')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                      supportChatFilter === 'blocked'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                  >
                    Blocked
                  </button>
                </div>
              </div>

              {/* Search input bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search chats by Nickname, Email address or Phone number..."
                  value={supportChatSearch}
                  onChange={(e) => setSupportChatSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                {supportChatSearch && (
                  <button
                    onClick={() => setSupportChatSearch('')}
                    className="absolute right-3 top-3 text-[10px] text-slate-500 hover:text-slate-300 font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Threads List layout */}
              {(() => {
                const filteredList = supportChats.filter((chat) => {
                  const query = supportChatSearch.toLowerCase().trim();
                  if (query) {
                    const emailMatch = (chat.email || '').toLowerCase().includes(query);
                    const nicknameMatch = (chat.nickname || '').toLowerCase().includes(query);
                    const phoneMatch = (chat.phone || '').includes(query);
                    if (!emailMatch && !nicknameMatch && !phoneMatch) {
                      return false;
                    }
                  }
                  if (supportChatFilter === 'unread') {
                    return chat.unreadCountForAdmin > 0;
                  }
                  if (supportChatFilter === 'blocked') {
                    return !!chat.blocked;
                  }
                  return true;
                });

                if (filteredList.length === 0) {
                  return (
                    <div className="py-12 text-center space-y-3">
                      <MessageSquare className="w-12 h-12 text-slate-800 mx-auto" />
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">No matching threads found</p>
                      <p className="text-[10px] text-slate-600">Try adjusting your filters or search keywords.</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                    {filteredList.map((chat) => {
                      const hasUnread = chat.unreadCountForAdmin > 0;
                      return (
                        <div
                          key={chat.userKey}
                          onClick={() => {
                            setActiveSupportChatKey(chat.userKey);
                            update(ref(db, `support_chats/${chat.userKey}`), { unreadCountForAdmin: 0 });
                          }}
                          className={`p-4 rounded-xl border bg-slate-950/40 border-slate-850 hover:bg-slate-900/50 transition-all cursor-pointer flex flex-col justify-between space-y-3.5 relative`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2.5">
                              {/* Avatar circle */}
                              <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-black text-purple-400 uppercase text-xs">
                                {(chat.nickname || chat.email || 'G')[0]}
                              </div>
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-xs text-white font-black">{chat.nickname || 'Gamer'}</span>
                                  {hasUnread && (
                                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase rounded animate-pulse">
                                      New message
                                    </span>
                                  )}
                                  {chat.blocked && (
                                    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[8px] font-black uppercase rounded">
                                      Blocked
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{chat.email}</span>
                              </div>
                            </div>

                            <span className="text-[8px] text-slate-600 font-mono">
                              {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleString() : ''}
                            </span>
                          </div>

                          {/* Quick Actions and open button */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-900" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center space-x-1.5">
                              {/* Block Action */}
                              <button
                                onClick={() => {
                                  const confirmText = chat.blocked ? "Turn ON chat for this user?" : "Turn OFF / Disable chat for this user?";
                                  if (confirm(confirmText)) {
                                    update(ref(db, `support_chats/${chat.userKey}`), { blocked: !chat.blocked });
                                  }
                                }}
                                className={`p-1.5 rounded-lg border cursor-pointer ${
                                  chat.blocked
                                    ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                    : 'text-slate-500 border-slate-850 hover:text-slate-200 hover:bg-slate-900 bg-slate-950/80'
                                }`}
                                title={chat.blocked ? "Unblock Chat" : "Block Chat"}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>

                              {/* Clear History */}
                              <button
                                onClick={() => {
                                  if (confirm(`Clear all messages in conversation for ${chat.email}?`)) {
                                    remove(ref(db, `support_chats/${chat.userKey}/messages`));
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-slate-850 text-slate-500 hover:text-slate-200 hover:bg-slate-900 bg-slate-950/80 cursor-pointer"
                                title="Clear Messages"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Chat */}
                              <button
                                onClick={() => {
                                  if (confirm(`Delete the entire support chat object from firebase for ${chat.email}?`)) {
                                    remove(ref(db, `support_chats/${chat.userKey}`));
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/10 bg-slate-950/80 cursor-pointer"
                                title="Delete completely"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                setActiveSupportChatKey(chat.userKey);
                                update(ref(db, `support_chats/${chat.userKey}`), { unreadCountForAdmin: 0 });
                              }}
                              className="bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-[9px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                            >
                              <span>Open Chat</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            /* PAGE 2: CHAT CONVERSATION SCREEN (FULL WIDTH SINGLE CONVERSATION) */
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 flex flex-col h-[580px] min-h-[580px] overflow-hidden">
              {(() => {
                const activeChat = supportChats.find(c => c.userKey === activeSupportChatKey);
                const msgsList = activeChat?.messages ? Object.values(activeChat.messages).sort((a: any, b: any) => a.timestamp - b.timestamp) : [];

                return (
                  <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
                    {/* Upper Header bar */}
                    <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 flex items-center justify-between shrink-0 mb-3">
                      <div className="flex items-center space-x-3">
                        {/* Back Arrow button */}
                        <button
                          onClick={() => setActiveSupportChatKey(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer flex items-center justify-center border border-slate-850 bg-slate-950"
                        >
                          <ChevronLeft className="h-4.5 w-4.5" />
                          <span className="text-[10px] font-bold uppercase ml-1 pr-1 hidden sm:inline">Back to Inbox</span>
                        </button>

                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs text-white font-black uppercase tracking-wider">{activeChat?.nickname || 'Gamer'}</span>
                            {activeChat?.blocked && (
                              <span className="text-[8px] bg-red-500/10 text-red-400 font-black px-1 rounded uppercase">Blocked</span>
                            )}
                          </div>
                          <span className="text-[9px] text-slate-500 font-mono block mt-0.5">{activeChat?.email}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          const confirmText = activeChat?.blocked ? "Turn ON chat for this user?" : "Turn OFF / Disable chat for this user?";
                          if (confirm(confirmText)) {
                            update(ref(db, `support_chats/${activeSupportChatKey}`), { blocked: !activeChat?.blocked });
                          }
                        }}
                        className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                          activeChat?.blocked
                            ? 'bg-rose-500/15 border-rose-500/25 text-rose-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {activeChat?.blocked ? 'Enable User Chat' : 'Disable User Chat'}
                      </button>
                    </div>

                    {/* Chat Messages panel */}
                    <div className="flex-1 bg-slate-950/40 border border-slate-850/60 rounded-xl p-4 overflow-y-auto space-y-3 flex flex-col min-h-0 mb-3">
                      {msgsList.length === 0 ? (
                        <div className="my-auto text-center text-xs text-slate-600 font-bold p-6">
                          No messages in this chat thread. Send a reply below.
                        </div>
                      ) : (
                        msgsList.map((msg: any) => {
                          const isAdmin = msg.sender === 'admin';
                          return (
                            <div
                              key={msg.msgId}
                              className={`flex flex-col max-w-[80%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'} space-y-1`}
                            >
                              <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                                isAdmin
                                  ? 'bg-purple-500 text-slate-950 rounded-tr-none font-bold'
                                  : 'bg-[#1E293B] text-slate-200 rounded-tl-none border border-slate-800'
                              }`}>
                                {msg.text}
                              </div>
                              <span className="text-[8px] text-slate-600 font-mono">
                                {new Date(msg.timestamp).toLocaleString()}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Reply input control */}
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!adminReplyText.trim() || !activeSupportChatKey) return;

                      try {
                        const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                        const replyRef = ref(db, `support_chats/${activeSupportChatKey}/messages/${msgId}`);

                        await set(replyRef, {
                          msgId,
                          sender: 'admin',
                          text: adminReplyText.trim(),
                          timestamp: Date.now()
                        });

                        const currentUnreadUser = activeChat?.unreadCountForUser || 0;
                        await update(ref(db, `support_chats/${activeSupportChatKey}`), {
                          unreadCountForUser: currentUnreadUser + 1,
                          unreadCountForAdmin: 0,
                          lastMessageTimestamp: Date.now()
                        });

                        setAdminReplyText('');
                      } catch (err) {
                        console.error('Failed to send admin reply: ', err);
                      }
                    }} className="flex items-center space-x-2 shrink-0">
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Type administrator support reply..."
                        className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500/30"
                      />
                      <button
                        type="submit"
                        disabled={!adminReplyText.trim()}
                        className="bg-purple-500 hover:bg-purple-400 disabled:opacity-40 text-slate-950 p-3 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center"
                      >
                        <Send className="w-4.5 h-4.5" />
                      </button>
                    </form>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

