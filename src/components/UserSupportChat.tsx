import React, { useState, useEffect, useRef } from 'react';
import { ref, onValue, update, push, set, get } from 'firebase/database';
import { db } from '../firebase';
import { UserProfile, SupportChat, SupportMessage, AppConfig } from '../types';
import { 
  ChevronLeft, 
  Send, 
  MessageSquare, 
  Ban, 
  Sparkles, 
  PhoneCall, 
  Mail, 
  Headphones, 
  HelpCircle,
  FileText
} from 'lucide-react';

interface UserSupportChatProps {
  user: UserProfile;
  appConfig: AppConfig;
  onBack: () => void;
}

export default function UserSupportChat({ user, appConfig, onBack }: UserSupportChatProps) {
  const [supportChat, setSupportChat] = useState<SupportChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'faq'>('chat');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const emailKey = user.email ? user.email.toLowerCase().replace(/@/g, '_at_').replace(/\./g, '_') : (user.phone || user.uid);

  // FAQ Data for rich support experience
  const faqs = [
    {
      q: "How to deposit money into the wallet?",
      a: "Go to 'Wallet' -> 'Deposit', enter the desired amount, choose a payment method, copy the UPI ID/Bank info, complete the payment in your UPI app, and copy-paste the 12-digit UTR/Txn ID to submit."
    },
    {
      q: "What is the minimum withdrawal amount?",
      a: `The minimum withdrawal amount is ${appConfig.currencySymbol}${appConfig.minWithdrawal || 110}. Withdrawals are processed 24/7 directly to your linked bank account.`
    },
    {
      q: "My deposit is pending. What should I do?",
      a: "Deposits are usually verified within 2-5 minutes. If it takes longer, please send a message here with your UTR code and a screenshot. Our admin team will manually credit it instantly."
    },
    {
      q: "How does the daily interest wallet work?",
      a: `Every single day, you earn ${((appConfig.interestRate !== undefined ? appConfig.interestRate : 0.03) * 100).toFixed(0)}% daily compound interest on your total wallet balance! Keep funds in your wallet to earn free passive cash.`
    },
    {
      q: "What are the prediction games on this app?",
      a: "We support high-frequency 1-Minute, 3-Minute, 5-Minute, and 10-Minute Color Prediction games. Place bets on Green, Violet, Red, Big, Small, or exact Numbers to win high multipliers!"
    }
  ];

  // 1. Listen to live chat messages
  useEffect(() => {
    if (!emailKey) return;

    const chatRef = ref(db, `support_chats/${emailKey}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.val() as SupportChat;
        setSupportChat(val);
        
        // Mark as read for user
        if (val.unreadCountForUser > 0) {
          update(chatRef, { unreadCountForUser: 0 });
        }
      } else {
        setSupportChat(null);
      }
    });

    return () => unsubscribe();
  }, [emailKey]);

  // 2. Scroll to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [supportChat?.messages, activeTab]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !emailKey) return;

    if (supportChat?.blocked) {
      alert('Your support chat access has been restricted by the administrator.');
      return;
    }

    try {
      const chatRef = ref(db, `support_chats/${emailKey}`);
      const messagesRef = ref(db, `support_chats/${emailKey}/messages`);
      const newMsgRef = push(messagesRef);

      const msgObj: SupportMessage = {
        msgId: newMsgRef.key || Date.now().toString(),
        sender: 'user',
        text: newMessage.trim(),
        timestamp: Date.now()
      };

      const currentUnreadAdmin = supportChat?.unreadCountForAdmin || 0;

      // Update support chat metadata and set message
      await Promise.all([
        set(newMsgRef, msgObj),
        update(chatRef, {
          userEmail: user.email || '',
          userPhone: user.phone || 'N/A',
          userNickname: user.nickname || 'Player',
          userKey: emailKey,
          lastMessageText: newMessage.trim(),
          lastMessageTimestamp: Date.now(),
          unreadCountForAdmin: currentUnreadAdmin + 1,
          unreadCountForUser: 0,
          updatedAt: Date.now()
        })
      ]);

      setNewMessage('');
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0D121F] text-slate-100 animate-in fade-in duration-300">
      
      {/* Header bar */}
      <div className="flex items-center justify-between bg-[#0B0F17] p-4 border-b border-slate-900 sticky top-0 z-30 shrink-0">
        <div className="flex items-center space-x-3">
          <button 
            onClick={onBack}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center space-x-1.5">
              <Headphones className="w-3.5 h-3.5" />
              <span>Customer Care Support</span>
            </h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">Real-time Chat with active executives</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider">Online</span>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-900/85 bg-[#0A0E1A] p-1.5 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
            activeTab === 'chat'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Live Support Chat</span>
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
            activeTab === 'faq'
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Help FAQ Guides</span>
        </button>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-hidden flex flex-col relative min-h-0 bg-[#0A0E1A]/40">
        {activeTab === 'chat' ? (
          <div className="flex-1 flex flex-col overflow-hidden relative min-h-0">
            {/* Quick Helper Banner */}
            <div className="bg-amber-500/5 border-b border-amber-500/10 p-3 flex items-start space-x-2.5 shrink-0">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="text-[9px] text-amber-500/90 leading-relaxed font-semibold">
                <span>Welcome to real-time verification! Share deposit transaction IDs, screenshots, or withdrawal issues directly below. Our active agents manually verify and credit payouts 24/7.</span>
              </div>
            </div>

            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 flex flex-col min-h-0 custom-scrollbar">
              {supportChat && supportChat.messages && Object.keys(supportChat.messages).length > 0 ? (
                (Object.values(supportChat.messages) as SupportMessage[])
                  .sort((a, b) => a.timestamp - b.timestamp)
                  .map((msg: SupportMessage) => {
                    const isMe = msg.sender === 'user';
                    return (
                      <div 
                        key={msg.msgId} 
                        className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'} space-y-1`}
                      >
                        <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                          isMe 
                            ? 'bg-gradient-to-r from-[#E5A93B] to-[#C18F2E] text-slate-950 rounded-tr-none font-bold shadow-md shadow-amber-500/5' 
                            : 'bg-[#121824] text-slate-200 rounded-tl-none border border-slate-800'
                        }`}>
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold font-mono px-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
              ) : (
                <div className="my-auto text-center space-y-3 p-6 max-w-[280px] mx-auto">
                  <div className="w-14 h-14 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <MessageSquare className="w-7 h-7 text-amber-500/40" />
                  </div>
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">No history found</h4>
                  <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                    Send a message below to instantly launch a live chat thread with active verification desk executives.
                  </p>
                </div>
              )}

              {supportChat?.blocked && (
                <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl flex items-center space-x-2.5 shrink-0 animate-bounce">
                  <Ban className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-[10px] text-red-400 font-bold leading-tight uppercase tracking-wide">
                    Your support messaging permission is suspended.
                  </p>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Form Input Bar */}
            <form onSubmit={handleSendMessage} className="bg-[#0B0F17] p-3.5 border-t border-slate-900 flex items-center space-x-2.5 shrink-0">
              <input 
                type="text"
                value={newMessage}
                disabled={supportChat?.blocked}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={supportChat?.blocked ? "Support Chat Suspended" : "Write your concern or paste UTR code..."}
                className="flex-1 bg-slate-950 border border-slate-800/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/30 font-semibold"
              />
              <button
                type="submit"
                disabled={supportChat?.blocked || !newMessage.trim()}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-30 disabled:scale-100 text-slate-950 p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* FAQ Guides list view */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <div className="bg-slate-900/30 border border-slate-800 p-4 rounded-2xl space-y-1.5">
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">Official Support Emails & Accounts</span>
              <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                If the live desk chat is overloaded or offline, please forward payment credentials to:
              </p>
              <div className="space-y-2 pt-2 text-xs">
                {appConfig.supportEmail && (
                  <div className="flex items-center space-x-2 bg-slate-950/60 p-2 rounded-xl border border-slate-900 font-mono">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300 text-[10px]">{appConfig.supportEmail}</span>
                  </div>
                )}
                {appConfig.telegramSupport && (
                  <a 
                    href={appConfig.telegramSupport}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-sky-500/5 hover:bg-sky-500/10 p-2 rounded-xl border border-sky-500/15 text-sky-400 transition-all"
                  >
                    <div className="flex items-center space-x-2 font-mono text-[10px] font-bold">
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Telegram Channels Desk</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                  </a>
                )}
                {appConfig.whatsappSupport && (
                  <a 
                    href={appConfig.whatsappSupport}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-emerald-500/5 hover:bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/15 text-emerald-400 transition-all"
                  >
                    <div className="flex items-center space-x-2 font-mono text-[10px] font-bold">
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>WhatsApp Support Help</span>
                    </div>
                    <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                  </a>
                )}
              </div>
            </div>

            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Frequently Asked Questions</span>
            
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-slate-900/20 border border-slate-850 p-3.5 rounded-2xl space-y-1.5 hover:border-slate-800 transition-colors">
                  <span className="text-[10px] font-extrabold text-white uppercase tracking-wide block leading-snug flex items-start space-x-1.5">
                    <span className="text-amber-500 text-xs shrink-0 font-black">Q.</span>
                    <span>{faq.q}</span>
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed pl-4">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
