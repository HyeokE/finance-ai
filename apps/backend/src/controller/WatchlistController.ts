import { Request, Response } from "express";
import { SettingsRepository } from "../infrastructure/database/SettingsRepository";
import type {
  AddWatchlistRequest,
  UpdateWatchlistRequest,
} from "@auto-finance/shared";
import { logger } from "../util/logger";
import { DataCollector } from "../module/DataCollector";
import { ContextCompressor } from "../module/ContextCompressor";
import { Market } from "../model/Trading";

// Lazy initialization
let settingsRepo: SettingsRepository | null = null;
const getSettingsRepo = () => {
  if (!settingsRepo) {
    settingsRepo = new SettingsRepository();
  }
  return settingsRepo;
};

// ================== Watchlist ==================

export const getWatchlist = async (req: Request, res: Response) => {
  try {
    const market = req.params.market;
    const watchlist = await getSettingsRepo().getWatchlist(market);
    res.json({ success: true, data: watchlist });
  } catch (error) {
    logger.error("Failed to get watchlist", { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get watchlist",
    });
  }
};

export const addWatchlistItem = async (req: Request, res: Response) => {
  try {
    const item: AddWatchlistRequest = req.body;
    const result = await getSettingsRepo().addWatchlistItem(item);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Failed to add watchlist item", { error });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to add watchlist item",
    });
  }
};

export const updateWatchlistItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates: UpdateWatchlistRequest = req.body;
    const result = await getSettingsRepo().updateWatchlistItem(id, updates);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Failed to update watchlist item", { error });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update watchlist item",
    });
  }
};

export const deleteWatchlistItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await getSettingsRepo().deleteWatchlistItem(id);
    res.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete watchlist item", { error });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete watchlist item",
    });
  }
};

export const toggleWatchlistItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const result = await getSettingsRepo().toggleWatchlistItem(id, enabled);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Failed to toggle watchlist item", { error });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to toggle watchlist item",
    });
  }
};

