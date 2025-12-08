import { StockFeature, Market } from "../model/Trading";
import { IndexInfo, Sentiment } from "../model/AI";
import { CompressedMarketData } from "../model/Market";
import { DataCollector, PriceData } from "./DataCollector";
import { logger } from "../util/logger";
import { getSectorInfo } from "../data/sector-mapping";

/**
 * Context Compressor Module
 * Compresses raw market data into GPT-friendly features to reduce token usage
 */
export class ContextCompressor {
  private dataCollector: DataCollector;

  constructor(dataCollector: DataCollector) {
    this.dataCollector = dataCollector;
  }

  /**
   * Compress market data for GPT input
   */
  async compressMarketData(
    tickers: string[],
    indexInfo: IndexInfo,
    sentiment: Sentiment,
    market: Market = Market.DOMESTIC,
    breakingNews: any[] = []
  ): Promise<CompressedMarketData> {
    try {
      logger.info("Compressing market data...", {
        ticker_count: tickers.length,
        market,
      });

      // Collect detailed prices with OHLC
      const detailedPrices = await this.dataCollector.collectDetailedPrices(
        tickers,
        market
      );
      logger.info("📈 Detailed stock prices collected", {
        total_tickers: tickers.length,
        prices_found: detailedPrices.size,
        tickers_with_prices: Array.from(detailedPrices.keys()),
      });

      // Generate features for each stock
      const features: StockFeature[] = [];
      let successCount = 0;
      let failureCount = 0;
      const failureReasons: Record<string, number> = {};

      for (const ticker of tickers) {
        const priceData = detailedPrices.get(ticker);
        if (!priceData) {
          logger.warn(`⚠️ No price data for ticker ${ticker}`);
          failureCount++;
          failureReasons["no_price"] = (failureReasons["no_price"] || 0) + 1;
          continue;
        }

        try {
          const feature = await this.generateStockFeature(
            ticker,
            priceData,
            market
          );
          if (feature) {
            features.push(feature);
            successCount++;
            logger.debug(`✅ Feature generated for ${ticker}`, {
              price: feature.price,
              intraday_return: feature.intraday_return.toFixed(4),
              volume_ratio: feature.volume_ratio.toFixed(2),
            });
          } else {
            failureCount++;
            failureReasons["insufficient_history"] =
              (failureReasons["insufficient_history"] || 0) + 1;
            logger.warn(`⚠️ Feature generation returned null for ${ticker}`);
          }
        } catch (error: any) {
          failureCount++;
          const errorType = error?.message?.includes("초과")
            ? "rate_limit"
            : "unknown_error";
          failureReasons[errorType] = (failureReasons[errorType] || 0) + 1;
          logger.warn(`❌ Failed to generate feature for ${ticker}`, {
            ticker,
            error: error?.message || error,
          });
        }
      }

      logger.info("📊 Feature generation summary", {
        success: successCount,
        failures: failureCount,
        failure_breakdown: failureReasons,
        success_rate: `${((successCount / tickers.length) * 100).toFixed(1)}%`,
      });

      // Sort by feature score (combination of volume and volatility)
      features.sort((a, b) => {
        const scoreA = a.volume_ratio * (1 + Math.abs(a.intraday_return));
        const scoreB = b.volume_ratio * (1 + Math.abs(b.intraday_return));
        return scoreB - scoreA;
      });

      // Take top N stocks
      const topFeatures = features.slice(0, 50);

      logger.info("Market data compressed", {
        input_tickers: tickers.length,
        output_features: topFeatures.length,
        breaking_news_count: breakingNews.length,
      });

      return {
        index: indexInfo,
        sentiment,
        universe_features: topFeatures,
        breaking_news: breakingNews.length > 0 ? breakingNews : undefined,
      };
    } catch (error) {
      logger.error("Failed to compress market data", { error });
      throw error;
    }
  }

