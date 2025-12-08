import { Portfolio, StockFeature } from "./Trading";

/**
 * AI-related TypeScript interfaces and types
 */

/**
 * Market index information
 */
export interface IndexInfo {
  KOSPI: {
    price: number;
    change_pct: number;
    volume: number;
  };
  KOSDAQ: {
    price: number;
    change_pct: number;
    volume: number;
  };
  SP500?: {
    price: number;
    change_pct: number;
  };
  NASDAQ?: {
    price: number;
    change_pct: number;
  };
  HANG_SENG?: {
    price: number;
    change_pct: number;
  };
  NIKKEI?: {
    price: number;
    change_pct: number;
  };
  VIX?: {
    price: number;
    change_pct: number;
  };
}

/**
 * Breaking news item
 */
export interface NewsItem {
  date: string; // YYYYMMDD
  time: string; // HHMMSS
  ticker?: string;
  stock_name?: string;
  title: string;
  category?: string;
  serial_number?: string;
}

/**
 * Market sentiment indicators
 */
export interface Sentiment {
  fear_greed_index?: number; // 0-100
  vix?: number; // Volatility index
  foreign_net_buy_krw: number; // Foreign investor net buy amount
  institution_net_buy_krw: number; // Institutional net buy amount
  short_selling_ratio?: number; // Short selling %
  credit_balance_change_pct?: number; // Credit balance change %
}

/**
 * Market context for AI
 */
export interface MarketContext {
  index: IndexInfo;
  sentiment: Sentiment;
  exchange_rates?: Record<string, number>; // Currency exchange rates (USDKRW, HKDKRW, JPYKRW, CNYKRW)
  breaking_news?: NewsItem[]; // Recent breaking news (max 20 items)
}

/**
 * Risk constraints for trading
 */
export interface Constraints {
  max_position_weight: number; // e.g., 0.20 = 20%
  max_total_investment: number; // e.g., 0.80 = 80%
  min_cash_reserve: number; // e.g., 0.20 = 20%
  stop_loss_pct: number; // e.g., -0.03 = -3%
  take_profit_pct?: number; // e.g., 0.10 = 10%
  max_trades_per_batch: number; // e.g., 10
  min_order_amount: number; // e.g., 100000 KRW
  min_confidence_to_trade: number; // e.g., 0.6
}

/**
 * AI input structure
 */
export interface AIInput {
  portfolio: Portfolio;
  market: MarketContext;
  stocks: StockFeature[];
  constraints: Constraints;
}

/**
 * Single trading decision
 */
export interface Decision {
  ticker: string;
  name?: string; // Stock name (e.g., "Apple", "삼성전자")
  action: "BUY" | "SELL" | "HOLD";
  amount_krw?: number;
  quantity?: number;
  confidence: number; // 0-1
  reason: string;
}

/**
 * Position summary for AI output
 */
export interface PositionSummary {
  total_trades: number;
  buy_count: number;
  sell_count: number;
  hold_count: number;
  total_buy_amount_krw: number;
  total_sell_amount_krw: number;
}

/**
 * Risk check for AI output
 */
export interface RiskCheck {
  cash_after_trades: number;
  cash_ratio_after_trades: number;
  constraints_satisfied: boolean;
  warnings: string[];
}

/**
 * AI output structure
 */
export interface AIOutput {
  decisions: Decision[];
  market_view: string; // Overall market assessment
  risk_level: "low" | "medium" | "high";
  missing_data?: string[]; // List of data that would be helpful but is currently missing
  position_summary?: PositionSummary; // Summary of proposed trades
  risk_check?: RiskCheck; // Risk assessment of proposed trades
}

/**
 * Default risk constraints
 */
export const DEFAULT_CONSTRAINTS: Constraints = {
  max_position_weight: parseFloat(process.env.MAX_POSITION_WEIGHT || "0.20"),
  max_total_investment: parseFloat(process.env.MAX_TOTAL_INVESTMENT || "0.80"),
  min_cash_reserve: parseFloat(process.env.MIN_CASH_RESERVE || "0.20"),
  stop_loss_pct: parseFloat(process.env.STOP_LOSS_PCT || "-0.03"),
  max_trades_per_batch: parseInt(process.env.MAX_TRADES_PER_BATCH || "10"),
  min_order_amount: parseInt(process.env.MIN_ORDER_AMOUNT || "100000"),
  min_confidence_to_trade: parseFloat(
    process.env.MIN_CONFIDENCE_TO_TRADE || "0.6"
  ),
};
