import { StockFeature } from '../model/Trading';
import { IndexInfo, Sentiment } from '../model/AI';
import { CompressedMarketData } from '../model/Market';
import { DataCollector } from './DataCollector';
import { logger } from '../util/logger';

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
        sentiment: Sentiment
    ): Promise<CompressedMarketData> {
        try {
            logger.info('Compressing market data...', { ticker_count: tickers.length });

            // Collect prices
            const prices = await this.dataCollector.collectStockPrices(tickers);

            // Generate features for each stock
            const features: StockFeature[] = [];

            for (const ticker of tickers) {
                const price = prices.get(ticker);
                if (!price) continue;

                try {
                    const feature = await this.generateStockFeature(ticker, price);
                    if (feature) {
                        features.push(feature);
                    }
                } catch (error) {
                    logger.warn('Failed to generate feature for ticker', { ticker, error });
                }
            }

            // Sort by feature score (combination of volume and volatility)
            features.sort((a, b) => {
                const scoreA = a.volume_ratio * (1 + Math.abs(a.intraday_return));
                const scoreB = b.volume_ratio * (1 + Math.abs(b.intraday_return));
                return scoreB - scoreA;
            });

            // Take top N stocks
            const topFeatures = features.slice(0, 50);

            logger.info('Market data compressed', {
                input_tickers: tickers.length,
                output_features: topFeatures.length,
            });

            return {
                index: indexInfo,
                sentiment,
                universe_features: topFeatures,
            };
        } catch (error) {
            logger.error('Failed to compress market data', { error });
            throw error;
        }
    }

    /**
     * Generate features for a single stock
     */
    private async generateStockFeature(ticker: string, currentPrice: number): Promise<StockFeature | null> {
        try {
            // Get historical data (last 30 days)
            const history = await this.dataCollector.getStockHistory(ticker, 30);

            if (history.length < 2) {
                return null;
            }

            // Calculate intraday return
            const previousClose = history[0]?.close || currentPrice;
            const intradayReturn = (currentPrice - previousClose) / previousClose;

            // Calculate volume ratio
            const avgVolume = history.reduce((sum, d) => sum + d.volume, 0) / history.length;
            const todayVolume = history[0]?.volume || avgVolume;
            const volumeRatio = todayVolume / avgVolume;

            // Calculate 20-day volatility
            const returns = history.slice(0, 20).map((d, i) => {
                if (i === 0) return 0;
                return (d.close - history[i - 1].close) / history[i - 1].close;
            });
            const volatility = this.calculateStdDev(returns);

            // Calculate EMAs
            const ema5 = this.calculateEMA(history.slice(0, 5).map((d) => d.close), 5);
            const ema20 = this.calculateEMA(history.slice(0, 20).map((d) => d.close), 20);

            const feature: StockFeature = {
                ticker,
                name: ticker, // TODO: Get actual name
                price: currentPrice,
                intraday_return: intradayReturn,
                volume_ratio: volumeRatio,
                volatility_20d: volatility,
                ema5_position: ema5 > 0 ? currentPrice / ema5 : 1,
                ema20_position: ema20 > 0 ? currentPrice / ema20 : 1,
                sector: 'unknown', // TODO: Get sector info
                sector_strength: 0.5, // TODO: Calculate sector strength
            };

            return feature;
        } catch (error) {
            logger.warn('Failed to generate stock feature', { ticker, error });
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
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

        return Math.sqrt(variance);
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