  /**
   * Generate features for a single stock
   */
  private async generateStockFeature(
    ticker: string,
    priceData: PriceData,
    market: Market = Market.DOMESTIC
  ): Promise<StockFeature | null> {
    const currentPrice = priceData.current;
    try {
      // Get historical data (last 30 days)
      const history = await this.dataCollector.getStockHistory(
        ticker,
        30,
        market
      );

      logger.debug(`📊 History data for ${ticker}`, {
        ticker,
        history_length: history.length,
        market,
        history_sample: history.slice(0, 3),
      });

      const historyWindow = history.slice(0, 30);

      // History array: [most_recent, ..., oldest]
      // historyWindow[0] = most recent (yesterday or today if market is open)
      // historyWindow[1] = previous day

      // Get yesterday's close price (or most recent if today's data not available)
      // If history[0] is today, use history[1] as previous close
      // Otherwise, use history[0] as previous close
      const yesterdayClose =
        history.length > 1
          ? history[1]?.close
          : history[0]?.close || currentPrice;
      const mostRecentClose = historyWindow[0]?.close || currentPrice;

      // Today's volume: use most recent volume
      const todayVolume = historyWindow[0]?.volume || 0;
      const averageVolume =
        historyWindow.length > 0
          ? historyWindow.reduce((sum, d) => sum + d.volume, 0) /
            historyWindow.length
          : 0;

      // Calculate volume ratio
      const volumeRatio = averageVolume > 0 ? todayVolume / averageVolume : 1;

      // Reverse to chronological order (oldest first) for AI
      const history7d = historyWindow.slice(0, 7).slice().reverse();
      const history30d = historyWindow.slice().reverse();

      logger.info(`📈 Processed history for ${ticker}`, {
        ticker,
        market,
        history_length: history.length,
        history_7d_length: history7d.length,
        history_30d_length: history30d.length,
        current_price: currentPrice,
        yesterday_close: yesterdayClose,
        most_recent_close: mostRecentClose,
        today_volume: todayVolume,
        average_volume: averageVolume,
        volume_ratio: volumeRatio.toFixed(2),
        history_7d_first: history7d[0],
        history_7d_last: history7d[history7d.length - 1],
        history_30d_first: history30d[0],
        history_30d_last: history30d[history30d.length - 1],
      });

      // If no history, create minimal feature with price only
      if (history.length < 2) {
        logger.warn(
          `📉 Insufficient history data for ${ticker}, creating minimal feature`,
          {
            ticker,
            market,
            history_length: history.length,
            current_price: currentPrice,
            today_volume: todayVolume,
            note: "Will use price-only data. AI may request more data.",
          }
        );

        // Return minimal feature with price only
        // Still include available history data even if insufficient
        const fromPrevCloseReturn =
          priceData.prev_close > 0
            ? (currentPrice - priceData.prev_close) / priceData.prev_close
            : 0;

        const sectorInfo = getSectorInfo(ticker);

        return {
          ticker,
          name: ticker,
          price: currentPrice,
          prev_close: priceData.prev_close,
          open: priceData.open,
          high: priceData.high,
          low: priceData.low,
          intraday_return: 0, // Cannot calculate without previous close
          from_prev_close_return: fromPrevCloseReturn,
          volume_ratio:
            todayVolume > 0 && averageVolume > 0
              ? todayVolume / averageVolume
              : 1.0,
          today_volume: todayVolume,
          average_volume_30d: averageVolume,
          volatility_20d: 0,
          atr_14d: 0,
          ema5_position: 1.0,
          ema20_position: 1.0,
          sector: `${sectorInfo.sector} - ${sectorInfo.industry}`,
          sector_strength: 0.5,
          history_7d: history7d, // Include whatever data we have
          history_30d: history30d, // Include whatever data we have
        };
      }

      logger.debug(
        `📊 Processing ${ticker} with ${history.length} days of data`
      );

      // Calculate intraday return
      // Use yesterday's close (history[1]) if available, otherwise use most recent (history[0])
      // If current price equals previous close, intraday return is 0%
      const previousClose = yesterdayClose;
      const intradayReturn =
        previousClose > 0 ? (currentPrice - previousClose) / previousClose : 0;

      logger.info(`📊 Calculated metrics for ${ticker}`, {
        ticker,
        market,
        current_price: currentPrice,
        previous_close: previousClose,
        intraday_return: `${(intradayReturn * 100).toFixed(2)}%`,
        today_volume: todayVolume,
        average_volume: averageVolume,
        volume_ratio: volumeRatio.toFixed(2),
        has_volume_data: todayVolume > 0,
        has_history_data: history.length >= 2,
      });

      // Calculate 20-day volatility
      const returns = history.slice(0, 20).map((d, i) => {
        if (i === 0) return 0;
        return (d.close - history[i - 1].close) / history[i - 1].close;
      });
      const volatility = this.calculateStdDev(returns);

      // Calculate ATR (14-day)
      const atr = this.calculateATR(history, priceData.high, priceData.low, 14);

      // Calculate EMAs
      const ema5 = this.calculateEMA(
        history.slice(0, 5).map((d) => d.close),
        5
      );
      const ema20 = this.calculateEMA(
        history.slice(0, 20).map((d) => d.close),
        20
      );

      const fromPrevCloseReturn =
        priceData.prev_close > 0
          ? (currentPrice - priceData.prev_close) / priceData.prev_close
          : intradayReturn;

      const sectorInfo = getSectorInfo(ticker);

      const feature: StockFeature = {
        ticker,
        name: ticker, // TODO: Get actual name
        price: currentPrice,
        prev_close: priceData.prev_close,
        open: priceData.open,
        high: priceData.high,
        low: priceData.low,
        intraday_return: intradayReturn,
        from_prev_close_return: fromPrevCloseReturn,
        volume_ratio: volumeRatio,
        today_volume: todayVolume,
        average_volume_30d: averageVolume,
        volatility_20d: volatility,
        atr_14d: atr,
        ema5_position: ema5 > 0 ? currentPrice / ema5 : 1,
        ema20_position: ema20 > 0 ? currentPrice / ema20 : 1,
        sector: `${sectorInfo.sector} - ${sectorInfo.industry}`,
        sector_strength: 0.5, // TODO: Calculate sector strength
        history_7d: history7d,
        history_30d: history30d,
      };

      return feature;
    } catch (error) {
      logger.warn("Failed to generate stock feature", { ticker, error });
      return null;
    }
  }

