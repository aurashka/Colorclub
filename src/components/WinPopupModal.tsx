import React, { useEffect, useState } from 'react';
import { X, Award, Sparkles, TrendingUp, Zap, CheckCircle2 } from 'lucide-react';

interface WinPopupModalProps {
  periodId: string;
  roomId: string;
  totalBidsCount: number;
  totalWinAmount: number;
  resultText: string;
  gameTypeLabel: string;
  currencySymbol?: string;
  onClose: () => void;
}

interface ConfettiItem {
  id: number;
  x: number; // percentage left
  delay: number; // seconds delay
  duration: number; // seconds duration
  color: string;
  size: number; // size in pixels
  angle: number;
}

export const WinPopupModal: React.FC<WinPopupModalProps> = ({
  periodId,
  roomId,
  totalBidsCount,
  totalWinAmount,
  resultText,
  gameTypeLabel,
  currencySymbol = '₹',
  onClose,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);
  const [confetti, setConfetti] = useState<ConfettiItem[]>([]);

  // Generate confetti on mount
  useEffect(() => {
    const colors = [
      '#FCD34D', // Gold
      '#F59E0B', // Amber
      '#10B981', // Green
      '#3B82F6', // Blue
      '#EC4899', // Pink
      '#8B5CF6', // Purple
      '#EF4444', // Red
    ];
    const items: ConfettiItem[] = [];
    for (let i = 0; i < 60; i++) {
      items.push({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.5 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        angle: Math.random() * 360,
      });
    }
    setConfetti(items);
  }, []);

  // Countdown timer for auto-cancel after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* CSS Animations Styles injected locally to ensure absolute compatibility and portability */}
      <style>{`
        @keyframes float-particle {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(105vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes modal-bounce-in {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          70% {
            transform: scale(1.05);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        @keyframes ribbon-slide-up {
          0% {
            transform: translateY(20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes glow-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.4)) drop-shadow(0 0 20px rgba(245, 158, 11, 0.2));
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(245, 158, 11, 0.7)) drop-shadow(0 0 40px rgba(245, 158, 11, 0.4));
          }
        }
        .animate-float-particle {
          animation: float-particle linear infinite;
        }
        .animate-modal-bounce {
          animation: modal-bounce-in 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-ribbon {
          animation: ribbon-slide-up 0.5s ease-out 0.15s forwards;
        }
        .animate-glow {
          animation: glow-pulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Falling Confetti Particles overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confetti.map((item) => (
          <div
            key={item.id}
            className="absolute animate-float-particle"
            style={{
              left: `${item.x}%`,
              top: `-20px`,
              width: `${item.size}px`,
              height: `${item.size}px`,
              backgroundColor: item.color,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
              borderRadius: item.id % 3 === 0 ? '50%' : item.id % 3 === 1 ? '4px' : '0px',
              transform: `rotate(${item.angle}deg)`,
            }}
          />
        ))}
      </div>

      {/* Elegant Golden Achievement Card (inspired by user uploaded visual) */}
      <div 
        className="relative w-full max-w-[360px] rounded-3xl p-0.5 bg-gradient-to-b from-[#FFF2B2] via-[#E5A83B] to-[#7F530E] shadow-[0_20px_50px_rgba(245,158,11,0.25)] animate-modal-bounce overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent close on card click
      >
        {/* Soft Radial Background Reflection */}
        <div className="absolute inset-0 bg-radial-gradient from-white/20 via-transparent to-transparent pointer-events-none" />

        {/* Outer frame of luxury golden-cream cards */}
        <div className="rounded-[22px] bg-gradient-to-b from-[#FAF1D6] via-[#F4E3B4] to-[#DBBA72] p-6 text-slate-900 flex flex-col items-center relative">
          
          {/* Close/Cancel button */}
          <button 
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-950/10 hover:bg-slate-950/20 text-slate-800 hover:text-slate-950 transition-all cursor-pointer z-10"
            title="Dismiss prediction"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Luxury Flying Emblem (Winged Medallion with Rocket symbol just like user uploaded image!) */}
          <div className="relative mt-2 mb-4 animate-glow">
            {/* Outer golden wings background wrapper */}
            <div className="absolute -inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
              <div className="w-10 h-6 bg-gradient-to-r from-[#DF9F28] to-[#FFF0B3] opacity-40 rounded-l-full blur-[1px] rotate-12" />
              <div className="w-10 h-6 bg-gradient-to-l from-[#DF9F28] to-[#FFF0B3] opacity-40 rounded-r-full blur-[1px] -rotate-12" />
            </div>

            {/* Glowing gold medal circle */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#FFEAA3] via-[#E5A93C] to-[#8C5D0F] p-1 shadow-[0_8px_16px_rgba(140,93,15,0.4)] flex items-center justify-center relative">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#FFFDF0] to-[#E3AC3B] flex items-center justify-center shadow-inner">
                <div className="w-15 h-15 rounded-full bg-gradient-to-b from-[#F3C065] to-[#BF8819] flex items-center justify-center relative shadow-md">
                  {/* Rocket flying high inside golden badge */}
                  <Zap className="w-8 h-8 text-white fill-white animate-pulse" />
                </div>
              </div>
            </div>

            {/* Wing details (left and right golden leaves) */}
            <div className="absolute -top-1 -left-4 text-[#C18712] animate-bounce duration-1000">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="absolute -bottom-1 -right-3 text-[#C18712] animate-ping duration-1000 opacity-70">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          {/* Header Text */}
          <div className="text-center space-y-1 z-10">
            <h3 className="text-amber-900 font-extrabold tracking-[0.18em] uppercase text-xs">
              Prediction Winner
            </h3>
            <h2 className="text-2xl font-black bg-gradient-to-b from-[#6B3F04] to-[#A06C26] bg-clip-text text-transparent font-sans uppercase tracking-tight">
              Congratulations!
            </h2>
          </div>

          {/* White elegant curved ticket slip sliding out (inspired by user uploaded image!) */}
          <div className="w-full mt-4 mb-5 p-0.5 rounded-2xl bg-gradient-to-b from-[#E6B34A] to-[#B07F1A] shadow-[0_8px_20px_rgba(0,0,0,0.12)] relative animate-ribbon overflow-hidden">
            {/* Left/Right ticket side cutouts to feel like a real certificate coupon */}
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FAF1D6] border-r border-[#E6B34A]" />
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#FAF1D6] border-l border-[#E6B34A]" />

            <div className="bg-gradient-to-b from-white to-[#FFFDF5] rounded-[14px] px-6 py-5 text-center flex flex-col items-center relative">
              {/* Star highlights */}
              <div className="absolute top-2 left-3 text-amber-400 opacity-60">★</div>
              <div className="absolute bottom-2 right-3 text-amber-400 opacity-60">★</div>

              <span className="text-[10px] font-black tracking-widest text-[#B07F1A] uppercase">
                WINNING BONUS PRICE
              </span>
              <span className="text-3xl font-black text-slate-900 mt-1.5 mb-1 font-mono tracking-tight drop-shadow-sm">
                +{currencySymbol}{totalWinAmount.toFixed(2)}
              </span>
              
              <div className="flex items-center space-x-1.5 mt-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">
                  Success Credited
                </span>
              </div>
            </div>
          </div>

          {/* Detail parameters block */}
          <div className="w-full space-y-2.5 bg-slate-950/5 border border-slate-950/10 rounded-2xl p-4 text-xs font-medium text-slate-800 mb-5">
            <div className="flex justify-between items-center pb-1.5 border-b border-amber-900/10">
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Arena Type</span>
              <span className="text-[#6B3F04] font-black uppercase tracking-wide">{gameTypeLabel}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-amber-900/10">
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Period ID</span>
              <span className="text-[#6B3F04] font-mono font-black">{periodId}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-amber-900/10">
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Period Result</span>
              <span className="text-[#6B3F04] font-black uppercase tracking-wide">{resultText}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider">Successful Bets</span>
              <span className="text-[#6B3F04] font-bold">
                <strong className="text-emerald-700 font-extrabold font-mono text-sm">{totalBidsCount}</strong> bids won!
              </span>
            </div>
          </div>

          {/* Shrinking progress bar indicating the 5 second auto close */}
          <div className="w-full h-1 bg-amber-900/10 rounded-full overflow-hidden mb-4">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-[#8C5D0F] transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${(secondsLeft / 5) * 100}%` }}
            />
          </div>

          {/* Bottom Cancel / Close button */}
          <button
            onClick={onClose}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-b from-[#8C5D0F] to-[#513202] hover:from-[#9E6C1A] hover:to-[#5E3B04] text-white font-extrabold uppercase text-xs tracking-widest shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer text-center relative overflow-hidden"
          >
            {/* Shining highlight effect sweep */}
            <div className="absolute inset-0 w-1/2 h-full bg-white/10 skew-x-12 -translate-x-full hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
            Dismiss ({secondsLeft}s)
          </button>
        </div>
      </div>
    </div>
  );
};
