import { Market } from './Trading';

// Re-export Market enum for convenience
export { Market };

export interface MarketBatchSettings {
    id?: string;
    market: Market;
    enabled: boolean;
    schedule_times: string[]; // ["09:05", "10:30", ...]
    max_stocks: number;
    created_at?: Date;
    updated_at?: Date;
}

export interface MarketRiskSettings {
    id?: string;
    market: Market;
    max_position_weight: number;
    max_total_investment: number;
    min_confidence: number;
    stop_loss_pct: number;
    max_trades_per_batch: number;
    created_at?: Date;
    updated_at?: Date;
}
