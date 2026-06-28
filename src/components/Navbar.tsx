import React from 'react';
import { UserProfile } from '../types';
import { LogOut, Wallet, Gamepad2, History, CreditCard, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  user: UserProfile;
  activeTab: 'arena' | 'wallet' | 'records' | 'admin';
  setActiveTab: (tab: 'arena' | 'wallet' | 'records' | 'admin') => void;
  onSignOut: () => void;
}

export default function Navbar({ user, activeTab, setActiveTab, onSignOut }: NavbarProps) {
  return (
    <header className="bg-[#1E293B] border-b border-slate-700/50 sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo and App Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-600 flex items-center justify-center text-white font-black text-xl rounded-xl shadow-inner">
              C
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wider text-white block leading-tight uppercase">
                Chroma Predict
              </span>
              <span className="text-[9px] text-slate-400 font-mono block uppercase tracking-widest">
                Realtime Arena
              </span>
            </div>
          </div>

          {/* Center Tabs (Desktop) */}
          <nav className="hidden md:flex space-x-2">
            <button
              onClick={() => setActiveTab('arena')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === 'arena'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
              <span>Arena</span>
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === 'wallet'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>Wallet</span>
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                activeTab === 'records'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-500/20'
                  : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Records</span>
            </button>
            {user.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === 'admin'
                    ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                    : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Console</span>
              </button>
            )}
          </nav>

          {/* User Info and Sign Out */}
          <div className="flex items-center space-x-4">
            {/* Wallet Balance widget */}
            <div className="flex items-center space-x-2.5 bg-slate-900/50 px-4 py-1.5 rounded-xl border border-slate-700/60 shadow-inner">
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest leading-none mb-0.5">
                  Available Balance
                </span>
                <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm leading-none">
                  ${user.wallet !== undefined ? user.wallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                </span>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/10">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              </div>
            </div>

            {/* Profile Nickname */}
            <div className="hidden sm:block text-right">
              <span className="text-xs font-bold text-slate-200 block">
                {user.nickname}
              </span>
              <span className="text-[10px] text-slate-500 font-mono block">
                {user.phone}
              </span>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex justify-around items-center border-t border-slate-800 bg-[#1E293B] py-2">
        <button
          onClick={() => setActiveTab('arena')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold uppercase tracking-wider ${
            activeTab === 'arena' ? 'text-blue-400' : 'text-slate-400'
          }`}
        >
          <Gamepad2 className="h-5 w-5 mb-0.5" />
          <span>Arena</span>
        </button>
        <button
          onClick={() => setActiveTab('wallet')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold uppercase tracking-wider ${
            activeTab === 'wallet' ? 'text-blue-400' : 'text-slate-400'
          }`}
        >
          <CreditCard className="h-5 w-5 mb-0.5" />
          <span>Wallet</span>
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`flex flex-col items-center p-2 text-[10px] font-bold uppercase tracking-wider ${
            activeTab === 'records' ? 'text-blue-400' : 'text-slate-400'
          }`}
        >
          <History className="h-5 w-5 mb-0.5" />
          <span>Records</span>
        </button>
        {user.role === 'admin' && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex flex-col items-center p-2 text-[10px] font-bold uppercase tracking-wider ${
              activeTab === 'admin' ? 'text-purple-400' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="h-5 w-5 mb-0.5" />
            <span>Admin</span>
          </button>
        )}
      </div>
    </header>
  );
}
