import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, BidRecord, RoomType, GamePeriod, DepositChannel, DepositChannelField, WithdrawalField, AppConfig } from '../types';
import { COLOR_MAP } from '../utils/gameUtils';
import { ShieldAlert, Users, Check, X, DollarSign, Search, Settings, Radio, Plus, Percent, Calendar, Trash2, Clock, Landmark, Layers, Send, QrCode, CreditCard, Sparkles, Mail, MessageSquare, Ban, Edit, Ticket, UserCheck, AlertTriangle, ChevronLeft, ChevronRight, LayoutDashboard, TrendingUp, Activity, CheckCircle2 } from 'lucide-react';
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
  const [adminTab, setAdminTab] = useState<'dashboard' | 'transactions' | 'users' | 'manipulate' | 'payments' | 'appConfig' | 'coupons' | 'supportChat'>('dashboard');
  
  // Search State
  const [userSearch, setUserSearch] = useState('');

  // Lazy loading state for user database list
  const [userListLimit, setUserListLimit] = useState(10);

  // Reset limit when search pattern changes
  React.useEffect(() => {
    setUserListLimit(10);
  }, [userSearch]);
  
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
  const [cfgAppName, setCfgAppName] = useState(String(appConfig.appName || ''));
  const [cfgCurrencySymbol, setCfgCurrencySymbol] = useState(String(appConfig.currencySymbol || '₹'));
  const [cfgCurrencyName, setCfgCurrencyName] = useState(String(appConfig.currencyName || 'INR'));
  const [cfgMinDep, setCfgMinDep] = useState((appConfig.minDeposit || 100).toString());
  const [cfgMaxDep, setCfgMaxDep] = useState((appConfig.maxDeposit || 100000).toString());
  const [cfgMinWith, setCfgMinWith] = useState((appConfig.minWithdrawal || 110).toString());
  const [cfgMaxWith, setCfgMaxWith] = useState((appConfig.maxWithdrawal || 100000).toString());
  const [cfgTg, setCfgTg] = useState(String(appConfig.telegramSupport || ''));
  const [cfgWa, setCfgWa] = useState(String(appConfig.whatsappSupport || ''));
  const [cfgInterestRate, setCfgInterestRate] = useState((appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03).toString());
  const [cfgSupportEmail, setCfgSupportEmail] = useState(String(appConfig.supportEmail || 'support@lottery7.vip'));
  const [cfgSupportChatLink, setCfgSupportChatLink] = useState(String(appConfig.supportChatLink || ''));
  const [cfgReferralDomain, setCfgReferralDomain] = useState(String(appConfig.referralDomain || ''));
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

  // User tab specific filters and drill-down state
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline' | 'money' | 'admin'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);

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
    setCfgAppName(String(appConfig.appName || ''));
    setCfgCurrencySymbol(String(appConfig.currencySymbol || '₹'));
    setCfgCurrencyName(String(appConfig.currencyName || 'INR'));
    setCfgMinDep((appConfig.minDeposit || 100).toString());
    setCfgMaxDep((appConfig.maxDeposit || 100000).toString());
    setCfgMinWith((appConfig.minWithdrawal || 110).toString());
    setCfgMaxWith((appConfig.maxWithdrawal || 100000).toString());
    setCfgTg(String(appConfig.telegramSupport || ''));
    setCfgWa(String(appConfig.whatsappSupport || ''));
    setCfgInterestRate((appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03).toString());
    setCfgSupportEmail(String(appConfig.supportEmail || 'support@lottery7.vip'));
    setCfgSupportChatLink(String(appConfig.supportChatLink || ''));
    setCfgReferralDomain(String(appConfig.referralDomain || ''));
  }, [appConfig]);

  const handleAppConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgSuccess('');
    setCfgError('');
    setCfgLoading(true);

    try {
      await onUpdateAppConfig({
        appName: String(cfgAppName || '').trim(),
        minDeposit: Number(cfgMinDep),
        maxDeposit: Number(cfgMaxDep),
        minWithdrawal: Number(cfgMinWith),
        maxWithdrawal: Number(cfgMaxWith),
        telegramSupport: String(cfgTg || '').trim(),
        whatsappSupport: String(cfgWa || '').trim(),
        currencySymbol: String(cfgCurrencySymbol || '').trim(),
        currencyName: String(cfgCurrencyName || '').trim(),
        interestRate: Number(cfgInterestRate),
        supportEmail: String(cfgSupportEmail || '').trim(),
        supportChatLink: String(cfgSupportChatLink || '').trim(),
        referralDomain: String(cfgReferralDomain || '').trim()
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
  
  const filteredUsers = users.filter((u) => {
    // 1. Search Query Match
    const searchLower = userSearch.toLowerCase().trim();
    if (searchLower) {
      const emailMatch = u.email && u.email.toLowerCase().includes(searchLower);
      const phoneMatch = u.phone && u.phone.includes(searchLower);
      const nicknameMatch = u.nickname && u.nickname.toLowerCase().includes(searchLower);
      const inviteCodeMatch = u.inviteCode && u.inviteCode.toLowerCase().includes(searchLower);
      const referredByMatch = u.referredBy && u.referredBy.toLowerCase().includes(searchLower);
      const referredByUserKeyMatch = u.referredByUserKey && u.referredByUserKey.toLowerCase().includes(searchLower);

      if (!emailMatch && !phoneMatch && !nicknameMatch && !inviteCodeMatch && !referredByMatch && !referredByUserKeyMatch) {
        return false;
      }
    }

    // 2. Tab Category Match
    const isOnline = u.lastActive ? (Date.now() - u.lastActive) <= 120000 : false;
    if (userFilter === 'online') {
      return isOnline;
    }
    if (userFilter === 'offline') {
      return !isOnline;
    }
    if (userFilter === 'money') {
      return u.wallet > 0;
    }
    if (userFilter === 'admin') {
      return u.role === 'admin';
    }

    return true;
  });

  // Sort by money if the userFilter is 'money', otherwise by lastActive or registration order
  if (userFilter === 'money') {
    filteredUsers.sort((a, b) => (b.wallet || 0) - (a.wallet || 0));
  } else {
    filteredUsers.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
  }

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
    <div className="bg-[#0B0F19] border border-slate-800 rounded-2xl p-2 sm:p-3 lg:p-4 shadow-2xl font-sans text-slate-200 min-h-[780px] flex flex-col xl:flex-row gap-5">
      
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

      {/* 1. SIDEBAR NAVIGATION RAIL */}
      <div className="xl:w-[260px] shrink-0 bg-[#0F1322] border border-slate-850 rounded-2xl p-4 flex flex-col justify-between space-y-6">
        <div className="space-y-5">
          {/* Console Logo and Title */}
          <div className="border-b border-slate-850 pb-4">
            <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2">
              <ShieldAlert className="h-5 w-5 text-purple-500 animate-pulse" />
              <span>Admin Console</span>
            </h3>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">Management Suite v1.2</p>
          </div>

          {/* Tab buttons */}
          <div className="flex xl:flex-col gap-1 overflow-x-auto xl:overflow-x-visible pb-2 xl:pb-0 scrollbar-none space-y-4">
            {/* Group 1: Overview & Activity */}
            <div className="space-y-1">
              <span className="hidden xl:block text-[8px] font-black tracking-widest text-slate-500 uppercase px-3 mb-1">📊 SYSTEM MONITOR</span>
              
              {/* Dashboard Overview */}
              <button
                onClick={() => setAdminTab('dashboard')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 w-full shrink-0 border ${
                  adminTab === 'dashboard'
                    ? 'bg-purple-550/10 text-purple-400 border-purple-500/25 font-extrabold shadow-md shadow-purple-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span>Dashboard Home</span>
              </button>

              {/* Transactions Section */}
              <button
                onClick={() => setAdminTab('transactions')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between w-full shrink-0 border ${
                  adminTab === 'transactions'
                    ? 'bg-purple-550/10 text-purple-400 border-purple-500/25 font-extrabold shadow-md shadow-purple-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <DollarSign className="h-4 w-4 shrink-0" />
                  <span>Transactions</span>
                </div>
                {(pendingDeposits.length + pendingWithdrawals.length) > 0 && (
                  <span className="bg-red-500 text-white font-black px-1.5 py-0.5 rounded-md text-[8px] animate-pulse leading-none">
                    {pendingDeposits.length + pendingWithdrawals.length}
                  </span>
                )}
              </button>

              {/* User Database */}
              <button
                onClick={() => setAdminTab('users')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between w-full shrink-0 border ${
                  adminTab === 'users'
                    ? 'bg-purple-550/10 text-purple-400 border-purple-500/25 font-extrabold shadow-md shadow-purple-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>Player Database</span>
                </div>
                <span className="bg-slate-850 text-slate-400 font-bold px-1.5 py-0.5 rounded-md text-[8px] font-mono leading-none">
                  {users.length}
                </span>
              </button>

              {/* Live Chat Support */}
              <button
                onClick={() => setAdminTab('supportChat')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between w-full shrink-0 border ${
                  adminTab === 'supportChat'
                    ? 'bg-purple-550/10 text-purple-400 border-purple-500/25 font-extrabold shadow-md shadow-purple-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span>Help Support</span>
                </div>
                {unreadChatCount > 0 && (
                  <span className="bg-red-500 text-white font-black px-1.5 py-0.5 rounded-md text-[8px] animate-bounce leading-none">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            </div>

            {/* Group 2: System Quick Controls */}
            <div className="space-y-1">
              <span className="hidden xl:block text-[8px] font-black tracking-widest text-[#d4af37] uppercase px-3 mb-1">⚡ QUICK CONTROLS</span>

              {/* Outcome Manipulation */}
              <button
                onClick={() => setAdminTab('manipulate')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 w-full shrink-0 border ${
                  adminTab === 'manipulate'
                    ? 'bg-purple-550/10 text-[#d4af37] border-amber-500/25 font-extrabold shadow-md shadow-amber-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>Outcome Overrides</span>
              </button>

              {/* Payment Gateways */}
              <button
                onClick={() => setAdminTab('payments')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 w-full shrink-0 border ${
                  adminTab === 'payments'
                    ? 'bg-purple-550/10 text-[#d4af37] border-amber-500/25 font-extrabold shadow-md shadow-amber-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <Landmark className="h-4 w-4 shrink-0" />
                <span>Payment Setup</span>
              </button>

              {/* Coupons */}
              <button
                onClick={() => setAdminTab('coupons')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between w-full shrink-0 border ${
                  adminTab === 'coupons'
                    ? 'bg-purple-550/10 text-[#d4af37] border-amber-500/25 font-extrabold shadow-md shadow-amber-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Ticket className="h-4 w-4 shrink-0" />
                  <span>Gift Coupons</span>
                </div>
                <span className="bg-slate-850 text-slate-400 font-bold px-1.5 py-0.5 rounded-md text-[8px] font-mono leading-none">
                  {coupons.length}
                </span>
              </button>

              {/* App Settings */}
              <button
                onClick={() => setAdminTab('appConfig')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2.5 w-full shrink-0 border ${
                  adminTab === 'appConfig'
                    ? 'bg-purple-550/10 text-[#d4af37] border-amber-500/25 font-extrabold shadow-md shadow-amber-950/20 bg-slate-900/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-850/40'
                }`}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Global Config</span>
              </button>
            </div>
          </div>
        </div>

        {/* Server status indicator */}
        <div className="hidden xl:block pt-4 border-t border-slate-850">
          <div className="flex items-center space-x-2 bg-slate-950 p-2.5 rounded-xl border border-slate-850">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <div className="text-[9px] font-bold text-slate-400 font-mono">
              REALTIME CONSOLE ACTIVE
            </div>
          </div>
        </div>
      </div>

      {/* 2. MAIN VIEW WINDOW */}
      <div className="flex-1 bg-[#0F1322] border border-slate-850 rounded-2xl p-4 lg:p-6 min-h-0 overflow-y-auto space-y-6">

        {/* Tab Contents: dashboard */}
        {adminTab === 'dashboard' && (
          <div className="space-y-6">
            {/* System Overview Hero Banner */}
            <div className="bg-gradient-to-br from-purple-950/20 via-slate-950/30 to-slate-950/75 p-5 sm:p-6 rounded-2xl border border-purple-900/15 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 hidden md:block">
                <ShieldAlert className="h-40 w-40 text-purple-400" />
              </div>
              <div className="relative z-10 space-y-2">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-purple-550/10 border border-purple-500/20 rounded-full text-[9px] font-black uppercase tracking-widest text-purple-400">
                  <Activity className="h-3 w-3 animate-pulse" />
                  <span>Real-time System Status</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase">System Performance Dashboard</h3>
                <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
                  Welcome back to the system administrator cockpit. Below is a live summary of platform financial metrics, pending requests, and gamer registration statistics. Use the tabs in the sidebar navigation pane to inspect individual database models.
                </p>
              </div>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 hover:border-purple-500/20 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Approved Deposits</span>
                  <DollarSign className="h-7 w-7 text-emerald-400 bg-emerald-500/10 p-1.5 rounded-xl group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-2xl font-black font-mono text-white block">
                  {appConfig.currencySymbol}{totalDeposited.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Verified Inbound Funds</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 hover:border-purple-500/20 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Paid Withdrawals</span>
                  <DollarSign className="h-7 w-7 text-rose-400 bg-rose-500/10 p-1.5 rounded-xl group-hover:scale-110 transition-transform" />
                </div>
                <span className="text-2xl font-black font-mono text-white block">
                  {appConfig.currencySymbol}{totalWithdrawn.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Verified Outbound Cashouts</span>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 hover:border-purple-500/20 transition-all shadow-md group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Net System Margin</span>
                  <TrendingUp className="h-7 w-7 text-purple-400 bg-purple-500/10 p-1.5 rounded-xl group-hover:scale-110 transition-transform" />
                </div>
                <span className={`text-2xl font-black font-mono block ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {appConfig.currencySymbol}{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase block mt-1">Net Platform Earnings</span>
              </div>
            </div>

            {/* Quick Status Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                onClick={() => setAdminTab('users')}
                className="bg-slate-950/20 border border-slate-850 rounded-xl p-4 text-left cursor-pointer hover:bg-slate-950/40 hover:border-purple-500/10 transition-all"
              >
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Gamers</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className="text-xl font-black font-mono text-white">{users.length}</span>
                  <span className="text-[10px] text-slate-500 font-bold">Registered</span>
                </div>
              </div>

              <div 
                onClick={() => setAdminTab('transactions')}
                className="bg-slate-950/20 border border-slate-850 rounded-xl p-4 text-left cursor-pointer hover:bg-slate-950/40 hover:border-purple-500/10 transition-all"
              >
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Pending Deposits</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-xl font-black font-mono ${pendingDeposits.length > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                    {pendingDeposits.length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Awaiting Action</span>
                </div>
              </div>

              <div 
                onClick={() => setAdminTab('transactions')}
                className="bg-slate-950/20 border border-slate-850 rounded-xl p-4 text-left cursor-pointer hover:bg-slate-950/40 hover:border-purple-500/10 transition-all"
              >
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Pending Withdrawals</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-xl font-black font-mono ${pendingWithdrawals.length > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`}>
                    {pendingWithdrawals.length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Awaiting Action</span>
                </div>
              </div>

              <div 
                onClick={() => setAdminTab('supportChat')}
                className="bg-slate-950/20 border border-slate-850 rounded-xl p-4 text-left cursor-pointer hover:bg-slate-950/40 hover:border-purple-500/10 transition-all"
              >
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Support Inbox</span>
                <div className="flex items-baseline space-x-1.5 mt-1">
                  <span className={`text-xl font-black font-mono ${unreadChatCount > 0 ? 'text-red-500 animate-bounce' : 'text-slate-400'}`}>
                    {unreadChatCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Unread Chats</span>
                </div>
              </div>
            </div>



            {/* Direct App Configuration Form at bottom of Dashboard */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-5 space-y-5 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4.5 w-4.5 text-[#d4af37] animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">Dashboard App Configuration (Firebase Console)</h4>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mt-0.5">Edit and save live details instantly</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminTab('appConfig')}
                  className="px-3 py-1 bg-purple-550/10 hover:bg-purple-550/25 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shrink-0 text-center"
                >
                  Manage All Details
                </button>
              </div>

              {cfgSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{cfgSuccess}</span>
                </div>
              )}
              {cfgError && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center space-x-2">
                  <X className="h-3.5 w-3.5 text-rose-400" />
                  <span>{cfgError}</span>
                </div>
              )}

              <form onSubmit={handleAppConfigSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Application Name</label>
                    <input
                      type="text"
                      required
                      value={cfgAppName}
                      onChange={(e) => setCfgAppName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30 font-bold"
                      placeholder="e.g. My VIP Game"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency Symbol</label>
                    <input
                      type="text"
                      required
                      value={cfgCurrencySymbol}
                      onChange={(e) => setCfgCurrencySymbol(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30 font-mono"
                      placeholder="e.g. ₹ or $"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency Name (Code)</label>
                    <input
                      type="text"
                      required
                      value={cfgCurrencyName}
                      onChange={(e) => setCfgCurrencyName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500/30 font-mono"
                      placeholder="e.g. INR or USD"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/20 p-3.5 border border-slate-900 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min Deposit</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMinDep}
                      onChange={(e) => setCfgMinDep(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Max Deposit</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMaxDep}
                      onChange={(e) => setCfgMaxDep(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min Withdrawal</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={cfgMinWith}
                      onChange={(e) => setCfgMinWith(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interest Rate (Daily)</label>
                    <input
                      type="number"
                      step="0.0001"
                      required
                      value={cfgInterestRate}
                      onChange={(e) => setCfgInterestRate(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Telegram Support Link</label>
                    <input
                      type="text"
                      value={cfgTg}
                      onChange={(e) => setCfgTg(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
                      placeholder="e.g. https://t.me/customer_service"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp Support Link</label>
                    <input
                      type="text"
                      value={cfgWa}
                      onChange={(e) => setCfgWa(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs text-white focus:outline-none"
                      placeholder="e.g. WhatsApp support link/number"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={cfgLoading}
                  className="w-full bg-[#d4af37] text-slate-950 hover:bg-[#ebd06a] font-black py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  <span>{cfgLoading ? 'Saving Config...' : 'Update App Config on Firebase'}</span>
                </button>
              </form>
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
        <div className="space-y-6 animate-in fade-in duration-300">
          {selectedUserDetail ? (
            /* ========================================================= */
            /* 1. DRILL-DOWN PLAYER DETAIL PAGE VIEW                     */
            /* ========================================================= */
            (() => {
              const freshUser = users.find(u => u.uid === selectedUserDetail.uid) || selectedUserDetail;
              const uKey = freshUser.email ? getEmailKey(freshUser.email) : (freshUser.phone || freshUser.uid);
              
              // Calculate Financial metrics
              const userDeposits = deposits.filter(d => d.userId === freshUser.uid);
              const totalUserDeposited = userDeposits.filter(d => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0);
              
              const userWithdrawals = withdrawals.filter(w => w.userId === freshUser.uid);
              const totalUserWithdrawn = userWithdrawals.filter(w => w.status === 'approved').reduce((acc, w) => acc + w.amount, 0);
              
              // Calculate Bidding statistics
              const userBids = activeBids.filter(b => b.userId === freshUser.uid);
              const activeUserBids = userBids.filter(b => b.status === 'pending');
              const pastUserBids = userBids.filter(b => b.status !== 'pending');
              const totalBidsCount = userBids.length;
              const totalBiddingVolume = userBids.reduce((acc, b) => acc + b.amount, 0);
              
              // Get Referred Downstream list
              const referredPlayers = users.filter(u => u.referredByUserKey === uKey || u.referredBy === freshUser.inviteCode);
              
              const isUserOnline = freshUser.lastActive ? (Date.now() - freshUser.lastActive) <= 120000 : false;

              return (
                <div className="space-y-6">
                  {/* Detail view header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-850">
                    <div className="flex items-center space-x-3.5">
                      <button
                        onClick={() => setSelectedUserDetail(null)}
                        className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-300 transition-all flex items-center space-x-1.5 font-bold uppercase text-[10px] tracking-wider cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back To List</span>
                      </button>
                      
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-base font-black text-white">{freshUser.nickname || 'Unknown Player'}</h4>
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            isUserOnline
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-500 border border-slate-800'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                            <span>{isUserOnline ? 'Online' : 'Offline'}</span>
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">UID: {freshUser.uid}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {freshUser.role === 'admin' ? (
                        <span className="bg-purple-500/15 text-purple-400 border border-purple-500/25 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase">Admin Operator</span>
                      ) : (
                        <span className="bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase">Standard Player</span>
                      )}
                    </div>
                  </div>

                  {/* Bento Metrics Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Wallet Money */}
                    <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Wallet Balance</span>
                        <span className="text-xl font-black font-mono text-emerald-400 leading-none">
                          {appConfig.currencySymbol || '$'}
                          {(freshUser.wallet || 0).toLocaleString([], { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 rounded-lg text-emerald-400">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Total Recharge Deposited */}
                    <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Deposits (Recharge)</span>
                        <span className="text-xl font-black font-mono text-white leading-none">
                          {appConfig.currencySymbol || '$'}
                          {totalUserDeposited.toLocaleString([], { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2 bg-blue-500/10 border border-blue-500/15 rounded-lg text-blue-400">
                        <Landmark className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Total Withdrawals paid out */}
                    <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Withdrawals</span>
                        <span className="text-xl font-black font-mono text-white leading-none">
                          {appConfig.currencySymbol || '$'}
                          {totalUserWithdrawn.toLocaleString([], { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2 bg-rose-500/10 border border-rose-500/15 rounded-lg text-rose-400">
                        <CreditCard className="w-5 h-5" />
                      </div>
                    </div>

                    {/* Bidding volume and counts */}
                    <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Bidding Volume</span>
                        <span className="text-xl font-black font-mono text-purple-400 leading-none">
                          {totalBiddingVolume.toLocaleString([], { minimumFractionDigits: 2 })}
                        </span>
                        <span className="block text-[8px] text-slate-500 font-bold uppercase tracking-wider">Across {totalBidsCount} placed bets</span>
                      </div>
                      <div className="p-2 bg-purple-500/10 border border-purple-500/15 rounded-lg text-purple-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                  </div>

                  {/* Quick Action Credit adjuster */}
                  <div className="bg-purple-950/10 border border-purple-500/15 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center space-x-1.5">
                        <Settings className="w-4 h-4" />
                        <span>Direct Account Credit Adjuster</span>
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Enter an absolute value to override this player's wallet balance instantly.</p>
                    </div>

                    <div className="flex items-center bg-slate-950/80 border border-slate-850 rounded-lg p-1.5 shrink-0 self-start md:self-center">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="New wallet amount"
                        value={editingUserKey === uKey ? adjustAmount : ''}
                        onChange={(e) => {
                          setEditingUserKey(uKey);
                          setAdjustAmount(e.target.value);
                        }}
                        onFocus={() => {
                          if (editingUserKey !== uKey) {
                            setEditingUserKey(uKey);
                            setAdjustAmount(freshUser.wallet.toString());
                          }
                        }}
                        className="w-32 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (editingUserKey !== uKey) return;
                          try {
                            await onUpdateUserWallet(uKey, parseFloat(adjustAmount) || 0);
                            alert('Wallet credit ledger updated successfully!');
                            setEditingUserKey(null);
                          } catch (err: any) {
                            alert('Failed to update wallet balance: ' + err.message);
                          }
                        }}
                        className="ml-2 bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded-md cursor-pointer transition-all"
                      >
                        Save Balance
                      </button>
                    </div>
                  </div>

                  {/* Core Profiles & Referrals Insight Panels */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* General Bio and Credentials */}
                    <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-5 space-y-4">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-2">
                        <Activity className="w-4.5 h-4.5 text-purple-400" />
                        <span>Security Credentials & Metadata</span>
                      </h5>
                      
                      <div className="space-y-3 font-mono text-xs text-slate-300">
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Nickname</span>
                          <span className="text-white font-sans font-bold">{freshUser.nickname || 'Guest Gamer'}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Email Contact</span>
                          <span className="text-white select-all font-bold">{freshUser.email}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Phone contact</span>
                          <span className="text-white">{freshUser.phone || 'Not Configured'}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Password Cipher</span>
                          <span className="text-purple-300 select-all font-bold" title="Plaintext verification">{freshUser.password || '••••••••'}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Registration stamp</span>
                          <span className="text-slate-400 font-sans">{new Date(freshUser.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Last Sync Pulse</span>
                          <span className="text-slate-400 font-sans">
                            {freshUser.lastActive ? new Date(freshUser.lastActive).toLocaleString() : 'No active session recorded'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Invite Program and Parents details */}
                    <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-5 space-y-4">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-2">
                        <QrCode className="w-4.5 h-4.5 text-purple-400" />
                        <span>Referral Network & Affiliations</span>
                      </h5>
                      
                      <div className="space-y-3 font-mono text-xs text-slate-300">
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">Own Referral Code</span>
                          <span className="text-emerald-400 font-bold select-all">{freshUser.inviteCode || 'No code set'}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">referred by code</span>
                          <span className="text-slate-300 font-bold">{freshUser.referredBy || 'Organic direct install'}</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">parent affiliate</span>
                          <span className="text-slate-400 font-sans truncate max-w-[180px]">
                            {(() => {
                              const parent = users.find(u => u.uid === freshUser.referredByUserKey || (u.inviteCode && u.inviteCode === freshUser.referredBy));
                              return parent ? `${parent.nickname} (${parent.email || parent.phone})` : 'Direct Operator';
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">direct invitees</span>
                          <span className="text-purple-400 font-sans font-bold">{referredPlayers.length} Members</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-900/60">
                          <span className="text-slate-500 uppercase text-[9px] font-black tracking-wider">network interest earned</span>
                          <span className="text-emerald-400 font-sans font-bold">
                            {appConfig.currencySymbol || '$'}{(freshUser.interestEarned || 0).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bidding Portfolios Layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Active/Pending Bids */}
                    <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-4 flex flex-col h-[320px]">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-1.5 shrink-0">
                        <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span>Active Unsettled Bids ({activeUserBids.length})</span>
                      </h5>

                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mt-2">
                        {activeUserBids.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600 font-black text-[9px] uppercase tracking-wider">
                            <span>No active bids calculating</span>
                          </div>
                        ) : (
                          activeUserBids.sort((a,b) => b.createdAt - a.createdAt).map((bid) => (
                            <div key={bid.bidId} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between font-mono text-xs">
                              <div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="text-[10px] font-bold text-white bg-slate-855 px-1.5 py-0.5 rounded font-sans uppercase">Room {bid.roomId}</span>
                                  <span className="text-slate-400 font-bold">Period {bid.periodId}</span>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  Selection: <span className="text-amber-400 font-black uppercase">{bid.selection}</span> | {new Date(bid.createdAt).toLocaleTimeString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-bold text-white block">{appConfig.currencySymbol || '$'}{bid.amount.toFixed(2)}</span>
                                <span className="text-[8px] bg-amber-500/10 text-amber-400 font-black px-1 rounded animate-pulse">Pending</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Past settled game history */}
                    <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-4 flex flex-col h-[320px]">
                      <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-1.5 shrink-0">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span>Settled Game Records ({pastUserBids.length})</span>
                      </h5>

                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 mt-2">
                        {pastUserBids.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-slate-600 font-black text-[9px] uppercase tracking-wider">
                            <span>No historical settlements recorded</span>
                          </div>
                        ) : (
                          pastUserBids.sort((a,b) => b.createdAt - a.createdAt).map((bid) => {
                            const won = bid.status === 'won';
                            return (
                              <div key={bid.bidId} className="p-3 bg-slate-950/60 border border-slate-900 rounded-xl flex items-center justify-between font-mono text-xs">
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded font-sans uppercase">Room {bid.roomId}</span>
                                    <span className="text-slate-400 font-bold">Period {bid.periodId}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    Placed: <span className="text-white font-bold uppercase">{bid.selection}</span> | {new Date(bid.createdAt).toLocaleDateString()} {new Date(bid.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-bold text-slate-400 block">{appConfig.currencySymbol || '$'}{bid.amount.toFixed(2)}</span>
                                  <span className={`inline-block text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                    won
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                      : 'bg-red-500/10 text-red-500 border border-red-500/15'
                                  }`}>
                                    {won ? `Won +${appConfig.currencySymbol || '$'}${bid.winAmount.toFixed(2)}` : 'Lost'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Ledger transactions list */}
                  <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-5 space-y-4">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-1.5">
                      <Landmark className="w-4.5 h-4.5 text-purple-400" />
                      <span>Financial Ledger Log (All Deposit & Withdrawal requests)</span>
                    </h5>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-850 text-left text-xs text-slate-300 font-mono">
                        <thead className="bg-[#0c1122]/60 text-slate-500 uppercase tracking-wider font-bold">
                          <tr>
                            <th className="px-4 py-2 text-[9px] tracking-wider">Transaction Type</th>
                            <th className="px-4 py-2 text-[9px] tracking-wider">Amount</th>
                            <th className="px-4 py-2 text-[9px] tracking-wider">Ledger reference</th>
                            <th className="px-4 py-2 text-[9px] tracking-wider">Timestamp</th>
                            <th className="px-4 py-2 text-[9px] tracking-wider">Settlement status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-slate-300">
                          {(() => {
                            const dList = userDeposits.map(d => ({ ...d, txType: 'Deposit' }));
                            const wList = userWithdrawals.map(w => ({ ...w, txType: 'Withdrawal' }));
                            const combinedTx = [...dList, ...wList].sort((a,b) => b.createdAt - a.createdAt);

                            if (combinedTx.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="py-8 text-center text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                    No financial request history tracked
                                  </td>
                                </tr>
                              );
                            }

                            return combinedTx.map((tx: any, idx) => {
                              const isDeposit = tx.txType === 'Deposit';
                              return (
                                <tr key={idx} className="hover:bg-slate-900/20">
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                      isDeposit
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                                    }`}>
                                      {tx.txType}
                                    </span>
                                  </td>
                                  <td className={`px-4 py-3 font-bold ${isDeposit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {isDeposit ? '+' : '-'}{appConfig.currencySymbol || '$'}{tx.amount.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">
                                    {isDeposit ? `UTR: ${tx.utr}` : `Acc: ${tx.accountNumber || ''} / UPI: ${tx.upi || ''}`}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 font-sans text-[10px]">{new Date(tx.createdAt).toLocaleString()}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                                      tx.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      tx.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/15' :
                                      tx.status === 'hold' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                                      'bg-slate-850 text-slate-400'
                                    }`}>
                                      {tx.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Downstream Referral players table list */}
                  <div className="bg-[#090D1A]/40 border border-slate-850 rounded-xl p-5 space-y-4">
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-850/60 flex items-center space-x-1.5">
                      <Users className="w-4.5 h-4.5 text-purple-400" />
                      <span>Downstream Referred players ({referredPlayers.length} accounts)</span>
                    </h5>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-850 text-left text-xs text-slate-300">
                        <thead className="bg-[#0c1122]/60 text-slate-500 uppercase tracking-wider font-bold">
                          <tr>
                            <th className="px-4 py-3 text-[9px] tracking-wider">Nickname</th>
                            <th className="px-4 py-3 text-[9px] tracking-wider">Email / contact</th>
                            <th className="px-4 py-3 text-[9px] tracking-wider font-mono">wallet balance</th>
                            <th className="px-4 py-3 text-[9px] tracking-wider">Joined timestamp</th>
                            <th className="px-4 py-3 text-[9px] tracking-wider text-center">Drill Down</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900/60 text-slate-300">
                          {referredPlayers.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                No network players registered under this user's affiliate structure
                              </td>
                            </tr>
                          ) : (
                            referredPlayers.map((p) => {
                              return (
                                <tr key={p.uid} className="hover:bg-slate-900/20">
                                  <td className="px-4 py-3">
                                    <div className="font-extrabold text-white">{p.nickname || 'Guest'}</div>
                                    <span className="text-[8px] text-slate-500 font-mono tracking-wider">UID: {p.uid.substring(0,8)}...</span>
                                  </td>
                                  <td className="px-4 py-3 font-mono">
                                    <div>{p.email}</div>
                                    {p.phone && <div className="text-[10px] text-slate-500">Phone: {p.phone}</div>}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-emerald-400 font-extrabold">
                                    {appConfig.currencySymbol || '$'}{(p.wallet || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 text-[10px] font-sans">{new Date(p.createdAt).toLocaleDateString()}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        setSelectedUserDetail(p);
                                        setAdjustAmount(p.wallet.toString());
                                      }}
                                      className="bg-purple-550/10 text-purple-400 hover:text-white border border-purple-500/20 hover:bg-purple-550/25 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider cursor-pointer transition-all"
                                    >
                                      Drill Down
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* ========================================================= */
            /* 2. PLAYER REGISTRY DIRECTORY LISTING VIEW                  */
            /* ========================================================= */
            <>
              {/* Header block with stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white tracking-wider uppercase flex items-center space-x-2">
                    <Users className="h-4.5 w-4.5 text-purple-400 animate-pulse" />
                    <span>Player Registry Directory</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Search, analyze, and instantly adjust registered player accounts and wallets.
                  </p>
                </div>
              </div>

              {/* Dynamic Bento Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Total Players Card */}
                <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Registered Players</span>
                    <span className="text-2xl font-black font-mono text-white leading-none">{users.length}</span>
                  </div>
                  <div className="p-2 bg-purple-500/10 border border-purple-500/15 rounded-lg text-purple-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                {/* Total Liabilities Card */}
                <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Total Wallet Liabilities</span>
                    <span className="text-2xl font-black font-mono text-emerald-400 leading-none">
                      {appConfig.currencySymbol || '$'}
                      {users.reduce((acc, u) => acc + (u.wallet || 0), 0).toLocaleString([], { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/15 rounded-lg text-emerald-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>

                {/* Admin Accounts Card */}
                <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Admin Operators</span>
                    <span className="text-2xl font-black font-mono text-purple-400 leading-none">
                      {users.filter(u => u.role === 'admin').length}
                    </span>
                  </div>
                  <div className="p-2 bg-purple-500/10 border border-purple-500/15 rounded-lg text-purple-400">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Custom Category Filter Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setUserFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                    userFilter === 'all'
                      ? 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  All Users
                </button>
                <button
                  onClick={() => setUserFilter('online')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center space-x-1.5 ${
                    userFilter === 'online'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Online Players</span>
                </button>
                <button
                  onClick={() => setUserFilter('money')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center space-x-1 ${
                    userFilter === 'money'
                      ? 'bg-purple-500/15 border-purple-500/35 text-purple-400'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>High Money Users</span>
                </button>
                <button
                  onClick={() => setUserFilter('offline')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                    userFilter === 'offline'
                      ? 'bg-slate-800/40 border-slate-700 text-slate-300'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  Offline Players
                </button>
                <button
                  onClick={() => setUserFilter('admin')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all flex items-center space-x-1 ${
                    userFilter === 'admin'
                      ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                      : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Administrators</span>
                </button>
              </div>

              {/* Search bar layout */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Search className="h-4.5 w-4.5 text-slate-500" />
                </div>
                <input
                  type="text"
                  placeholder="Search player database by Name, Phone, Email, Referral invite code or Parent referral..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-xs text-white placeholder-slate-600 transition-all"
                />
                {userSearch && (
                  <button
                    onClick={() => setUserSearch('')}
                    className="absolute right-3.5 top-3.5 text-[10px] text-slate-500 hover:text-white"
                  >
                    ✕ Clear Search
                  </button>
                )}
              </div>

              {/* Modern full-page Table / Grid panel */}
              <div className="border border-slate-850 rounded-xl bg-[#090D1A]/40 overflow-hidden shadow-xl">
                {/* Desktop View Table: ONLY columns Name, Status, and Money */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-850 text-left text-xs text-slate-300">
                    <thead className="bg-[#0c1122]/80 text-slate-400 uppercase tracking-wider font-bold font-sans">
                      <tr>
                        <th className="px-6 py-4 text-[10px] tracking-widest font-black">Player Identity (Name)</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest font-black">Current Status (Last Active)</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest font-black">Wallet Balance (Money)</th>
                        <th className="px-6 py-4 text-[10px] tracking-widest font-black text-center">Interactive Drill Down</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 text-slate-300 bg-transparent">
                      {filteredUsers.slice(0, userListLimit).map((u) => {
                        const isOnline = u.lastActive ? (Date.now() - u.lastActive) <= 120000 : false;
                        const initials = (u.nickname || 'G')[0].toUpperCase();
                        
                        return (
                          <tr
                            key={u.uid}
                            onClick={() => {
                              setSelectedUserDetail(u);
                              setAdjustAmount(u.wallet.toString());
                            }}
                            className="hover:bg-slate-900/35 transition-all duration-150 cursor-pointer"
                          >
                            {/* Player Identity (Name) */}
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3.5">
                                <div className="w-9.5 h-9.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-black uppercase text-sm shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <div className="flex items-center space-x-1.5">
                                    <span className="text-xs text-white font-extrabold tracking-wide">{u.nickname || 'Guest Gamer'}</span>
                                    {u.role === 'admin' && (
                                      <span className="bg-purple-500/15 text-purple-400 border border-purple-500/25 px-1.5 py-0.2 text-[8px] font-black rounded uppercase">Admin</span>
                                    )}
                                  </div>
                                  <span className="block text-[9px] text-slate-500 font-mono tracking-wider">{u.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Status (Online or last active offline) */}
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                                <span className="font-sans font-bold text-xs text-slate-200">
                                  {isOnline ? 'Online Now' : u.lastActive ? `Last active: ${new Date(u.lastActive).toLocaleDateString()} ${new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Never recorded'}
                                </span>
                              </div>
                            </td>

                            {/* Wallet Balance (Money) */}
                            <td className="px-6 py-4 font-mono font-bold text-emerald-400 text-sm">
                              {appConfig.currencySymbol || '$'}
                              {u.wallet !== undefined ? u.wallet.toFixed(2) : '0.00'}
                            </td>

                            {/* Interactive Drill Down trigger */}
                            <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setSelectedUserDetail(u);
                                  setAdjustAmount(u.wallet.toString());
                                }}
                                className="text-purple-400 hover:text-white text-[10px] font-bold uppercase tracking-widest border border-slate-800 hover:bg-slate-800 px-3 py-1.5 rounded-lg flex items-center justify-center space-x-1.5 mx-auto cursor-pointer transition-all"
                              >
                                <Settings className="h-3.5 w-3.5" />
                                <span>Inspect & Adjust</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Grid View */}
                <div className="block md:hidden divide-y divide-slate-850/60 p-4 space-y-4">
                  {filteredUsers.slice(0, userListLimit).map((u) => {
                    const isOnline = u.lastActive ? (Date.now() - u.lastActive) <= 120000 : false;
                    const initials = (u.nickname || 'G')[0].toUpperCase();

                    return (
                      <div
                        key={u.uid}
                        onClick={() => {
                          setSelectedUserDetail(u);
                          setAdjustAmount(u.wallet.toString());
                        }}
                        className="pt-4 first:pt-0 space-y-3 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center font-black uppercase text-xs">
                              {initials}
                            </div>
                            <div>
                              <span className="text-xs text-white font-extrabold">{u.nickname || 'Unknown Player'}</span>
                              <span className="block text-[8px] text-slate-500 font-mono">{u.email}</span>
                            </div>
                          </div>

                          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-700'}`} />
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-500 font-sans uppercase text-[9px] font-black tracking-wider">Wallet Balance</span>
                          <span className="text-emerald-400 font-bold text-sm">
                            {appConfig.currencySymbol || '$'}
                            {u.wallet !== undefined ? u.wallet.toFixed(2) : '0.00'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lazy Loading / Pagination control block */}
              {filteredUsers.length > userListLimit && (
                <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-[#0F1322]/60 border border-slate-850 rounded-xl gap-4">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">
                    Showing {Math.min(userListLimit, filteredUsers.length)} of {filteredUsers.length} Players Registered
                  </span>
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <button
                      onClick={() => setUserListLimit((prev) => prev + 15)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-purple-550/15 hover:bg-purple-550/25 border border-purple-500/20 text-purple-400 text-xs font-extrabold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg active:scale-95"
                    >
                      Load 15 More Players
                    </button>
                    <button
                      onClick={() => setUserListLimit(filteredUsers.length)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-755 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Load All
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
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
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black uppercase text-purple-400 tracking-wider flex items-center space-x-2">
                <MessageSquare className="h-4.5 w-4.5 text-purple-400 animate-pulse" />
                <span>Live Help Desk Command Suite</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time player chat threads, inbox synchronization, and direct administrator replies.
              </p>
            </div>
          </div>

          {/* Quick Email configurations & Status overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Configure Client Contact Email</span>
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await update(ref(db, 'app_config'), { supportEmail: cfgSupportEmail });
                  alert('Support email edited successfully.');
                } catch (err: any) {
                  alert('Error editing support email: ' + err.message);
                }
              }} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-2.5 text-slate-600 font-mono text-xs">@</span>
                  <input
                    type="email"
                    required
                    value={cfgSupportEmail}
                    onChange={(e) => setCfgSupportEmail(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                    placeholder="support@domain.win"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-purple-550/10 hover:bg-purple-550/25 text-purple-400 border border-purple-500/25 font-black text-xs uppercase tracking-wider px-4 rounded-lg cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  Save Configuration
                </button>
              </form>
            </div>

            <div className="bg-slate-900/30 border border-slate-850 p-4 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Inbox Density</span>
                <span className="text-xl font-black font-mono text-white">{supportChats.length} Active Threads</span>
              </div>
              {unreadChatCount > 0 ? (
                <div className="bg-red-500/10 border border-red-500/25 p-2 rounded-lg text-center shrink-0">
                  <span className="block text-red-500 font-black text-lg leading-none font-mono animate-pulse">{unreadChatCount}</span>
                  <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">Unread</span>
                </div>
              ) : (
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-2 rounded-lg text-center shrink-0">
                  <span className="block text-emerald-500 font-black text-xs uppercase tracking-wider">All Clear</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">No unreads</span>
                </div>
              )}
            </div>
          </div>

          {/* SPLIT PANE WORKSPACE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/20 border border-slate-850 rounded-2xl overflow-hidden h-[620px] shadow-2xl relative">
            
            {/* COLUMN 1: INBOX THREADS SIDEBAR (4/12 WIDTH) */}
            <div className={`lg:col-span-4 border-r border-slate-850 flex flex-col h-full bg-slate-900/10 ${activeSupportChatKey ? 'hidden lg:flex' : 'flex'}`}>
              
              {/* Filter bar and search container */}
              <div className="p-4 border-b border-slate-850 bg-slate-950/40 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Support Threads</span>
                  
                  {/* Dense Filter buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setSupportChatFilter('all')}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                        supportChatFilter === 'all'
                          ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20'
                          : 'text-slate-500 hover:text-white border border-transparent'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSupportChatFilter('unread')}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all flex items-center space-x-1 ${
                        supportChatFilter === 'unread'
                          ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                          : 'text-slate-500 hover:text-white border border-transparent'
                      }`}
                    >
                      <span>Unread</span>
                      {unreadChatCount > 0 && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />}
                    </button>
                    <button
                      onClick={() => setSupportChatFilter('blocked')}
                      className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${
                        supportChatFilter === 'blocked'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'text-slate-500 hover:text-white border border-transparent'
                      }`}
                    >
                      Blocked
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search Inbox by Nickname, Phone or Email..."
                    value={supportChatSearch}
                    onChange={(e) => setSupportChatSearch(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500/30"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  {supportChatSearch && (
                    <button
                      onClick={() => setSupportChatSearch('')}
                      className="absolute right-2.5 top-2.5 text-[9px] text-slate-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable list of threads */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-850 bg-slate-950/10 custom-scrollbar">
                {(() => {
                  const filteredList = supportChats.filter((chat) => {
                    const query = supportChatSearch.toLowerCase().trim();
                    if (query) {
                      const emailMatch = (chat.email || '').toLowerCase().includes(query);
                      const nicknameMatch = (chat.nickname || '').toLowerCase().includes(query);
                      const phoneMatch = (chat.phone || '').includes(query);
                      if (!emailMatch && !nicknameMatch && !phoneMatch) return false;
                    }
                    if (supportChatFilter === 'unread') return chat.unreadCountForAdmin > 0;
                    if (supportChatFilter === 'blocked') return !!chat.blocked;
                    return true;
                  });

                  if (filteredList.length === 0) {
                    return (
                      <div className="py-16 text-center space-y-2">
                        <MessageSquare className="w-8 h-8 text-slate-700 mx-auto animate-pulse" />
                        <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">No threads found</span>
                        <p className="text-[9px] text-slate-600 px-4">Adjust filters or keyword parameters to search again.</p>
                      </div>
                    );
                  }

                  return filteredList.map((chat) => {
                    const isActive = chat.userKey === activeSupportChatKey;
                    const hasUnread = chat.unreadCountForAdmin > 0;
                    const initials = (chat.nickname || chat.email || 'G')[0].toUpperCase();

                    return (
                      <div
                        key={chat.userKey}
                        onClick={() => {
                          setActiveSupportChatKey(chat.userKey);
                          update(ref(db, `support_chats/${chat.userKey}`), { unreadCountForAdmin: 0 });
                        }}
                        className={`p-3.5 flex items-start space-x-3 transition-all cursor-pointer select-none border-l-2 relative ${
                          isActive
                            ? 'bg-purple-950/10 border-purple-500'
                            : hasUnread
                            ? 'bg-red-500/5 border-red-500 hover:bg-slate-900/20'
                            : 'border-transparent hover:bg-slate-900/30'
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 ${
                          isActive
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : hasUnread
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {initials}
                        </div>

                        {/* Thread detail details */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs text-white font-bold truncate block">{chat.nickname || 'Gamer'}</span>
                            <span className="text-[8px] text-slate-600 font-mono">
                              {chat.lastMessageTimestamp ? new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] text-slate-500 truncate block font-mono">{chat.email}</span>
                            {hasUnread && (
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                            )}
                          </div>

                          {/* Quick statuses */}
                          <div className="flex items-center space-x-1 pt-1.5">
                            {chat.blocked && (
                              <span className="px-1 py-0.2 bg-amber-500/10 text-amber-500 text-[7px] font-bold rounded">BLOCKED</span>
                            )}
                            {chat.unreadCountForAdmin > 0 && (
                              <span className="px-1 py-0.2 bg-red-500 text-white text-[7px] font-black rounded">{chat.unreadCountForAdmin} NEW</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* COLUMN 2: ACTIVE CONVERSATION PANE (8/12 WIDTH) */}
            <div className={`lg:col-span-8 flex flex-col h-full bg-[#080B13]/40 ${!activeSupportChatKey ? 'hidden lg:flex' : 'flex'}`}>
              {activeSupportChatKey ? (
                (() => {
                  const activeChat = supportChats.find(c => c.userKey === activeSupportChatKey);
                  const msgsList = activeChat?.messages ? Object.values(activeChat.messages).sort((a: any, b: any) => a.timestamp - b.timestamp) : [];

                  return (
                    <div className="flex flex-col h-full overflow-hidden">
                      {/* Active Chat Header */}
                      <div className="p-3.5 bg-slate-950/60 border-b border-slate-850 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Back Arrow visible on mobile */}
                          <button
                            onClick={() => setActiveSupportChatKey(null)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-850 bg-slate-950 lg:hidden cursor-pointer shrink-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs text-white font-extrabold uppercase tracking-wider truncate block">{activeChat?.nickname || 'Gamer'}</span>
                              {activeChat?.blocked ? (
                                <span className="text-[8px] bg-red-500/15 text-red-400 border border-red-500/25 font-black px-1.5 py-0.5 rounded uppercase">Blocked</span>
                              ) : (
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-black px-1.5 py-0.5 rounded uppercase">Connected</span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono truncate block mt-0.5">{activeChat?.email}</span>
                          </div>
                        </div>

                        {/* Top Action controls */}
                        <div className="flex items-center space-x-2">
                          {/* Block Button */}
                          <button
                            onClick={() => {
                              const confirmText = activeChat?.blocked ? "Turn ON chat for this user?" : "Turn OFF / Disable chat for this user?";
                              if (confirm(confirmText)) {
                                update(ref(db, `support_chats/${activeSupportChatKey}`), { blocked: !activeChat?.blocked });
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase cursor-pointer transition-all ${
                              activeChat?.blocked
                                ? 'bg-red-500/15 border-red-500/25 text-red-400 hover:bg-red-500/25'
                                : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                          >
                            {activeChat?.blocked ? 'Unblock User' : 'Block Chat'}
                          </button>

                          {/* Clear history */}
                          <button
                            onClick={() => {
                              if (confirm(`Clear all messages in conversation for ${activeChat?.email}?`)) {
                                remove(ref(db, `support_chats/${activeSupportChatKey}/messages`));
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-850 text-slate-500 hover:text-rose-400 hover:bg-slate-900 bg-slate-950 cursor-pointer"
                            title="Clear conversation history"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete completely */}
                          <button
                            onClick={() => {
                              if (confirm(`Delete the entire support chat object from firebase for ${activeChat?.email}?`)) {
                                setActiveSupportChatKey(null);
                                remove(ref(db, `support_chats/${activeSupportChatKey}`));
                              }
                            }}
                            className="p-1.5 rounded-lg border border-red-500/10 text-red-500 hover:text-white hover:bg-red-500 bg-slate-950 cursor-pointer"
                            title="Delete thread object"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Chat Messages scroll pane */}
                      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#07090F]/20 custom-scrollbar flex flex-col">
                        {msgsList.length === 0 ? (
                          <div className="my-auto text-center space-y-3 p-6 max-w-sm mx-auto">
                            <MessageSquare className="w-10 h-10 text-slate-800 mx-auto" />
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-wider">No message logs yet</h5>
                            <p className="text-[10px] text-slate-500">
                              Send an administrative message using the reply panel below to initialize communications.
                            </p>
                          </div>
                        ) : (
                          msgsList.map((msg: any) => {
                            const isAdmin = msg.sender === 'admin';
                            return (
                              <div
                                key={msg.msgId}
                                className={`flex flex-col max-w-[80%] ${isAdmin ? 'self-end items-end' : 'self-start items-start'} space-y-1`}
                              >
                                <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-lg ${
                                  isAdmin
                                    ? 'bg-purple-600 text-slate-950 rounded-tr-none font-bold'
                                    : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-850'
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

                      {/* Input panel bottom */}
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
                      }} className="p-3 bg-slate-950/60 border-t border-slate-850 flex items-center space-x-2 shrink-0">
                        <input
                          type="text"
                          value={adminReplyText}
                          onChange={(e) => setAdminReplyText(e.target.value)}
                          placeholder="Type administrator support response..."
                          className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-purple-500/30 font-sans"
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
                })()
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-purple-500/5 rounded-full border border-purple-500/10 flex items-center justify-center animate-pulse">
                    <MessageSquare className="w-8 h-8 text-purple-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase text-white tracking-widest">Select a Support Thread</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Choose any player message thread on the left side inbox list to preview chat logs and begin replying.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

