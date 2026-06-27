import React, { useState, useEffect } from 'react';
import { Trophy, Rocket, Flame, ArrowRight, Volume2, Coins, ChevronRight, ShieldCheck, Sparkles, Award } from 'lucide-react';

interface HomeSectionProps {
  onLaunchGame: () => void;
  userPhone: string;
}

export default function HomeSection({ onLaunchGame, userPhone }: HomeSectionProps) {
  const [activeCategory, setActiveCategory] = useState<'lottery' | 'mini' | 'popular'>('lottery');
  const [tickerIndex, setTickerIndex] = useState(0);

  // Auto-scrolling ticker announcements
  const announcements = [
    "Welcome to Color Club! Get 100% bonus on your first deposit! 🏆",
    "Refer your friends using your unique referral code to earn lifetime commission! 💸",
    "Win Go 1-Min and 3-Min prediction rooms are now active. Start winning! 🔥",
    "System Update: Instant automated withdrawal settlements are online."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % announcements.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col space-y-4 font-sans text-slate-200 p-4">
      {/* Top Brand Header */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center space-x-2">
          {/* Clover-like 4 circle logo */}
          <div className="grid grid-cols-2 gap-[2px] w-6 h-6 rotate-45 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-base font-black tracking-wider text-[#E5A93B] uppercase">
            Color Club
          </span>
        </div>
      </div>

      {/* Interactive Sliding Promotion Banners */}
      <div className="relative overflow-x-auto flex space-x-3 pb-2 scrollbar-none snap-x snap-mandatory">
        {/* Banner 1: Member first deposit */}
        <div className="min-w-[85%] snap-center bg-gradient-to-r from-[#9A1E24] via-[#5C1014] to-[#1F0406] rounded-2xl p-4 flex flex-col justify-between h-32 border border-[#9A1E24]/20 shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-4 translate-y-4">
            <Trophy className="w-28 h-28 text-white" />
          </div>
          <div className="space-y-0.5 z-10">
            <h4 className="text-sm font-black text-white leading-tight tracking-tight uppercase">
              MEMBER'S FIRST<br />DEPOSIT BONUS
            </h4>
            <span className="text-[9px] text-[#FFD700] font-bold block">
              Deposit now and get instant bonus
            </span>
          </div>
          <p className="text-[10px] text-slate-300 font-medium z-10">
            Secure high-payout matching credits today!
          </p>
        </div>

        {/* Banner 2: Refer with friends */}
        <div className="min-w-[85%] snap-center bg-gradient-to-r from-[#1E3A8A] via-[#1E1B4B] to-[#0F172A] rounded-2xl p-4 flex flex-col justify-between h-32 border border-blue-500/20 shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-4 translate-y-4">
            <Coins className="w-28 h-28 text-white" />
          </div>
          <div className="space-y-0.5 z-10">
            <h4 className="text-sm font-black text-white leading-tight tracking-tight uppercase">
              REFER WITH YOUR<br />CLOSE FRIENDS
            </h4>
            <span className="text-[9px] text-blue-300 font-bold block">
              Refer with your link and earn commissions
            </span>
          </div>
          <p className="text-[10px] text-slate-300 font-medium z-10">
            Uncapped lifetime network payout!
          </p>
        </div>
      </div>

      {/* Scrolling Announce Marquee */}
      <div className="bg-[#121110] border border-[#E5A93B]/10 rounded-xl px-3 py-2 flex items-center space-x-2">
        <Volume2 className="h-3.5 w-3.5 text-[#E5A93B] shrink-0" />
        <div className="overflow-hidden relative w-full h-4">
          <div className="absolute inset-0 flex items-center">
            <span className="text-[10px] text-[#A27B2C] font-semibold truncate animate-in fade-in duration-300">
              {announcements[tickerIndex]}
            </span>
          </div>
        </div>
      </div>

      {/* Grid Menu: Categories on Left, Game Card on Right */}
      <div className="grid grid-cols-12 gap-3 pt-1">
        {/* Category List Tabs (3 Columns) */}
        <div className="col-span-4 flex flex-col space-y-2">
          {/* Category: Lottery */}
          <button
            onClick={() => setActiveCategory('lottery')}
            className={`flex flex-col items-center justify-center py-4 rounded-xl transition-all cursor-pointer border ${
              activeCategory === 'lottery'
                ? 'bg-gradient-to-b from-[#FFE194] via-[#E2B354] to-[#B07E2A] border-[#FFE194] text-[#3D2C08] shadow-md shadow-[#E2B354]/10'
                : 'bg-[#181716] border-[#3D2C08]/20 text-slate-400 hover:text-slate-300'
            }`}
          >
            <div className={`p-1.5 rounded-lg mb-1`}>
              <Trophy className={`w-5 h-5 ${activeCategory === 'lottery' ? 'text-[#3D2C08]' : 'text-[#E5A93B]'}`} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider">Lottery</span>
          </button>

          {/* Category: Mini */}
          <button
            onClick={() => setActiveCategory('mini')}
            className={`flex flex-col items-center justify-center py-4 rounded-xl transition-all cursor-pointer border ${
              activeCategory === 'mini'
                ? 'bg-gradient-to-b from-[#FFE194] via-[#E2B354] to-[#B07E2A] border-[#FFE194] text-[#3D2C08] shadow-md shadow-[#E2B354]/10'
                : 'bg-[#181716] border-[#3D2C08]/20 text-slate-400 hover:text-slate-300'
            }`}
          >
            <div className="p-1.5 rounded-lg mb-1">
              <Rocket className={`w-5 h-5 ${activeCategory === 'mini' ? 'text-[#3D2C08]' : 'text-rose-500'}`} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider">Mini</span>
          </button>

          {/* Category: Popular */}
          <button
            onClick={() => setActiveCategory('popular')}
            className={`flex flex-col items-center justify-center py-4 rounded-xl transition-all cursor-pointer border ${
              activeCategory === 'popular'
                ? 'bg-gradient-to-b from-[#FFE194] via-[#E2B354] to-[#B07E2A] border-[#FFE194] text-[#3D2C08] shadow-md shadow-[#E2B354]/10'
                : 'bg-[#181716] border-[#3D2C08]/20 text-slate-400 hover:text-slate-300'
            }`}
          >
            <div className="p-1.5 rounded-lg mb-1">
              <Flame className={`w-5 h-5 ${activeCategory === 'popular' ? 'text-[#3D2C08]' : 'text-amber-500'}`} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider">Popular</span>
          </button>
        </div>

        {/* Big Interactive Card: Win Go Launcher (8 Columns) */}
        <div className="col-span-8 flex flex-col">
          {activeCategory === 'lottery' ? (
            <button
              onClick={onLaunchGame}
              className="flex-1 bg-gradient-to-br from-[#FFE194] via-[#E2B354] to-[#B07E2A] text-[#3D2C08] rounded-2xl p-4 flex flex-col justify-between text-left shadow-lg relative overflow-hidden transition-all duration-300 cursor-pointer active:scale-98 group border border-[#FFE194]/40"
            >
              {/* Overlay bingo balls */}
              <div className="absolute right-2 top-8 flex items-center space-x-1 opacity-95 transform rotate-12 transition-transform group-hover:scale-110">
                <span className="h-8 w-8 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full font-bold text-xs text-white flex items-center justify-center shadow-md font-mono border border-white/20">9</span>
                <span className="h-8 w-8 bg-gradient-to-br from-rose-400 via-rose-500 to-violet-700 rounded-full font-bold text-xs text-white flex items-center justify-center shadow-md font-mono border border-white/20">0</span>
                <span className="h-8 w-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full font-bold text-xs text-white flex items-center justify-center shadow-md font-mono border border-white/20">4</span>
              </div>

              <div>
                <h3 className="text-xl font-black uppercase tracking-tight leading-none text-[#3D2C08]">
                  Win Go
                </h3>
                <p className="text-[10px] font-bold text-[#3D2C08]/85 mt-2">
                  Guess Number / Color
                </p>
                <p className="text-[9px] text-[#3D2C08]/75 leading-tight font-semibold">
                  Green/Red/Violet To Win
                </p>
              </div>

              <div className="flex items-center space-x-1 text-[10px] font-bold bg-[#3D2C08] text-[#FFE194] rounded-full px-3 py-1 w-max shadow-md transition-transform group-hover:translate-x-1">
                <span>Play Now</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ) : activeCategory === 'mini' ? (
            <div className="flex-1 bg-[#181716] border border-[#3D2C08]/20 rounded-2xl p-4 flex flex-col justify-between text-left">
              <div className="space-y-1">
                <span className="text-[8px] font-bold uppercase bg-slate-950 border border-slate-900 text-[#E5A93B] px-2 py-0.5 rounded">Mini Games</span>
                <h4 className="text-sm font-black text-white mt-1">Aviator Cruise</h4>
                <p className="text-[9px] text-slate-400 leading-relaxed">Our physical flight-prediction curve lobby is syncing on the blockchain.</p>
              </div>
              <button
                onClick={onLaunchGame}
                className="mt-3 bg-[#E2B354]/10 hover:bg-[#E2B354]/20 text-[#E5A93B] border border-[#E5A93B]/20 rounded-xl py-2 px-3 text-[9px] font-bold uppercase tracking-wider flex items-center justify-between"
              >
                <span>Play Win Go Instead</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex-1 bg-[#181716] border border-[#3D2C08]/20 rounded-2xl p-4 flex flex-col justify-between text-left">
              <div className="space-y-1">
                <span className="text-[8px] font-bold uppercase bg-slate-950 border border-slate-900 text-[#E5A93B] px-2 py-0.5 rounded">Trending 2026</span>
                <h4 className="text-sm font-black text-white mt-1">Jackpot Wheel</h4>
                <p className="text-[9px] text-slate-400 leading-relaxed">High multipliers and spinning wheel games. Currently under sync validation.</p>
              </div>
              <button
                onClick={onLaunchGame}
                className="mt-3 bg-[#E2B354]/10 hover:bg-[#E2B354]/20 text-[#E5A93B] border border-[#E5A93B]/20 rounded-xl py-2 px-3 text-[9px] font-bold uppercase tracking-wider flex items-center justify-between"
              >
                <span>Play Win Go Instead</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Outlined View More Button Row */}
      <div className="pt-2">
        <button
          onClick={onLaunchGame}
          className="w-full border border-[#E5A93B] text-[#E5A93B] py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer bg-transparent hover:bg-[#E5A93B]/5"
        >
          <div className="flex space-x-[3px] items-center">
            <span className="w-1 h-3 bg-[#E5A93B] rounded-full" />
            <span className="w-1 h-3 bg-[#E5A93B] rounded-full" />
            <span className="w-1 h-3 bg-[#E5A93B] rounded-full" />
          </div>
          <span>View More</span>
        </button>
      </div>

      {/* Decorative safety badge card */}
      <div className="bg-[#121110] border border-[#3D2C08]/25 rounded-xl p-3 flex items-start space-x-3 text-slate-400">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-[9px] space-y-0.5">
          <span className="font-bold text-slate-300 block">Secured Prediction Engine</span>
          <p className="leading-relaxed">All round calculations utilize decentralized, auditable UTC timestamps to prevent system manipulation and secure your stakes.</p>
        </div>
      </div>
    </div>
  );
}

