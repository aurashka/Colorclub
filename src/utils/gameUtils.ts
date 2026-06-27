import { RoomType, GamePeriod } from '../types';

export const COLOR_MAP = {
  0: { color: 'red-violet' as const, premiumColor: 'Red & Violet', colors: ['red', 'violet'] },
  1: { color: 'green' as const, premiumColor: 'Green', colors: ['green'] },
  2: { color: 'red' as const, premiumColor: 'Red', colors: ['red'] },
  3: { color: 'green' as const, premiumColor: 'Green', colors: ['green'] },
  4: { color: 'red' as const, premiumColor: 'Red', colors: ['red'] },
  5: { color: 'green-violet' as const, premiumColor: 'Green & Violet', colors: ['green', 'violet'] },
  6: { color: 'red' as const, premiumColor: 'Red', colors: ['red'] },
  7: { color: 'green' as const, premiumColor: 'Green', colors: ['green'] },
  8: { color: 'red' as const, premiumColor: 'Red', colors: ['red'] },
  9: { color: 'green' as const, premiumColor: 'Green', colors: ['green'] }
};

export function getPeriodDetails(roomId: RoomType): {
  periodId: string;
  timeLeft: number;
  isLocked: boolean;
  totalDuration: number;
  lockTime: number;
} {
  const nowSec = Math.floor(Date.now() / 1000);
  const secondsIntoDay = nowSec % 86400;
  
  const totalDuration = roomId === 'parity' ? 60 : 180;
  const lockTime = roomId === 'parity' ? 10 : 30; // 10s for 1 min, 30s for 3 min
  
  const periodIndex = Math.floor(secondsIntoDay / totalDuration) + 1;
  const timeLeft = totalDuration - (secondsIntoDay % totalDuration);
  const isLocked = timeLeft <= lockTime;
  
  // Format: YYYYMMDD + padded index
  const dateObj = new Date(nowSec * 1000);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const padLength = roomId === 'parity' ? 4 : 3;
  const periodId = `${dateStr}${String(periodIndex).padStart(padLength, '0')}`;
  
  return {
    periodId,
    timeLeft,
    isLocked,
    totalDuration,
    lockTime
  };
}

// Generate period result based on number
export function generatePeriodResult(periodId: string, roomId: RoomType, num: number): GamePeriod {
  const mapping = COLOR_MAP[num as keyof typeof COLOR_MAP];
  return {
    periodId,
    roomId,
    number: num,
    color: mapping.color,
    premiumColor: mapping.premiumColor,
    timestamp: Date.now()
  };
}

// Check if a bid won and calculate payout
export function calculateBidResult(
  selection: string,
  amount: number,
  winningNum: number
): { status: 'won' | 'lost'; winAmount: number } {
  const mapping = COLOR_MAP[winningNum as keyof typeof COLOR_MAP];
  const isNumberSelection = !isNaN(Number(selection));
  
  if (isNumberSelection) {
    if (Number(selection) === winningNum) {
      // Direct number match pays 9x
      return { status: 'won', winAmount: amount * 9 };
    }
    return { status: 'won' as const, winAmount: 0 }.status === 'won' ? { status: 'lost', winAmount: 0 } : { status: 'lost', winAmount: 0 };
  }
  
  // Color or size selection
  if (selection === 'violet') {
    if (winningNum === 0 || winningNum === 5) {
      // Violet match pays 4.5x
      return { status: 'won', winAmount: amount * 4.5 };
    }
  } else if (selection === 'green') {
    if (winningNum === 1 || winningNum === 3 || winningNum === 7 || winningNum === 9) {
      // Green match pays 2x
      return { status: 'won', winAmount: amount * 2 };
    } else if (winningNum === 5) {
      // Green-Violet match pays 1.5x
      return { status: 'won', winAmount: amount * 1.5 };
    }
  } else if (selection === 'red') {
    if (winningNum === 2 || winningNum === 4 || winningNum === 6 || winningNum === 8) {
      // Red match pays 2x
      return { status: 'won', winAmount: amount * 2 };
    } else if (winningNum === 0) {
      // Red-Violet match pays 1.5x
      return { status: 'won', winAmount: amount * 1.5 };
    }
  } else if (selection === 'small') {
    if ([0, 1, 2, 3, 4].includes(winningNum)) {
      // Small wins pays 2x
      return { status: 'won', winAmount: amount * 2 };
    }
  } else if (selection === 'big') {
    if ([5, 6, 7, 8, 9].includes(winningNum)) {
      // Big wins pays 2x
      return { status: 'won', winAmount: amount * 2 };
    }
  }
  
  return { status: 'lost', winAmount: 0 };
}
