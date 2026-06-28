import React, { useState } from 'react';
import { db } from '../firebase';
import { ref, get, set } from 'firebase/database';
import { UserProfile } from '../types';
import { Shield, Phone, Lock, User, UserPlus, LogIn, Award, Mail } from 'lucide-react';

interface LoginSignupProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const getEmailKey = (email: string): string => {
  return email.toLowerCase().trim()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_');
};

export default function LoginSignup({ onLoginSuccess }: LoginSignupProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);

    try {
      const emailKey = getEmailKey(email);
      const userRef = ref(db, `users/${emailKey}`);
      const snapshot = await get(userRef);

      if (isLogin) {
        // Login flow
        if (!snapshot.exists()) {
          setError('User not found. Please sign up.');
          setLoading(false);
          return;
        }

        const userData = snapshot.val() as UserProfile;
        if (userData.password !== password) {
          setError('Incorrect password.');
          setLoading(false);
          return;
        }

        onLoginSuccess(userData);
      } else {
        // Signup flow
        if (snapshot.exists()) {
          setError('Email already registered. Please login.');
          setLoading(false);
          return;
        }

        if (!nickname) {
          setError('Please provide a nickname.');
          setLoading(false);
          return;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const isDefaultAdmin = normalizedEmail === 'admin@gmail.com' || normalizedEmail === 'smartharshitmaan@gmail.com';

        // Set up initial profile
        const newUser: UserProfile = {
          uid: `user_${Date.now()}`,
          email: normalizedEmail,
          phone: phone || '',
          password,
          nickname,
          wallet: 20, // Free $20 sign-up bonus to make it extremely interactive!
          inviteCode: inviteCode || '',
          role: isDefaultAdmin ? 'admin' : 'user',
          isAdmin: isDefaultAdmin,
          createdAt: Date.now()
        };

        await set(userRef, newUser);
        onLoginSuccess(newUser);
      }
    } catch (err: any) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] px-4 sm:px-6 lg:px-8 py-12 font-sans text-slate-200">
      <div className="max-w-md w-full space-y-8 bg-[#1E293B] p-8 rounded-2xl shadow-2xl border border-slate-800 transition-all duration-300">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-tr from-emerald-500 via-purple-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-900/20 transform hover:rotate-6 transition-transform duration-300">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-black text-white tracking-tight uppercase">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="mt-2 text-xs text-slate-400">
            {isLogin ? 'Log in to your color prediction game portal' : 'Get a $20 welcome bonus to start bidding!'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl text-xs leading-relaxed flex items-center space-x-2">
            <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 animate-pulse" />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-700 text-sm font-sans"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mobile Number (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Phone className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-700 text-sm font-mono"
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nickname</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="text"
                    required={!isLogin}
                    placeholder="Your nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-700 text-sm"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-700 text-sm font-mono"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Invite Code (Optional)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Award className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. WIN777"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="block w-full pl-10 pr-3 py-3 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-700 text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-xs font-bold uppercase tracking-widest rounded-xl text-white bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 transition-all duration-150 cursor-pointer shadow-lg shadow-purple-950/25 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </span>
              ) : isLogin ? (
                <span className="flex items-center space-x-2">
                  <LogIn className="h-4 w-4" />
                  <span>Log In Securely</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Claim Welcome Bonus & Sign Up</span>
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-4 border-t border-slate-800">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs font-bold uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>
        </div>
      </div>
    </div>
  );
}
