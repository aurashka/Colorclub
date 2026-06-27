import React from 'react';
import { RoomType } from '../types';
import { Hourglass, Lock, Unlock, HelpCircle } from 'lucide-react';

interface TimerSectionProps {
  roomId: RoomType;
  setRoomId: (id: RoomType) => void;
  periodId: string;
  timeLeft: number;
  isLocked: boolean;
  totalDuration: number;
}

export default function TimerSection({
  roomId,
  setRoomId,
  periodId,
  timeLeft,
  isLocked,
  totalDuration,
}: TimerSectionProps) {
  // Format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Progress percentage
  const progressPercent = (timeLeft / totalDuration) * 100;

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>

      {/* Room Selection Toggle */}
      <div className="flex p-1 bg-slate-900/60 rounded-xl mb-6 border border-slate-800">
        <button
          onClick={() => setRoomId('parity')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${
            roomId === 'parity'
              ? 'bg-[#1E293B] text-emerald-400 border-emerald-500/20 shadow-md'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex flex-col items-center">
            <span className="text-sm">Parity Arena</span>
            <span className="text-[9px] font-mono opacity-60">1 Min Block</span>
          </div>
        </button>
        <button
          onClick={() => setRoomId('sapre')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer border ${
            roomId === 'sapre'
              ? 'bg-[#1E293B] text-purple-400 border-purple-500/20 shadow-md'
              : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <div className="flex flex-col items-center">
            <span className="text-sm">Sapre Arena</span>
            <span className="text-[9px] font-mono opacity-60">3 Min Block</span>
          </div>
        </button>
      </div>

      {/* Main Stats Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Left Side: Active Period Information */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-slate-400">
            <Hourglass className="h-4 w-4 animate-pulse text-blue-400" />
            <span className="text-[10px] font-bold tracking-widest uppercase">Current Prediction Block</span>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-black text-white tracking-tighter block font-mono">
              {periodId}
            </span>
            <span className="text-[10px] text-slate-500 font-mono block tracking-wide">
              Atomic Decentralized Epoch Timestamp
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isLocked ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                <Lock className="h-3 w-3" />
                <span>Locked</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Unlock className="h-3 w-3" />
                <span>Bidding Open</span>
              </span>
            )}
            <span className="text-[10px] text-slate-400 flex items-center space-x-1">
              <HelpCircle className="h-3 w-3 text-slate-500" />
              <span>Lock limits: {roomId === 'parity' ? '10s' : '30s'}</span>
            </span>
          </div>
        </div>

        {/* Right Side: Giant Visual Countdown */}
        <div className="flex flex-col items-center md:items-end justify-center">
          <div className="relative flex items-center justify-center w-full max-w-[240px]">
            <div className={`p-4 rounded-xl border text-center w-full transition-all duration-300 bg-slate-900/50 border-slate-700/60 ${
              isLocked 
                ? 'border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]' 
                : 'border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]'
            }`}>
              <span className="text-[9px] font-bold uppercase text-slate-500 block tracking-widest mb-1">
                Time Remaining
              </span>
              <span className={`text-3xl font-extrabold tracking-widest font-mono block ${isLocked ? 'text-rose-400' : 'text-white'}`}>
                {timeLeft > 0 ? (
                  <>
                    {formatTime(timeLeft).split(':')[0]}:
                    <span className={isLocked ? 'text-rose-500' : 'text-blue-400 font-black'}>
                      {formatTime(timeLeft).split(':')[1]}
                    </span>
                  </>
                ) : (
                  <span className="text-rose-500">00:00</span>
                )}
              </span>
            </div>
          </div>
          
          {/* Dynamic Progress Bar */}
          <div className="w-full max-w-[240px] bg-slate-950 h-2 rounded-full mt-3 overflow-hidden border border-slate-800">
            <div
              style={{ width: `${progressPercent}%` }}
              className={`h-full transition-all duration-1000 rounded-full ${
                isLocked ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : roomId === 'parity' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
