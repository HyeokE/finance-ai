import { Market } from './MarketSettings';

/**
 * Watchlist - User-selected stocks for analysis
 */

export interface WatchlistItem {
    id: string;
    market: Market;
    ticker: string;
    name: string;
    enabled: boolean;
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface AddWatchlistRequest {
    market: Market;
    ticker: string;
    name: string;
    notes?: string;
}

export interface UpdateWatchlistRequest {
    name?: string;
    enabled?: boolean;
    notes?: string;
}
