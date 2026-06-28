import React, { useState } from 'react';
import { db } from '../firebase';
import { ref, get, update } from 'firebase/database';
import { UserProfile } from '../types';
import { User, Smartphone, Mail, AlertCircle, Sparkles } from 'lucide-react';

interface CompleteProfileModalProps {
  user: UserProfile;
  onUpdateSuccess: (updatedUser: UserProfile) => void;
}

export const getEmailKey = (email: string): string => {
  return email.toLowerCase().trim()
    .replace(/@/g, '_at_')
    .replace(/\./g, '_');
};

export default function CompleteProfileModal({ user, onUpdateSuccess }: CompleteProfileModalProps) {
  // Check what fields are actually missing
  const isNicknameMissing = !user.nickname || user.nickname.trim() === '' || user.nickname.trim().toLowerCase() === 'gamer';
  const isPhoneMissing = !user.phone || user.phone.trim() === '';
  const isEmailMissing = !user.email || user.email.trim() === '';

  const [nickname, setNickname] = useState(user.nickname || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [email, setEmail] = useState(user.email || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If nothing is actually missing, do not render
  if (!isNicknameMissing && !isPhoneMissing && !isEmailMissing) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (isNicknameMissing && !nickname.trim()) {
      setError('Please provide a nickname.');
      return;
    }
    if (isPhoneMissing && (!phone.trim() || phone.trim().length < 10)) {
      setError('Please provide a valid 10-digit mobile number.');
      return;
    }
    if (isEmailMissing) {
      if (!email.trim() || !email.includes('@') || !email.includes('.')) {
        setError('Please provide a valid email address.');
        return;
      }
    }

    setLoading(true);

    try {
      // Find the user's primary database key
      const userKey = user.email ? getEmailKey(user.email) : (user.phone || user.uid);
      const userRef = ref(db, `users/${userKey}`);

      // Check if phone already registered by another account
      if (isPhoneMissing && phone.trim()) {
        const phoneSnap = await get(ref(db, `users/${phone.trim()}`));
        if (phoneSnap.exists() && phoneSnap.val().uid !== user.uid) {
          setError('This mobile number is already linked to another account.');
          setLoading(false);
          return;
        }
      }

      // Check if email already registered by another account
      if (isEmailMissing && email.trim()) {
        const emailKey = getEmailKey(email);
        const emailSnap = await get(ref(db, `users/${emailKey}`));
        if (emailSnap.exists() && emailSnap.val().uid !== user.uid) {
          setError('This email address is already linked to another account.');
          setLoading(false);
          return;
        }
      }

      // Build update fields payload
      const updates: Partial<UserProfile> = {};
      if (isNicknameMissing) updates.nickname = nickname.trim();
      if (isPhoneMissing) updates.phone = phone.trim();
      if (isEmailMissing) updates.email = email.toLowerCase().trim();

      await update(userRef, updates);

      // Fetch the fully updated user data
      const updatedSnap = await get(userRef);
      if (updatedSnap.exists()) {
        onUpdateSuccess(updatedSnap.val() as UserProfile);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to update profile details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-5 select-none font-sans">
      <div className="bg-[#121110] border-2 border-[#E5A93B]/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden flex flex-col justify-between">
        
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#E5A93B]/10 to-transparent rounded-full blur-xl pointer-events-none" />

        <div className="space-y-4">
          
          {/* Headline */}
          <div className="text-center space-y-1.5 pb-2 border-b border-[#3D2C08]/20">
            <div className="mx-auto bg-gradient-to-tr from-[#E5A93B] to-[#C18F2E] p-2.5 rounded-full inline-flex items-center justify-center text-slate-950 mb-1 shadow-lg shadow-[#E5A93B]/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-sm font-black text-[#E5A93B] uppercase tracking-wider">Complete Profile</h2>
            <p className="text-[10px] text-slate-400 leading-relaxed px-2">
              For security, payouts, and account safety, please complete the missing information.
            </p>
          </div>

          {/* Error Box */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-2.5 rounded-xl text-[10px] leading-relaxed flex items-center space-x-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Nickname Input (If missing) */}
            {isNicknameMissing && (
              <div className="space-y-1">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Nickname</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter your nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-[#181716] border border-[#3D2C08]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Phone Input (If missing) */}
            {isPhoneMissing && (
              <div className="space-y-1">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Mobile Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Smartphone className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-9 pr-3 py-2.5 bg-[#181716] border border-[#3D2C08]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] text-xs text-white placeholder-slate-600 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Email Input (If missing) */}
            {isEmailMissing && (
              <div className="space-y-1">
                <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="h-3.5 w-3.5" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-[#181716] border border-[#3D2C08]/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#E5A93B] text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#0B0A09] bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] hover:from-[#f3b94c] hover:to-[#d09e3a] transition-all cursor-pointer shadow-md disabled:opacity-40"
              >
                {loading ? 'Saving Profile...' : 'Save and Continue'}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
}
