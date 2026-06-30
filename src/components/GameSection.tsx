import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RoomType, BidRecord, UserProfile, GamePeriod, AppConfig } from '../types';
import { getPeriodDetails } from '../utils/gameUtils';
import { 
  Coins, Wallet, RefreshCw, HelpCircle, Lock, Unlock, Landmark,
  ChevronRight, Volume2, Play, Flame, Star, AlertTriangle, HelpCircle as HelpIcon, CheckCircle2,
  ChevronDown, ChevronUp, Check, Copy, History, Calendar, FileText
} from 'lucide-react';

interface GameSectionProps {
  roomId: RoomType;
  setRoomId: (id: RoomType) => void;
  periodId: string;
  timeLeft: number;
  isLocked: boolean;
  totalDuration: number;
  user: UserProfile | null;
  activeBids: BidRecord[];
  userAllBids: BidRecord[];
  history: GamePeriod[];
  onPlaceBid: (selection: string, totalCost: number) => Promise<void>;
  onNavigateToWallet: (subTab: 'deposit' | 'withdrawal' | 'history') => void;
  onLoginPrompt: () => void;
  appConfig: AppConfig;
  selectedSelection: string | null;
  setSelectedSelection: (selection: string | null) => void;
}

export default function GameSection({
  roomId,
  setRoomId,
  periodId,
  timeLeft,
  isLocked,
  totalDuration,
  user,
  activeBids,
  userAllBids,
  history,
  onPlaceBid,
  onNavigateToWallet,
  onLoginPrompt,
  appConfig,
  selectedSelection,
  setSelectedSelection,
}: GameSectionProps) {
  const [multiplier, setMultiplier] = useState<number>(1);
  const [baseAmount, setBaseAmount] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  // Custom design states
  const [bottomTab, setBottomTab] = useState<'gameRecord' | 'myHistory'>('gameRecord');
  const [expandedBidId, setExpandedBidId] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);
  const [copiedBidId, setCopiedBidId] = useState<string | null>(null);
  const [myBidsPage, setMyBidsPage] = useState<number>(1);
  const [myBidsFilter, setMyBidsFilter] = useState<'all' | '30s' | '1m' | '3m'>('all');

  const findPeriodResult = (pId: string, rId: string) => {
    return history.find((h) => h.periodId === pId && h.roomId === rId);
  };

  const handleSelection = (sel: string) => {
    if (isLocked) return;
    if (!user) {
      onLoginPrompt();
      return;
    }
    setSelectedSelection(sel);
    setError('');
    setSuccessMsg('');
  };

  const handleApplyPresetMultiplier = (multStr: string) => {
    if (isLocked) return;
    if (multStr === 'Random') {
      const options = ['green', 'red', 'violet', 'small', 'big', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
      const randomSel = options[Math.floor(Math.random() * options.length)];
      handleSelection(randomSel);
    } else {
      const val = parseInt(multStr.replace('x', ''));
      if (!isNaN(val)) {
        setMultiplier(val);
      }
    }
  };

  const handleConfirmBid = async () => {
    if (!selectedSelection) return;
    if (!user) {
      onLoginPrompt();
      return;
    }
    const totalCost = baseAmount * multiplier;
    if (totalCost > (user.wallet ?? 0)) {
      setError(`Insufficient balance. Cost: ${appConfig.currencySymbol}${totalCost.toFixed(2)}, Balance: ${appConfig.currencySymbol}${(user.wallet ?? 0).toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await onPlaceBid(selectedSelection, totalCost);
      setSelectedSelection(null);
      setMultiplier(1);
    } catch (err: any) {
      setError(err.message || 'Bidding failed.');
    } finally {
      setLoading(false);
    }
  };

  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Get color configurations for past numbers or active selections
  const getBallStyle = (num: number) => {
    // glossy 3D gradients with white reflection dot
    const baseSphere = "h-8 w-8 rounded-full font-extrabold flex items-center justify-center text-white text-xs shadow-md border border-white/20 relative overflow-hidden before:absolute before:w-2 before:h-2 before:bg-white/45 before:rounded-full before:top-0.5 before:left-1";
    if (num === 0) return `${baseSphere} bg-gradient-to-br from-rose-400 via-rose-500 to-violet-700`;
    if (num === 5) return `${baseSphere} bg-gradient-to-br from-emerald-400 via-emerald-500 to-violet-700`;
    if ([1, 3, 7, 9].includes(num)) return `${baseSphere} bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/10`;
    return `${baseSphere} bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/10`;
  };

  const getSelectionBallStyle = (sel: string) => {
    const baseSphere = "h-11 w-11 rounded-full font-black text-sm text-white flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95 border border-white/10 relative overflow-hidden before:absolute before:w-2.5 before:h-2.5 before:bg-white/40 before:rounded-full before:top-1 before:left-1.5 cursor-pointer shadow-md";
    const num = Number(sel);
    if (isNaN(num)) return '';
    if (num === 0) return `${baseSphere} bg-gradient-to-br from-rose-400 via-rose-500 to-violet-700`;
    if (num === 5) return `${baseSphere} bg-gradient-to-br from-emerald-400 via-emerald-500 to-violet-700`;
    if ([1, 3, 7, 9].includes(num)) return `${baseSphere} bg-gradient-to-br from-emerald-400 to-emerald-600`;
    return `${baseSphere} bg-gradient-to-br from-rose-400 to-rose-600`;
  };

  const getSelectionTheme = (sel: string | null) => {
    if (!sel) return { bg: 'bg-[#E2B354]', hover: 'hover:opacity-90', text: 'text-[#E5A93B]', border: 'border-[#E5A93B]/30' };
    if (sel === 'green') return { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    if (sel === 'red') return { bg: 'bg-rose-600', hover: 'hover:bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30' };
    if (sel === 'violet') return { bg: 'bg-violet-600', hover: 'hover:bg-violet-500', text: 'text-violet-400', border: 'border-violet-500/30' };
    if (sel === 'small') return { bg: 'bg-sky-600', hover: 'hover:bg-sky-500', text: 'text-sky-400', border: 'border-sky-500/30' };
    if (sel === 'big') return { bg: 'bg-amber-600', hover: 'hover:bg-amber-500', text: 'text-amber-500', border: 'border-amber-500/30' };
    
    const num = Number(sel);
    if (!isNaN(num)) {
      if (num === 0) return { bg: 'bg-gradient-to-r from-rose-500 via-rose-600 to-violet-700', hover: 'hover:opacity-95', text: 'text-purple-400', border: 'border-purple-500/30' };
      if (num === 5) return { bg: 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-violet-700', hover: 'hover:opacity-95', text: 'text-[#E5A93B]', border: 'border-[#E5A93B]/30' };
      if ([1, 3, 7, 9].includes(num)) return { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30' };
      return { bg: 'bg-rose-600', hover: 'hover:bg-rose-500', text: 'text-rose-400', border: 'border-rose-500/30' };
    }
    return { bg: 'bg-[#E2B354]', hover: 'hover:bg-[#FFE194]', text: 'text-[#E5A93B]', border: 'border-[#E5A93B]/30' };
  };

  const getFilteredHistory = () => {
    return history
      .filter((item) => item.roomId === roomId)
      .sort((a, b) => b.periodId.localeCompare(a.periodId));
  };

  return (
    <div className="flex flex-col space-y-4 font-sans text-slate-200 p-4">
      
      {/* 1. Wallet Balance Top Gold Header Card */}
      <div className="bg-gradient-to-br from-[#FFE194] via-[#E2B354] to-[#B07E2A] rounded-3xl p-5 text-[#3D2C08] shadow-lg border border-[#FFE194]/30 relative overflow-hidden">
        <div className="flex justify-between items-center mb-1.5">
          <div className="flex items-center space-x-1.5 text-[#3D2C08]/90">
            <Wallet className="h-4 w-4 text-[#3D2C08]" />
            <span className="text-[10px] font-black uppercase tracking-wider">Wallet Balance</span>
          </div>
          <button className="text-[#3D2C08] hover:opacity-80 transition-transform active:rotate-180">
            <RefreshCw className="h-4 w-4 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex justify-between items-center">
          {user ? (
            <span className="text-2xl font-black font-mono tracking-tight text-[#3D2C08]">
              {appConfig.currencySymbol}{(user.wallet !== undefined ? user.wallet : 0).toFixed(2)}
            </span>
          ) : (
            <span className="text-xs font-black uppercase tracking-wider text-[#3D2C08]/90">
              Guest Mode (Explore)
            </span>
          )}
          <div className="flex space-x-2">
            {user ? (
              <>
                <button
                  onClick={() => onNavigateToWallet('deposit')}
                  className="bg-[#8C5D19] hover:bg-[#6D4812] text-white font-extrabold text-[10px] uppercase tracking-wider px-4.5 py-1.5 rounded-full transition-colors shadow-sm cursor-pointer"
                >
                  Deposit
                </button>
                <button
                  onClick={() => onNavigateToWallet('withdrawal')}
                  className="border border-[#8C5D19] text-[#8C5D19] bg-transparent font-extrabold text-[10px] uppercase tracking-wider px-4.5 py-1.5 rounded-full hover:bg-[#8C5D19]/5 transition-all cursor-pointer"
                >
                  Withdraw
                </button>
              </>
            ) : (
              <button
                onClick={onLoginPrompt}
                className="bg-[#8C5D19] hover:bg-[#6D4812] text-white font-extrabold text-[10px] uppercase tracking-wider px-5 py-2 rounded-full transition-all shadow-md cursor-pointer animate-pulse"
              >
                Login / Register
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Arena Switch Toggles */}
      <div className="flex p-0.5 bg-[#181716] rounded-xl border border-[#3D2C08]/10 space-x-1">
        <button
          onClick={() => setRoomId('30s')}
          className={`flex-1 py-2 px-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center min-h-[46px] ${
            roomId === '30s'
              ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] font-black shadow-lg scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <span className="font-extrabold truncate">30 Sec</span>
          <span className={`font-mono text-[9px] mt-0.5 font-bold ${
            roomId === '30s' ? 'text-[#3D2C08]/90' : 'text-slate-400'
          }`}>
            {formatTime(getPeriodDetails('30s').timeLeft)}
          </span>
        </button>

        <button
          onClick={() => setRoomId('1m')}
          className={`flex-1 py-2 px-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center min-h-[46px] ${
            roomId === '1m'
              ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] font-black shadow-lg scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <span className="font-extrabold truncate">1 Min</span>
          <span className={`font-mono text-[9px] mt-0.5 font-bold ${
            roomId === '1m' ? 'text-[#3D2C08]/90' : 'text-slate-400'
          }`}>
            {formatTime(getPeriodDetails('1m').timeLeft)}
          </span>
        </button>

        <button
          onClick={() => setRoomId('3m')}
          className={`flex-1 py-2 px-1 text-[9px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer flex flex-col items-center justify-center min-h-[46px] ${
            roomId === '3m'
              ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] font-black shadow-lg scale-[1.02]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <span className="font-extrabold truncate">3 Min</span>
          <span className={`font-mono text-[9px] mt-0.5 font-bold ${
            roomId === '3m' ? 'text-[#3D2C08]/90' : 'text-slate-400'
          }`}>
            {formatTime(getPeriodDetails('3m').timeLeft)}
          </span>
        </button>
      </div>

      {/* 2. Coupon-shaped Draw Ticket */}
      <div className="bg-gradient-to-br from-[#FFE194] via-[#E2B354] to-[#B07E2A] rounded-3xl p-5 text-[#3D2C08] shadow-xl border border-[#FFE194]/45 relative overflow-hidden">
        {/* Notch details for physical ticket shape */}
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0d0d0d] border-r border-[#FFE194]/30" />
        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#0d0d0d] border-l border-[#FFE194]/30" />
        
        {/* Top bar inside Coupon */}
        <div className="flex justify-between items-start border-b border-[#3D2C08]/15 pb-3">
          <div>
            <button 
              onClick={() => setShowHowToPlay(!showHowToPlay)}
              className="text-[9px] font-black uppercase bg-[#3D2C08]/10 hover:bg-[#3D2C08]/15 text-[#3D2C08] border border-[#3D2C08]/25 px-3.5 py-1.5 rounded-full flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <span>How to play !</span>
            </button>
            <div className="mt-2.5">
              <span className="text-[8px] font-bold text-[#3D2C08]/70 uppercase tracking-wider block">Period ID</span>
              <span className="text-xs font-mono font-black text-[#3D2C08] tracking-wider">
                {periodId}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[8px] font-black text-[#3D2C08]/75 uppercase tracking-wider block mb-1">Time Remaining</span>
            <div className="flex items-center space-x-1 justify-end">
              <span className="text-sm font-bold text-white bg-[#3D2C08] px-2.5 py-1 rounded-lg shadow font-mono">
                {timeLeft > 0 ? formatTime(timeLeft).split(':')[0] : '00'}
              </span>
              <span className="text-[#3D2C08] font-black text-sm">:</span>
              <span className="text-sm font-bold text-white bg-[#3D2C08] px-2.5 py-1 rounded-lg shadow font-mono">
                {timeLeft > 0 ? formatTime(timeLeft).split(':')[1] : '00'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic How to Play Rules */}
        {showHowToPlay && (
          <div className="bg-[#3D2C08]/10 border border-[#3D2C08]/15 rounded-xl p-3 text-[10px] text-[#3D2C08] font-bold leading-relaxed space-y-1 mt-2">
            <p className="font-extrabold uppercase tracking-wide text-amber-950">⚡ Win Go Rules:</p>
            <p>• Predict colors (Red: Even, Green: Odd, Violet: 0 or 5) for 2x to 4.5x returns.</p>
            <p>• Predict numbers (0-9) for a massive 9x return!</p>
            <p>• Predict size (Small: 0-4, Big: 5-9) for 2x returns.</p>
          </div>
        )}

        {/* 3D past 8 balls outcome tracker */}
        <div className="flex justify-between items-center pt-3">
          <div className="space-y-1.5 w-full">
            <span className="text-[8px] font-black text-[#3D2C08]/80 uppercase tracking-widest block">Recent Results (Last 8 Draws)</span>
            <div className="flex flex-wrap gap-1.5 items-center">
              {getFilteredHistory().slice(0, 8).reverse().map((item, idx) => (
                <div key={idx} className={getBallStyle(item.number)}>
                  <span>{item.number}</span>
                </div>
              ))}
              {getFilteredHistory().length === 0 && (
                <span className="text-[10px] text-[#3D2C08]/70 font-mono italic">No draws yet...</span>
              )}
            </div>
          </div>
        </div>


      </div>

      {/* 4. Color Prediction Buttons (Cohesive Triple Segment Pill block) */}
      <div className="space-y-1.5">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Choose Color</span>
        <div className="flex w-full rounded-2xl overflow-hidden border border-[#3D2C08]/10 shadow-md">
          {/* Green button (slanted-left) */}
          <button
            disabled={isLocked}
            onClick={() => handleSelection('green')}
            className={`flex-1 py-3 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedSelection === 'green'
                ? 'bg-emerald-700 text-white shadow-inner scale-98'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />
            <span>Green</span>
          </button>

          {/* Violet button (center) */}
          <button
            disabled={isLocked}
            onClick={() => handleSelection('violet')}
            className={`flex-1 py-3 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed border-x border-[#3D2C08]/15 ${
              selectedSelection === 'violet'
                ? 'bg-violet-700 text-white shadow-inner scale-98'
                : 'bg-violet-600 hover:bg-violet-500 text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />
            <span>Violet</span>
          </button>

          {/* Red button (slanted-right) */}
          <button
            disabled={isLocked}
            onClick={() => handleSelection('red')}
            className={`flex-1 py-3 font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 disabled:opacity-40 disabled:cursor-not-allowed ${
              selectedSelection === 'red'
                ? 'bg-rose-700 text-white shadow-inner scale-98'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <span className="w-1.5 h-1.5 bg-white rounded-full shrink-0" />
            <span>Red</span>
          </button>
        </div>
      </div>

      {/* 5. Shiny Numbers Grid (0-9 in beautiful 2 rows of 5) */}
      <div className="space-y-1.5">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Choose Number</span>
        <div className="grid grid-cols-5 gap-3 bg-[#181716] p-3 rounded-2xl border border-[#3D2C08]/10 shadow">
          {Array.from({ length: 10 }).map((_, idx) => {
            const numStr = String(idx);
            const isSelected = selectedSelection === numStr;
            return (
              <button
                key={idx}
                disabled={isLocked}
                onClick={() => handleSelection(numStr)}
                className={`${getSelectionBallStyle(numStr)} ${
                  isSelected ? 'ring-4 ring-[#E5A93B] scale-90 border-white' : ''
                } disabled:opacity-30 disabled:pointer-events-none`}
              >
                <span className="font-mono font-black text-base">{idx}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Size Selection Pills */}
      <div className="grid grid-cols-2 gap-3.5 pt-0.5">
        <button
          disabled={isLocked}
          onClick={() => handleSelection('small')}
          className={`py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer border flex items-center justify-center space-x-1 disabled:opacity-40 disabled:pointer-events-none ${
            selectedSelection === 'small'
              ? 'bg-sky-700 text-white border-sky-400 scale-98 shadow-inner'
              : 'bg-sky-600 border-sky-500 text-white shadow-md'
          }`}
        >
          <span>Small (0-4)</span>
        </button>

        <button
          disabled={isLocked}
          onClick={() => handleSelection('big')}
          className={`py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer border flex items-center justify-center space-x-1 disabled:opacity-40 disabled:pointer-events-none ${
            selectedSelection === 'big'
              ? 'bg-amber-600 text-white border-amber-400 scale-98 shadow-inner'
              : 'bg-amber-500 border-amber-400 text-slate-950 shadow-md font-bold'
          }`}
        >
          <span>Big (5-9)</span>
        </button>
      </div>

      {/* 7. Presets Shortcuts Bar */}
      <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
        {['Random', '1x', '5x', '10x', '20x', '50x'].map((p) => {
          const isMultActive = p.endsWith('x') && multiplier === parseInt(p.replace('x', ''));
          return (
            <button
              key={p}
              disabled={isLocked}
              onClick={() => handleApplyPresetMultiplier(p)}
              className={`px-3.5 py-1.5 border text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer shrink-0 transition-all ${
                isMultActive
                  ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] border-[#FFE194]'
                  : 'bg-transparent border-[#E5A93B]/40 text-[#E5A93B] hover:border-[#E5A93B]/60'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      {/* 8. Active Stakes in current period */}
      {activeBids.length > 0 && (
        <div className="bg-[#181716] p-3 rounded-xl border border-[#3D2C08]/10 space-y-1.5 shadow">
          <span className="text-[8px] font-black text-[#E5A93B] uppercase tracking-widest block">Stakes in current block {periodId}</span>
          <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
            {activeBids.map((b) => (
              <div key={b.bidId} className="flex justify-between items-center text-[10px] bg-black/40 p-2.5 rounded-lg border border-[#3D2C08]/10">
                <span className="font-extrabold text-slate-200 font-mono">
                  {b.selection.toUpperCase()} ({appConfig.currencySymbol}{b.amount.toFixed(2)})
                </span>
                <span className="text-[8px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold animate-pulse">Pending Outcome</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 9. Floating Stake Confirm Drawer with Backdrop */}
      {selectedSelection && createPortal(
        <>
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setSelectedSelection(null)}
            className="absolute inset-0 bg-black/75 z-45 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
          />

          {/* Premium Bottom Sheet Drawer */}
          <div className="absolute inset-x-0 bottom-0 bg-[#121110] border-t-2 border-[#E2B354]/45 rounded-t-3xl p-5 shadow-[0_-12px_35px_rgba(0,0,0,0.9)] z-50 animate-in slide-in-from-bottom duration-300 flex flex-col space-y-4">
            
            {/* Drawer Drag Accent */}
            <div className="w-10 h-1 bg-slate-800 rounded-full mx-auto -mt-2 mb-1" />

            {/* Header / Selection Title */}
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[8px] font-black text-[#E5A93B] uppercase tracking-wider block">PREDICTION ROUND {periodId}</span>
                <h3 className="text-sm font-black text-white mt-0.5 flex items-center space-x-2">
                  <span>Contract Select:</span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-sm ${
                    getSelectionTheme(selectedSelection).bg
                  } text-white`}>
                    {selectedSelection.toUpperCase()}
                  </span>
                </h3>
              </div>
              <button 
                onClick={() => setSelectedSelection(null)}
                className="text-slate-400 hover:text-white text-xs bg-slate-900 hover:bg-slate-800 px-3 py-1 rounded-full cursor-pointer transition-colors border border-[#3D2C08]/15"
              >
                Close
              </button>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold p-2.5 rounded-xl">
                {error}
              </div>
            )}

            {/* Base Contract Money (Base Amount Selector) */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Contract Money</span>
              <div className="grid grid-cols-4 gap-2">
                {[10, 100, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBaseAmount(amt)}
                    className={`py-2 rounded-xl text-xs font-black font-mono border transition-all ${
                      baseAmount === amt
                        ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] border-[#FFE194] text-[#3D2C08] shadow-md shadow-[#E2B354]/10'
                        : 'bg-[#181716] border-[#3D2C08]/10 text-[#E5A93B] hover:border-[#E5A93B]/25'
                    }`}
                  >
                    {appConfig.currencySymbol}{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiplier / Quantity Control */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">Multiplier / Quantity</span>
              <div className="flex justify-between items-center bg-[#181716] p-2.5 rounded-xl border border-[#3D2C08]/10 shadow-inner">
                <div className="flex items-center space-x-1">
                  {['1x', '5x', '10x', '20x', '50x', '100x'].map((m) => {
                    const mVal = parseInt(m);
                    return (
                      <button
                        key={m}
                        onClick={() => setMultiplier(mVal)}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md transition-colors ${
                          multiplier === mVal 
                            ? 'bg-[#E2B354]/20 text-[#E5A93B] font-extrabold'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex items-center space-x-2 border-l border-slate-800 pl-3">
                  <button
                    onClick={() => setMultiplier(Math.max(1, multiplier - 1))}
                    className="w-7 h-7 bg-black border border-[#3D2C08]/20 text-[#E5A93B] font-black flex items-center justify-center rounded-lg hover:bg-[#181716] active:scale-90 transition-transform"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-sm text-white w-6 text-center">{multiplier}</span>
                  <button
                    onClick={() => setMultiplier(multiplier + 1)}
                    className="w-7 h-7 bg-black border border-[#3D2C08]/20 text-[#E5A93B] font-black flex items-center justify-center rounded-lg hover:bg-[#181716] active:scale-90 transition-transform"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Presale Agreement */}
            <div className="flex items-center space-x-2 pt-1">
              <input 
                id="termsCheck"
                type="checkbox" 
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="rounded border-[#3D2C08]/20 text-[#E2B354] focus:ring-[#E2B354] w-3.5 h-3.5 bg-black cursor-pointer"
              />
              <label htmlFor="termsCheck" className="text-[9px] text-slate-500 font-bold select-none cursor-pointer">
                I agree to the <span className="text-[#E5A93B] hover:underline">Presale Rule Agreement</span>
              </label>
            </div>

            {/* Confirm Actions */}
            <div className="grid grid-cols-3 gap-2.5 pt-1.5">
              <button
                onClick={() => setSelectedSelection(null)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider py-3.5 rounded-2xl border border-slate-800 transition-colors"
              >
                Cancel
              </button>
              
              <button
                disabled={loading || !termsAccepted || isLocked}
                onClick={handleConfirmBid}
                className={`col-span-2 ${
                  isLocked 
                    ? 'bg-rose-950/40 text-rose-500 border border-rose-500/30' 
                    : getSelectionTheme(selectedSelection).bg
                } ${
                  isLocked ? '' : getSelectionTheme(selectedSelection).hover
                } font-black text-[10px] uppercase tracking-wider py-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center space-x-1.5 disabled:opacity-45`}
              >
                {loading ? (
                  <span className="animate-pulse">Placing prediction...</span>
                ) : isLocked ? (
                  <span className="flex items-center space-x-1.5 text-rose-500 font-bold">
                    <Lock className="h-3 w-3 shrink-0" />
                    <span>Locked ({timeLeft}s)</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1.5 text-white">
                    <Play className="h-3.5 w-3.5 fill-current shrink-0" />
                    <span>Confirm - {appConfig.currencySymbol}{(baseAmount * multiplier).toFixed(2)}</span>
                  </span>
                )}
              </button>
            </div>

          </div>
        </>,
        document.getElementById('smartphone-container') || document.body
      )}

      {/* Success notifier popup */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-2xl flex items-center space-x-2 text-[10px] text-emerald-400 font-bold shadow animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 10. Segmented Toggles: Game Record vs My History */}
      <div className="space-y-2">
        <div className="flex p-0.5 bg-[#181716] rounded-xl border border-[#3D2C08]/10 shadow">
          <button
            onClick={() => setBottomTab('gameRecord')}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              bottomTab === 'gameRecord'
                ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] font-black shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Game Record
          </button>
          <button
            onClick={() => {
              if (!user) {
                onLoginPrompt();
              } else {
                setBottomTab('myHistory');
              }
            }}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              bottomTab === 'myHistory'
                ? 'bg-gradient-to-r from-[#FFE194] to-[#E2B354] text-[#3D2C08] font-black shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            My History
          </button>
        </div>

        {/* Tab content: Game Record */}
        {bottomTab === 'gameRecord' && (
          <div className="overflow-hidden border border-[#3D2C08]/10 rounded-2xl bg-[#181716]/30 shadow">
            <table className="min-w-full divide-y divide-[#3D2C08]/15 text-[10px]">
              <thead className="bg-[#181716] text-[#E5A93B] font-extrabold font-mono uppercase tracking-wider text-[8px]">
                <tr>
                  <th className="px-4 py-3 text-left">Period ({roomId === '30s' ? '30 Sec' : roomId === '1m' ? '1 Min' : '3 Min'})</th>
                  <th className="px-4 py-3 text-center">Numberball with color</th>
                  <th className="px-4 py-3 text-right">Big/Small</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D2C08]/10 font-sans text-slate-300">
                {getFilteredHistory().slice(0, 10).map((item) => {
                  const num = item.number;
                  let outcomeLabel = 'RED';
                  let outcomeColor = 'text-rose-500';
                  if (num === 0) {
                    outcomeLabel = 'VIOLET-RED';
                    outcomeColor = 'text-purple-400';
                  } else if (num === 5) {
                    outcomeLabel = 'VIOLET-GREEN';
                    outcomeColor = 'text-emerald-400';
                  } else if ([1, 3, 7, 9].includes(num)) {
                    outcomeLabel = 'GREEN';
                    outcomeColor = 'text-emerald-500';
                  }

                  return (
                    <tr key={item.periodId} className="hover:bg-slate-900/15">
                      <td className="px-4 py-2.5 font-mono text-slate-400">{item.periodId}</td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className={`h-6 w-6 rounded-full font-extrabold flex items-center justify-center text-white text-[10px] shadow-sm relative overflow-hidden before:absolute before:w-1.5 before:h-1.5 before:bg-white/40 before:rounded-full before:top-0.5 before:left-0.5 ${
                            num === 0 ? 'bg-gradient-to-r from-red-500 to-violet-600' :
                            num === 5 ? 'bg-gradient-to-r from-emerald-500 to-violet-600' :
                            [1,3,7,9].includes(num) ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}>
                            {item.number}
                          </span>
                          <span className={`font-black text-[9px] uppercase tracking-wider ${outcomeColor}`}>
                            {outcomeLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold uppercase text-[9px]">
                        <span className={`inline-block px-2 py-0.5 rounded border ${
                          item.number >= 5 
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}>
                          {item.number >= 5 ? 'Big' : 'Small'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {getFilteredHistory().length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-600 italic font-mono">
                      Awaiting game draw sync...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab content: My History (Durable expandable stakes / play records) */}
        {bottomTab === 'myHistory' && (() => {
          const filteredBids = myBidsFilter === 'all'
            ? userAllBids
            : userAllBids.filter((b) => b.roomId === myBidsFilter);

          const sortedBids = [...filteredBids].sort((a, b) => b.createdAt - a.createdAt);
          const bidsPerPage = 10;
          const totalBids = sortedBids.length;
          const totalPages = Math.ceil(totalBids / bidsPerPage) || 1;
          const startIndex = (myBidsPage - 1) * bidsPerPage;
          const paginatedBids = sortedBids.slice(startIndex, startIndex + bidsPerPage);

          return (
            <div className="space-y-3">
              {/* Filter Row: All, 30s, 1m, 3m */}
              <div className="flex p-0.5 bg-[#141211] rounded-xl border border-[#3D2C08]/10 text-[9px] font-bold font-mono">
                {(['all', '30s', '1m', '3m'] as const).map((filterOpt) => (
                  <button
                    key={filterOpt}
                    onClick={() => {
                      setMyBidsFilter(filterOpt);
                      setMyBidsPage(1);
                    }}
                    className={`flex-1 py-1.5 rounded-lg uppercase transition-all duration-150 cursor-pointer ${
                      myBidsFilter === filterOpt
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'text-slate-500 hover:text-slate-300 border border-transparent'
                    }`}
                  >
                    {filterOpt === 'all' ? 'All' : filterOpt}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-thin">
                {paginatedBids.map((b) => {
                  const isExpanded = expandedBidId === b.bidId;
                  const periodResult = findPeriodResult(b.periodId, b.roomId);
                  
                  // Formatting outcome rewards
                  const isWon = b.status === 'won';
                  const isPending = b.status === 'pending';
                  const rewardClass = isWon ? 'text-emerald-500' : 'text-rose-500';
                  const rewardPrefix = isWon ? '+' : '-';
                  const rewardFormatted = isPending 
                    ? 'Pending' 
                    : `${rewardPrefix}${appConfig.currencySymbol}${isWon ? b.winAmount.toFixed(2) : b.amount.toFixed(2)}`;

                  return (
                    <div 
                      key={b.bidId} 
                      className={`border rounded-2xl bg-[#181716]/60 transition-all overflow-hidden ${
                        isExpanded 
                          ? 'border-[#E2B354]/45 shadow-lg shadow-[#E2B354]/5 bg-[#1a1918]' 
                          : 'border-[#3D2C08]/10 hover:border-[#E2B354]/25'
                      }`}
                    >
                      {/* Collapsed Header / Tappable row */}
                      <div 
                        onClick={() => setExpandedBidId(isExpanded ? null : b.bidId)}
                        className="p-3 flex items-center justify-between cursor-pointer select-none text-[10px]"
                      >
                        <div className="space-y-0.5">
                          <span className="font-mono text-[9px] text-[#E5A93B] font-black tracking-wider flex items-center space-x-1.5">
                            <span>{b.periodId}</span>
                            <span className="bg-[#FFE194]/15 text-[#E5A93B] text-[7.5px] font-black px-1.5 py-0.5 rounded border border-[#E5A93B]/20 uppercase">
                              {b.roomId}
                            </span>
                          </span>
                          <div className="flex items-center space-x-1.5 text-slate-500 text-[8px] font-bold">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>
                              {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="font-mono font-black text-slate-200 block">{appConfig.currencySymbol}{b.amount.toFixed(2)}</span>
                            <span className={`text-[9px] font-black tracking-wide block ${
                              isPending 
                                ? 'text-amber-500 animate-pulse' 
                                : rewardClass
                            }`}>
                              {rewardFormatted}
                            </span>
                          </div>

                          <div className="text-[#E5A93B]">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detailed Sheet */}
                      {isExpanded && (
                        <div className="px-4.5 pb-4.5 pt-1.5 border-t border-[#3D2C08]/10 bg-black/35 text-[9px] space-y-3 animate-in slide-in-from-top-1 duration-150">
                          
                          {/* Grid Breakdown */}
                          <div className="grid grid-cols-2 gap-4 text-slate-400">
                            <div className="space-y-1.5">
                              <div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest block">Staked Selection</span>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className={`px-2 py-0.5 rounded-md font-black text-[8px] uppercase tracking-wider ${
                                    getSelectionTheme(b.selection).bg
                                  } text-white`}>
                                    {b.selection}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Contract calculation</span>
                                <span className="font-mono text-slate-300">
                                  {appConfig.currencySymbol}{(b.amount / multiplier).toFixed(2)} x {multiplier} = {appConfig.currencySymbol}{b.amount.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-right">
                              <div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest block">Draw Outcome</span>
                                {periodResult ? (
                                  <div className="flex items-center justify-end space-x-1 mt-0.5">
                                    <span className={`h-4.5 w-4.5 rounded-full font-black flex items-center justify-center text-white text-[8px] ${
                                      periodResult.number === 0 ? 'bg-gradient-to-r from-red-500 to-violet-600' :
                                      periodResult.number === 5 ? 'bg-gradient-to-r from-emerald-500 to-violet-600' :
                                      [1,3,7,9].includes(periodResult.number) ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}>
                                      {periodResult.number}
                                    </span>
                                    <span className="font-black text-slate-300 text-[8px] uppercase tracking-wide">
                                      {periodResult.premiumColor}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-amber-500 font-extrabold animate-pulse block mt-0.5">Waiting Draw...</span>
                                )}
                              </div>

                              <div>
                                <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest block">Fee (Platform Tax)</span>
                                <span className="font-mono text-slate-400">
                                  {appConfig.currencySymbol}{(b.amount * 0.02).toFixed(2)} (2%)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Transaction Copy Bar */}
                          <div className="bg-[#181716]/40 p-2.5 rounded-xl border border-[#3D2C08]/10 flex justify-between items-center text-slate-400">
                            <div className="truncate pr-4">
                              <span className="text-[7px] font-bold text-slate-500 uppercase tracking-wider block leading-none">ORDER ID</span>
                              <span className="font-mono text-[8px] tracking-wide text-slate-300 select-all">{b.bidId}</span>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(b.bidId);
                                setCopiedBidId(b.bidId);
                                setTimeout(() => setCopiedBidId(null), 1500);
                              }}
                              className="p-1 bg-black rounded-lg hover:bg-[#181716] text-[#E5A93B] shrink-0 active:scale-95 transition-transform"
                              title="Copy Order ID"
                            >
                              {copiedBidId === b.bidId ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>

                          {/* Financial Settle Outcome Summary */}
                          <div className="bg-black/20 p-2 rounded-xl flex justify-between items-center text-[10px] border border-dashed border-[#3D2C08]/15">
                            <span className="text-slate-400 font-bold">Payout Yield</span>
                            <span className={`font-mono font-black ${
                              isPending ? 'text-amber-500' : isWon ? 'text-[#10B981]' : 'text-[#EF4444]'
                            }`}>
                              {isPending 
                                ? 'Awaiting block settlement' 
                                : isWon 
                                  ? `+ ${appConfig.currencySymbol}${b.winAmount.toFixed(2)} (Won!)` 
                                  : `- ${appConfig.currencySymbol}${b.amount.toFixed(2)} (Lost)`
                              }
                            </span>
                          </div>

                        </div>
                      )}
                    </div>
                  );
                })}

                {totalBids === 0 && (
                  <div className="bg-[#181716]/30 border border-dashed border-[#3D2C08]/10 rounded-2xl p-8 text-center text-slate-500">
                    <FileText className="h-8 w-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-bold text-[10px]">No play logs found</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">Your prediction stakes will display here!</p>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalBids > bidsPerPage && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#181716]/60 border border-[#3D2C08]/10 rounded-xl mt-3 text-[10px]">
                  <button
                    disabled={myBidsPage === 1}
                    onClick={() => setMyBidsPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 rounded-lg font-black text-[#E5A93B] bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-slate-400 font-bold">
                    Page {myBidsPage} of {totalPages}
                  </span>
                  <button
                    disabled={myBidsPage >= totalPages}
                    onClick={() => setMyBidsPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1.5 rounded-lg font-black text-[#E5A93B] bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-40 disabled:hover:bg-amber-500/10 active:scale-95 transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
