import React from 'react';
import { GamePeriod, RoomType } from '../types';
import { COLOR_MAP } from '../utils/gameUtils';
import { Sparkles, BarChart2, TrendingUp, Circle } from 'lucide-react';

interface HistorySectionProps {
  roomId: RoomType;
  history: GamePeriod[];
}

export default function HistorySection({ roomId, history }: HistorySectionProps) {
  // Filter history for the active room only and sort descending by periodId
  const roomHistory = history
    .filter((item) => item.roomId === roomId)
    .sort((a, b) => b.periodId.localeCompare(a.periodId));

  const recentHistory = roomHistory.slice(0, 30); // show up to 30 past games

  // Calculate statistics over recent history
  const totalRecords = recentHistory.length;
  let redCount = 0;
  let greenCount = 0;
  let violetCount = 0;
  const numCounts = Array(10).fill(0);

  recentHistory.forEach((item) => {
    numCounts[item.number]++;
    const mapping = COLOR_MAP[item.number as keyof typeof COLOR_MAP];
    if (mapping.colors.includes('red')) redCount++;
    if (mapping.colors.includes('green')) greenCount++;
    if (mapping.colors.includes('violet')) violetCount++;
  });

  const getPercentage = (count: number) => {
    if (totalRecords === 0) return '0%';
    return `${Math.round((count / totalRecords) * 100)}%`;
  };

  const getColorLabelClass = (color: string) => {
    if (color === 'green') return 'bg-emerald-600 text-white';
    if (color === 'red') return 'bg-rose-600 text-white';
    if (color === 'violet') return 'bg-violet-600 text-white';
    if (color === 'red-violet') return 'bg-gradient-to-r from-rose-500 to-violet-600 text-white';
    if (color === 'green-violet') return 'bg-gradient-to-r from-emerald-500 to-violet-600 text-white';
    return 'bg-slate-600 text-white';
  };

  const getNumberColorClass = (num: number) => {
    if (num === 0) return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
    if (num === 5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if ([1, 3, 7, 9].includes(num)) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  const getCircleGradient = (color: string) => {
    if (color === 'green') return 'bg-emerald-600';
    if (color === 'red') return 'bg-rose-600';
    if (color === 'violet') return 'bg-violet-600';
    if (color === 'red-violet') return 'bg-gradient-to-tr from-rose-500 to-violet-600';
    if (color === 'green-violet') return 'bg-gradient-to-tr from-emerald-500 to-violet-600';
    return 'bg-slate-600';
  };

  return (
    <div className="bg-[#1E293B] border border-slate-700/50 rounded-2xl p-6 shadow-xl font-sans space-y-8 text-slate-200">
      {/* Overview Analytics Banner */}
      <div>
        <div className="flex items-center space-x-2 text-slate-400 mb-4">
          <BarChart2 className="h-5 w-5 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Arena Trend Analytics (Last {totalRecords} Rounds)</h3>
        </div>

        {totalRecords === 0 ? (
          <div className="text-center py-8 bg-slate-900/40 border border-slate-800 rounded-xl text-slate-500 text-xs">
            No history generated yet. Results are created automatically at the end of each period!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Red Statistics */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">RED STREAK</span>
                <span className="text-2xl font-black text-white font-mono">{getPercentage(redCount)}</span>
              </div>
              <div className="h-10 w-10 bg-rose-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md">
                R
              </div>
            </div>

            {/* Green Statistics */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">GREEN STREAK</span>
                <span className="text-2xl font-black text-white font-mono">{getPercentage(greenCount)}</span>
              </div>
              <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md">
                G
              </div>
            </div>

            {/* Violet Statistics */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider block mb-1">VIOLET STREAK</span>
                <span className="text-2xl font-black text-white font-mono">{getPercentage(violetCount)}</span>
              </div>
              <div className="h-10 w-10 bg-violet-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md">
                V
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Circle Trend Chain */}
      {totalRecords > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <TrendingUp className="h-4 w-4 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Sequence Map (Chronological Left-to-Right)</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800 overflow-x-auto">
            <div className="flex space-x-3.5 min-w-max py-2">
              {[...recentHistory].reverse().map((item) => (
                <div key={item.periodId} className="flex flex-col items-center space-y-1.5">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center font-black text-white text-sm shadow-lg transition-transform hover:scale-110 ${getCircleGradient(item.color)}`}>
                    {item.number}
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono">...{item.periodId.slice(-3)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History List Table */}
      <div className="space-y-3">
        <div className="flex items-center space-x-1.5 text-slate-400">
          <Sparkles className="h-4 w-4 text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Detailed Period Records</span>
        </div>
        <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
          <table className="min-w-full divide-y divide-slate-800 text-left">
            <thead className="bg-slate-900/60 text-[10px] text-slate-400 uppercase tracking-widest font-bold font-mono">
              <tr>
                <th className="px-6 py-4">Period ID</th>
                <th className="px-6 py-4 text-center">Number</th>
                <th className="px-6 py-4">Color Outcome</th>
                <th className="px-6 py-4">Landing Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
              {recentHistory.map((item) => (
                <tr key={item.periodId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 font-bold font-mono text-slate-200">{item.periodId}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full font-black border font-mono ${getNumberColorClass(item.number)}`}>
                      {item.number}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${getColorLabelClass(item.color)}`}>
                      {item.premiumColor}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-500">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
