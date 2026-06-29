import React, { useState } from 'react';
import { db } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { UserProfile, AppConfig } from '../types';
import { Mail, Lock, Eye, EyeOff, Award, ArrowLeft, ChevronDown } from 'lucide-react';

interface LoginSignupProps {
  onLoginSuccess: (user: UserProfile) => void;
  appConfig?: AppConfig;
}

export const getEmailKey = (email: string): string => {
  return email.toLowerCase().trim()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_');
};

export default function LoginSignup({ onLoginSuccess, appConfig }: LoginSignupProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('5853117646974'); // prefilled default
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Referral code check states
  const [inviteCodeStatus, setInviteCodeStatus] = useState<'idle' | 'valid' | 'invalid' | 'checking'>('idle');
  const [referredByUserNickname, setReferredByUserNickname] = useState('');
  const [referredByUserKey, setReferredByUserKey] = useState('');

  // App Name from Firebase
  const [appName, setAppName] = useState(appConfig?.appName || 'LOTTERY7');

  React.useEffect(() => {
    if (appConfig?.appName) {
      setAppName(appConfig.appName);
    } else {
      const appConfigRef = ref(db, 'admin_control/app_config');
      get(appConfigRef).then((snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (val.appName) {
            setAppName(val.appName);
          }
        }
      }).catch(console.error);
    }
  }, [appConfig]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || params.get('inviteCode');
    if (refCode) {
      setInviteCode(refCode);
      setIsLogin(false);
    }
  }, []);

  // Validate Referral Code on change with debounce
  React.useEffect(() => {
    if (!inviteCode.trim()) {
      setInviteCodeStatus('idle');
      setReferredByUserNickname('');
      return;
    }

    setInviteCodeStatus('checking');
    const delayDebounce = setTimeout(() => {
      const usersRef = ref(db, 'users');
      get(usersRef).then((snap) => {
        if (snap.exists()) {
          let found = false;
          let referrerName = '';
          let referrerKey = '';
          snap.forEach((child) => {
            const val = child.val();
            if (val.inviteCode && val.inviteCode.toUpperCase() === inviteCode.trim().toUpperCase()) {
              found = true;
              referrerName = val.nickname || val.email || 'User';
              referrerKey = child.key || '';
            }
          });

          if (found) {
            setInviteCodeStatus('valid');
            setReferredByUserNickname(referrerName);
            setReferredByUserKey(referrerKey);
          } else {
            setInviteCodeStatus('invalid');
            setReferredByUserNickname('');
            setReferredByUserKey('');
          }
        } else {
          setInviteCodeStatus('invalid');
          setReferredByUserNickname('');
          setReferredByUserKey('');
        }
      }).catch((err) => {
        console.error(err);
        setInviteCodeStatus('invalid');
        setReferredByUserNickname('');
        setReferredByUserKey('');
      });
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Common validations
    if (!email || !email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!nickname.trim()) {
        setError('Please enter a nickname.');
        return;
      }
      if (inviteCode.trim() && inviteCodeStatus !== 'valid') {
        setError('Only valid referral codes are accepted. Please enter a valid code or clear it.');
        return;
      }
      if (!agreeTerms) {
        setError('You must agree to the Privacy Agreement to register.');
        return;
      }
    }

    setLoading(true);

    try {
      const userKey = getEmailKey(email);
      const userRef = ref(db, `users/${userKey}`);
      const snapshot = await get(userRef);

      if (isLogin) {
        // Login Flow
        if (!snapshot.exists()) {
          setError('Email address not found. Please sign up.');
          setLoading(false);
          return;
        }

        const userData = snapshot.val() as UserProfile;
        if (userData.password !== password) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }

        // On successful login
        onLoginSuccess(userData);
      } else {
        // Signup Flow
        if (snapshot.exists()) {
          setError('Email already registered. Please login.');
          setLoading(false);
          return;
        }

        const isDefaultAdmin = email.toLowerCase().trim() === 'admin@gmail.com' || email.toLowerCase().trim() === 'smartharshitmaan@gmail.com';
        const finalNickname = nickname.trim() || 'Gamer';
        
        const generateAlphanumericCode = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
        };
        const ownInviteCode = generateAlphanumericCode();

        const newUser: UserProfile = {
          uid: `user_${Date.now()}`,
          email: email.toLowerCase().trim(),
          phone: '',
          password,
          nickname: finalNickname,
          wallet: 20, // $20 welcome signup bonus
          inviteCode: ownInviteCode,
          referredBy: (inviteCode.trim() && inviteCodeStatus === 'valid') ? inviteCode.trim().toUpperCase() : undefined,
          referredByUserKey: (inviteCode.trim() && inviteCodeStatus === 'valid') ? referredByUserKey : undefined,
          role: isDefaultAdmin ? 'admin' : 'user',
          isAdmin: isDefaultAdmin,
          createdAt: Date.now()
        };

        await set(userRef, newUser);
        onLoginSuccess(newUser);
      }
    } catch (err: any) {
      console.error(err);
      setError('A secure database connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0A09] text-slate-100 flex flex-col justify-between font-sans">
      
      {/* HEADER BAR (As seen in screenshots) */}
      <div className="bg-[#181716] border-b border-[#3D2C08]/20 px-4 py-3 flex items-center justify-between shadow-md">
        <button 
          onClick={() => {
            if (!isLogin) {
              setIsLogin(true);
              setError('');
            }
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        
        {/* LOGO MATCHING SCREENSHOT */}
        <div className="flex items-center space-x-1.5">
          <div className="bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-[#0B0A09] font-black italic text-sm px-2 py-0.5 rounded flex items-center justify-center transform skew-x-[-10deg]">
            {appName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase() || 'L7'}
          </div>
          <span className="font-extrabold text-xs tracking-wider text-[#E5A93B]">{appName.toUpperCase()}</span>
        </div>

        {/* LANGUAGE SELECTOR */}
        <div className="flex items-center space-x-1 cursor-pointer bg-[#242220] border border-[#3D2C08]/30 rounded-full px-2.5 py-1">
          <div className="w-4 h-3 bg-blue-900 rounded-sm relative overflow-hidden flex items-center justify-center text-[6px] font-black text-white shrink-0">
            <span className="absolute left-0 top-0 bg-red-600 w-2.5 h-1.5"></span>
            <span className="absolute right-0 bottom-0 bg-white w-2.5 h-1.5"></span>
            ★
          </div>
          <span className="text-[9px] font-black text-slate-300">EN</span>
          <ChevronDown className="h-2.5 w-2.5 text-slate-400" />
        </div>
      </div>

      {/* BODY WRAPPER */}
      <div className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto px-4.5 py-6">
        
        {/* WELCOME / SUBTITLE ZONE */}
        <div className="mb-6">
          <h1 className="text-xl font-black text-[#E5A93B] tracking-tight uppercase">
            {isLogin ? 'Log in' : 'Register'}
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {isLogin 
              ? 'Please log in with your email address' 
              : 'Please register with your email address'}
          </p>
        </div>

        {/* ERROR BOX */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-xl text-[11px] leading-relaxed mb-5 flex items-center space-x-2 animate-pulse">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* FORM MAIN CONTAINER */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* EMAIL FIELD */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-[#E5A93B] uppercase tracking-widest">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                placeholder="Please enter the email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-[#181716] border border-[#3D2C08]/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] focus:border-[#E5A93B] text-xs text-white placeholder-slate-600"
              />
            </div>
          </div>

          {/* NICKNAME FIELD (Only during registration) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[#E5A93B] uppercase tracking-widest">Nickname</label>
              <input
                type="text"
                required
                placeholder="Please enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="block w-full px-4 py-3 bg-[#181716] border border-[#3D2C08]/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] focus:border-[#E5A93B] text-xs text-white placeholder-slate-600"
              />
            </div>
          )}

          {/* PASSWORD FIELD */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-[#E5A93B] uppercase tracking-widest">
              {isLogin ? 'Password' : 'Set password'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={isLogin ? 'Password' : 'Set password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 bg-[#181716] border border-[#3D2C08]/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] focus:border-[#E5A93B] text-xs text-white placeholder-slate-600 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#E5A93B] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* CONFIRM PASSWORD (Only during registration) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[#E5A93B] uppercase tracking-widest">Confirm password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 bg-[#181716] border border-[#3D2C08]/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] focus:border-[#E5A93B] text-xs text-white placeholder-slate-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-[#E5A93B] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* INVITE CODE (Only during registration) */}
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-[#E5A93B] uppercase tracking-widest">Invite code</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Award className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.trim())}
                  className={`block w-full pl-10 pr-10 py-3 bg-[#181716] border rounded-xl focus:outline-none focus:ring-1 text-xs text-white placeholder-slate-600 font-mono ${
                    inviteCode.trim() === ''
                      ? 'border-[#3D2C08]/10 focus:ring-[#E5A93B] focus:border-[#E5A93B]'
                      : inviteCodeStatus === 'valid'
                      ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500'
                      : inviteCodeStatus === 'invalid'
                      ? 'border-rose-500 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-amber-500 focus:ring-amber-500 focus:border-amber-500'
                  }`}
                />
                {inviteCode.trim() !== '' && (
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    {inviteCodeStatus === 'checking' && (
                      <svg className="animate-spin h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {inviteCodeStatus === 'valid' && (
                      <span className="text-emerald-500 font-bold text-xs">✓</span>
                    )}
                    {inviteCodeStatus === 'invalid' && (
                      <span className="text-rose-500 font-bold text-xs">✗</span>
                    )}
                  </div>
                )}
              </div>
              {inviteCode.trim() !== '' && (
                <div className="text-[10px] font-bold mt-1">
                  {inviteCodeStatus === 'checking' && (
                    <span className="text-amber-500">Checking code validity...</span>
                  )}
                  {inviteCodeStatus === 'valid' && (
                    <span className="text-emerald-400">✓ Valid Refer Code (Invited by: {referredByUserNickname})</span>
                  )}
                  {inviteCodeStatus === 'invalid' && (
                    <span className="text-rose-400">✗ Invalid Refer Code. Only valid code can register.</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CHECKBOXES AND LABELS */}
          {isLogin ? (
            <div className="flex items-center space-x-2 py-1">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-full border-[#3D2C08]/30 text-[#E5A93B] focus:ring-[#E5A93B] bg-[#181716] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer">
                Remember password
              </label>
            </div>
          ) : (
            <div className="flex items-center space-x-2 py-1">
              <input
                id="agreeTerms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="h-4 w-4 rounded border-[#3D2C08]/30 text-[#E5A93B] focus:ring-[#E5A93B] bg-[#181716] cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide cursor-pointer">
                I have read and agree <span className="text-[#E5A93B]">【Privacy Agreement】</span>
              </label>
            </div>
          )}

          {/* MAIN ACTIONS */}
          <div className="space-y-3 pt-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-[#0B0A09] bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] hover:from-[#f3b94c] hover:to-[#d09e3a] active:scale-[0.99] transition-all cursor-pointer shadow-lg shadow-[#E5A93B]/5 disabled:opacity-40"
            >
              {loading ? (
                <span className="flex items-center justify-center space-x-1.5">
                  <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </span>
              ) : isLogin ? (
                'Log in'
              ) : (
                'Register'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-widest text-[#E5A93B] border border-[#E5A93B]/50 hover:border-[#E5A93B] hover:bg-[#E5A93B]/5 transition-all cursor-pointer"
            >
              {isLogin ? 'Register' : 'I have an account Login'}
            </button>
          </div>

        </form>

      </div>

      {/* FOOTER ACCENT BAR */}
      <div className="h-1.5 bg-gradient-to-r from-[#3D2C08] via-[#E5A93B] to-[#3D2C08]" />
    </div>
  );
}
