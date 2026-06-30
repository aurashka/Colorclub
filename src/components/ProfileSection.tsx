import React, { useState } from 'react';
import { UserProfile, DepositRequest, WithdrawalRequest, AppConfig } from '../types';
import { 
  UserCircle2, Copy, Check, LogOut, CreditCard, Share2, HelpCircle, 
  Gift, Info, ShieldAlert, Landmark, ChevronRight, HelpCircle as HelpIcon,
  MessageSquare
} from 'lucide-react';

interface ProfileSectionProps {
  user: UserProfile;
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  onSignOut: () => void;
  onNavigateToWallet: (subTab: 'deposit' | 'withdrawal' | 'history') => void;
  onNavigateToAdmin: () => void;
  appConfig: AppConfig;
  onOpenSheet: (sheet: string) => void;
  unreadSupportCount?: number;
}

export default function ProfileSection({
  user,
  deposits,
  withdrawals,
  onSignOut,
  onNavigateToWallet,
  onNavigateToAdmin,
  appConfig,
  onOpenSheet,
  unreadSupportCount = 0,
}: ProfileSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user.inviteCode || 'WIN777');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col space-y-6 font-sans text-slate-200 p-4">
      {/* Top Banner Gold Card */}
      <div className="bg-gradient-to-br from-[#FFE194] via-[#E2B354] to-[#B07E2A] rounded-3xl p-5 text-[#3D2C08] shadow-lg border border-[#FFE194]/30 relative overflow-hidden">
        {/* User Info Row */}
        <div className="flex justify-between items-start">
          <div className="space-y-0.5">
            <h3 className="text-sm font-black tracking-wide text-[#3D2C08] flex items-center space-x-1">
              <span>Name: {user?.nickname || 'Gamer'}</span>
            </h3>
            <div className="text-[10px] text-[#3D2C08]/85 font-mono">
              UID: <span className="select-all font-bold">{user?.uid}</span>
            </div>
            <div className="flex items-center space-x-1.5 text-[#3D2C08]/90 text-xs mt-1">
              <span>Refercode : <span className="font-mono font-bold text-[#3D2C08]">{user.inviteCode || 'aT2Zb2'}</span></span>
              <button 
                onClick={handleCopyCode}
                className="focus:outline-none hover:opacity-80 active:scale-95 transition-transform cursor-pointer"
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

          {/* Bank details button removed per request */}
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
              onClick={() => onOpenSheet('refer')}
              className="mt-1.5 px-4 py-1 bg-[#8C5D19] text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full hover:bg-[#6D4812] transition-colors cursor-pointer"
            >
              See
            </button>
          </div>

          <div className="space-y-0.5">
            <span className="text-sm font-black font-mono block text-[#3D2C08]">
              {appConfig.currencySymbol}{(user.interestEarned || 0).toFixed(2)}
            </span>
            <span className="text-[10px] font-bold text-[#3D2C08]/80 block uppercase tracking-wider">Interest</span>
            <button 
              onClick={() => onOpenSheet('interest')}
              className="mt-1.5 px-4 py-1 bg-[#8C5D19] text-white font-extrabold text-[9px] uppercase tracking-wider rounded-full hover:bg-[#6D4812] transition-colors cursor-pointer"
            >
              See
            </button>
          </div>
        </div>
      </div>

      {/* QUICK INVITATION ACTION CARD AT TOP (Copy Refercode & Link) */}
      <div className="bg-[#181716] border border-[#3D2C08]/20 rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div className="space-y-1">
          <span className="text-[10px] font-black uppercase text-[#E5A93B] tracking-wider block">Referral Link & Code</span>
          <span className="text-xs text-slate-300 font-mono font-bold block">{user.inviteCode || 'WIN777'}</span>
          <span className="text-[9px] text-slate-500 block truncate max-w-[190px]">
            {`${appConfig.referralDomain || window.location.origin}/?ref=${user.inviteCode || 'WIN777'}`}
          </span>
        </div>
        <button
          onClick={() => {
            const inviteBase = appConfig.referralDomain || window.location.origin;
            const inviteLink = inviteBase.endsWith('/') ? `${inviteBase}?ref=${user.inviteCode || 'WIN777'}` : `${inviteBase}/?ref=${user.inviteCode || 'WIN777'}`;
            navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] font-black text-[11px] px-3.5 py-2.5 rounded-xl flex items-center space-x-1 hover:brightness-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 stroke-[3]" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 stroke-[2]" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>

      {/* Two Large Action Cards: Deposit and Withdraw Side-by-Side */}
      <div className="grid grid-cols-2 gap-3.5 pt-1">
        {/* Deposit Card */}
        <button
          onClick={() => onNavigateToWallet('deposit')}
          className="bg-[#181716] border border-[#3D2C08]/10 rounded-2xl p-4 text-left hover:bg-[#201F1E] hover:border-[#E5A93B]/20 transition-all cursor-pointer flex items-center space-x-3.5 h-20 text-slate-200"
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
          className="bg-[#181716] border border-[#3D2C08]/10 rounded-2xl p-4 text-left hover:bg-[#201F1E] hover:border-[#E5A93B]/20 transition-all cursor-pointer flex items-center space-x-3.5 h-20 text-slate-200"
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
          onClick={() => onOpenSheet('refer')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <Share2 className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">Refer & Earn</span>
        </button>

        {/* Help (24x7) */}
        <button
          onClick={() => onOpenSheet('help')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform relative"
        >
          <div className="text-[#E5A93B] mb-2 relative">
            <HelpCircle className="h-6 w-6 stroke-[1.5]" />
            {unreadSupportCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0D121F] animate-pulse" />
            )}
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide flex items-center space-x-1 justify-center">
            <span>Help (24x7)</span>
          </span>
        </button>

        {/* How To Play */}
        <button
          onClick={() => onOpenSheet('rules')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <HelpIcon className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">How To Play</span>
        </button>

        {/* Gifts card */}
        <button
          onClick={() => onOpenSheet('gift')}
          className="flex flex-col items-center group cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="text-[#E5A93B] mb-2">
            <Gift className="h-6 w-6 stroke-[1.5]" />
          </div>
          <span className="text-[10px] font-bold text-[#E5A93B]/90 tracking-wide">Gifts card</span>
        </button>

        {/* About Us */}
        <button
          onClick={() => onOpenSheet('about')}
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
    </div>
  );
}
