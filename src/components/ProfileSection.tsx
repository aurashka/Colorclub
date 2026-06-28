import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, AppConfig } from '../types';
import { 
  UserCircle2, Copy, Check, LogOut, ArrowDownCircle, ArrowUpCircle, 
  CreditCard, Share2, HelpCircle, FileText, Gift, Info, ShieldAlert,
  Save, Landmark, PhoneCall, ChevronRight, HelpCircle as HelpIcon
} from 'lucide-react';
import { db } from '../firebase';
import { ref, get } from 'firebase/database';

interface ProfileSectionProps {
  user: UserProfile;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  onSignOut: () => void;
  onNavigateToWallet: (subTab: 'deposit' | 'withdrawal' | 'history') => void;
  onNavigateToAdmin: () => void;
  appConfig: AppConfig;
}

export default function ProfileSection({
  user,
  deposits,
  withdrawals,
  onSignOut,
  onNavigateToWallet,
  onNavigateToAdmin,
  appConfig,
}: ProfileSectionProps) {
  const [copied, setCopied] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Profile-specific state
  const [giftCode, setGiftCode] = useState('');
  const [giftSuccess, setGiftSuccess] = useState('');
  const [giftError, setGiftError] = useState('');
  
  // Bank state (stored locally in localStorage for mock persistence)
  const [bankName, setBankName] = useState(localStorage.getItem('bank_name') || '');
  const [accountNum, setAccountNum] = useState(localStorage.getItem('bank_acc') || '');
  const [ifsc, setIfsc] = useState(localStorage.getItem('bank_ifsc') || '');
  const [upi, setUpi] = useState(localStorage.getItem('bank_upi') || '');
  const [bankSaved, setBankSaved] = useState('');

  // Referred Users State
  const [referredUsers, setReferredUsers] = useState<UserProfile[]>([]);

  React.useEffect(() => {
    if (activeModal === 'refer' && user.inviteCode) {
      const usersRef = ref(db, 'users');
      get(usersRef).then((snap) => {
        if (snap.exists()) {
          const allUsers: UserProfile[] = [];
          snap.forEach((child) => {
            const val = child.val();
            if (val.uid === user.uid) return;
            const matchesReferredBy = val.referredBy === user.inviteCode;
            const matchesInviteCodeLegacy = val.inviteCode === user.inviteCode;
            if (matchesReferredBy || matchesInviteCodeLegacy) {
              allUsers.push(val);
            }
          });
          setReferredUsers(allUsers);
        }
      }).catch(console.error);
    }
  }, [activeModal, user.inviteCode, user.uid]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.inviteCode || 'WIN777');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGiftRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    setGiftError('');
    setGiftSuccess('');
    if (!giftCode.trim()) {
      setGiftError('Please provide a valid gift voucher code.');
      return;
    }
    if (giftCode.trim().toUpperCase() === 'WELCOME100') {
      setGiftSuccess('Voucher successfully activated! $100.00 welcome promotional credits added.');
      setGiftCode('');
    } else {
      setGiftError('Invalid or expired gift voucher code. Please contact live help support.');
    }
  };

  const handleSaveBank = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('bank_name', bankName);
    localStorage.setItem('bank_acc', accountNum);
    localStorage.setItem('bank_ifsc', ifsc);
    localStorage.setItem('bank_upi', upi);
    setBankSaved('Bank details synchronized with security gateway successfully.');
    setTimeout(() => setBankSaved(''), 4000);
  };

  return (
    <div className="flex flex-col space-y-6 font-sans text-slate-200 p-4">
      {/* Top Banner Gold Card */}
      <div className="bg-gradient-to-br from-[#FFE194] via-[#E2B354] to-[#B07E2A] rounded-3xl p-5 text-[#3D2C08] shadow-lg border border-[#FFE194]/30 relative overflow-hidden">
        {/* User Info Row */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black tracking-wide text-[#3D2C08] flex items-center space-x-1">
              <span>Id : {user?.nickname ? (user.nickname.includes('@') ? user.nickname : `${user.nickname}@gmail.com`) : 'user@gmail.com'}</span>
            </h3>
            <div className="flex items-center space-x-1.5 text-[#3D2C08]/90 text-xs mt-1">
              <span>Refercode : <span className="font-mono font-bold text-[#3D2C08]">{user.inviteCode || 'aT2Zb2'}</span></span>
              <button 
                onClick={handleCopyCode}
                className="focus:outline-none hover:opacity-80 active:scale-95 transition-transform"
                title="Copy Refer Code"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-900" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#3D2C08]" />
                )}
              </button>
            </div>
          </div>

          <div className="w-5 h-5 rounded-full border border-[#3D2C08]/50 flex items-center justify-center font-black text-xs text-[#3D2C08]">
            !
          </div>
        </div>

        {/* 3 Columns Ledger Row */}
        <div className="grid grid-cols-3 gap-1 pt-6 mt-4 text-center text-[#3D2C08]">
          <div className="space-y-0.5">
            <span className="text-sm font-black font-mono block text-[#3D2C08]">
              {appConfig.currencySymbol}{(user.wallet !== undefined ? user.wallet : 0).toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-[#3D2C08]/80 block uppercase tracking-wider">Balance</span>
            <button 
              onClick={() => onNavigateToWallet('deposit')}
              className="mt-1.5 px-4 py-1 bg-[#8C5D19] text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full hover:bg-[#6D4812] shadow-sm transition-colors cursor-pointer"
            >
              Recharge
            </button>
          </div>

          <div className="space-y-0.5 border-x border-[#3D2C08]/15">
            <span className="text-sm font-black font-mono block text-[#3D2C08]">
              {appConfig.currencySymbol}0.00
            </span>
            <span className="text-[10px] font-bold text-[#3D2C08]/80 block uppercase tracking-wider">Commission</span>
            <button 
              onClick={() => setActiveModal('refer')}
              className="mt-1.5 px-4 py-1 bg-[#8C5D19] text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full hover:bg-[#6D4812] transition-colors cursor-pointer"
            >
              See
            </button>
          </div>

          <div className="space-y-0.5">
            <span className="text-sm font-black font-mono block text-[#3D2C08]">
              {appConfig.currencySymbol}94.33
            </span>
            <span className="text-[10px] font-bold text-[#3D2C08]/80 block uppercase tracking-wider">Interest</span>
            <button 
              onClick={() => setActiveModal('interest')}
              className="mt-1.5 px-4 py-1 bg-[#8C5D19] text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full hover:bg-[#6D4812] transition-colors cursor-pointer"
            >
              See
            </button>
          </div>
        </div>
      </div>

      {/* Two Large Action Cards: Deposit and Withdraw Side-by-Side */}
      <div className="grid grid-cols-2 gap-3.5 pt-1">
        {/* Deposit Card */}
        <button
          onClick={() => onNavigateToWallet('deposit')}
          className="bg-[#181716] border border-[#3D2C08]/10 rounded-2xl p-4 text-left hover:bg-[#201F1E] hover:border-[#E5A93B]/20 transition-all cursor-pointer flex items-center space-x-3.5 h-20"
        >
          <div className="p-2.5 bg-[#E2B354]/10 border border-[#E2B354]/20 text-[#E5A93B] rounded-xl shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-white uppercase tracking-wider leading-none">Deposit</h4>
            <span className="text-[9px] text-slate-500 font-bold block mt-1">Add Money !</span>
          </div>
        </button>

        {/* Withdraw Card */}
        <button
          onClick={() => onNavigateToWallet('withdrawal')}
          className="bg-[#181716] border border-[#3D2C08]/10 rounded-2xl p-4 text-left hover:bg-[#201F1E] hover:border-[#E5A93B]/20 transition-all cursor-pointer flex items-center space-x-3.5 h-20"
        >
          <div className="p-2.5 bg-[#E2B354]/10 border border-[#E2B354]/20 text-[#E5A93B] rounded-xl shrink-0">
            <CreditCard className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-black text-white uppercase tracking-wider leading-none">Withdraw</h4>
            <span className="text-[9px] text-slate-500 font-bold block mt-1">Wallet To Bank</span>
          </div>
        </button>
      </div>

      {/* Grid of 5 Action Icons (Transparent Backgrounds, neat column alignments) */}
      <div className="grid grid-cols-3 gap-y-6 gap-x-2 pt-2 text-center">

        {/* Refer & Earn */}
        <button
          onClick={() => setActiveModal('refer')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <Share2 className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">Refer & Earn</span>
        </button>

        {/* Help (24x7) */}
        <button
          onClick={() => setActiveModal('help')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <HelpCircle className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">Help (24x7)</span>
        </button>

        {/* How To Play */}
        <button
          onClick={() => setActiveModal('rules')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <HelpIcon className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">How To Play</span>
        </button>

        {/* Gifts card */}
        <button
          onClick={() => setActiveModal('gift')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <Gift className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">Gifts card</span>
        </button>

        {/* About Us */}
        <button
          onClick={() => setActiveModal('about')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <Info className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">About Us</span>
        </button>
      </div>

      {/* Admin Panel Gateway (Only visible to admin users) */}
      {user.role === 'admin' && (
        <button
          onClick={onNavigateToAdmin}
          className="w-full bg-purple-500/10 hover:bg-purple-500/15 text-purple-400 border border-purple-500/35 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-2.5 transition-all shadow-md cursor-pointer animate-pulse"
        >
          <ShieldAlert className="h-4 w-4 text-purple-400" />
          <span>Go to Administration Control</span>
        </button>
      )}

      {/* Logout button */}
      <div className="pt-4 flex justify-center">
        <button
          onClick={onSignOut}
          className="w-full max-w-sm bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-[#E2B354]/10 hover:brightness-105 active:scale-98"
        >
          <span>Logout</span>
          <LogOut className="h-4.5 w-4.5 text-[#3D2C08] stroke-[2.5]" />
        </button>
      </div>

      {/* MODAL VIEWPORTS (RENDERED IN MOCK VIEWPORT FRAME) */}
      {activeModal && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col p-5 overflow-y-auto animate-in fade-in duration-200">
          {/* Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-900/80 mb-4">
            <h3 className="text-sm font-black uppercase text-amber-400 tracking-wide">
              {activeModal === 'addbank' && 'Bank Credentials Setup'}
              {activeModal === 'refer' && 'Referral Program'}
              {activeModal === 'help' && 'Live 24x7 Helpdesk'}
              {activeModal === 'rules' && 'Rules & Guidelines'}
              {activeModal === 'gift' && 'Voucher Redemption'}
              {activeModal === 'about' && 'Platform Overview'}
              {activeModal === 'interest' && 'Interest Ledger Accumulator'}
            </h3>
            <button 
              onClick={() => {
                setActiveModal(null);
                setGiftError('');
                setGiftSuccess('');
              }}
              className="text-slate-500 hover:text-white font-extrabold text-sm border border-slate-900 px-3 py-1 rounded-xl cursor-pointer"
            >
              X
            </button>
          </div>

          {/* Modal Content Switch */}
          {activeModal === 'addbank' && (
            <form onSubmit={handleSaveBank} className="space-y-4">
              <p className="text-[10px] text-slate-400 leading-relaxed">Configuring bank details provides swift auto-settlements during withdrawal requests.</p>
              
              {bankSaved && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] p-2.5 rounded-xl font-bold">
                  {bankSaved}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Bank Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Central Federal Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Account Number</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 10002930291"
                    value={accountNum}
                    onChange={(e) => setAccountNum(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">IFSC / Branch Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. IFSC293"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono"
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
                    className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-700 font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer hover:bg-amber-400 mt-2 shadow-md"
              >
                <Save className="h-4 w-4" />
                <span>Save Bank Settings</span>
              </button>
            </form>
          )}

          {activeModal === 'refer' && (() => {
            const inviteBase = appConfig.referralDomain || window.location.origin;
            const inviteLink = inviteBase.endsWith('/') ? `${inviteBase}?ref=${user.inviteCode || 'WIN777'}` : `${inviteBase}/?ref=${user.inviteCode || 'WIN777'}`;
            return (
              <div className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-start space-x-3 text-amber-400">
                  <Share2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-[10px] space-y-1">
                    <span className="font-bold block">Lifetime Referral Ledger:</span>
                    <p className="leading-relaxed text-slate-300">Invite new players to join our game using your link. Get instant credits from every stake they place! Paid directly to your ledger.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[8px] font-bold text-slate-500 block uppercase tracking-widest">Share invitation URL</span>
                  <div className="flex bg-slate-950 p-2 rounded-xl border border-slate-900 items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 overflow-hidden truncate mr-2">
                      {inviteLink}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(inviteLink);
                        alert('Invitation link copied successfully!');
                      }}
                      className="bg-amber-500 text-slate-950 px-3 py-1 rounded-lg text-[9px] font-bold uppercase shrink-0 cursor-pointer"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/30 p-4 rounded-xl border border-slate-900 space-y-3">
                  <div className="text-center pb-2 border-b border-slate-900">
                    <span className="text-[9px] font-bold text-slate-500 block uppercase">Total Referred Members</span>
                    <span className="text-xl font-mono font-black text-amber-400">{referredUsers.length} Accounts</span>
                  </div>
                  
                  {referredUsers.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-left">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Referred Account List</span>
                      {referredUsers.map((refUser, idx) => (
                        <div key={refUser.uid || idx} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-900/40">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-white font-bold block">{refUser.nickname || 'Anonym User'}</span>
                            <span className="text-[8px] text-slate-500 font-mono block">Joined: {new Date(refUser.createdAt || Date.now()).toLocaleDateString()}</span>
                          </div>
                          <span className="text-[10px] text-emerald-400 font-mono font-bold">Active</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {activeModal === 'help' && (
            <div className="space-y-4">
              <p className="text-[10px] text-slate-400 leading-relaxed">Our live verification specialists are available around the clock to settle billing queries and audit deposits claim requests.</p>
              
              <div className="space-y-3">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white block">Email Support</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">support@colorclub.win</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-white block">Telegram Live Chat</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-0.5">@ColorClubHelpdesk</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            </div>
          )}

          {activeModal === 'rules' && (
            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              <p className="font-bold text-amber-400 text-sm">Winning Payout Multipliers:</p>
              <ul className="list-disc pl-4 space-y-2 text-[11px] text-slate-400">
                <li><span className="font-bold text-white">Green or Red Colors:</span> 2x standard payout. (Violet split lands on 0 or 5 pays 1.5x to primary colors).</li>
                <li><span className="font-bold text-white">Violet Color:</span> 4.5x high payout (lands on numbers 0 or 5).</li>
                <li><span className="font-bold text-white">Specific Numbers (0 - 9):</span> 9.0x super payout!</li>
                <li><span className="font-bold text-white">Size (Small / Big):</span> 2.0x clean payout. Small represents numbers 0-4, and Big represents 5-9.</li>
              </ul>
            </div>
          )}

          {activeModal === 'gift' && (
            <form onSubmit={handleGiftRedeem} className="space-y-4">
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
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Voucher / Code</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. WELCOME100"
                  value={giftCode}
                  onChange={(e) => setGiftCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-3 text-xs text-white placeholder-slate-700 font-mono tracking-widest"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-amber-500 text-slate-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 cursor-pointer hover:bg-amber-400 mt-2 shadow-md"
              >
                <Gift className="h-4 w-4" />
                <span>Claim Voucher Credits</span>
              </button>
            </form>
          )}

          {activeModal === 'about' && (
            <div className="space-y-3 text-[11px] text-slate-400 leading-relaxed">
              <p>Color Club is an automated prediction and gaming platform operating with synchronized client state ledgers down to the atomic millisecond.</p>
              <p>All block timelines, countdown sequences, and outcome results are synchronized in real-time, allowing transparent gaming on any screen or device.</p>
              <p className="border-t border-slate-900 pt-3 text-[10px] text-slate-600">Version 2.4.1 (Sync Alpha Edition). Secured by active cryptographic SSL channels.</p>
            </div>
          )}

          {activeModal === 'interest' && (
            <div className="space-y-3">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-900 text-center space-y-1">
                <span className="text-[9px] font-bold text-slate-550 uppercase">Accumulated Annual Yield (APY)</span>
                <span className="text-2xl font-mono font-black text-emerald-400 block">{appConfig.currencySymbol}94.33</span>
                <span className="text-[9px] text-slate-500 block leading-tight">Interest earned organically on active wallets at 0.03% daily return rate!</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed text-center">Interest continues to accrue in real-time. Simply keep funds in your active balance to trigger the APY yield multiplier.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
