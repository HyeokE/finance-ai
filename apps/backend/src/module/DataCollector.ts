import { KISApiClient } from '../infrastructure/api/KISApiClient';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { AccountBalance, Position, StockFeature } from '../model/Trading';
import { IndexInfo, Sentiment } from '../model/AI';
import { logger } from '../util/logger';
import { retryWithBackoff } from '../util/retry';
import { ApiError } from '../util/errors';
import { getToday, getDaysAgo } from '../util/formatters';
import { kisRateLimiter } from '../util/rateLimiter';

/**
 * Data Collector Module
 * Collects market data, account info, and sentiment indicators from KIS API
 */
export class DataCollector {
    private kisApi: KISApiClient;
    private accountNumber: string;

    constructor() {
        const factory = new KISApiFactory();
        this.kisApi = factory.create({
            baseURL: process.env.KIS_BASE_URL || '',
        });
        this.accountNumber = process.env.KIS_ACCOUNT_NUMBER || '';
    }

    /**
     * Collect account balance and positions
     */
    async collectAccountData(): Promise<AccountBalance> {
        try {
            logger.info('Collecting account data...');

            await kisRateLimiter.waitIfNeeded();
            const balanceData = await retryWithBackoff(() =>
                this.kisApi.getAccountBalance(this.accountNumber)
            );

            // Parse KIS API response
            const output = balanceData.output1 || [];
            const output2 = balanceData.output2?.[0] || {};

            const positions: Position[] = output.map((item: any) => ({
                ticker: item.pdno,
                name: item.prdt_name,
                quantity: parseInt(item.hldg_qty),
                avg_price: parseFloat(item.pchs_avg_pric),
                current_price: parseFloat(item.prpr),
                market_value: parseFloat(item.evlu_amt),
                unrealized_pnl: parseFloat(item.evlu_pfls_amt),
                unrealized_pnl_pct: parseFloat(item.evlu_pfls_rt) / 100,
                weight: 0, // Will be calculated
            }));

            const totalEquity = parseFloat(output2.tot_evlu_amt || 0);
            const cash = parseFloat(output2.prvs_rcdl_excc_amt || 0);

            // Calculate position weights
            positions.forEach((pos) => {
                pos.weight = totalEquity > 0 ? pos.market_value / totalEquity : 0;
            });

            const accountBalance: AccountBalance = {
                account_number: this.accountNumber,
                total_equity: totalEquity,
                cash,
                securities_value: totalEquity - cash,
                positions,
                buyable_cash: parseFloat(output2.nass_amt || 0),
            };

            logger.info('Account data collected', {
                total_equity: totalEquity,
                position_count: positions.length,
            });

            return accountBalance;
        } catch (error) {
            logger.error('Failed to collect account data', { error });
            throw new ApiError('Failed to collect account data', undefined, error);
        }
    }

    /**
     * Collect market index information
     */
    async collectIndexInfo(): Promise<IndexInfo> {
        try {
            logger.info('Collecting index info...');

            // Fetch indices sequentially with rate limiting
            await kisRateLimiter.waitIfNeeded();
            const kospiData = await retryWithBackoff(() => this.kisApi.getIndexInfo('0001')); // KOSPI

            await kisRateLimiter.waitIfNeeded();
            const kosdaqData = await retryWithBackoff(() => this.kisApi.getIndexInfo('1001')); // KOSDAQ

            const kospiOutput = kospiData.output || {};
            const kosdaqOutput = kosdaqData.output || {};

            const indexInfo: IndexInfo = {
                KOSPI: {
                    price: parseFloat(kospiOutput.bstp_nmix_prpr || 0),
                    change_pct: parseFloat(kospiOutput.bstp_nmix_prdy_vrss_sign || 0) / 100,
                    volume: parseFloat(kospiOutput.acml_vol || 0),
                },
                KOSDAQ: {
                    price: parseFloat(kosdaqOutput.bstp_nmix_prpr || 0),
                    change_pct: parseFloat(kosdaqOutput.bstp_nmix_prdy_vrss_sign || 0) / 100,
                    volume: parseFloat(kosdaqOutput.acml_vol || 0),
                },
            };

            logger.info('Index info collected', { KOSPI: indexInfo.KOSPI.price });

            return indexInfo;
        } catch (error) {
            logger.error('Failed to collect index info', { error });
            throw new ApiError('Failed to collect index info', undefined, error);
        }
    }

