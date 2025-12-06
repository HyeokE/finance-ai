import axios from 'axios';
import { KISApiClient } from '../infrastructure/api/KISApiClient';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { AccountBalance, Position, StockFeature, Market, EXCHANGE_CODES } from '../model/Trading';
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
        // Use singleton factory to share access token
        const factory = KISApiFactory.getInstance();
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

            const sentiment: Sentiment = {
                foreign_net_buy_krw: 0,
                institution_net_buy_krw: 0,
            };

            const fearGreedIndex = await this.fetchFearGreedIndex();
            if (fearGreedIndex !== undefined) {
                sentiment.fear_greed_index = fearGreedIndex;
            }

            logger.info('Sentiment data collected', {
                fear_greed_index: sentiment.fear_greed_index,
            });

            return sentiment;
        } catch (error) {
            logger.error('Failed to collect sentiment', { error });
            throw new ApiError('Failed to collect sentiment', undefined, error);
        }
    }

    /**
     * Fetch CNN Fear & Greed index (or fallback to env override)
     */
    private async fetchFearGreedIndex(): Promise<number | undefined> {
        const apiUrl = process.env.FEAR_GREED_API_URL || 'https://production.dataviz.cnn.io/index/fearandgreed/';
        const fallbackEnv = process.env.FEAR_GREED_INDEX;
        const fallback = fallbackEnv !== undefined ? parseFloat(fallbackEnv) : undefined;

        try {
            const { data } = await axios.get(apiUrl, { timeout: 5000 });
            const parsed = this.parseFearGreedResponse(data);
            if (parsed !== undefined) {
                return parsed;
            }

            if (Number.isFinite(fallback)) {
                logger.warn('Fear & Greed API returned no score, using fallback env value', { apiUrl });
                return fallback;
            }

            logger.warn('Fear & Greed API returned no score and no fallback available', {
                apiUrl,
                response_keys: data ? Object.keys(data) : [],
            });
        } catch (error: any) {
            if (Number.isFinite(fallback)) {
                logger.warn('Failed to fetch fear & greed index, using fallback env value', {
                    apiUrl,
                    error: error?.message || error,
                });
                return fallback;
            }

            logger.warn('Failed to fetch fear & greed index', {
                apiUrl,
                error: error?.message || error,
            });
        }

        return undefined;
    }

    /**
     * Parse fear/greed score from various API response shapes
     */
    private parseFearGreedResponse(payload: any): number | undefined {
        const candidates = [
            payload?.fear_and_greed?.score,
            payload?.fear_and_greed?.now?.score,
            payload?.fear_and_greed?.now?.value,
            payload?.fearAndGreed?.score,
            payload?.fgi?.now?.value,
            payload?.now?.value,
            payload?.score,
            payload?.value,
            Array.isArray(payload?.data) ? payload.data[0]?.score ?? payload.data[0]?.value : undefined,
        ];

        for (const candidate of candidates) {
            const parsed = typeof candidate === 'string' ? parseFloat(candidate) : candidate;
            if (typeof parsed === 'number' && Number.isFinite(parsed)) {
                return Math.max(0, Math.min(100, parsed));
            }
        }

        return undefined;
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
    async collectStockPrices(tickers: string[], market: Market = Market.DOMESTIC): Promise<Map<string, number>> {
        try {
            logger.info('Collecting stock prices...', { count: tickers.length, market });

            const prices = new Map<string, number>();
            const exchangeCode = EXCHANGE_CODES[market];

            // Batch requests with rate limiting
            for (const ticker of tickers) {
                try {
                    await kisRateLimiter.waitIfNeeded();
                    
                    let price = 0;
                    
                    if (market === Market.DOMESTIC) {
                        // Domestic stock
                        const priceData = await this.kisApi.getCurrentPrice(ticker);
                        const output = priceData.output || {};
                        price = parseFloat(output.stck_prpr || 0);
                    } else {
                        // Overseas stock
                        const priceData = await this.kisApi.getOverseasPrice(ticker, exchangeCode);
                        
                        // Check for API errors
                        if (priceData.rt_cd !== '0') {
                            logger.warn('KIS API error for overseas stock', {
                                ticker,
                                exchangeCode,
                                rt_cd: priceData.rt_cd,
                                msg_cd: priceData.msg_cd,
                                msg1: priceData.msg1,
                            });
                            throw new Error(`KIS API error: ${priceData.msg1 || priceData.msg_cd}`);
                        }
                        
                        const output = priceData.output || {};
                        
                        // KIS API response format for overseas stocks
                        // Response can be array or object
                        if (Array.isArray(output) && output.length > 0) {
                            const stock = output[0];
                            price = parseFloat(stock.last || stock.LAST || stock.xymd_cls_prc || 0);
                        } else if (output && typeof output === 'object') {
                            price = parseFloat(output.last || output.LAST || output.xymd_cls_prc || 0);
                        }
                        
                        if (price === 0) {
                            logger.debug('Overseas stock price response', {
                                ticker,
                                exchangeCode,
                                output,
                                response_keys: Object.keys(priceData),
                            });
                        }
                    }

                    if (price > 0) {
                        prices.set(ticker, price);
                    } else {
                        logger.warn('Price is 0 or invalid', { ticker, market, exchangeCode });
                    }
                } catch (error) {
                    logger.warn('Failed to get price for ticker', { ticker, market, error });
                }
            }

            logger.info('Stock prices collected', { count: prices.size, market });

            return prices;
        } catch (error) {
            logger.error('Failed to collect stock prices', { error, market });
            throw new ApiError('Failed to collect stock prices', undefined, error);
        }
    }

    /**
     * Get daily candles for a stock
     */
    async getStockHistory(
        ticker: string,
        days: number = 30,
        market: Market = Market.DOMESTIC
    ): Promise<{ close: number; volume: number }[]> {
        try {
            const endDate = getToday();
            const startDate = getDaysAgo(days);
            const exchangeCode = EXCHANGE_CODES[market];

            logger.debug(`📊 Fetching history for ${ticker}`, {
                ticker,
                market,
                exchangeCode,
                startDate,
                endDate,
                days,
            });

            await kisRateLimiter.waitIfNeeded();
            
            let historyData: any;
            if (market === Market.DOMESTIC) {
                historyData = await retryWithBackoff(() =>
                    this.kisApi.getDailyPrices(ticker, startDate, endDate)
                );
            } else {
                historyData = await retryWithBackoff(() =>
                    this.kisApi.getOverseasDailyPrices(ticker, exchangeCode, 'D', startDate, endDate)
                );
            }

            let dataArray: any[] = [];
            
            if (market === Market.DOMESTIC) {
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
                dataArray = output;
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
            } else {
                // Overseas stock history
                // Check for API errors first
                if (historyData.rt_cd !== '0') {
                    logger.warn('KIS API error for overseas history', {
                        ticker,
                        market,
                        exchangeCode,
                        rt_cd: historyData.rt_cd,
                        msg_cd: historyData.msg_cd,
                        msg1: historyData.msg1,
                    });
                }
                
                const output = historyData.output || [];
                dataArray = Array.isArray(output) ? output : [];
                
                logger.debug(`📈 Overseas history API response for ${ticker}`, {
                    ticker,
                    market,
                    exchangeCode,
                    output_length: dataArray.length,
                    rt_cd: historyData.rt_cd,
                    msg_cd: historyData.msg_cd,
                    msg1: historyData.msg1,
                    response_keys: Object.keys(historyData),
                });
                
                // If still empty, try without date range (get recent data)
                if (dataArray.length === 0 && days > 7) {
                    logger.warn(`⚠️ Empty overseas history data, retrying without date range for ${ticker}`);
                    await kisRateLimiter.waitIfNeeded();
                    const retryData = await retryWithBackoff(() =>
                        this.kisApi.getOverseasDailyPrices(ticker, exchangeCode, 'D')
                    );
                    
                    if (retryData.rt_cd === '0') {
                        dataArray = retryData.output || [];
                        logger.debug(`📈 Retry without date range result`, {
                            ticker,
                            length: dataArray.length,
                            rt_cd: retryData.rt_cd,
                        });
                    }
                }
            }

            if (dataArray.length === 0) {
                logger.warn(`⚠️ No history data available for ${ticker}`, {
                    ticker,
                    market,
                    exchangeCode,
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

            // Parse data based on market type
            if (market === Market.DOMESTIC) {
                return dataArray.map((item: any) => ({
                    close: parseFloat(item.stck_clpr || item.stck_prpr || 0),
                    volume: parseFloat(item.acml_vol || item.acml_tr_pbmn || 0),
                }));
            } else {
                // Overseas stock format
                return dataArray.map((item: any) => ({
                    close: parseFloat(item.xymd_cls_prc || item.close || item.CLOSE || 0),
                    volume: parseFloat(item.ovrs_tvol || item.volume || item.VOLUME || 0),
                }));
            }
        } catch (error) {
            logger.warn('Failed to get stock history', { ticker, error });
            return [];
        }
    }
}
