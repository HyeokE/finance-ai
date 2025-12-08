export const MARKET_INFO = {
    DOMESTIC: { flag: '🇰🇷', name: 'Korea', hours: '09:00-15:30 KST' },
    US: { flag: '🇺🇸', name: 'United States', hours: '23:30-06:00 KST' },
} as const;

export type MarketKey = keyof typeof MARKET_INFO;
