export const MARKET_INFO = {
    DOMESTIC: { flag: '🇰🇷', name: 'Korea', hours: '09:00-15:30 KST' },
    US: { flag: '🇺🇸', name: 'United States', hours: '23:30-06:00 KST' },
    HK: { flag: '🇭🇰', name: 'Hong Kong', hours: '10:30-17:00 KST' },
    JP: { flag: '🇯🇵', name: 'Japan', hours: '09:00-15:00 KST' },
    CN: { flag: '🇨🇳', name: 'China', hours: '10:30-16:00 KST' },
} as const;

export type MarketKey = keyof typeof MARKET_INFO;
