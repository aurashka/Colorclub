export type RoomType = '30s' | '1m' | '3m';

export interface UserProfile {
  uid: string;
  email: string; // main Email
  phone?: string; // optional Phone
  password?: string; // used for verification
  nickname: string;
  wallet: number;
  inviteCode?: string;
  referredBy?: string;
  referredByUserKey?: string;
  hasDeposited?: boolean;
  role?: 'admin' | 'user';
  isAdmin?: boolean;
  createdAt: number;
  interestEarned?: number;
}

export interface ReferralCommissionLog {
  logId: string;
  referrerKey: string;
  referredUserNickname: string;
  referredUserEmail: string;
  type: 'bet' | 'deposit';
  amount: number;
  sourceAmount: number;
  timestamp: number;
}

export interface GamePeriod {
  periodId: string;
  roomId: RoomType;
  number: number; // 0-9
  color: 'red' | 'green' | 'violet' | 'red-violet' | 'green-violet';
  premiumColor: string; // Red, Green, Violet, Red & Violet, Green & Violet
  timestamp: number;
  totalBids?: number;
  totalAmount?: number;
  manipulated?: boolean;
}

export interface BidRecord {
  bidId: string;
  userId: string;
  phone?: string;
  email?: string;
  nickname: string;
  periodId: string;
  roomId: RoomType;
  selection: 'red' | 'green' | 'violet' | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'small' | 'big';
  amount: number;
  status: 'pending' | 'won' | 'lost';
  winAmount: number;
  createdAt: number;
}

export interface DepositRequest {
  depositId: string;
  userId: string;
  phone: string;
  nickname: string;
  amount: number;
  utr: string; // fallback or general reference
  fieldsData?: { [key: string]: string }; // customizable input fields submitted by user
  status: 'pending' | 'approved' | 'rejected' | 'hold';
  holdReason?: string;
  channel?: string; // name of selected deposit method
  createdAt: number;
  updatedAt: number;
}

export interface WithdrawalRequest {
  withdrawalId: string;
  userId: string;
  phone: string;
  nickname: string;
  amount: number;
  fieldsData?: { [key: string]: string }; // dynamic custom fields
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upi?: string;
  status: 'pending' | 'approved' | 'rejected' | 'hold';
  holdReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DepositChannelField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number';
  required: boolean;
}

export interface DepositChannel {
  id: string;
  name: string;
  type: 'qr' | 'upi' | 'bank' | 'custom';
  bonus: number; // multiplier, e.g. 0.20 for 20%
  upiId?: string;
  qrCodeUrl?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  accountHolder?: string;
  requiredFields: DepositChannelField[];
}

export interface WithdrawalField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'number';
  required: boolean;
}

export interface AdminSettings {
  activePeriodOverride?: {
    [roomId: string]: number; // roomId -> overridden number (0-9)
  };
}

export interface AppConfig {
  appName: string;
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  telegramSupport: string;
  whatsappSupport: string;
  currencySymbol: string;
  currencyName: string;
  interestRate?: number;
  lastInterestDistributed?: number;
  supportEmail?: string;
  supportChatLink?: string;
  referralDomain?: string;
}

export interface GiftCoupon {
  id: string;
  code: string;
  amount: number;
  expiryType: 'hours' | 'days' | 'unlimited';
  expiryDuration?: number;
  expiryTimestamp: number; // calculated epoch timestamp. If unlimited, set to 9999999999999 (distant future)
  audienceType: 'everyone' | 'single_user';
  targetUserEmail?: string;
  claimedUsers?: { [userKey: string]: { timestamp: number, email: string, nickname: string } };
  createdAt: number;
}

export interface SupportMessage {
  msgId: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: number;
}

export interface SupportChat {
  userKey: string;
  email: string;
  nickname: string;
  messages?: { [msgId: string]: SupportMessage };
  unreadCountForAdmin: number;
  unreadCountForUser: number;
  blocked?: boolean;
  lastMessageTimestamp: number;
}
