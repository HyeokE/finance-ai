import { StockFeature, Market, OHLCVolumePoint } from "../model/Trading";
import { PriceData } from "./DataCollector";
import { logger } from "../util/logger";

export interface SectorInfo {
  sector: string;
  industry: string;
}

export interface SupplyDemandInfo {
  foreign_net_buy: number;
  institution_net_buy: number;
}

/**
 * FeatureBuilder Module
 * Transforms raw market data into AI-ready features
 */
export class FeatureBuilder {
  /**
   * Build stock features from collected raw data
   */
  buildStockFeatures(
    tickers: string[],
    priceData: Map<string, PriceData>,
    historyData: Map<string, OHLCVolumePoint[]>,
    sectorData: Map<string, SectorInfo>,
    supplyData: Map<string, SupplyDemandInfo>
  ): StockFeature[] {
    logger.info("Building stock features", {
      ticker_count: tickers.length,
    });

    const features: StockFeature[] = [];

    for (const ticker of tickers) {
      try {
        const feature = this.buildSingleFeature(
          ticker,
          priceData.get(ticker),
          historyData.get(ticker) || [],
          sectorData.get(ticker),
          supplyData.get(ticker)
        );

        if (feature) {
          features.push(feature);
        }
      } catch (error: any) {
        logger.error(`Failed to build feature for ${ticker}`, {
          ticker,
          error: error.message,
        });
      }
    }

    logger.info("Stock features built", {
      total_tickers: tickers.length,
      features_built: features.length,
      success_rate: `${((features.length / tickers.length) * 100).toFixed(1)}%`,
    });

    return features;
  }

  /**
   * Build feature for a single stock
   */
  private buildSingleFeature(
    ticker: string,
    priceData: PriceData | undefined,
    history: OHLCVolumePoint[],
    sectorInfo: SectorInfo | undefined,
    supplyInfo: SupplyDemandInfo | undefined
  ): StockFeature | null {
    if (!priceData) {
      logger.warn(`No price data for ${ticker}`);
      return null;
    }

    const currentPrice = priceData.current;

    // Calculate intraday return
    const intradayReturn = this.calculateIntraDayReturn(
      currentPrice,
      priceData.open
    );

    // Calculate return from previous close
    const fromPrevCloseReturn = this.calculateFromPrevCloseReturn(
      currentPrice,
      priceData.prev_close
    );

    // Get today's volume and calculate volume ratio
    const todayVolume = history[0]?.volume || 0;
    const volumeRatio = this.calculateVolumeRatio(todayVolume, history);
    const averageVolume30d =
      history.length > 0
        ? history.slice(0, 30).reduce((sum, d) => sum + d.volume, 0) /
          Math.min(30, history.length)
        : 0;

    // Calculate volatility (20-day)
    const volatility20d = this.calculateVolatility(history, 20);

    // Calculate ATR (14-day)
    const atr14d = this.calculateATR(history, priceData.high, priceData.low, 14);

    // Calculate EMAs
    const ema5 = this.calculateEMA(
      history.slice(0, 5).map((d) => d.close),
      5
    );
    const ema20 = this.calculateEMA(
      history.slice(0, 20).map((d) => d.close),
      20
    );

    // Calculate RSI (14-day)
    const rsi14d = this.calculateRSI(history, 14);

    // Prepare history arrays for AI (chronological order - oldest first)
    const history7d = history.slice(0, 7).reverse();
    const history30d = history.slice(0, 30).reverse();

    const feature: StockFeature = {
      ticker,
      name: ticker,
      price: currentPrice,
      prev_close: priceData.prev_close,
      open: priceData.open,
      high: priceData.high,
      low: priceData.low,
      intraday_return: intradayReturn,
      from_prev_close_return: fromPrevCloseReturn,
      volume_ratio: volumeRatio,
      today_volume: todayVolume,
      average_volume_30d: averageVolume30d,
      volatility_20d: volatility20d,
      atr_14d: atr14d,
      ema5_position: ema5 > 0 ? currentPrice / ema5 : 1,
      ema20_position: ema20 > 0 ? currentPrice / ema20 : 1,
      sector: sectorInfo
        ? `${sectorInfo.sector} - ${sectorInfo.industry}`
        : "Unknown",
      sector_strength: 0.5,
      history_7d: history7d,
      history_30d: history30d,
      // New fields from supply/demand
      foreign_net_buy: supplyInfo?.foreign_net_buy,
      institution_net_buy: supplyInfo?.institution_net_buy,
      rsi_14d: rsi14d,
    };

    return feature;
  }