    /**
     * Collect market sentiment indicators
     */
    async collectSentiment(): Promise<Sentiment> {
        try {
            logger.info('Collecting sentiment data...');

            // For now, return basic sentiment
            // TODO: Add external APIs for fear/greed index, VIX, etc.
            const sentiment: Sentiment = {
                foreign_net_buy_krw: 0,
                institution_net_buy_krw: 0,
            };

            logger.info('Sentiment data collected');

            return sentiment;
        } catch (error) {
            logger.error('Failed to collect sentiment', { error });
            throw new ApiError('Failed to collect sentiment', undefined, error);
        }
    }

    /**
     * Collect top stocks by volume
     */
    async collectTopStocksByVolume(limit: number = 50): Promise<string[]> {
        try {
            logger.info('Collecting top stocks by volume...', { limit });

            const rankingData = await retryWithBackoff(() => this.kisApi.getVolumeRanking(limit));

            const output = rankingData.output || [];
            const tickers = output.map((item: any) => item.mksc_shrn_iscd).filter(Boolean);

            logger.info('Top stocks collected', { count: tickers.length });

            return tickers.slice(0, limit);
        } catch (error) {
            logger.error('Failed to collect top stocks', { error });
            throw new ApiError('Failed to collect top stocks', undefined, error);
        }
    }

    /**
     * Collect current prices for multiple stocks
     */
    async collectStockPrices(tickers: string[]): Promise<Map<string, number>> {
        try {
            logger.info('Collecting stock prices...', { count: tickers.length });

            const prices = new Map<string, number>();

            // Batch requests with rate limiting
            for (const ticker of tickers) {
                try {
                    await kisRateLimiter.waitIfNeeded();
                    const priceData = await this.kisApi.getCurrentPrice(ticker);
                    const output = priceData.output || {};
                    const price = parseFloat(output.stck_prpr || 0);

                    if (price > 0) {
                        prices.set(ticker, price);
                    }
                } catch (error) {
                    logger.warn('Failed to get price for ticker', { ticker, error });
                }
            }

            logger.info('Stock prices collected', { count: prices.size });

            return prices;
        } catch (error) {
            logger.error('Failed to collect stock prices', { error });
            throw new ApiError('Failed to collect stock prices', undefined, error);
        }
    }

    /**
     * Get daily candles for a stock
     */
    async getStockHistory(
        ticker: string,
        days: number = 30
    ): Promise<{ close: number; volume: number }[]> {
        try {
            const endDate = getToday();
            const startDate = getDaysAgo(days);

            logger.debug(`📊 Fetching history for ${ticker}`, {
                ticker,
                startDate,
                endDate,
                days,
            });

            await kisRateLimiter.waitIfNeeded();
            const historyData = await retryWithBackoff(() =>
                this.kisApi.getDailyPrices(ticker, startDate, endDate)
            );

            const output = historyData.output || [];
            const output2 = historyData.output2 || [];

            logger.debug(`📈 History API response for ${ticker}`, {
                ticker,
                output_length: output.length,
                output2_length: output2.length,
                rt_cd: historyData.rt_cd,
                msg_cd: historyData.msg_cd,
                msg1: historyData.msg1,
                response_keys: Object.keys(historyData),
            });

            // Try output first, fallback to output2 if empty
            let dataArray = output;
            if (output.length === 0 && output2.length > 0) {
                logger.info(`📊 Using output2 for ${ticker} (output was empty)`, {
                    output2_length: output2.length,
                });
                dataArray = output2;
            }

            // If still empty, try a shorter date range (7 days)
            if (dataArray.length === 0 && days > 7) {
                logger.warn(`⚠️ Empty history data, retrying with 7 days for ${ticker}`);
                const shortStartDate = getDaysAgo(7);

                await kisRateLimiter.waitIfNeeded();
                const retryData = await retryWithBackoff(() =>
                    this.kisApi.getDailyPrices(ticker, shortStartDate, endDate)
                );

                dataArray = retryData.output || retryData.output2 || [];
                logger.debug(`📈 Retry with 7 days result`, {
                    ticker,
                    length: dataArray.length,
                    rt_cd: retryData.rt_cd,
                    msg_cd: retryData.msg_cd,
                });
            }

            if (dataArray.length === 0) {
                logger.warn(`⚠️ No history data available for ${ticker}`, {
                    ticker,
                    startDate,
                    endDate,
                    days,
                    possible_reasons: [
                        'Market closed (requires 09:00-15:30 KST)',
                        'Paper trading mode limitation',
                        'Invalid ticker or delisted stock',
                        'Weekend/holiday (no trading data)'
                    ],
                });
                return [];
            }

            return dataArray.map((item: any) => ({
                close: parseFloat(item.stck_clpr || item.stck_prpr || 0),
                volume: parseFloat(item.acml_vol || item.acml_tr_pbmn || 0),
            }));
        } catch (error) {
            logger.warn('Failed to get stock history', { ticker, error });
            return [];
        }
    }
}
