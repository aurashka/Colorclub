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
  
  let totalDuration = 60;
  let lockTime = 15;
  
  if (roomId === '30s') {
    totalDuration = 30;
    lockTime = 15;
  } else if (roomId === '1m') {
    totalDuration = 60;
    lockTime = 15;
  } else if (roomId === '3m') {
    totalDuration = 180;
    lockTime = 15;
  }
  
  const periodIndex = Math.floor(secondsIntoDay / totalDuration) + 1;
  const timeLeft = totalDuration - (secondsIntoDay % totalDuration);
  const isLocked = timeLeft <= lockTime;
  
  // Format: YYYYMMDD + padded index
  const dateObj = new Date(nowSec * 1000);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const periodId = `${dateStr}${String(periodIndex).padStart(4, '0')}`;
  
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

// 32-bit FNV-1a hash combined with a Murmur3-like finalizer to get a high-quality deterministic pseudo-random index (0-9)
export function getDeterministicNumber(periodId: string, roomId: string): number {
  const str = `${periodId}_${roomId}_prism_secret_salt_928374`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  
  let uHash = hash >>> 0;
  uHash = Math.imul(uHash ^ (uHash >>> 15), 2246822507) >>> 0;
  uHash = Math.imul(uHash ^ (uHash >>> 13), 3266489909) >>> 0;
  uHash = (uHash ^ (uHash >>> 16)) >>> 0;
  
  return uHash % 10;
}

// Generates the correct period ID for any specific timestamp
export function getPeriodIdForTimestamp(roomId: RoomType, timestampSec: number): string {
  const secondsIntoDay = timestampSec % 86400;
  let totalDuration = 60;
  if (roomId === '30s') {
    totalDuration = 30;
  } else if (roomId === '1m') {
    totalDuration = 60;
  } else if (roomId === '3m') {
    totalDuration = 180;
  }
  
  const periodIndex = Math.floor(secondsIntoDay / totalDuration) + 1;
  const dateObj = new Date(timestampSec * 1000);
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  return `${dateStr}${String(periodIndex).padStart(4, '0')}`;
}

// Retrieves the last completed period IDs count
export function getRecentPeriodIds(roomId: RoomType, count: number): string[] {
  const nowSec = Math.floor(Date.now() / 1000);
  let totalDuration = 60;
  if (roomId === '30s') {
    totalDuration = 30;
  } else if (roomId === '1m') {
    totalDuration = 60;
  } else if (roomId === '3m') {
    totalDuration = 180;
  }
  
  const activePeriodStartSec = nowSec - (nowSec % totalDuration);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const targetSec = activePeriodStartSec - (i * totalDuration) - 5;
    ids.push(getPeriodIdForTimestamp(roomId, targetSec));
  }
  return ids;
}

// Reconstructs the full details of a deterministic pseudo-random period
export function getDeterministicResult(periodId: string, roomId: RoomType): GamePeriod {
  const num = getDeterministicNumber(periodId, roomId);
  const mapping = COLOR_MAP[num as keyof typeof COLOR_MAP];
  
  const year = parseInt(periodId.slice(0, 4), 10);
  const month = parseInt(periodId.slice(4, 6), 10) - 1;
  const day = parseInt(periodId.slice(6, 8), 10);
  const index = parseInt(periodId.slice(8, 12), 10);
  
  let totalDuration = 60;
  if (roomId === '30s') {
    totalDuration = 30;
  } else if (roomId === '1m') {
    totalDuration = 60;
  } else if (roomId === '3m') {
    totalDuration = 180;
  }
  
  const secondsIntoDay = index * totalDuration;
  const dateObj = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const timestamp = dateObj.getTime() + secondsIntoDay * 1000;
  
  return {
    periodId,
    roomId,
    number: num,
    color: mapping.color,
    premiumColor: mapping.premiumColor,
    timestamp
  };
}