  /**
   * Calculate intraday return: (current / open - 1)
   */
  private calculateIntraDayReturn(current: number, open: number): number {
    if (open <= 0) return 0;
    return (current - open) / open;
  }

  /**
   * Calculate return from previous close: (current / prev_close - 1)
   */
  private calculateFromPrevCloseReturn(
    current: number,
    prevClose: number
  ): number {
    if (prevClose <= 0) return 0;
    return (current - prevClose) / prevClose;
  }

  /**
   * Calculate volume ratio: today_volume / average_volume_20d
   */
  private calculateVolumeRatio(
    todayVolume: number,
    history: OHLCVolumePoint[]
  ): number {
    if (history.length === 0) return 1;

    const window = history.slice(0, 20);
    const averageVolume =
      window.reduce((sum, d) => sum + d.volume, 0) / window.length;

    if (averageVolume <= 0) return 1;
    return todayVolume / averageVolume;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  private calculateVolatility(
    history: OHLCVolumePoint[],
    period: number
  ): number {
    if (history.length < 2) return 0;

    const window = history.slice(0, Math.min(period, history.length));
    const returns = window.map((d, i) => {
      if (i === 0) return 0;
      const prevClose = window[i - 1]?.close || d.close;
      if (prevClose <= 0) return 0;
      return (d.close - prevClose) / prevClose;
    });

    return this.calculateStdDev(returns);
  }

  /**
   * Calculate ATR (Average True Range)
   */
  private calculateATR(
    history: OHLCVolumePoint[],
    currentHigh: number,
    currentLow: number,
    period: number = 14
  ): number {
    if (history.length < 2) return 0;

    const trueRanges: number[] = [];

    // Calculate true range for historical data
    for (let i = 0; i < Math.min(period, history.length - 1); i++) {
      const current = history[i];
      const prev = history[i + 1];

      // For history data with OHLC, we can calculate proper TR
      if (current.open && current.high && current.low) {
        const tr = Math.max(
          current.high - current.low,
          Math.abs(current.high - prev.close),
          Math.abs(current.low - prev.close)
        );
        trueRanges.push(tr);
      } else {
        // Fallback: use close price differences
        const tr = Math.abs(current.close - prev.close);
        trueRanges.push(tr);
      }
    }

    // Add today's true range if we have current OHLC
    if (currentHigh > 0 && currentLow > 0 && history.length > 0) {
      const prevClose = history[0].close;
      const todayTR = Math.max(
        currentHigh - currentLow,
        Math.abs(currentHigh - prevClose),
        Math.abs(currentLow - prevClose)
      );
      trueRanges.unshift(todayTR);
    }

    if (trueRanges.length === 0) return 0;

    // ATR is the average of true ranges
    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  private calculateRSI(
    history: OHLCVolumePoint[],
    period: number = 14
  ): number {
    if (history.length < period + 1) return 50; // Neutral RSI if insufficient data

    const window = history.slice(0, period + 1);
    const changes: number[] = [];

    // Calculate price changes
    for (let i = 0; i < period; i++) {
      const change = window[i].close - window[i + 1].close;
      changes.push(change);
    }

    // Separate gains and losses
    const gains = changes.map((c) => (c > 0 ? c : 0));
    const losses = changes.map((c) => (c < 0 ? Math.abs(c) : 0));

    // Calculate average gain and loss
    const avgGain = gains.reduce((sum, g) => sum + g, 0) / period;
    const avgLoss = losses.reduce((sum, l) => sum + l, 0) / period;

    if (avgLoss === 0) return 100; // All gains, max RSI
    if (avgGain === 0) return 0; // All losses, min RSI

    // Calculate RS and RSI
    const rs = avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);

    return rsi;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }
}

