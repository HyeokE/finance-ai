/**
 * Market data TypeScript interfaces
 */

import { IndexInfo, Sentiment, NewsItem } from "./AI";
import { StockFeature } from "./Trading";

/**
 * Raw market data collected from APIs
 */
export interface RawMarketData {
  timestamp: Date;
  index: IndexInfo;
  sentiment: Sentiment;
  stock_prices: Map<string, number>;
  stock_volumes: Map<string, number>;
}

/**
 * Compressed market data for GPT input
 */
export interface CompressedMarketData {
  index: IndexInfo;
  sentiment: Sentiment;
  universe_features: StockFeature[];
  breaking_news?: NewsItem[];
}

/**
 * Investor trading trend
 */
export interface InvestorTrend {
  date: string;
  ticker: string;
  foreign_buy: number;
  foreign_sell: number;
  institution_buy: number;
  institution_sell: number;
  individual_buy: number;
  individual_sell: number;
}

/**
 * OHLCV candle data
 */
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
