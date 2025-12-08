import { Market } from "../model/Trading";

/**
 * Market trading hours and timezone utilities
 */

export interface MarketHours {
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  timezone: string;
}

/**
 * Define trading hours for each market (in KST)
 */
export const MARKET_HOURS: Record<Market, MarketHours> = {
  [Market.DOMESTIC]: {
    openHour: 9,
    openMinute: 0,
    closeHour: 15,
    closeMinute: 30,
    timezone: "Asia/Seoul",
  },
  [Market.US]: {
    // US market: 23:30 ~ 06:00 KST (next day)
    // NYSE/NASDAQ: 09:30 ~ 16:00 EST
    openHour: 23,
    openMinute: 30,
    closeHour: 6,
    closeMinute: 0,
    timezone: "Asia/Seoul", // Converted to KST
  },
};

/**
 * Check if a market is currently open for trading
 */
export function isMarketOpen(market: Market, now: Date = new Date()): boolean {
  const hours = MARKET_HOURS[market];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const openTime = hours.openHour * 60 + hours.openMinute;
  const closeTime = hours.closeHour * 60 + hours.closeMinute;

  // Handle overnight markets (US market crosses midnight in KST)
  if (market === Market.US) {
    // US market: 23:30 ~ 06:00 (next day)
    // Open if current time is after 23:30 OR before 06:00
    return currentTime >= openTime || currentTime < closeTime;
  }

  // Regular market hours (same day)
  return currentTime >= openTime && currentTime < closeTime;
}

/**
 * Get the appropriate market based on current time
 * Returns the market that is currently open, or null if no market is open
 */
export function getCurrentMarket(now: Date = new Date()): Market | null {
  // Check each market
  for (const market of Object.values(Market)) {
    if (isMarketOpen(market as Market, now)) {
      return market as Market;
    }
  }
  return null;
}

/**
 * Check if a batch request is allowed for a specific market
 * Only allow trading during market hours (with some buffer time)
 */
export function canTradeMarket(
  market: Market,
  now: Date = new Date()
): {
  allowed: boolean;
  reason?: string;
  currentMarket?: Market | null;
} {
  const currentMarket = getCurrentMarket(now);

  if (currentMarket === market) {
    return { allowed: true, currentMarket };
  }

  const hours = MARKET_HOURS[market];
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  let timeInfo: string;
  if (market === Market.US) {
    timeInfo = `23:30-06:00 KST`;
  } else {
    timeInfo = `${hours.openHour.toString().padStart(2, "0")}:${hours.openMinute
      .toString()
      .padStart(2, "0")}-${hours.closeHour
      .toString()
      .padStart(2, "0")}:${hours.closeMinute.toString().padStart(2, "0")} KST`;
  }

  return {
    allowed: false,
    reason: `${market} market is closed. Trading hours: ${timeInfo}. Current time: ${currentHour
      .toString()
      .padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")} KST`,
    currentMarket,
  };
}

/**
 * Get formatted trading hours for display
 */
export function getMarketHoursDisplay(market: Market): string {
  const hours = MARKET_HOURS[market];

  if (market === Market.US) {
    return "23:30-06:00 KST (NYSE/NASDAQ 09:30-16:00 EST)";
  }

  return `${hours.openHour.toString().padStart(2, "0")}:${hours.openMinute
    .toString()
    .padStart(2, "0")}-${hours.closeHour.toString().padStart(2, "0")}:${hours.closeMinute
    .toString()
    .padStart(2, "0")} KST`;
}

