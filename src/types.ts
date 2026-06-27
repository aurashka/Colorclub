export type RoomType = 'parity' | 'sapre'; // Parity = 1 min, Sapre = 3 min

export interface UserProfile {
  uid: string;
  phone: string;
  password?: string; // used for verification
  nickname: string;
  wallet: number;
  inviteCode?: string;
  isAdmin?: boolean;
  createdAt: number;
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
  phone: string;
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
  utr: string; // transaction reference number
  status: 'pending' | 'approved' | 'rejected' | 'hold';
  holdReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WithdrawalRequest {
  withdrawalId: string;
  userId: string;
  phone: string;
  nickname: string;
  amount: number;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  upi?: string;
  status: 'pending' | 'approved' | 'rejected' | 'hold';
  holdReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AdminSettings {
  activePeriodOverride?: {
    [roomId: string]: number; // roomId -> overridden number (0-9)
  };
}
