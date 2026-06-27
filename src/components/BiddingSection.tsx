import React, { useState } from 'react';
import { RoomType, BidRecord, UserProfile } from '../types';
import { Play, Flame, HelpCircle, CheckCircle2, Ticket, AlertTriangle } from 'lucide-react';

interface BiddingSectionProps {
  roomId: RoomType;
  periodId: string;
  isLocked: boolean;
  user: UserProfile;
  activeBids: BidRecord[];
  onPlaceBid: (selection: string, amount: number) => Promise<void>;
}

export default function BiddingSection({
  roomId,
  periodId,
  isLocked,
  user,
  activeBids,
  onPlaceBid,
}: BiddingSectionProps) {
  const [selectedSelection, setSelectedSelection] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(10);
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRules, setShowRules] = useState(false);

  const presets = [10, 50, 100, 500, 1000, 5000];

  const handleSelection = (selection: string) => {
    if (isLocked) return;
    setSelectedSelection(selection);
    setError('');
  };

  const handleBiddingSubmit = async () => {
    if (!selectedSelection) {
      setError('Please select a color or a number first!');
      return;
    }
    const totalCost = bidAmount * quantity;
    if (totalCost > user.wallet) {
      setError(`Insufficient wallet balance. You need $${totalCost.toFixed(2)}, but only have $${user.wallet.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onPlaceBid(selectedSelection, totalCost);
      // Reset after success
      setSelectedSelection(null);
      setQuantity(1);
    } catch (err: any) {
      setError(err.message || 'Failed to place bid.');
    } finally {
      setLoading(false);
    }
  };

  const getSelectionName = (sel: string) => {
    if (isNaN(Number(sel))) {
      return sel.toUpperCase();
    }
    return `Number ${sel}`;
  };

  const getSelectionColorClass = (sel: string) => {
    if (sel === 'green') return 'bg-emerald-600 hover:bg-emerald-500 text-white';
    if (sel === 'red') return 'bg-rose-600 hover:bg-rose-500 text-white';
    if (sel === 'violet') return 'bg-violet-600 hover:bg-violet-500 text-white';
    
    // Numbers color map
    const num = Number(sel);
    if (num === 0) return 'bg-gradient-to-r from-rose-500 to-violet-600 text-white';
    if (num === 5) return 'bg-gradient-to-r from-emerald-500 to-violet-600 text-white';
    if ([1, 3, 7, 9].includes(num)) return 'bg-emerald-600 hover:bg-emerald-500 text-white';
    return 'bg-rose-600 hover:bg-rose-500 text-white';
  };

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 shadow-xl font-sans space-y-6">
      {/* Header with quick rule button */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide uppercase">Place Prediction Bid</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Predict the next color or number to win high multipliers</p>
        </div>
        <button
          onClick={() => setShowRules(!showRules)}
          className="text-xs font-semibold text-slate-400 hover:text-blue-400 flex items-center space-x-1 border border-slate-700/60 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Rules</span>
        </button>
      </div>

      {/* Embedded Payout Rules */}
      {showRules && (
        <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-4 text-xs text-slate-300 space-y-2 animate-in fade-in duration-200">
          <p className="font-bold text-blue-400">🎯 Winning Payout Multipliers:</p>
          <ul className="list-disc pl-4 space-y-1 text-slate-300 leading-relaxed">
            <li><span className="font-semibold text-emerald-400">Green / Red Colors:</span> 2.0x standard payout. (If Violet split lands like 0 or 5, primary color gets 1.5x).</li>
            <li><span className="font-semibold text-violet-400">Violet Color:</span> 4.5x high payout (lands on number 0 or 5).</li>
            <li><span className="font-semibold text-blue-400">Specific Numbers (0 - 9):</span> 9.0x super jackpot payout!</li>
          </ul>
        </div>
      )}

      {isLocked && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-start space-x-3 text-rose-300">
          <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold block text-rose-400">Bidding Locked for Period {periodId}</span>
            <span className="leading-relaxed text-slate-400">Placing bids is suspended in the final countdown seconds to lock block records and finalize realtime outcome stream securely. Please wait for the next block.</span>
          </div>
        </div>
      )}

      {/* Selection Area */}
      <div className="space-y-5">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2.5">Select Color</span>
          <div className="grid grid-cols-3 gap-3">
            <button
              disabled={isLocked}
              onClick={() => handleSelection('green')}
              className={`py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                selectedSelection === 'green'
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-500 scale-95'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/20'
              }`}
            >
              <div className="h-2.5 w-2.5 bg-white rounded-full shadow-sm animate-pulse" />
              <span>Green (2.0x)</span>
            </button>

            <button
              disabled={isLocked}
              onClick={() => handleSelection('violet')}
              className={`py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                selectedSelection === 'violet'
                  ? 'bg-violet-700 text-white ring-2 ring-violet-500 scale-95'
                  : 'bg-[#7C3AED] hover:bg-violet-500 text-white shadow-lg shadow-violet-950/20'
              }`}
            >
              <div className="h-2.5 w-2.5 bg-white rounded-full shadow-sm animate-pulse" />
              <span>Violet (4.5x)</span>
            </button>

            <button
              disabled={isLocked}
              onClick={() => handleSelection('red')}
              className={`py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                selectedSelection === 'red'
                  ? 'bg-rose-700 text-white ring-2 ring-rose-500 scale-95'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/20'
              }`}
            >
              <div className="h-2.5 w-2.5 bg-white rounded-full shadow-sm animate-pulse" />
              <span>Red (2.0x)</span>
            </button>
          </div>
        </div>

        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2.5">Select Number (9.0x Payout Jackpot)</span>
          <div className="grid grid-cols-5 gap-2.5">
            {Array.from({ length: 10 }).map((_, idx) => {
              const numStr = String(idx);
              const colorClass = getSelectionColorClass(numStr);
              return (
                <button
                  key={idx}
                  disabled={isLocked}
                  onClick={() => handleSelection(numStr)}
                  className={`py-3.5 rounded-xl font-mono font-bold text-base sm:text-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex flex-col items-center justify-center ${colorClass} ${
                    selectedSelection === numStr
                      ? 'ring-4 ring-blue-500/50 scale-90 border border-white'
                      : 'hover:scale-105 border border-transparent'
                  }`}
                >
                  <span>{idx}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Amount and Multiplier Control Sheet */}
      {selectedSelection && (
        <div className="bg-slate-900/50 rounded-xl p-5 border border-slate-700/40 space-y-4 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Selected Target:</span>
            <span className={`px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest shadow-sm ${getSelectionColorClass(selectedSelection)}`}>
              {getSelectionName(selectedSelection)}
            </span>
          </div>

          {/* Amount Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Base Amount (USD)</span>
            <div className="grid grid-cols-6 gap-2">
              {presets.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setBidAmount(amt)}
                  className={`py-2 text-xs font-bold font-mono rounded-lg border transition-all cursor-pointer ${
                    bidAmount === amt
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Multiplier / Quantity Tracker */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Multiplier Bracket</span>
              <span className="text-[10px] text-slate-500">Multiplies the base selected amount</span>
            </div>
            <div className="flex items-center space-x-3 bg-slate-950 p-1.5 rounded-xl border border-slate-800 w-full sm:w-auto justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 font-bold flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-slate-400 hover:text-white text-lg"
              >
                -
              </button>
              <span className="font-bold text-white text-base font-mono w-8 text-center">{quantity}x</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-9 h-9 font-bold flex items-center justify-center rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-slate-400 hover:text-white text-lg"
              >
                +
              </button>
            </div>
          </div>

          {/* Real-time sum */}
          <div className="flex justify-between items-center pt-3.5 border-t border-slate-800">
            <span className="font-bold text-slate-300 text-xs uppercase tracking-wider">Total Ledger Cost:</span>
            <span className="font-mono font-black text-emerald-400 text-lg">
              ${(bidAmount * quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 rounded-xl text-xs flex items-center space-x-2">
          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Place Bid Button */}
      <button
        disabled={isLocked || !selectedSelection || loading}
        onClick={handleBiddingSubmit}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center space-x-2 transition-all disabled:opacity-20 disabled:pointer-events-none cursor-pointer shadow-lg shadow-blue-900/20 active:scale-[0.98]"
      >
        {loading ? (
          <span className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Locking prediction into ledger...</span>
          </span>
        ) : (
          <span className="flex items-center space-x-2">
            <Play className="h-4 w-4 fill-current" />
            <span>
              {selectedSelection
                ? `Confirm prediction: $${(bidAmount * quantity).toFixed(2)}`
                : 'Select prediction target'}
            </span>
          </span>
        )}
      </button>

      {/* User's Bids for Current Active Period */}
      {activeBids.length > 0 && (
        <div className="pt-5 border-t border-slate-800">
          <div className="flex items-center space-x-1.5 mb-3 text-emerald-400">
            <Ticket className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Active Stakes in block {periodId}</span>
          </div>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {activeBids.map((bid) => (
              <div
                key={bid.bidId}
                className="flex justify-between items-center bg-slate-900/50 p-3.5 rounded-xl border border-slate-800"
              >
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${getSelectionColorClass(bid.selection)}`}>
                    {getSelectionName(bid.selection)}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">ID: ...{bid.bidId.slice(-6)}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-200 font-mono block">${bid.amount.toFixed(2)}</span>
                  <span className="text-[9px] text-amber-400 font-semibold uppercase tracking-wider animate-pulse flex items-center justify-end gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-400" /> Pending Result
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
