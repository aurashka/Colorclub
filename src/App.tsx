import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, onValue, set, get, update, remove } from 'firebase/database';
import { RoomType, UserProfile, GamePeriod, BidRecord, DepositRequest, WithdrawalRequest } from './types';
import { getPeriodDetails, generatePeriodResult, calculateBidResult } from './utils/gameUtils';

// Components
import LoginSignup from './components/LoginSignup';
import HomeSection from './components/HomeSection';
import GameSection from './components/GameSection';
import ProfileSection from './components/ProfileSection';
import WalletSection from './components/WalletSection';
import AdminPanel from './components/AdminPanel';

import { 
  Home as HomeIcon, Sparkles, User, ArrowLeft, ShieldCheck, 
  HelpCircle, AlertCircle, ChevronLeft
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'game' | 'profile'>('home');
  const [activeSubView, setActiveSubView] = useState<'wallet' | 'admin' | null>(null);
  const [walletSubTab, setWalletSubTab] = useState<'deposit' | 'withdrawal' | 'history'>('deposit');
  const [roomId, setRoomId] = useState<RoomType>('parity');

  // Real-time synced state lists
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<GamePeriod[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeBids, setActiveBids] = useState<BidRecord[]>([]);
  
  // Game state controls
  const [periodDetails, setPeriodDetails] = useState(getPeriodDetails('parity'));
  const [currentOverrides, setCurrentOverrides] = useState<{ [roomId: string]: number }>({});

  // Track previous period IDs for transition checking (both rooms)
  const prevPeriodIdParity = useRef<string>('');
  const prevPeriodIdSapre = useRef<string>('');

  // 1. Restore login session on mount
  useEffect(() => {
    const savedPhone = localStorage.getItem('prism_user_phone');
    if (savedPhone) {
      const userRef = ref(db, `users/${savedPhone}`);
      get(userRef).then((snap) => {
        if (snap.exists()) {
          setUser(snap.val() as UserProfile);
        } else {
          localStorage.removeItem('prism_user_phone');
        }
      });
    }
  }, []);

  // 2. Real-time subscriber for logged-in User profile & wallet balance
  useEffect(() => {
    if (!user?.phone) return;
    const userRef = ref(db, `users/${user.phone}`);
    const unsubscribe = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as UserProfile;
        setUser(data);
      }
    });
    return () => unsubscribe();
  }, [user?.phone]);

  // 3. Real-time subscriber for general database records
  useEffect(() => {
    // History
    const historyRef = ref(db, 'history');
    const unsubscribeHistory = onValue(historyRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list: GamePeriod[] = [];
        Object.keys(data).forEach((roomKey) => {
          const roomObj = data[roomKey];
          Object.keys(roomObj).forEach((pKey) => {
            list.push({
              periodId: pKey,
              roomId: roomKey as RoomType,
              ...roomObj[pKey],
            });
          });
        });
        setHistory(list);
      } else {
        setHistory([]);
      }
    });

    // Deposits
    const depositsRef = ref(db, 'deposits');
    const unsubscribeDeposits = onValue(depositsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data).map((key) => ({
          depositId: key,
          ...data[key],
        })) as DepositRequest[];
        setDeposits(list);
      } else {
        setDeposits([]);
      }
    });

    // Withdrawals
    const withdrawalsRef = ref(db, 'withdrawals');
    const unsubscribeWithdrawals = onValue(withdrawalsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data).map((key) => ({
          withdrawalId: key,
          ...data[key],
        })) as WithdrawalRequest[];
        setWithdrawals(list);
      } else {
        setWithdrawals([]);
      }
    });

    // Overrides
    const overridesRef = ref(db, 'admin_control/active_period_override');
    const unsubscribeOverrides = onValue(overridesRef, (snap) => {
      if (snap.exists()) {
        setCurrentOverrides(snap.val());
      } else {
        setCurrentOverrides({});
      }
    });

    return () => {
      unsubscribeHistory();
      unsubscribeDeposits();
      unsubscribeWithdrawals();
      unsubscribeOverrides();
    };
  }, []);

  // 4. Subscriber for All Bids in the database
  useEffect(() => {
    const bidsRef = ref(db, 'bids');
    const unsubscribeBids = onValue(bidsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list: BidRecord[] = [];
        // Data format: /bids/{roomId}/{periodId}/{userId}/{bidId}
        Object.keys(data).forEach((roomKey) => {
          const roomObj = data[roomKey];
          Object.keys(roomObj).forEach((pKey) => {
            const periodObj = roomObj[pKey];
            Object.keys(periodObj).forEach((uKey) => {
              const userObj = periodObj[uKey];
              Object.keys(userObj).forEach((bKey) => {
                list.push({
                  bidId: bKey,
                  roomId: roomKey as RoomType,
                  periodId: pKey,
                  userId: uKey,
                  ...userObj[bKey],
                });
              });
            });
          });
        });
        setActiveBids(list);
      } else {
        setActiveBids([]);
      }
    });

    return () => unsubscribeBids();
  }, []);

  // 5. Admin-only subscription: Users list
  useEffect(() => {
    if (!user?.isAdmin) return;
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data).map((key) => ({
          uid: data[key].uid,
          ...data[key],
        })) as UserProfile[];
        setUsersList(list);
      } else {
        setUsersList([]);
      }
    });
    return () => unsubscribeUsers();
  }, [user?.isAdmin]);

  // 6. Global game timer ticks (Synchronized)
  useEffect(() => {
    // Initial load
    const currentParity = getPeriodDetails('parity');
    const currentSapre = getPeriodDetails('sapre');
    prevPeriodIdParity.current = currentParity.periodId;
    prevPeriodIdSapre.current = currentSapre.periodId;

    const interval = setInterval(() => {
      // Update timer states
      const activeDetails = getPeriodDetails(roomId);
      setPeriodDetails(activeDetails);

      // Check transitions for both Parity (1m) and Sapre (3m) in the background
      const detailsParity = getPeriodDetails('parity');
      const detailsSapre = getPeriodDetails('sapre');

      if (detailsParity.periodId !== prevPeriodIdParity.current) {
        const oldPeriodId = prevPeriodIdParity.current;
        prevPeriodIdParity.current = detailsParity.periodId;
        handlePeriodTransition('parity', oldPeriodId);
      }

      if (detailsSapre.periodId !== prevPeriodIdSapre.current) {
        const oldPeriodId = prevPeriodIdSapre.current;
        prevPeriodIdSapre.current = detailsSapre.periodId;
        handlePeriodTransition('sapre', oldPeriodId);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId]);

  // Settle periods dynamically (Cooperative Sync engine)
  const handlePeriodTransition = async (roomKey: RoomType, oldPeriodId: string) => {
    console.log(`Transitioning ${roomKey} period: ${oldPeriodId}`);
    try {
      // 1. Check if result already exists in history
      const historyRecordRef = ref(db, `history/${roomKey}/${oldPeriodId}`);
      const historySnap = await get(historyRecordRef);
      
      let winningNum: number;

      if (historySnap.exists()) {
        winningNum = historySnap.val().number;
      } else {
        // Result doesn't exist yet! Let's build it (Cooperative single writer)
        // Check if administrator set an override
        const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
        const overrideSnap = await get(overrideRef);
        
        if (overrideSnap.exists() && overrideSnap.val() !== null) {
          winningNum = Number(overrideSnap.val());
          // Consume override
          await remove(overrideRef);
        } else {
          // Organic random choice
          winningNum = Math.floor(Math.random() * 10);
        }

        // Generate and save historical result
        const resultRecord = generatePeriodResult(oldPeriodId, roomKey, winningNum);
        await set(historyRecordRef, resultRecord);
      }

      // 2. Query and Settle Bids for this period
      const bidsPath = `bids/${roomKey}/${oldPeriodId}`;
      const periodBidsRef = ref(db, bidsPath);
      const bidsSnap = await get(periodBidsRef);

      if (bidsSnap.exists()) {
        const usersBidsData = bidsSnap.val();
        // Settle each user's bids
        for (const uid of Object.keys(usersBidsData)) {
          const userBids = usersBidsData[uid];
          for (const bidId of Object.keys(userBids)) {
            const bid = userBids[bidId];
            if (bid.status === 'pending') {
              const { status, winAmount } = calculateBidResult(bid.selection, bid.amount, winningNum);
              
              // Update bid status
              await update(ref(db, `${bidsPath}/${uid}/${bidId}`), {
                status,
                winAmount
              });

              // Credit winnings back to user balance in realtime
              if (status === 'won' && winAmount > 0) {
                const userProfileRef = ref(db, `users/${bid.phone}`);
                const currentProfileSnap = await get(userProfileRef);
                if (currentProfileSnap.exists()) {
                  const currentProfile = currentProfileSnap.val() as UserProfile;
                  const newWallet = (currentProfile.wallet || 0) + winAmount;
                  await update(userProfileRef, { wallet: newWallet });
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error settling transition for ${roomKey}/${oldPeriodId}:`, err);
    }
  };

  // Auth handles
  const handleLoginSuccess = (profile: UserProfile) => {
    setUser(profile);
    localStorage.setItem('prism_user_phone', profile.phone);
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('prism_user_phone');
    setActiveSubView(null);
    setActiveTab('home');
  };

  // User Game Operations: Placing Bids
  const handlePlaceBid = async (selection: string, totalCost: number) => {
    if (!user) throw new Error('Not logged in.');
    
    // Check lock boundary again
    const currentDetails = getPeriodDetails(roomId);
    if (currentDetails.isLocked) {
      throw new Error('This prediction round is already locked. Please wait for the next block to start.');
    }

    // Double check balance
    const userProfileRef = ref(db, `users/${user.phone}`);
    const userSnap = await get(userProfileRef);
    if (!userSnap.exists()) throw new Error('User account not found.');
    const activeProfile = userSnap.val() as UserProfile;
    
    if (activeProfile.wallet < totalCost) {
      throw new Error(`Insufficient wallet balance. Total cost: $${totalCost.toFixed(2)}, available: $${activeProfile.wallet.toFixed(2)}.`);
    }

    // 1. Deduct wallet balance from database
    const newWallet = activeProfile.wallet - totalCost;
    await update(userProfileRef, { wallet: newWallet });

    // 2. Save bid record
    const bidId = `bid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const bidRecordRef = ref(db, `bids/${roomId}/${currentDetails.periodId}/${user.uid}/${bidId}`);
    
    const record: Partial<BidRecord> = {
      phone: user.phone,
      nickname: user.nickname,
      selection: selection as any,
      amount: totalCost,
      status: 'pending',
      winAmount: 0,
      createdAt: Date.now()
    };
    
    await set(bidRecordRef, record);
  };

  // Wallet operations: Deposits Claims
  const handleDepositSubmit = async (amount: number, utr: string) => {
    if (!user) return;
    const depositId = `dep_${Date.now()}`;
    const depositRef = ref(db, `deposits/${depositId}`);
    
    const request: DepositRequest = {
      depositId,
      userId: user.uid,
      phone: user.phone,
      nickname: user.nickname,
      amount,
      utr,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await set(depositRef, request);
  };

  // Wallet operations: Withdrawals Requests
  const handleWithdrawalSubmit = async (
    amount: number,
    bankName: string,
    accountNumber: string,
    ifsc: string,
    upi: string
  ) => {
    if (!user) return;

    // Deduct held balance immediately from wallet
    const userProfileRef = ref(db, `users/${user.phone}`);
    const snap = await get(userProfileRef);
    if (!snap.exists()) throw new Error('User not found.');
    const profile = snap.val() as UserProfile;

    if (profile.wallet < amount) {
      throw new Error('Insufficient wallet funds.');
    }

    // Hold the amount
    const newWallet = profile.wallet - amount;
    await update(userProfileRef, { wallet: newWallet });

    const withdrawalId = `with_${Date.now()}`;
    const withdrawalRef = ref(db, `withdrawals/${withdrawalId}`);

    const request: WithdrawalRequest = {
      withdrawalId,
      userId: user.uid,
      phone: user.phone,
      nickname: user.nickname,
      amount,
      bankName: bankName || '',
      accountNumber: accountNumber || '',
      ifsc: ifsc || '',
      upi: upi || '',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(withdrawalRef, request);
  };

  // Admin Ledger operations: Adjust wallet balance directly
  const handleUpdateUserWallet = async (phone: string, newBalance: number) => {
    if (!user?.isAdmin) return;
    const userRef = ref(db, `users/${phone}`);
    await update(userRef, { wallet: newBalance });
  };

  // Admin Request operations: handle deposits approval/rejections/holds
  const handleDepositAction = async (
    depositId: string,
    status: 'approved' | 'rejected' | 'hold',
    holdReason?: string
  ) => {
    if (!user?.isAdmin) return;
    
    const depositRef = ref(db, `deposits/${depositId}`);
    const depSnap = await get(depositRef);
    if (!depSnap.exists()) return;
    const depRequest = depSnap.val() as DepositRequest;

    if (depRequest.status === 'approved') return; // already approved

    // Update state
    await update(depositRef, {
      status,
      holdReason: holdReason || null,
      updatedAt: Date.now()
    });

    // If approved, add money to user's wallet
    if (status === 'approved') {
      const userRef = ref(db, `users/${depRequest.phone}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const uProfile = userSnap.val() as UserProfile;
        const newBal = (uProfile.wallet || 0) + depRequest.amount;
        await update(userRef, { wallet: newBal });
      }
    }
  };

  // Admin Request operations: handle withdrawals approval/rejections/holds
  const handleWithdrawalAction = async (
    withdrawalId: string,
    status: 'approved' | 'rejected' | 'hold',
    holdReason?: string
  ) => {
    if (!user?.isAdmin) return;

    const withdrawalRef = ref(db, `withdrawals/${withdrawalId}`);
    const withSnap = await get(withdrawalRef);
    if (!withSnap.exists()) return;
    const withRequest = withSnap.val() as WithdrawalRequest;

    if (withRequest.status === 'approved') return; // already processed

    // Update state
    await update(withdrawalRef, {
      status,
      holdReason: holdReason || null,
      updatedAt: Date.now()
    });

    // If rejected, return held funds to user's wallet
    if (status === 'rejected') {
      const userRef = ref(db, `users/${withRequest.phone}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const uProfile = userSnap.val() as UserProfile;
        const newBal = (uProfile.wallet || 0) + withRequest.amount;
        await update(userRef, { wallet: newBal });
      }
    }
  };

  // Admin Manipulation overrides
  const handleSetWinningOverride = async (roomKey: RoomType, num: number) => {
    if (!user?.isAdmin) return;
    const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
    await set(overrideRef, num);
  };

  const handleClearWinningOverride = async (roomKey: RoomType) => {
    if (!user?.isAdmin) return;
    const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
    await remove(overrideRef);
  };

  // Unauthenticated view (Wrapped in smartphone simulator)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-0 md:p-6 lg:p-8 font-sans selection:bg-amber-500/30">
        <div className="w-full h-screen md:h-[860px] md:max-w-[430px] md:rounded-[36px] md:border-[10px] md:border-slate-900 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] bg-[#0F172A] flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <LoginSignup onLoginSuccess={handleLoginSuccess} />
          </div>
        </div>
      </div>
    );
  }

  // Filter pending active user bids for the current active period & active room
  const userActiveBids = activeBids.filter(
    (b) => b.userId === user.uid && b.periodId === periodDetails.periodId && b.roomId === roomId
  );

  const userRoomBids = activeBids.filter(
    (b) => b.userId === user.uid && b.roomId === roomId
  );

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-0 md:p-6 lg:p-8 font-sans selection:bg-amber-500/30">
      {/* Smartphone Container */}
      <div className="w-full h-screen md:h-[860px] md:max-w-[430px] md:rounded-[36px] md:border-[10px] md:border-slate-900 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] bg-[#0F172A] flex flex-col relative overflow-hidden">
        
        {/* Scrollable Viewport (Height reserved for bottom bar if no subview is open) */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${activeSubView ? 'pb-4' : 'pb-20'} custom-scrollbar relative bg-[#0D121F]`}>
          
          {/* Subview Layer: Wallet */}
          {activeSubView === 'wallet' && (
            <div className="animate-in fade-in duration-300">
              {/* Back Header */}
              <div className="flex items-center space-x-2 bg-[#0B0F17] p-4 sticky top-0 border-b border-slate-900/80 z-30">
                <button 
                  onClick={() => setActiveSubView(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  Wallet Settle Centre
                </span>
              </div>
              <div className="p-1">
                <WalletSection
                  user={user}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  onDepositSubmit={handleDepositSubmit}
                  onWithdrawalSubmit={handleWithdrawalSubmit}
                />
              </div>
            </div>
          )}

          {/* Subview Layer: Admin */}
          {activeSubView === 'admin' && user.isAdmin && (
            <div className="animate-in fade-in duration-300">
              {/* Back Header */}
              <div className="flex items-center space-x-2 bg-[#0B0F17] p-4 sticky top-0 border-b border-slate-900/80 z-30">
                <button 
                  onClick={() => setActiveSubView(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-black uppercase text-purple-400 tracking-wider">
                  Admin Control panel
                </span>
              </div>
              <div className="p-1">
                <AdminPanel
                  users={usersList}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  activeBids={activeBids}
                  activePeriodIdParity={getPeriodDetails('parity').periodId}
                  activePeriodIdSapre={getPeriodDetails('sapre').periodId}
                  onUpdateUserWallet={handleUpdateUserWallet}
                  onHandleDeposit={handleDepositAction}
                  onHandleWithdrawal={handleWithdrawalAction}
                  onSetWinningOverride={handleSetWinningOverride}
                  onClearWinningOverride={handleClearWinningOverride}
                  currentOverrides={currentOverrides}
                />
              </div>
            </div>
          )}

          {/* Main Tab Layer (When no subview is open) */}
          {!activeSubView && (
            <>
              {activeTab === 'home' && (
                <HomeSection 
                  onLaunchGame={() => setActiveTab('game')} 
                  userPhone={user.phone} 
                />
              )}
              {activeTab === 'game' && (
                <GameSection
                  roomId={roomId}
                  setRoomId={setRoomId}
                  periodId={periodDetails.periodId}
                  timeLeft={periodDetails.timeLeft}
                  isLocked={periodDetails.isLocked}
                  totalDuration={periodDetails.totalDuration}
                  user={user}
                  activeBids={userActiveBids}
                  userAllBids={userRoomBids}
                  history={history}
                  onPlaceBid={handlePlaceBid}
                  onNavigateToWallet={(subTab) => {
                    setActiveSubView('wallet');
                  }}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileSection
                  user={user}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  onSignOut={handleSignOut}
                  onNavigateToWallet={(subTab) => {
                    setActiveSubView('wallet');
                  }}
                  onNavigateToAdmin={() => setActiveSubView('admin')}
                />
              )}
            </>
          )}

        </div>

        {/* Bottom Mobile Navigation Bar (Visible only when no full-view subview is active) */}
        {!activeSubView && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#121110]/95 border-t border-[#3D2C08]/15 flex justify-around items-center px-4 py-2 z-40 backdrop-blur-md">
            
            {/* Home Tab Button */}
            <button
              onClick={() => {
                setActiveSubView(null);
                setActiveTab('home');
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'home' ? 'text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform ${activeTab === 'home' ? 'bg-amber-500/10 scale-105 text-amber-400' : 'text-slate-500'}`}>
                <HomeIcon className="w-5 h-5" />
              </div>
              <span className="text-[9px] mt-0.5 tracking-wider uppercase font-black">Home</span>
            </button>

            {/* Game Tab Button (Color Club) */}
            <button
              onClick={() => {
                setActiveSubView(null);
                setActiveTab('game');
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'game' ? 'text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform ${activeTab === 'game' ? 'bg-amber-500/10 scale-105 text-amber-400' : 'text-slate-500'}`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-[9px] mt-0.5 tracking-wider uppercase font-black">Color Club</span>
            </button>

            {/* Profile Tab Button */}
            <button
              onClick={() => {
                setActiveSubView(null);
                setActiveTab('profile');
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer ${
                activeTab === 'profile' ? 'text-amber-400 font-extrabold' : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <div className={`p-1 rounded-full transition-transform ${activeTab === 'profile' ? 'bg-amber-500/10 scale-105 text-amber-400' : 'text-slate-500'}`}>
                <User className="w-5 h-5" />
              </div>
              <span className="text-[9px] mt-0.5 tracking-wider uppercase font-black">Profile</span>
            </button>

          </div>
        )}

        {/* Floating Android Gesture Navigation Pill Indicator */}
        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-28 h-1 bg-slate-800 rounded-full select-none pointer-events-none z-50 opacity-40" />

      </div>
    </div>
  );
}
