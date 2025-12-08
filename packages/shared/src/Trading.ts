/**
 * Trading-related TypeScript interfaces and types
 */

/**
 * Market enum
 */
// Renamed to avoid conflict with MarketSettings.Market
export enum TradingMarket {
  DOMESTIC = "DOMESTIC",
  US = "US",
}

/**
 * Currency enum
 */
export enum Currency {
  KRW = "KRW",
  USD = "USD",
}

/**
 * Exchange code mapping for KIS API
 */
export const EXCHANGE_CODES: Record<TradingMarket, string> = {
  [TradingMarket.DOMESTIC]: "KRX",
  [TradingMarket.US]: "NAS", // Default to NASDAQ, can be NYS or AMS
};

/**
 * Single stock position
 */
export interface Position {
  ticker: string;
  name: string;
  quantity: number;
  avg_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight: number; // Portfolio weight (0-1)
  market?: TradingMarket; // Market type (domestic/overseas)
  currency?: Currency; // Position currency
}

/**
 * Overseas-specific position with currency info
 */
export interface OverseasPosition extends Position {
  market: TradingMarket;
  currency: Currency;
  exchange_code: string; // NAS, NYS, HKS, etc.
  market_value_krw: number; // KRW-converted value
  exchange_rate: number; // Current exchange rate
}

/**
 * Portfolio state
 */
export interface Portfolio {
  total_equity: number;
  cash: number;
  positions: Position[];
  total_market_value: number;
  cash_weight: number;
  by_market?: Record<string, number>; // Allocation by market (DOMESTIC, US, HK, JP, CN)
  by_currency?: Record<string, number>; // Allocation by currency (KRW, USD, HKD, JPY, CNY)
  realized_pl_today?: number; // Today's realized P/L
  daily_return?: number; // Today's portfolio return
}

/**
 * Order request
 */
export interface OrderRequest {
  ticker: string;
  direction: "BUY" | "SELL";
  quantity: number;
  price?: number; // Optional for market orders
  order_type: "MARKET" | "LIMIT";
}

/**
 * Order result from broker
 */
export interface OrderResult {
  broker_order_id: string;
  ticker: string;
  direction: "BUY" | "SELL";
  requested_qty: number;
  filled_qty: number;
  avg_filled_price?: number;
  status: "requested" | "partial_filled" | "filled" | "canceled" | "failed";
  error_code?: string;
  error_message?: string;
}

/**
 * Stock feature for AI input
 */
export interface PriceVolumePoint {
  close: number;
  volume: number;
}

export interface StockFeature {
  ticker: string;
  name: string;
  price: number;
  prev_close: number; // Previous day close
  open: number; // Today's open
  high: number; // Today's high
  low: number; // Today's low
  intraday_return: number; // Today's return
  from_prev_close_return: number; // (current - prev_close) / prev_close
  volume_ratio: number; // Today's volume / avg volume
  today_volume: number; // Latest trading volume
  average_volume_30d: number; // 30-day average volume
  volatility_20d: number; // 20-day volatility (std dev)
  atr_14d: number; // 14-day Average True Range
  ema5_position: number; // Current price / EMA5
  ema20_position: number; // Current price / EMA20
  sector: string;
  sector_strength: number; // Sector relative strength (0-1)
  market_cap_rank?: number;
  history_7d: PriceVolumePoint[]; // Last ~7 trading days (chronological)
  history_30d: PriceVolumePoint[]; // Last ~30 trading days (chronological)
  foreign_net_buy?: number; // Foreign investor net buy quantity/amount
  institution_net_buy?: number; // Institution net buy quantity/amount
  rsi_14d?: number; // 14-day Relative Strength Index
}

/**
 * Account balance information
 */
export interface AccountBalance {
  account_number: string;
  total_equity: number;
  cash: number;
  securities_value: number;
  positions: Position[];
  buyable_cash: number;
}

/**
 * Multi-currency account balance for overseas trading
 */
export interface OverseasAccountBalance {
  account_number: string;
  currency_balances: Map<Currency, number>; // Cash per currency
  positions: OverseasPosition[];
  total_equity_krw: number; // Total in KRW
  exchange_rates: Map<Currency, number>; // Current rates
}

/**
 * Exchange rate data
 */
export interface ExchangeRate {
  from_currency: Currency;
  to_currency: Currency;
  rate: number;
  timestamp: Date;
}