export const getWatchlistDetailed = async (req: Request, res: Response) => {
  try {
    const market = req.params.market?.toUpperCase() || "DOMESTIC";
    const watchlist = await getSettingsRepo().getWatchlist(market);

    if (watchlist.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    logger.info("Fetching detailed data for watchlist", {
      market,
      count: watchlist.length,
      tickers: watchlist.map((w) => w.ticker),
    });

    const dataCollector = new DataCollector();
    const contextCompressor = new ContextCompressor(dataCollector);

    // Convert market string to Market enum
    let marketEnum: Market;
    switch (market) {
      case "US":
        marketEnum = Market.US;
        break;
      case "HK":
        marketEnum = Market.HONG_KONG;
        break;
      case "JP":
        marketEnum = Market.JAPAN;
        break;
      case "CN":
        marketEnum = Market.CHINA;
        break;
      default:
        marketEnum = Market.DOMESTIC;
    }

    // Collect detailed prices for all tickers
    const tickers = watchlist.map((w) => w.ticker);
    const detailedPrices = await dataCollector.collectDetailedPrices(
      tickers,
      marketEnum
    );

    // Generate features for each stock SEQUENTIALLY to avoid rate limits
    const detailedItems: any[] = [];
    for (const item of watchlist) {
         try {
           const priceData = detailedPrices.get(item.ticker);
           if (!priceData) {
             logger.warn("No price data for ticker", { ticker: item.ticker });
             detailedItems.push({
               ...item,
               detailed_data: null,
             });
             continue;
           }

           // Get historical data
           const history = await dataCollector.getStockHistory(
             item.ticker,
             30,
             marketEnum
           );

           logger.info(`History data for ${item.ticker}`, {
             ticker: item.ticker,
             market: marketEnum,
             history_length: history.length,
             has_data: history.length > 0,
             sample: history.slice(0, 3),
           });

           // If no history data, return basic price info only
           if (history.length === 0) {
             logger.warn(`No history data for ${item.ticker}, returning price-only data`);
             detailedItems.push({
               ...item,
               detailed_data: {
                 current_price: priceData.current,
                 prev_close: priceData.prev_close,
                 open: priceData.open,
                 high: priceData.high,
                 low: priceData.low,
                 intraday_return: 0,
                 from_prev_close_return: priceData.prev_close > 0
                   ? (priceData.current - priceData.prev_close) / priceData.prev_close
                   : 0,
                 today_volume: 0,
                 average_volume_30d: 0,
                 volume_ratio: 0,
                 volatility_20d: 0,
                 atr_14d: 0,
                 ema5: priceData.current,
                 ema20: priceData.current,
                 ema5_position: 1,
                 ema20_position: 1,
                 history_length: 0,
               },
             });
             continue;
           }

           // Calculate volume metrics
           const todayVolume = history[0]?.volume || 0;
           const averageVolume =
             history.length > 0
               ? history.reduce((sum, d) => sum + d.volume, 0) / history.length
               : 0;
           const volumeRatio =
             averageVolume > 0 ? todayVolume / averageVolume : 0;

          // Calculate returns
          const yesterdayClose =
            history.length > 1 ? history[1]?.close : priceData.prev_close;
          const intradayReturn =
            yesterdayClose > 0
              ? (priceData.current - yesterdayClose) / yesterdayClose
              : 0;
          const fromPrevCloseReturn =
            priceData.prev_close > 0
              ? (priceData.current - priceData.prev_close) /
                priceData.prev_close
              : intradayReturn;

          // Calculate volatility (20-day)
          const returns = history.slice(0, 20).map((d, i) => {
            if (i === 0) return 0;
            return (d.close - history[i - 1].close) / history[i - 1].close;
          });
          const mean =
            returns.reduce((sum, val) => sum + val, 0) / returns.length;
          const variance =
            returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
            returns.length;
          const volatility = Math.sqrt(variance);

          // Calculate EMAs
          const ema5Prices = history.slice(0, 5).map((d) => d.close);
          const ema20Prices = history.slice(0, 20).map((d) => d.close);
          const calculateEMA = (prices: number[], period: number): number => {
            if (prices.length === 0) return 0;
            const multiplier = 2 / (period + 1);
            let ema = prices[0];
            for (let i = 1; i < prices.length; i++) {
              ema = (prices[i] - ema) * multiplier + ema;
            }
            return ema;
          };
          const ema5 = calculateEMA(ema5Prices, 5);
          const ema20 = calculateEMA(ema20Prices, 20);

          // Calculate ATR
          const trueRanges: number[] = [];
          for (let i = 0; i < Math.min(14, history.length - 1); i++) {
            const currentClose = history[i].close;
            const prevClose = history[i + 1].close;
            const tr = Math.abs(currentClose - prevClose);
            trueRanges.push(tr);
          }
          if (priceData.high > 0 && priceData.low > 0 && history.length > 0) {
            const prevClose = history[0].close;
            const todayTR = Math.max(
              priceData.high - priceData.low,
              Math.abs(priceData.high - prevClose),
              Math.abs(priceData.low - prevClose)
            );
            trueRanges.unshift(todayTR);
          }
          const atr =
            trueRanges.length > 0
              ? trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length
              : 0;

          detailedItems.push({
            ...item,
            detailed_data: {
              current_price: priceData.current,
              prev_close: priceData.prev_close,
              open: priceData.open,
              high: priceData.high,
              low: priceData.low,
              intraday_return: intradayReturn,
              from_prev_close_return: fromPrevCloseReturn,
              today_volume: todayVolume,
              average_volume_30d: averageVolume,
              volume_ratio: volumeRatio,
              volatility_20d: volatility,
              atr_14d: atr,
              ema5: ema5,
              ema20: ema20,
              ema5_position: ema5 > 0 ? priceData.current / ema5 : 1,
               ema20_position: ema20 > 0 ? priceData.current / ema20 : 1,
               history_length: history.length,
             },
           });
         } catch (error) {
           logger.error("Failed to get detailed data for ticker", {
             ticker: item.ticker,
             error,
           });
           detailedItems.push({
             ...item,
             detailed_data: null,
           });
         }
       }

    res.json({ success: true, data: detailedItems });
  } catch (error) {
    logger.error("Failed to get detailed watchlist", { error });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get detailed watchlist",
    });
  }
};