  /**
   * Calculate Exponential Moving Average
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

  /**
   * Calculate Average True Range (ATR) - simplified version
   * Uses close prices to estimate true range
   */
  private calculateATR(
    history: { close: number; volume: number }[],
    currentHigh: number,
    currentLow: number,
    period: number = 14
  ): number {
    if (history.length < 2) return 0;

    const trueRanges: number[] = [];

    // Calculate true range for each day
    // TR = max(high - low, |high - prev_close|, |low - prev_close|)
    // Since we don't have historical high/low, we approximate using close prices
    for (let i = 0; i < Math.min(period, history.length - 1); i++) {
      const currentClose = history[i].close;
      const prevClose = history[i + 1].close;

      // Approximate true range using close prices
      // TR ≈ |current_close - prev_close|
      const tr = Math.abs(currentClose - prevClose);
      trueRanges.push(tr);
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
    const atr = trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;

    return atr;
  }

  /**
   * Filter stocks by liquidity and volatility
   */
  filterStockUniverse(
    allTickers: string[],
    heldTickers: string[],
    maxCount: number = 50
  ): string[] {
    // Combine held positions with top candidates
    const uniqueTickers = new Set([...heldTickers, ...allTickers]);

    // Return up to maxCount tickers
    return Array.from(uniqueTickers).slice(0, maxCount);
  }
}
