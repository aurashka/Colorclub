import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, onValue, set, get, update, remove, query, limitToLast } from 'firebase/database';
import { RoomType, UserProfile, GamePeriod, BidRecord, DepositRequest, WithdrawalRequest, DepositChannel, DepositChannelField, WithdrawalField, AppConfig } from './types';
import { getPeriodDetails, generatePeriodResult, calculateBidResult, getRecentPeriodIds, getDeterministicResult, getDeterministicNumber } from './utils/gameUtils';
import { WinPopupModal } from './components/WinPopupModal';
import { playWinSound, playLossSound } from './utils/audioUtils';

// Components
import LoginSignup from './components/LoginSignup';
import HomeSection from './components/HomeSection';
import GameSection from './components/GameSection';
import ProfileSection from './components/ProfileSection';
import ProfileSheets from './components/ProfileSheets';
import WalletSection from './components/WalletSection';
import AdminPanel from './components/AdminPanel';
import CompleteProfileModal from './components/CompleteProfileModal';
import UserSupportChat from './components/UserSupportChat';

import { 
  Home as HomeIcon, Sparkles, User, ArrowLeft, ShieldCheck, 
  HelpCircle, AlertCircle, ChevronLeft
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'game' | 'profile' | 'login'>('game');
  const [showLoginPrompt, setShowLoginPrompt] = useState<boolean>(false);
  const [activeSubView, setActiveSubView] = useState<'deposit' | 'withdrawal' | 'admin' | 'support' | null>(null);
  const [walletSubTab, setWalletSubTab] = useState<'deposit' | 'withdrawal' | 'history'>('deposit');
  const [roomId, setRoomId] = useState<RoomType>('1m');
  const [activeProfileSheet, setActiveProfileSheet] = useState<string | null>(null);
  const [userUnreadSupportCount, setUserUnreadSupportCount] = useState(0);
  const [selectedSelection, setSelectedSelection] = useState<string | null>(null);
  const isPoppingRef = React.useRef(false);
  
  const [appConfig, setAppConfig] = useState<AppConfig>({
    appName: 'L7 LOTTERY7',
    minDeposit: 100,
    maxDeposit: 500000,
    minWithdrawal: 200,
    maxWithdrawal: 100000,
    telegramSupport: '@customer_service',
    whatsappSupport: '+919876543210',
    currencySymbol: '₹',
    currencyName: 'INR'
  });

  // Real-time synced state lists
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [history, setHistory] = useState<GamePeriod[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeBids, setActiveBids] = useState<BidRecord[]>([]);
  
  // States and refs for Win/Loss Sound and Win Popup
  const [winPopupDetails, setWinPopupDetails] = useState<{
    periodId: string;
    roomId: string;
    totalBidsCount: number;
    totalWinAmount: number;
    resultText: string;
    gameTypeLabel: string;
  } | null>(null);

  const processedBidsRef = useRef<Set<string>>(new Set());
  const initialBidsProcessedRef = useRef(false);
  
  // Game state controls
  const [periodDetails, setPeriodDetails] = useState(getPeriodDetails('1m'));
  const [currentOverrides, setCurrentOverrides] = useState<{ [roomId: string]: number }>({});
  const [presetResults, setPresetResults] = useState<{ [roomId: string]: { [periodId: string]: number } }>({});

  // Combine real database records with generated fallback records for a complete, continuous sequence
  const unifiedHistory = React.useMemo(() => {
    const list: GamePeriod[] = [];
    const rooms: RoomType[] = ['30s', '1m', '3m'];
    
    // Map existing history records by roomKey and periodId for fast lookup
    const dbHistoryMap: { [room: string]: { [period: string]: GamePeriod } } = {};
    rooms.forEach((r) => {
      dbHistoryMap[r] = {};
    });
    
    // Fill dbHistoryMap with real database records
    history.forEach((item) => {
      if (dbHistoryMap[item.roomId]) {
        dbHistoryMap[item.roomId][item.periodId] = item;
      }
    });
    
    rooms.forEach((roomKey) => {
      // Retrieve the last 60 period IDs for this arena to show a complete trend list
      const recentIds = getRecentPeriodIds(roomKey, 60);
      recentIds.forEach((pId) => {
        if (dbHistoryMap[roomKey][pId]) {
          list.push(dbHistoryMap[roomKey][pId]);
        } else {
          list.push(getDeterministicResult(pId, roomKey));
        }
      });
      
      // Also add any older database records that are not in the top 60 list, to preserve any custom matches in history
      Object.keys(dbHistoryMap[roomKey]).forEach((pId) => {
        if (!recentIds.includes(pId)) {
          list.push(dbHistoryMap[roomKey][pId]);
        }
      });
    });
    
    return list;
  }, [history]);

  // Payment gateways / forms custom settings (India UPI and banking)
  const [depositChannels, setDepositChannels] = useState<DepositChannel[]>([
    {
      id: 'paytm_qr',
      name: 'Paytm QR Speed',
      type: 'qr',
      bonus: 0.20,
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=pay@upi&pn=WinGo',
      upiId: 'pay@upi',
      requiredFields: [
        { id: 'utr', label: 'UTR Number / Reference (12 digits)', placeholder: 'e.g. 302918273645', type: 'text', required: true }
      ]
    },
    {
      id: 'upi_transfer',
      name: 'UPI Instant',
      type: 'upi',
      bonus: 0.15,
      upiId: 'pay@upi',
      requiredFields: [
        { id: 'utr', label: 'Transaction ID / UTR', placeholder: 'Enter UPI reference number', type: 'text', required: true }
      ]
    },
    {
      id: 'bank_instant',
      name: 'Bank Direct Transfer',
      type: 'bank',
      bonus: 0.18,
      bankName: 'State Bank of India',
      accountNumber: '1234567890',
      ifsc: 'SBIN0001234',
      accountHolder: 'Win Go Enterprise',
      requiredFields: [
        { id: 'utr', label: 'IMPS/NEFT Ref Number', placeholder: 'Enter reference or UTR', type: 'text', required: true },
        { id: 'holder', label: 'Account Holder Name', placeholder: 'e.g. Harshit Maan', type: 'text', required: true }
      ]
    }
  ]);
  const [withdrawalFields, setWithdrawalFields] = useState<WithdrawalField[]>([
    { id: 'upi', label: 'UPI ID / VPA', placeholder: 'e.g. name@upi', type: 'text', required: true },
    { id: 'bankName', label: 'Bank Name', placeholder: 'e.g. State Bank of India', type: 'text', required: false },
    { id: 'accountNo', label: 'Account Number', placeholder: 'e.g. 1092837465', type: 'text', required: false },
    { id: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. SBIN0001234', type: 'text', required: false }
  ]);

  // Track previous period IDs for transition checking (all three rooms)
  const prevPeriodId30s = useRef<string>('');
  const prevPeriodId1m = useRef<string>('');
  const prevPeriodId3m = useRef<string>('');

  // Helper to construct key for email-based profile database
  const getEmailKey = (email: string): string => {
    return email.toLowerCase().trim()
      .replace(/@/g, '_at_')
      .replace(/\./g, '_');
  };

  const getUserKey = (profile: UserProfile): string => {
    return profile.email ? getEmailKey(profile.email) : (profile.phone || profile.uid);
  };

  // Update document title dynamically based on App Configuration
  useEffect(() => {
    if (appConfig && appConfig.appName) {
      document.title = appConfig.appName;
    } else {
      document.title = 'Colour Game';
    }
  }, [appConfig?.appName]);

  // 1. Restore login session on mount & handle referral routing
  useEffect(() => {
    const handleReferralRouting = () => {
      const searchParams = new URLSearchParams(window.location.search);
      let refCode = searchParams.get('ref') || searchParams.get('inviteCode') || searchParams.get('code');
      if (!refCode && window.location.hash) {
        const hashQuery = window.location.hash.split('?')[1];
        if (hashQuery) {
          const hashParams = new URLSearchParams(hashQuery);
          refCode = hashParams.get('ref') || hashParams.get('inviteCode') || hashParams.get('code');
        }
      }
      if (refCode) {
        setActiveTab('login');
      }
    };

    const savedKey = localStorage.getItem('prism_user_key') || localStorage.getItem('prism_user_phone');
    if (savedKey) {
      const userRef = ref(db, `users/${savedKey}`);
      get(userRef).then((snap) => {
        if (snap.exists()) {
          setUser(snap.val() as UserProfile);
        } else {
          localStorage.removeItem('prism_user_key');
          localStorage.removeItem('prism_user_phone');
          handleReferralRouting();
        }
      }).catch(() => {
        handleReferralRouting();
      });
    } else {
      handleReferralRouting();
    }
  }, []);

  // Back History synchronization (Request 3)
  useEffect(() => {
    // Define initial state on mount if not already present
    if (!window.history.state) {
      window.history.replaceState({
        activeTab: 'game',
        activeSubView: null,
        activeProfileSheet: null,
        selectedSelection: null,
        showLoginPrompt: false
      }, '');
    }

    // Popstate listener to handle browser back button
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state) {
        isPoppingRef.current = true;
        if (state.activeTab !== undefined) setActiveTab(state.activeTab);
        if (state.activeSubView !== undefined) setActiveSubView(state.activeSubView);
        if (state.activeProfileSheet !== undefined) setActiveProfileSheet(state.activeProfileSheet);
        if (state.selectedSelection !== undefined) setSelectedSelection(state.selectedSelection);
        if (state.showLoginPrompt !== undefined) setShowLoginPrompt(state.showLoginPrompt);
      } else {
        // Revert to default home/game view
        isPoppingRef.current = true;
        setActiveTab('game');
        setActiveSubView(null);
        setActiveProfileSheet(null);
        setSelectedSelection(null);
        setShowLoginPrompt(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Monitor state changes and push history
  useEffect(() => {
    if (isPoppingRef.current) {
      isPoppingRef.current = false;
      return;
    }

    const currentState = window.history.state;
    const stateDiffers = !currentState || 
      currentState.activeTab !== activeTab ||
      currentState.activeSubView !== activeSubView ||
      currentState.activeProfileSheet !== activeProfileSheet ||
      currentState.selectedSelection !== selectedSelection ||
      currentState.showLoginPrompt !== showLoginPrompt;

    if (stateDiffers) {
      window.history.pushState({
        activeTab,
        activeSubView,
        activeProfileSheet,
        selectedSelection,
        showLoginPrompt
      }, '');
    }
  }, [activeTab, activeSubView, activeProfileSheet, selectedSelection, showLoginPrompt]);

  // 2. Real-time subscriber for logged-in User profile & wallet balance
  useEffect(() => {
    if (!user) return;
    const userKey = getUserKey(user);
    const userRef = ref(db, `users/${userKey}`);
    const unsubscribe = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val() as UserProfile;
        setUser(data);
      }
    });
    return () => unsubscribe();
  }, [user?.email, user?.phone]);

  // Update lastActive timestamp for the active user session
  useEffect(() => {
    if (!user) return;
    const userKey = getUserKey(user);
    const userRef = ref(db, `users/${userKey}`);
    
    // Update immediately on mount / change
    update(userRef, { lastActive: Date.now() });

    // Set up an interval to update every 45 seconds
    const interval = setInterval(() => {
      update(userRef, { lastActive: Date.now() });
    }, 45000);

    return () => clearInterval(interval);
  }, [user?.email, user?.phone]);

  // Real-time support chat unread count subscriber
  useEffect(() => {
    if (!user) {
      setUserUnreadSupportCount(0);
      return;
    }
    const userKey = getUserKey(user);
    const unreadRef = ref(db, `support_chats/${userKey}/unreadCountForUser`);
    const unsubscribe = onValue(unreadRef, (snap) => {
      if (snap.exists()) {
        setUserUnreadSupportCount(snap.val() as number);
      } else {
        setUserUnreadSupportCount(0);
      }
    });
    return () => unsubscribe();
  }, [user?.email, user?.phone, user?.uid]);

  // 3. Real-time subscriber for general database records
  useEffect(() => {
    // Optimized: History per room limited to last 40 entries to keep data recall tiny and fast
    const rooms: RoomType[] = ['30s', '1m', '3m'];
    const roomHistoryData: { [room: string]: GamePeriod[] } = {
      '30s': [],
      '1m': [],
      '3m': []
    };

    const unsubscribes = rooms.map((roomKey) => {
      const roomHistoryQuery = query(ref(db, `history/${roomKey}`), limitToLast(40));
      return onValue(roomHistoryQuery, (snap) => {
        const list: GamePeriod[] = [];
        if (snap.exists()) {
          const data = snap.val();
          Object.keys(data).forEach((pKey) => {
            list.push({
              periodId: pKey,
              roomId: roomKey,
              ...data[pKey]
            });
          });
        }
        roomHistoryData[roomKey] = list;

        // Combine all rooms' history together
        const combined = [
          ...roomHistoryData['30s'],
          ...roomHistoryData['1m'],
          ...roomHistoryData['3m']
        ];
        setHistory(combined);
      });
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

    // Presets/Scheduled overrrides
    const presetsRef = ref(db, 'admin_control/preset_results');
    const unsubscribePresets = onValue(presetsRef, (snap) => {
      if (snap.exists()) {
        setPresetResults(snap.val());
      } else {
        setPresetResults({});
      }
    });

    // Deposit Channels Config
    const gatewayRef = ref(db, 'admin_control/deposit_channels');
    const unsubscribeGateway = onValue(gatewayRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        if (Array.isArray(val)) {
          setDepositChannels(val.filter(Boolean));
        } else if (typeof val === 'object' && val !== null) {
          setDepositChannels(Object.values(val));
        } else {
          setDepositChannels([]);
        }
      } else {
        setDepositChannels([
          {
            id: 'paytm_qr',
            name: 'Paytm QR Speed',
            type: 'qr',
            bonus: 0.20,
            qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=pay@upi&pn=WinGo',
            upiId: 'pay@upi',
            requiredFields: [
              { id: 'utr', label: 'UTR Number / Reference (12 digits)', placeholder: 'e.g. 302918273645', type: 'text', required: true }
            ]
          },
          {
            id: 'upi_transfer',
            name: 'UPI Instant',
            type: 'upi',
            bonus: 0.15,
            upiId: 'pay@upi',
            requiredFields: [
              { id: 'utr', label: 'Transaction ID / UTR', placeholder: 'Enter UPI reference number', type: 'text', required: true }
            ]
          },
          {
            id: 'bank_instant',
            name: 'Bank Direct Transfer',
            type: 'bank',
            bonus: 0.18,
            bankName: 'State Bank of India',
            accountNumber: '1234567890',
            ifsc: 'SBIN0001234',
            accountHolder: 'Win Go Enterprise',
            requiredFields: [
              { id: 'utr', label: 'IMPS/NEFT Ref Number', placeholder: 'Enter reference or UTR', type: 'text', required: true },
              { id: 'holder', label: 'Account Holder Name', placeholder: 'e.g. Harshit Maan', type: 'text', required: true }
            ]
          }
        ]);
      }
    });

    // Withdrawal Custom Config
    const withConfigRef = ref(db, 'admin_control/withdrawal_config');
    const unsubscribeWithConfig = onValue(withConfigRef, (snap) => {
      if (snap.exists()) {
        setWithdrawalFields(snap.val() || []);
      } else {
        setWithdrawalFields([
          { id: 'upi', label: 'UPI ID / VPA', placeholder: 'e.g. mobile@upi', type: 'text', required: true },
          { id: 'bankName', label: 'Bank Name', placeholder: 'e.g. HDFC Bank', type: 'text', required: false },
          { id: 'accountNo', label: 'Account Number', placeholder: 'e.g. 1092837465', type: 'text', required: false },
          { id: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', type: 'text', required: false }
        ]);
      }
    });

    // App Configuration Config Subscriber and Automatic Seeding
    const appConfigRef = ref(db, 'admin_control/app_config');
    const unsubscribeAppConfig = onValue(appConfigRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setAppConfig({
          appName: val.appName || 'L7 LOTTERY7',
          minDeposit: val.minDeposit !== undefined ? Number(val.minDeposit) : 100,
          maxDeposit: val.maxDeposit !== undefined ? Number(val.maxDeposit) : 500000,
          minWithdrawal: val.minWithdrawal !== undefined ? Number(val.minWithdrawal) : 200,
          maxWithdrawal: val.maxWithdrawal !== undefined ? Number(val.maxWithdrawal) : 100000,
          telegramSupport: val.telegramSupport !== undefined ? String(val.telegramSupport) : '@customer_service',
          whatsappSupport: val.whatsappSupport !== undefined ? String(val.whatsappSupport) : '+919876543210',
          currencySymbol: val.currencySymbol || '₹',
          currencyName: val.currencyName || 'INR',
          interestRate: val.interestRate !== undefined ? Number(val.interestRate) : 0.03,
          lastInterestDistributed: val.lastInterestDistributed || 0,
          supportEmail: val.supportEmail || 'support@lottery7.vip',
          supportChatLink: val.supportChatLink || '',
          referralDomain: val.referralDomain || ''
        });
      } else {
        const defaults: AppConfig = {
          appName: 'L7 LOTTERY7',
          minDeposit: 100,
          maxDeposit: 500000,
          minWithdrawal: 200,
          maxWithdrawal: 100000,
          telegramSupport: '@customer_service',
          whatsappSupport: '+919876543210',
          currencySymbol: '₹',
          currencyName: 'INR',
          interestRate: 0.03,
          lastInterestDistributed: 0,
          supportEmail: 'support@lottery7.vip',
          supportChatLink: '',
          referralDomain: ''
        };
        set(appConfigRef, defaults);
        setAppConfig(defaults);
      }
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
      unsubscribeOverrides();
      unsubscribePresets();
      unsubscribeGateway();
      unsubscribeWithConfig();
      unsubscribeAppConfig();
    };
  }, []);

  // 4. Real-time subscriber for Bids, Deposits, and Withdrawals - Isolated per user or global for Admin
  useEffect(() => {
    if (!user) {
      setActiveBids([]);
      setDeposits([]);
      setWithdrawals([]);
      return;
    }

    let unsubscribeBids: () => void = () => {};
    let unsubscribeDeposits: () => void = () => {};
    let unsubscribeWithdrawals: () => void = () => {};

    if (user.role === 'admin') {
      // Admin: Subscribe to all records globally
      const bidsRef = ref(db, 'bids');
      unsubscribeBids = onValue(bidsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list: BidRecord[] = [];
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

      const depositsRef = ref(db, 'deposits');
      unsubscribeDeposits = onValue(depositsRef, (snap) => {
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

      const withdrawalsRef = ref(db, 'withdrawals');
      unsubscribeWithdrawals = onValue(withdrawalsRef, (snap) => {
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

    } else {
      // Normal User: Subscribe strictly to their own isolated data path in Firebase (No other users' data is fetched)
      const userBidsRef = ref(db, `user_bids/${user.uid}`);
      unsubscribeBids = onValue(userBidsRef, (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const list: BidRecord[] = [];
          Object.keys(data).forEach((bKey) => {
            list.push({
              bidId: bKey,
              ...data[bKey],
            });
          });
          setActiveBids(list);
        } else {
          setActiveBids([]);
        }
      });

      const userDepositsRef = ref(db, `user_deposits/${user.uid}`);
      unsubscribeDeposits = onValue(userDepositsRef, (snap) => {
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

      const userWithdrawalsRef = ref(db, `user_withdrawals/${user.uid}`);
      unsubscribeWithdrawals = onValue(userWithdrawalsRef, (snap) => {
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
    }

    return () => {
      unsubscribeBids();
      unsubscribeDeposits();
      unsubscribeWithdrawals();
    };
  }, [user?.uid, user?.role]);

  // Synchronize previously completed bids to avoid popups on page load/login
  useEffect(() => {
    if (!user) {
      processedBidsRef.current.clear();
      initialBidsProcessedRef.current = false;
      return;
    }

    if (activeBids.length > 0 && !initialBidsProcessedRef.current) {
      activeBids.forEach((bid) => {
        if (bid.userId === user.uid && bid.status !== 'pending') {
          processedBidsRef.current.add(bid.bidId);
        }
      });
      initialBidsProcessedRef.current = true;
    }
  }, [activeBids, user]);

  // Monitor bids to detect and announce game resolutions (Win / Loss)
  useEffect(() => {
    if (!user || !initialBidsProcessedRef.current) return;

    // Filter for any of current user's bids that have just been resolved (won or lost)
    const justResolved = activeBids.filter((bid) => {
      return (
        bid.userId === user.uid &&
        bid.status !== 'pending' &&
        !processedBidsRef.current.has(bid.bidId)
      );
    });

    if (justResolved.length === 0) return;

    // Add them immediately to the processed set to avoid duplicate execution
    justResolved.forEach((b) => processedBidsRef.current.add(b.bidId));

    // Group the newly resolved bids by periodId and roomId
    const groups: { [key: string]: BidRecord[] } = {};
    justResolved.forEach((bid) => {
      const key = `${bid.roomId}_${bid.periodId}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(bid);
    });

    // Run sound & visual reactions for each group
    Object.keys(groups).forEach((key) => {
      const groupBids = groups[key];
      const roomId = groupBids[0].roomId;
      const periodId = groupBids[0].periodId;

      // Check if any of the bids in this group won
      const winningBids = groupBids.filter((b) => b.status === 'won');
      const hasWonAny = winningBids.length > 0;

      if (hasWonAny) {
        const totalWinAmount = winningBids.reduce((acc, b) => acc + (b.winAmount || 0), 0);
        
        // Find the period result to present
        const periodResult = unifiedHistory.find((h) => h.roomId === roomId && h.periodId === periodId) || getDeterministicResult(periodId, roomId);
        let resultText = 'N/A';
        if (periodResult) {
          resultText = `${periodResult.premiumColor} (Number: ${periodResult.number})`;
        }

        // Play Win Audio
        playWinSound();

        // Open Win Popup overlay with details
        setWinPopupDetails({
          periodId,
          roomId,
          totalBidsCount: winningBids.length,
          totalWinAmount,
          resultText,
          gameTypeLabel: roomId === '30s' ? '30 Seconds' : roomId === '1m' ? '1 Minute' : '3 Minutes'
        });
      } else {
        // If all bets in this period lost, only play the Loss Audio, NO popup
        playLossSound();
      }
    });
  }, [activeBids, user, unifiedHistory]);

  // 5. Admin-only subscription: Users list
  useEffect(() => {
    if (user?.role !== 'admin') return;
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
  }, [user?.role]);

  // Instantly update periodDetails when roomId changes to ensure zero-lag tab transitions
  useEffect(() => {
    setPeriodDetails(getPeriodDetails(roomId));
  }, [roomId]);

  // 6. Global game timer ticks (Synchronized)
  useEffect(() => {
    // Initial load
    const current30s = getPeriodDetails('30s');
    const current1m = getPeriodDetails('1m');
    const current3m = getPeriodDetails('3m');
    prevPeriodId30s.current = current30s.periodId;
    prevPeriodId1m.current = current1m.periodId;
    prevPeriodId3m.current = current3m.periodId;

    const interval = setInterval(() => {
      // Update timer states
      const activeDetails = getPeriodDetails(roomId);
      setPeriodDetails(activeDetails);

      // Check transitions for all three arenas in the background
      const details30s = getPeriodDetails('30s');
      const details1m = getPeriodDetails('1m');
      const details3m = getPeriodDetails('3m');

      if (details30s.periodId !== prevPeriodId30s.current) {
        const oldPeriodId = prevPeriodId30s.current;
        prevPeriodId30s.current = details30s.periodId;
        handlePeriodTransition('30s', oldPeriodId);
      }

      if (details1m.periodId !== prevPeriodId1m.current) {
        const oldPeriodId = prevPeriodId1m.current;
        prevPeriodId1m.current = details1m.periodId;
        handlePeriodTransition('1m', oldPeriodId);
      }

      if (details3m.periodId !== prevPeriodId3m.current) {
        const oldPeriodId = prevPeriodId3m.current;
        prevPeriodId3m.current = details3m.periodId;
        handlePeriodTransition('3m', oldPeriodId);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomId]);

  // Settle periods dynamically (Cooperative Sync engine)
  const handlePeriodTransition = async (roomKey: RoomType, oldPeriodId: string) => {
    console.log(`Transitioning ${roomKey} period: ${oldPeriodId}`);
    try {
      // 1. Fetch bids first to see if any user placed bets
      const bidsPath = `bids/${roomKey}/${oldPeriodId}`;
      const periodBidsRef = ref(db, bidsPath);
      const bidsSnap = await get(periodBidsRef);
      const hasBids = bidsSnap.exists();

      // 2. Fetch presets/overrides
      const presetRef = ref(db, `admin_control/preset_results/${roomKey}/${oldPeriodId}`);
      const presetSnap = await get(presetRef);
      const hasPreset = presetSnap.exists() && presetSnap.val() !== null;

      const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
      const overrideSnap = await get(overrideRef);
      const hasOverride = overrideSnap.exists() && overrideSnap.val() !== null;

      const historyRecordRef = ref(db, `history/${roomKey}/${oldPeriodId}`);
      const historySnap = await get(historyRecordRef);
      const hasHistory = historySnap.exists();

      let winningNum: number;

      if (hasHistory) {
        winningNum = historySnap.val().number;
      } else {
        // Only determine and save if hasBids OR hasPreset OR hasOverride
        if (hasBids || hasPreset || hasOverride) {
          if (hasPreset) {
            winningNum = Number(presetSnap.val());
            await remove(presetRef);
          } else if (hasOverride) {
            winningNum = Number(overrideSnap.val());
            await remove(overrideRef);
          } else {
            // Organic fallback based on deterministic generator to be perfectly fair and consistent
            winningNum = getDeterministicNumber(oldPeriodId, roomKey);
          }

          // Generate and save historical result
          const resultRecord = generatePeriodResult(oldPeriodId, roomKey, winningNum);
          await set(historyRecordRef, resultRecord);
        } else {
          // If no user bid and no admin override, DO NOT save anything in Firebase!
          // We will fallback to getDeterministicResult(oldPeriodId, roomKey) dynamically on the client history render.
          return;
        }
      }

      // 3. Settle Bids for this period
      if (hasBids) {
        const usersBidsData = bidsSnap.val();
        // Settle each user's bids
        for (const uid of Object.keys(usersBidsData)) {
          const userBids = usersBidsData[uid];
          for (const bidId of Object.keys(userBids)) {
            const bid = userBids[bidId];
            if (bid.status === 'pending') {
              const { status, winAmount } = calculateBidResult(bid.selection, bid.amount, winningNum);
              
              // Update bid status globally and in user-isolated path
              const bidStatusUpdates = {
                status,
                winAmount
              };
              await update(ref(db, `${bidsPath}/${uid}/${bidId}`), bidStatusUpdates);
              await update(ref(db, `user_bids/${uid}/${bidId}`), bidStatusUpdates);

              // Credit winnings back to user balance in realtime
              if (status === 'won' && winAmount > 0) {
                const bidUserKey = bid.email ? getEmailKey(bid.email) : (bid.phone || uid);
                const userProfileRef = ref(db, `users/${bidUserKey}`);
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
    const key = getUserKey(profile);
    localStorage.setItem('prism_user_key', key);
    localStorage.setItem('prism_user_phone', profile.phone || '');
    setActiveTab('game');
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem('prism_user_key');
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
    const userKey = getUserKey(user);
    const userProfileRef = ref(db, `users/${userKey}`);
    const userSnap = await get(userProfileRef);
    if (!userSnap.exists()) throw new Error('User account not found.');
    const activeProfile = userSnap.val() as UserProfile;
    
    if (activeProfile.wallet < totalCost) {
      throw new Error(`Insufficient wallet balance. Total cost: ₹${totalCost.toFixed(2)}, available: ₹${activeProfile.wallet.toFixed(2)}.`);
    }

    // 1. Deduct wallet balance from database
    const newWallet = activeProfile.wallet - totalCost;
    await update(userProfileRef, { wallet: newWallet });

    // 1b. Distribute 5% referral bet commission
    const referredByCode = activeProfile.referredBy;
    if (referredByCode) {
      let referrerKey = activeProfile.referredByUserKey;
      
      // Fallback lookup if referredByUserKey is not set in user profile
      if (!referrerKey) {
        const usersSnap = await get(ref(db, 'users'));
        if (usersSnap.exists()) {
          usersSnap.forEach((child) => {
            const val = child.val();
            if (val.inviteCode && val.inviteCode.toUpperCase() === referredByCode.toUpperCase()) {
              referrerKey = child.key || '';
            }
          });
        }
      }

      if (referrerKey) {
        const commissionAmount = totalCost * 0.05;
        const referrerRef = ref(db, `users/${referrerKey}`);
        const referrerSnap = await get(referrerRef);
        if (referrerSnap.exists()) {
          const referrerProfile = referrerSnap.val() as UserProfile;
          const referrerNewWallet = (referrerProfile.wallet || 0) + commissionAmount;
          await update(referrerRef, { wallet: referrerNewWallet });

          // Log referral bet commission
          const logId = `com_bet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const commissionLogRef = ref(db, `referral_commissions/${referrerKey}/${logId}`);
          await set(commissionLogRef, {
            logId,
            referrerKey,
            referredUserNickname: activeProfile.nickname || 'Gamer',
            referredUserEmail: activeProfile.email || '',
            type: 'bet',
            amount: commissionAmount,
            sourceAmount: totalCost,
            timestamp: Date.now()
          });
        }
      }
    }

    // 2. Save bid record
    const bidId = `bid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const bidRecordRef = ref(db, `bids/${roomId}/${currentDetails.periodId}/${user.uid}/${bidId}`);
    
    const record: any = {
      bidId,
      roomId,
      periodId: currentDetails.periodId,
      userId: user.uid,
      phone: user.phone || '',
      email: user.email || '',
      nickname: user.nickname,
      selection: selection as any,
      amount: totalCost,
      status: 'pending',
      winAmount: 0,
      createdAt: Date.now()
    };
    
    await set(bidRecordRef, record);

    // Also save in user-specific bids path for super fast, lightweight and secure query isolation
    const userBidRef = ref(db, `user_bids/${user.uid}/${bidId}`);
    await set(userBidRef, record);
  };

  // Wallet operations: Deposits Claims
  const handleDepositSubmit = async (amount: number, utr: string, channelName?: string, fieldsData?: { [key: string]: string }) => {
    if (!user) return;
    const userKey = getUserKey(user);
    const depositId = `dep_${Date.now()}`;
    const depositRef = ref(db, `deposits/${depositId}`);
    
    const request: any = {
      depositId,
      userId: user.uid,
      userKey,
      phone: user.phone || '',
      email: user.email || '',
      nickname: user.nickname,
      amount,
      utr,
      fieldsData: fieldsData || {},
      channel: channelName || 'UPI QR',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await set(depositRef, request);

    // Also save in user-specific deposits path for isolated recall
    const userDepositRef = ref(db, `user_deposits/${user.uid}/${depositId}`);
    await set(userDepositRef, request);
  };

  // Wallet operations: Withdrawals Requests
  const handleWithdrawalSubmit = async (
    amount: number,
    fieldsData: { [key: string]: string }
  ) => {
    if (!user) return;

    const userKey = getUserKey(user);
    const userProfileRef = ref(db, `users/${userKey}`);
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

    // Map fieldsData to old keys to keep compatibility with Admin Panel table layout
    const bankName = fieldsData['bankName'] || fieldsData['Bank Name'] || fieldsData['bank'] || '';
    const accountNumber = fieldsData['accountNo'] || fieldsData['Account Number'] || fieldsData['acc'] || '';
    const ifsc = fieldsData['ifsc'] || fieldsData['IFSC Code'] || '';
    const upi = fieldsData['upi'] || fieldsData['UPI ID'] || fieldsData['UPI ID / VPA'] || '';

    const request: any = {
      withdrawalId,
      userId: user.uid,
      userKey,
      phone: user.phone || '',
      email: user.email || '',
      nickname: user.nickname,
      amount,
      fieldsData,
      bankName,
      accountNumber,
      ifsc,
      upi,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await set(withdrawalRef, request);

    // Also save in user-specific withdrawals path for clean and secure isolation
    const userWithdrawalRef = ref(db, `user_withdrawals/${user.uid}/${withdrawalId}`);
    await set(userWithdrawalRef, request);
  };

  // Admin Ledger operations: Adjust wallet balance directly
  const handleUpdateUserWallet = async (userKey: string, newBalance: number) => {
    if (user?.role !== 'admin') return;
    const userRef = ref(db, `users/${userKey}`);
    await update(userRef, { wallet: newBalance });
  };

  // Admin Request operations: handle deposits approval/rejections/holds
  const handleDepositAction = async (
    depositId: string,
    status: 'approved' | 'rejected' | 'hold',
    holdReason?: string
  ) => {
    if (user?.role !== 'admin') return;
    
    const depositRef = ref(db, `deposits/${depositId}`);
    const depSnap = await get(depositRef);
    if (!depSnap.exists()) return;
    const depRequest = depSnap.val() as any;

    if (depRequest.status === 'approved') return; // already approved

    // Update state globally and in user-specific path
    const updates = {
      status,
      holdReason: holdReason || null,
      updatedAt: Date.now()
    };
    await update(depositRef, updates);

    if (depRequest.userId) {
      await update(ref(db, `user_deposits/${depRequest.userId}/${depositId}`), updates);
    }

    // If approved, add money to user's wallet
    if (status === 'approved') {
      const depUserKey = depRequest.userKey || (depRequest.email ? getEmailKey(depRequest.email) : depRequest.phone);
      const userRef = ref(db, `users/${depUserKey}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const uProfile = userSnap.val() as UserProfile;
        const newBal = (uProfile.wallet || 0) + depRequest.amount;
        const newTotalDeposit = (uProfile.totalDeposit || 0) + depRequest.amount;
        
        let userUpdates: any = { 
          wallet: newBal,
          totalDeposit: newTotalDeposit
        };
        
        // Handle 10% first-deposit commission
        if (!uProfile.hasDeposited) {
          userUpdates.hasDeposited = true;
          
          const referredByCode = uProfile.referredBy;
          if (referredByCode) {
            let referrerKey = uProfile.referredByUserKey;
            
            // Fallback search if referrerKey is not on the profile
            if (!referrerKey) {
              const usersSnap = await get(ref(db, 'users'));
              if (usersSnap.exists()) {
                usersSnap.forEach((child) => {
                  const val = child.val();
                  if (val.inviteCode && val.inviteCode.toUpperCase() === referredByCode.toUpperCase()) {
                    referrerKey = child.key || '';
                  }
                });
              }
            }
            
            if (referrerKey) {
              const commissionAmount = depRequest.amount * 0.10;
              const referrerRef = ref(db, `users/${referrerKey}`);
              const referrerSnap = await get(referrerRef);
              if (referrerSnap.exists()) {
                const referrerProfile = referrerSnap.val() as UserProfile;
                const referrerNewWallet = (referrerProfile.wallet || 0) + commissionAmount;
                await update(referrerRef, { wallet: referrerNewWallet });
                
                // Save commission log
                const logId = `com_dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const commissionLogRef = ref(db, `referral_commissions/${referrerKey}/${logId}`);
                await set(commissionLogRef, {
                  logId,
                  referrerKey,
                  referredUserNickname: uProfile.nickname || 'Gamer',
                  referredUserEmail: uProfile.email || '',
                  type: 'deposit',
                  amount: commissionAmount,
                  sourceAmount: depRequest.amount,
                  timestamp: Date.now()
                });
              }
            }
          }
        }
        
        await update(userRef, userUpdates);
      }
    }
  };

  // Admin Request operations: handle withdrawals approval/rejections/holds
  const handleWithdrawalAction = async (
    withdrawalId: string,
    status: 'approved' | 'rejected' | 'hold',
    holdReason?: string
  ) => {
    if (user?.role !== 'admin') return;

    const withdrawalRef = ref(db, `withdrawals/${withdrawalId}`);
    const withSnap = await get(withdrawalRef);
    if (!withSnap.exists()) return;
    const withRequest = withSnap.val() as any;

    if (withRequest.status === 'approved') return; // already processed

    // Update state globally and in user-specific path
    const updates = {
      status,
      holdReason: holdReason || null,
      updatedAt: Date.now()
    };
    await update(withdrawalRef, updates);

    if (withRequest.userId) {
      await update(ref(db, `user_withdrawals/${withRequest.userId}/${withdrawalId}`), updates);
    }

    // If rejected, return held funds to user's wallet
    if (status === 'rejected') {
      const withUserKey = withRequest.userKey || (withRequest.email ? getEmailKey(withRequest.email) : withRequest.phone);
      const userRef = ref(db, `users/${withUserKey}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const uProfile = userSnap.val() as UserProfile;
        const newBal = (uProfile.wallet || 0) + withRequest.amount;
        await update(userRef, { wallet: newBal });
      }
    } else if (status === 'approved') {
      const withUserKey = withRequest.userKey || (withRequest.email ? getEmailKey(withRequest.email) : withRequest.phone);
      const userRef = ref(db, `users/${withUserKey}`);
      const userSnap = await get(userRef);
      if (userSnap.exists()) {
        const uProfile = userSnap.val() as UserProfile;
        const newTotalWithdrawal = (uProfile.totalWithdrawal || 0) + withRequest.amount;
        await update(userRef, { totalWithdrawal: newTotalWithdrawal });
      }
    }
  };

  // Admin Manipulation overrides
  const handleSetWinningOverride = async (roomKey: RoomType, num: number) => {
    if (user?.role !== 'admin') return;
    const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
    await set(overrideRef, num);
  };

  const handleClearWinningOverride = async (roomKey: RoomType) => {
    if (user?.role !== 'admin') return;
    const overrideRef = ref(db, `admin_control/active_period_override/${roomKey}`);
    await remove(overrideRef);
  };

  // Admin Manipulation: Future Presets
  const handleSetPresetResult = async (roomKey: RoomType, periodId: string, num: number) => {
    if (user?.role !== 'admin') return;
    const presetRef = ref(db, `admin_control/preset_results/${roomKey}/${periodId}`);
    await set(presetRef, num);
  };

  const handleClearPresetResult = async (roomKey: RoomType, periodId: string) => {
    if (user?.role !== 'admin') return;
    const presetRef = ref(db, `admin_control/preset_results/${roomKey}/${periodId}`);
    await remove(presetRef);
  };

  const handleUpdateDepositChannels = async (channels: DepositChannel[]) => {
    if (user?.role !== 'admin') return;
    const gatewayRef = ref(db, 'admin_control/deposit_channels');
    await remove(gatewayRef);
    await set(gatewayRef, channels);
  };

  const handleUpdateWithdrawalConfig = async (fields: WithdrawalField[]) => {
    if (user?.role !== 'admin') return;
    const configRef = ref(db, 'admin_control/withdrawal_config');
    await remove(configRef);
    await set(configRef, fields);
  };

  const handleUpdateAppConfig = async (config: AppConfig) => {
    if (user?.role !== 'admin') return;
    const configRef = ref(db, 'admin_control/app_config');
    await set(configRef, config);
  };

  // Filter pending active user bids for the current active period & active room
  const userActiveBids = user ? activeBids.filter(
    (b) => b.userId === user.uid && b.periodId === periodDetails.periodId && b.roomId === roomId
  ) : [];

  const userRoomBids = user ? activeBids.filter(
    (b) => b.userId === user.uid && b.roomId === roomId
  ) : [];

  const userBidsAllRooms = user ? activeBids.filter(
    (b) => b.userId === user.uid
  ) : [];

  return (
    <div className="min-h-screen bg-[#070B14] flex items-center justify-center p-0 md:p-6 lg:p-8 font-sans selection:bg-amber-500/30">
      {/* Smartphone Container */}
      <div id="smartphone-container" className="w-full h-screen md:h-[860px] md:max-w-[430px] md:rounded-[36px] md:border-[10px] md:border-slate-900 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] bg-[#0F172A] flex flex-col relative overflow-hidden">
        
        {/* Scrollable Viewport (Height reserved for bottom bar if no subview is open) */}
        <div className={`flex-1 overflow-y-auto overflow-x-hidden ${activeSubView ? 'pb-4' : 'pb-20'} custom-scrollbar relative bg-[#0D121F]`}>
          
          {/* Subview Layer: Wallet (Deposit / Withdrawal Separated) */}
          {(activeSubView === 'deposit' || activeSubView === 'withdrawal') && user && (
            <div className="animate-in fade-in duration-300">
              {/* Back Header */}
              <div className="flex items-center space-x-2 bg-[#0B0F17] p-4 sticky top-0 border-b border-slate-900/80 z-30">
                <button 
                  onClick={() => window.history.back()}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-xs font-black uppercase text-amber-400 tracking-wider">
                  {activeSubView === 'deposit' ? 'Recharge Deposit Center' : 'Withdrawal Payout Center'}
                </span>
              </div>
              <div className="p-1">
                <WalletSection
                  user={user}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  onDepositSubmit={handleDepositSubmit}
                  onWithdrawalSubmit={handleWithdrawalSubmit}
                  depositChannels={depositChannels}
                  withdrawalFields={withdrawalFields}
                  mode={activeSubView}
                  appConfig={appConfig}
                />
              </div>
            </div>
          )}

          {/* Subview Layer: Admin */}
          {activeSubView === 'admin' && user && user.role === 'admin' && (
            <div className="animate-in fade-in duration-300">
              {/* Back Header */}
              <div className="flex items-center space-x-2 bg-[#0B0F17] p-4 sticky top-0 border-b border-slate-900/80 z-30">
                <button 
                  onClick={() => window.history.back()}
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
                  activePeriodId30s={getPeriodDetails('30s').periodId}
                  activePeriodId1m={getPeriodDetails('1m').periodId}
                  activePeriodId3m={getPeriodDetails('3m').periodId}
                  history={unifiedHistory}
                  onUpdateUserWallet={handleUpdateUserWallet}
                  onHandleDeposit={handleDepositAction}
                  onHandleWithdrawal={handleWithdrawalAction}
                  onSetWinningOverride={handleSetWinningOverride}
                  onClearWinningOverride={handleClearWinningOverride}
                  currentOverrides={currentOverrides}
                  onSetPresetResult={handleSetPresetResult}
                  onClearPresetResult={handleClearPresetResult}
                  presetResults={presetResults}
                  depositChannels={depositChannels}
                  withdrawalFields={withdrawalFields}
                  onUpdateDepositChannels={handleUpdateDepositChannels}
                  onUpdateWithdrawalConfig={handleUpdateWithdrawalConfig}
                  appConfig={appConfig}
                  onUpdateAppConfig={handleUpdateAppConfig}
                />
              </div>
            </div>
          )}

          {/* Subview Layer: Support (Full Screen Chat) */}
          {activeSubView === 'support' && user && (
            <div className="absolute inset-0 z-40 bg-[#0D121F]">
              <UserSupportChat
                user={user}
                appConfig={appConfig}
                onBack={() => window.history.back()}
              />
            </div>
          )}

          {/* Main Tab Layer (When no subview is open) */}
          {!activeSubView && (
            <>
              {activeTab === 'home' && (
                <HomeSection 
                  onLaunchGame={() => setActiveTab('game')} 
                  userPhone={user?.phone || 'Guest'} 
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
                  userAllBids={userBidsAllRooms}
                  history={unifiedHistory}
                  onPlaceBid={handlePlaceBid}
                  onNavigateToWallet={(subTab) => {
                    if (!user) {
                      setShowLoginPrompt(true);
                    } else {
                      setActiveSubView(subTab === 'withdrawal' ? 'withdrawal' : 'deposit');
                    }
                  }}
                  onLoginPrompt={() => setShowLoginPrompt(true)}
                  appConfig={appConfig}
                  selectedSelection={selectedSelection}
                  setSelectedSelection={setSelectedSelection}
                />
              )}
              {activeTab === 'profile' && user && (
                <ProfileSection
                  user={user}
                  deposits={deposits}
                  withdrawals={withdrawals}
                  onSignOut={handleSignOut}
                  onNavigateToWallet={(subTab) => {
                    setActiveSubView(subTab === 'withdrawal' ? 'withdrawal' : 'deposit');
                  }}
                  onNavigateToAdmin={() => setActiveSubView('admin')}
                  appConfig={appConfig}
                  onOpenSheet={(sheet) => {
                    if (sheet === 'help') {
                      setActiveSubView('support');
                    } else {
                      setActiveProfileSheet(sheet);
                    }
                  }}
                  unreadSupportCount={userUnreadSupportCount}
                />
              )}
              {activeTab === 'login' && (
                <div className="w-full flex flex-col bg-[#0B0A09] relative min-h-full">
                  <LoginSignup 
                    onLoginSuccess={handleLoginSuccess} 
                    appConfig={appConfig} 
                    onBack={() => setActiveTab('game')} 
                  />
                </div>
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
              <span className="text-[9px] mt-0.5 tracking-wider uppercase font-black">Win Go</span>
            </button>

            {/* Profile Tab Button */}
            <button
              onClick={() => {
                if (!user) {
                  setShowLoginPrompt(true);
                  return;
                }
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

        {/* Dynamic Complete Profile Modal popup when user profile missing fields */}
        {user && (
          <CompleteProfileModal 
            onUpdateSuccess={(updatedUser) => {
              setUser(updatedUser);
            }} 
            user={user} 
          />
        )}

        {/* Real-time fixed bottom sheets for profile sub-menus */}
        {user && activeProfileSheet && (
          <ProfileSheets
            activeSheet={activeProfileSheet}
            onClose={() => window.history.back()}
            user={user}
            appConfig={appConfig}
            onNavigateToWallet={(subTab) => {
              window.history.back(); // Pop active profile sheet
              setTimeout(() => {
                setActiveSubView(subTab === 'withdrawal' ? 'withdrawal' : 'deposit');
              }, 100);
            }}
          />
        )}

        {/* Login Prompt Overlay Modal for unauthenticated actions */}
        {showLoginPrompt && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-5 z-50 animate-in fade-in duration-300">
            <div className="bg-[#121824] border border-slate-800/80 rounded-2xl p-6 w-full max-w-[340px] text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/10 rounded-full blur-xl"></div>
              <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-amber-500/10 rounded-full blur-xl"></div>
              
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-amber-500 animate-pulse" />
              </div>
              
              <h3 className="text-base font-black text-white mb-2 uppercase tracking-wider">
                Authentication Required
              </h3>
              <p className="text-slate-400 text-xs mb-6 leading-relaxed">
                You are not logged in. Please login or register to place bets, deposit funds, or access your profile!
              </p>
              
              <div className="flex flex-col space-y-2">
                <button
                  onClick={() => {
                    window.history.back(); // Pop login prompt
                    setTimeout(() => {
                      setActiveSubView(null);
                      setActiveTab('login');
                    }, 100);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black py-2.5 rounded-xl transition-all uppercase tracking-wider text-[10px] shadow-md shadow-amber-500/20 active:scale-98 cursor-pointer"
                >
                  Login / Register
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold py-2 rounded-xl transition-all text-[10px] border border-slate-800/60 cursor-pointer"
                >
                  Cancel & Explore
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Game Win Popup Overlay Modal (Auto closes in 5 seconds or on dismiss click) */}
        {user && winPopupDetails && (
          <WinPopupModal
            periodId={winPopupDetails.periodId}
            roomId={winPopupDetails.roomId}
            totalBidsCount={winPopupDetails.totalBidsCount}
            totalWinAmount={winPopupDetails.totalWinAmount}
            resultText={winPopupDetails.resultText}
            gameTypeLabel={winPopupDetails.gameTypeLabel}
            currencySymbol={appConfig.currencySymbol}
            onClose={() => setWinPopupDetails(null)}
          />
        )}

      </div>
    </div>
  );
}
