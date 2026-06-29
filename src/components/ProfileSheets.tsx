import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, AppConfig, GiftCoupon, SupportChat, SupportMessage } from '../types';
import { 
  X, Check, Copy, Share2, Users, Layers, Sparkles, Landmark, Save, HelpCircle, 
  ChevronRight, Gift, Info, Send, ShieldAlert, AlertTriangle, Mail, MessageSquare, Ban
} from 'lucide-react';
import { db } from '../firebase';
import { ref, get, set, update, onValue, push, runTransaction } from 'firebase/database';

interface ProfileSheetsProps {
  activeSheet: string | null;
  onClose: () => void;
  user: UserProfile;
  appConfig: AppConfig;
  onNavigateToWallet: (subTab: 'deposit' | 'withdrawal' | 'history') => void;
}

export default function ProfileSheets({
  activeSheet,
  onClose,
  user,
  appConfig,
  onNavigateToWallet,
}: ProfileSheetsProps) {
  const [copied, setCopied] = useState(false);
  const [referTab, setReferTab] = useState<'info' | 'team' | 'logs'>('info');
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);
  const [commissionLogs, setCommissionLogs] = useState<any[]>([]);
  
  // Bank details state
  const [bankName, setBankName] = useState(localStorage.getItem('bank_name') || '');
  const [accountNum, setAccountNum] = useState(localStorage.getItem('bank_acc') || '');
  const [ifsc, setIfsc] = useState(localStorage.getItem('bank_ifsc') || '');
  const [upi, setUpi] = useState(localStorage.getItem('bank_upi') || '');
  const [bankSaved, setBankSaved] = useState('');

  // Gift card / Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [giftSuccess, setGiftSuccess] = useState('');
  const [giftError, setGiftError] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);

  // Live support chat state
  const [supportChat, setSupportChat] = useState<SupportChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeSupportTab, setActiveSupportTab] = useState<'chat' | 'email'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const emailKey = user.email ? user.email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_') : '';

  // Listen to live support chat updates & clear user's unread counter when chat is open
  useEffect(() => {
    if (!emailKey || activeSheet !== 'help') return;

    const chatRef = ref(db, `support_chats/${emailKey}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as SupportChat;
        setSupportChat(val);
        
        // If there are unread messages for the user, clear them since the chat is open
        if (val.unreadCountForUser > 0) {
          update(chatRef, { unreadCountForUser: 0 });
        }
      } else {
        setSupportChat(null);
      }
    });

    return () => unsubscribe();
  }, [emailKey, activeSheet]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (activeSheet === 'help' && activeSupportTab === 'chat') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [supportChat?.messages, activeSheet, activeSupportTab]);

  // Load team & referral logs when refer sheet is open
  useEffect(() => {
    if (activeSheet === 'refer') {
      // Load Team members
      const usersRef = ref(db, 'users');
      get(usersRef).then((snap) => {
        if (snap.exists()) {
          const list: UserProfile[] = [];
          snap.forEach((child) => {
            const val = child.val();
            if (val.uid === user.uid) return;
            const matchesKey = val.referredByUserKey === emailKey;
            const matchesCode = val.referredBy && val.referredBy.toUpperCase() === user.inviteCode?.toUpperCase();
            if (matchesKey || matchesCode) {
              list.push(val);
            }
          });
          setReferredUsers(list);
        }
      }).catch(console.error);

      // Load Referral Commission Logs
      const logsRef = ref(db, `referral_commissions/${emailKey}`);
      get(logsRef).then((snap) => {
        const logs: any[] = [];
        if (snap.exists()) {
          snap.forEach((child) => {
            logs.push(child.val());
          });
        }
        logs.sort((a, b) => b.timestamp - a.timestamp);
        setCommissionLogs(logs);
      }).catch(console.error);
    }
  }, [activeSheet, emailKey, user.inviteCode, user.uid]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.inviteCode || 'WIN777');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bank_name', bankName);
    localStorage.setItem('bank_acc', accountNum);
    localStorage.setItem('bank_ifsc', ifsc);
    localStorage.setItem('bank_upi', upi);
    setBankSaved('Bank settings saved successfully.');
    setTimeout(() => setBankSaved(''), 4000);
  };

  const handleRedeemCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setGiftError('');
    setGiftSuccess('');
    const codeClean = couponCode.trim().toUpperCase();
    if (!codeClean) {
      setGiftError('Please enter a voucher code.');
      return;
    }

    setRedeemLoading(true);
    try {
      const couponRef = ref(db, `admin_control/gift_coupons/${codeClean}`);
      const couponSnap = await get(couponRef);

      if (!couponSnap.exists()) {
        setGiftError('Invalid or expired gift voucher code.');
        setRedeemLoading(false);
        return;
      }

      const coupon = couponSnap.val() as GiftCoupon;

      // 1. Check expiry
      if (Date.now() > coupon.expiryTimestamp) {
        setGiftError('This voucher code has expired.');
        setRedeemLoading(false);
        return;
      }

      // 2. Check audience restrictions
      if (coupon.audienceType === 'single_user' && coupon.targetUserEmail) {
        if (coupon.targetUserEmail.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
          setGiftError('This promotional voucher is restricted to a specific user only.');
          setRedeemLoading(false);
          return;
        }
      }

      // 3. Check if already claimed by this user
      if (coupon.claimedUsers && coupon.claimedUsers[emailKey]) {
        setGiftError('You have already claimed this voucher code once.');
        setRedeemLoading(false);
        return;
      }

      // 3b. Check total claim limits
      if (coupon.maxClaimsLimit && coupon.maxClaimsLimit > 0) {
        const claimCount = coupon.claimedUsers ? Object.keys(coupon.claimedUsers).length : 0;
        if (claimCount >= coupon.maxClaimsLimit) {
          setGiftError('This promotional voucher has reached its maximum claim limit.');
          setRedeemLoading(false);
          return;
        }
      }

      // 4. Update the user's wallet wallet & write claimed users logs transactionally
      const userRef = ref(db, `users/${emailKey}`);
      const userSnap = await get(userRef);
      if (!userSnap.exists()) {
        setGiftError('Failed to fetch user ledger.');
        setRedeemLoading(false);
        return;
      }

      const currentProfile = userSnap.val() as UserProfile;
      const currentWallet = currentProfile.wallet || 0;
      const newWallet = currentWallet + coupon.amount;

      // Update wallet
      await update(userRef, { wallet: newWallet });

      // Save user log under coupon claim list
      const claimLogRef = ref(db, `admin_control/gift_coupons/${codeClean}/claimedUsers/${emailKey}`);
      await set(claimLogRef, {
        timestamp: Date.now(),
        email: user.email,
        nickname: user.nickname || 'Gamer'
      });

      setGiftSuccess(`Voucher claimed successfully! Added ${appConfig.currencySymbol}${coupon.amount.toFixed(2)} to your balance.`);
      setCouponCode('');
    } catch (err: any) {
      setGiftError('Redemption failed: ' + (err.message || 'Server error.'));
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !emailKey) return;

    if (supportChat?.blocked) {
      alert('Support chat feature has been disabled for your account.');
      return;
    }

    try {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const messageRef = ref(db, `support_chats/${emailKey}/messages/${msgId}`);
      
      const newMsg: SupportMessage = {
        msgId,
        sender: 'user',
        text: newMessage.trim(),
        timestamp: Date.now()
      };

      // Append message
      await set(messageRef, newMsg);

      // Increment admin unread count and update meta properties
      const chatMetaRef = ref(db, `support_chats/${emailKey}`);
      const currentUnreadAdmin = supportChat?.unreadCountForAdmin || 0;

      await update(chatMetaRef, {
        userKey: emailKey,
        email: user.email,
        nickname: user.nickname || 'Gamer',
        unreadCountForAdmin: currentUnreadAdmin + 1,
        unreadCountForUser: 0,
        lastMessageTimestamp: Date.now()
      });

      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message: ', err);
    }
  };

  if (!activeSheet) return null;

  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end duration-300 transition-all">
      {/* Click backdrop to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
      
      {/* Bottom Sheet wrapper */}
      <div className="bg-[#121110] border-t-2 border-[#E5A93B]/40 rounded-t-[32px] max-h-[85%] h-[85%] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
        {/* Decorative swipe grab bar */}
        <div className="w-12 h-1 bg-slate-700/50 rounded-full mx-auto my-3 shrink-0" />
        
        {/* Header */}
        <div className="px-5 pb-3 border-b border-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-[#E2B354]/10 border border-[#E2B354]/20 text-[#E5A93B] rounded-lg">
              {activeSheet === 'addbank' && <Landmark className="w-4 h-4" />}
              {activeSheet === 'refer' && <Share2 className="w-4 h-4" />}
              {activeSheet === 'help' && <MessageSquare className="w-4 h-4" />}
              {activeSheet === 'rules' && <HelpCircle className="w-4 h-4" />}
              {activeSheet === 'gift' && <Gift className="w-4 h-4" />}
              {activeSheet === 'about' && <Info className="w-4 h-4" />}
              {activeSheet === 'interest' && <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                {activeSheet === 'addbank' && 'Configure Bank Settings'}
                {activeSheet === 'refer' && 'Refer & Earn Dashboard'}
                {activeSheet === 'help' && 'Live Helpdesk & Chat'}
                {activeSheet === 'rules' && 'How to Play (Rules)'}
                {activeSheet === 'gift' && 'Voucher Redemption'}
                {activeSheet === 'about' && 'Platform Info'}
                {activeSheet === 'interest' && 'Interest Accumulator'}
              </h3>
              <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                {activeSheet === 'addbank' && 'Synchronize Payout Gateway'}
                {activeSheet === 'refer' && 'Invite Ledger Earnings'}
                {activeSheet === 'help' && '24x7 Customer Verification'}
                {activeSheet === 'rules' && 'Multiplier Pay Rates'}
                {activeSheet === 'gift' && 'Claim Promotional Voucher'}
                {activeSheet === 'about' && 'Technical Block Audits'}
                {activeSheet === 'interest' && 'Organic Daily Ledger APY'}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-white font-extrabold text-xs bg-[#1A1918] border border-slate-850 px-3 py-1.5 rounded-xl cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col space-y-4">
          
          {/* 1. BANK DETAILS SETUP SHEET */}
          {activeSheet === 'addbank' && (
            <form onSubmit={handleSaveBank} className="space-y-4 flex flex-col">
              <p className="text-[10px] text-slate-400 leading-relaxed">Configuring bank details provides swift auto-settlements during withdrawal requests.</p>
              
              {bankSaved && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] p-2.5 rounded-xl font-bold">
                  {bankSaved}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-400/30"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Account Number</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 50100293029"
                    value={accountNum}
                    onChange={(e) => setAccountNum(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono focus:outline-none focus:border-amber-400/30"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">IFSC Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. SBIN0001234"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono focus:outline-none focus:border-amber-400/30"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">UPI ID / VPA</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. username@upi"
                    value={upi}
                    onChange={(e) => setUpi(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono focus:outline-none focus:border-amber-400/30"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer mt-4 shadow-md hover:brightness-105 active:scale-98"
              >
                <Save className="h-4 w-4" />
                <span>Save Bank Settings</span>
              </button>
            </form>
          )}

          {/* 2. REFER & EARN DASHBOARD SHEET */}
          {activeSheet === 'refer' && (
            <div className="space-y-4 flex flex-col h-full overflow-hidden">
              {/* Tabs */}
              <div className="bg-[#1A1918] p-1 rounded-xl flex border border-[#3D2C08]/10 shrink-0">
                <button
                  type="button"
                  onClick={() => setReferTab('info')}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    referTab === 'info' 
                      ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Invite & Info</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setReferTab('team')}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    referTab === 'team' 
                      ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>My Team ({referredUsers.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReferTab('logs')}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                    referTab === 'logs' 
                      ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] shadow-md' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Refer Logs</span>
                </button>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {referTab === 'info' && (() => {
                  const inviteBase = appConfig.referralDomain || window.location.origin;
                  const inviteLink = inviteBase.endsWith('/') ? `${inviteBase}?ref=${user.inviteCode || 'WIN777'}` : `${inviteBase}/?ref=${user.inviteCode || 'WIN777'}`;
                  const totalBetCom = commissionLogs.filter(l => l.type === 'bet').reduce((s, l) => s + l.amount, 0);
                  const totalDepCom = commissionLogs.filter(l => l.type === 'deposit').reduce((s, l) => s + l.amount, 0);
                  const totalAllCom = totalBetCom + totalDepCom;
                  return (
                    <div className="space-y-4">
                      {/* STATS OVERVIEW CARDS */}
                      <div className="bg-[#181716] border border-[#3D2C08]/15 rounded-2xl p-4 text-center space-y-1 shadow-md">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Total Referral Earnings</span>
                        <span className="text-2xl font-mono font-black text-emerald-400 block">
                          {appConfig.currencySymbol || '₹'}{totalAllCom.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-slate-400 block">All commissions are instantly credited to your main balance wallet.</span>
                      </div>

                      {/* ALAG ALAG COMMISSION HEADERS & STATS */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#181716] border border-[#3D2C08]/10 rounded-xl p-3 space-y-1 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-wider">Bet Commission (5%)</span>
                          <span className="text-sm font-mono font-black text-amber-400 block">
                            {appConfig.currencySymbol || '₹'}{totalBetCom.toFixed(2)}
                          </span>
                          <p className="text-[8px] text-slate-500 leading-tight">Earn 5% on every prediction stake placed by your invites.</p>
                        </div>

                        <div className="bg-[#181716] border border-[#3D2C08]/10 rounded-xl p-3 space-y-1 text-center">
                          <span className="text-[8px] font-bold text-slate-400 block uppercase tracking-wider">First Dep. Commission (10%)</span>
                          <span className="text-sm font-mono font-black text-amber-400 block">
                            {appConfig.currencySymbol || '₹'}{totalDepCom.toFixed(2)}
                          </span>
                          <p className="text-[8px] text-slate-500 leading-tight">Earn 10% cash bonus when your invite makes their first recharge.</p>
                        </div>
                      </div>

                      {/* INVITE LINKS & CODES */}
                      <div className="bg-[#181716] border border-[#3D2C08]/10 rounded-2xl p-4 space-y-3.5">
                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black uppercase text-[#E5A93B] tracking-wider block">Your Referral Code</span>
                          <div className="flex bg-slate-950 p-2.5 rounded-xl border border-slate-900 items-center justify-between">
                            <span className="text-xs font-mono font-black text-white px-1">
                              {user.inviteCode || 'WIN777'}
                            </span>
                            <button 
                              onClick={handleCopyCode}
                              className="bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase cursor-pointer"
                            >
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[9px] font-black uppercase text-[#E5A93B] tracking-wider block">Your Direct Invitation Link</span>
                          <div className="flex bg-slate-950 p-2.5 rounded-xl border border-slate-900 items-center justify-between">
                            <span className="text-[10px] font-mono text-slate-400 overflow-hidden truncate mr-2 select-all">
                              {inviteLink}
                            </span>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(inviteLink);
                                alert('Invitation Link copied successfully!');
                              }}
                              className="bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase shrink-0 cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* SYSTEM INFO BOARD */}
                      <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-amber-500/90 leading-relaxed text-[10px] space-y-1.5">
                        <span className="font-extrabold uppercase block tracking-wider">★ Referral Rules & Info:</span>
                        <p>1. <strong className="text-white">5% Bet Commission:</strong> Whenever any player who registered using your referral code places a bet, you will instantly receive 5% of their total stake amount directly into your wallet.</p>
                        <p>2. <strong className="text-white">10% First Deposit Commission:</strong> When your referred user makes their very first approved deposit, you will receive a 10% bonus calculated on that first deposit amount.</p>
                      </div>
                    </div>
                  );
                })()}

                {referTab === 'team' && (
                  <div className="space-y-3">
                    {referredUsers.length === 0 ? (
                      <div className="bg-[#181716] border border-slate-900 p-8 rounded-2xl text-center text-slate-500 text-xs">
                        No team members registered yet. Copy and share your link above to build your active income team!
                      </div>
                    ) : (
                      referredUsers.map((refUser, idx) => {
                        const totalUserCommission = commissionLogs
                          .filter(log => log.referredUserEmail?.toLowerCase() === refUser.email?.toLowerCase())
                          .reduce((sum, log) => sum + log.amount, 0);

                        return (
                          <div key={refUser.uid || idx} className="bg-[#181716] p-3 rounded-xl border border-slate-900/60 flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-xs text-white font-extrabold block">
                                {refUser.nickname || 'Gamer'}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono block">
                                {refUser.email}
                              </span>
                              <span className="text-[8px] text-slate-500 block font-mono">
                                Registered: {new Date(refUser.createdAt || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'short' })}
                              </span>
                            </div>
                            
                            <div className="text-right">
                              <span className="text-[8px] font-bold text-slate-500 uppercase block">Earned</span>
                              <span className="text-xs font-mono font-black text-emerald-400 block">
                                +{appConfig.currencySymbol || '₹'}{totalUserCommission.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {referTab === 'logs' && (
                  <div className="space-y-3">
                    {commissionLogs.length === 0 ? (
                      <div className="bg-[#181716] border border-slate-900 p-8 rounded-2xl text-center text-slate-500 text-xs">
                        No referral logs recorded. When your invited players play or deposit, commission credits will log here.
                      </div>
                    ) : (
                      commissionLogs.map((log, idx) => (
                        <div key={log.logId || idx} className="bg-[#181716] p-3 rounded-xl border border-slate-900/60 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs text-white font-bold">{log.referredUserNickname}</span>
                              <span className={`text-[8px] font-black px-1 rounded uppercase ${log.type === 'deposit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                                {log.type === 'deposit' ? 'Deposit' : 'Bet'}
                              </span>
                            </div>
                            <span className="text-[9px] text-slate-400 block">Source Amt: {appConfig.currencySymbol || '₹'}{log.sourceAmount.toFixed(2)}</span>
                            <span className="text-[8px] text-slate-500 block">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-400">
                            +{appConfig.currencySymbol || '₹'}{log.amount.toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. HELP & LIVE CHAT SUPPORT SHEET */}
          {activeSheet === 'help' && (
            <div className="space-y-4 flex flex-col h-full overflow-hidden">
              {/* Support Mode Switcher */}
              <div className="bg-[#1A1918] p-1 rounded-xl flex border border-[#3D2C08]/10 shrink-0">
                <button
                  onClick={() => setActiveSupportTab('chat')}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer relative ${
                    activeSupportTab === 'chat'
                      ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] shadow-md font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Live Chat Support</span>
                  {supportChat?.unreadCountForUser && supportChat.unreadCountForUser > 0 ? (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#121110] animate-bounce" />
                  ) : null}
                </button>
                <button
                  onClick={() => setActiveSupportTab('email')}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer ${
                    activeSupportTab === 'email'
                      ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] shadow-md font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Support</span>
                </button>
              </div>

              {/* Support Content */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                {activeSupportTab === 'email' ? (
                  <div className="space-y-4 py-3 shrink-0">
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Our live email auditing gateway handles deposit disputes, manual ledger settlements, and platform queries.
                    </p>

                    <a 
                      href={`mailto:${appConfig.supportEmail || 'support@colorclub.win'}`}
                      className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between hover:bg-slate-900 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                          <Mail className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-white block">Email Support Address</span>
                          <span className="text-[10px] text-slate-500 font-mono block mt-0.5">{appConfig.supportEmail || 'support@colorclub.win'}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </a>

                    <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-amber-500/90 leading-relaxed text-[9px] space-y-1">
                      <span className="font-extrabold uppercase block tracking-wider">Note:</span>
                      <p>Emails are processed sequentially. Please include your registered ID and complete screenshot records for faster deposit resolutions.</p>
                    </div>
                  </div>
                ) : (
                  // Live Chat Area
                  <div className="flex-1 flex flex-col overflow-hidden relative">
                    
                    {/* Chat Header inside help tab */}
                    <div className="bg-[#1A1918] p-3 rounded-t-xl border-x border-t border-slate-900 flex items-center justify-between shrink-0">
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full block" />
                          <span className="absolute inset-0 bg-emerald-500 rounded-full block animate-ping opacity-75" />
                        </div>
                        <span className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center space-x-1.5">
                          <span>Support</span>
                          {supportChat?.unreadCountForUser && supportChat.unreadCountForUser > 0 ? (
                            <span className="px-1.5 py-0.5 bg-red-500 text-[8px] text-white rounded-full font-black animate-bounce shrink-0">
                              New Message
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono">Live Sync</span>
                    </div>

                    {/* Messages Panel */}
                    <div className="flex-1 bg-slate-950/40 border-x border-slate-900 overflow-y-auto p-4 space-y-3 flex flex-col min-h-0">
                      {supportChat && supportChat.messages && Object.keys(supportChat.messages).length > 0 ? (
                        (Object.values(supportChat.messages) as SupportMessage[])
                          .sort((a, b) => a.timestamp - b.timestamp)
                          .map((msg: SupportMessage) => {
                            const isMe = msg.sender === 'user';
                            return (
                              <div 
                                key={msg.msgId} 
                                className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'} space-y-1`}
                              >
                                <div className={`px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                                  isMe 
                                    ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-slate-950 rounded-tr-none font-medium' 
                                    : 'bg-[#1E293B] text-slate-200 rounded-tl-none border border-slate-800'
                                }`}>
                                  {msg.text}
                                </div>
                                <span className="text-[8px] text-slate-600 font-mono">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            );
                          })
                      ) : (
                        <div className="my-auto text-center space-y-2 p-6">
                          <MessageSquare className="w-8 h-8 text-slate-700 mx-auto" />
                          <p className="text-xs text-slate-500">No support history recorded. Send a message to open a live conversation thread with active agents.</p>
                        </div>
                      )}
                      
                      {supportChat?.blocked && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center space-x-2 shrink-0">
                          <Ban className="w-4 h-4 text-red-400 shrink-0" />
                          <p className="text-[9px] text-red-400 leading-tight">Your live support chat permission has been suspended by administration.</p>
                        </div>
                      )}
                      
                      <div ref={chatEndRef} />
                    </div>

                    {/* Input send bar */}
                    <form onSubmit={handleSendSupportMessage} className="bg-[#1A1918] p-2 rounded-b-xl border-x border-b border-slate-900 flex items-center space-x-2 shrink-0">
                      <input 
                        type="text"
                        value={newMessage}
                        disabled={supportChat?.blocked}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={supportChat?.blocked ? "Chat disabled" : "Type support message..."}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-700 focus:outline-none focus:border-amber-500/30 font-sans"
                      />
                      <button
                        type="submit"
                        disabled={supportChat?.blocked || !newMessage.trim()}
                        className="bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] disabled:opacity-40 disabled:scale-100 text-slate-950 p-2 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. RULES & GUIDELINES (HOW TO PLAY) */}
          {activeSheet === 'rules' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <p className="font-extrabold text-amber-400 text-sm">Prediction Multipliers & Pay Rates:</p>
              
              <div className="space-y-3 bg-[#181716] border border-slate-900 p-4 rounded-xl">
                <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                  <span className="font-extrabold text-white text-[11px] uppercase">Option Type</span>
                  <span className="font-extrabold text-[#E5A93B] text-[11px] uppercase">Payout Return</span>
                </div>
                
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300">Red or Green Colors</span>
                  <span className="font-mono font-bold text-white">2.0x Return</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300">Violet Split (lands on 0 or 5)</span>
                  <span className="font-mono font-bold text-white">4.5x Return</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300">Specific Numbers (0 - 9)</span>
                  <span className="font-mono font-bold text-emerald-400 font-extrabold">9.0x Return</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-300">Size bet (Big / Small)</span>
                  <span className="font-mono font-bold text-white">2.0x Return</span>
                </div>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 space-y-2 text-[10px] text-slate-400 leading-normal">
                <span className="font-extrabold text-white block uppercase tracking-wider text-[9px] text-[#E5A93B]">Game Arena Rules:</span>
                <p>• Red numbers represent: 2, 4, 6, 8. Split represents 0.</p>
                <p>• Green numbers represent: 1, 3, 7, 9. Split represents 5.</p>
                <p>• Small representations are numbers 0, 1, 2, 3, 4.</p>
                <p>• Big representations are numbers 5, 6, 7, 8, 9.</p>
                <p>• If a red-violet or green-violet split is triggered, users betting on colors receive 1.5x returned payouts, while users placing a split-violet bet receive a premium 4.5x payout.</p>
              </div>
            </div>
          )}

          {/* 5. GIFTS CARD / VOUCHER REDEMPTION */}
          {activeSheet === 'gift' && (
            <form onSubmit={handleRedeemCoupon} className="space-y-4">
              <p className="text-[10px] text-slate-400 leading-relaxed">Redeem promo keys or activity vouchers gifted by administrators to instantly top up your wallet ledger balance.</p>
              
              {giftError && (
                <div className="bg-rose-500/10 border border-rose-500/25 p-2.5 rounded-xl text-rose-400 text-[10px] font-bold">
                  {giftError}
                </div>
              )}
              {giftSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-2.5 rounded-xl text-emerald-400 text-[10px] font-bold">
                  {giftSuccess}
                </div>
              )}

              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Enter Voucher Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. WELCOME100"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-3 text-xs text-white placeholder-slate-700 font-mono tracking-widest focus:outline-none focus:border-amber-400/30 uppercase"
                />
              </div>

              <button 
                type="submit" 
                disabled={redeemLoading}
                className="w-full bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] disabled:opacity-50 text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer hover:brightness-105 transition-all shadow-md mt-2"
              >
                <Gift className="h-4 w-4" />
                <span>{redeemLoading ? 'Verifying Coupon...' : 'Claim Voucher Credits'}</span>
              </button>
            </form>
          )}

          {/* 6. ABOUT US PLATFORM INFO */}
          {activeSheet === 'about' && (
            <div className="space-y-3 text-[11px] text-slate-400 leading-relaxed">
              <div className="bg-[#181716] border border-slate-900 p-4 rounded-xl text-center space-y-1.5">
                <span className="text-xs font-black text-white block uppercase tracking-widest">{appConfig.appName || 'LOTTERY7'}</span>
                <span className="text-[9px] text-[#E5A93B] uppercase tracking-wider block font-bold">Realtime prediction platform</span>
              </div>
              <p>Color Club is an automated prediction and gaming platform operating with synchronized client state ledgers down to the atomic millisecond.</p>
              <p>All block timelines, countdown sequences, and outcome results are synchronized in real-time, allowing transparent gaming on any screen or device.</p>
              
              <div className="border-t border-slate-900 pt-3 text-[10px] text-slate-600 leading-tight">
                <p>• Secured by Active Cryptographic SSL channels.</p>
                <p className="mt-1">• Client-side transaction synchronization active: v2.5.3 (Alpha Build)</p>
              </div>
            </div>
          )}

          {/* 7. INTEREST ACCUMULATOR */}
          {activeSheet === 'interest' && (
            <div className="space-y-4">
              <div className="bg-[#181716] border border-slate-900 p-4 rounded-xl text-center space-y-1.5">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Organic Annual Yield (APY)</span>
                <span className="text-2xl font-mono font-black text-emerald-400 block">
                  {appConfig.currencySymbol || '₹'}{(user.interestEarned || 0).toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-400 block leading-tight">Interest earned organically on active wallets at {(appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03)}% daily return rate!</span>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-relaxed text-center">Interest continues to accrue in real-time. Simply keep funds in your active balance to trigger the APY yield multiplier.</p>
              
              <button 
                onClick={() => onNavigateToWallet('deposit')}
                className="w-full bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
              >
                <span>Recharge Wallet & Accumulate</span>
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
