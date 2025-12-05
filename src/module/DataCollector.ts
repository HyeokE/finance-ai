import { KISApiClient } from '../infrastructure/api/KISApiClient';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { AccountBalance, Position, StockFeature } from '../model/Trading';
import { IndexInfo, Sentiment } from '../model/AI';
import { logger } from '../util/logger';
import { retryWithBackoff } from '../util/retry';
import { ApiError } from '../util/errors';
import { getToday, getDaysAgo } from '../util/formatters';

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

            const [kospiData, kosdaqData] = await Promise.all([
                retryWithBackoff(() => this.kisApi.getIndexInfo('0001')), // KOSPI
                retryWithBackoff(() => this.kisApi.getIndexInfo('1001')), // KOSDAQ
            ]);

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
                    const priceData = await this.kisApi.getCurrentPrice(ticker);
                    const output = priceData.output || {};
                    const price = parseFloat(output.stck_prpr || 0);

                    if (price > 0) {
                        prices.set(ticker, price);
                    }

                    // Small delay to avoid rate limiting
                    await new Promise((resolve) => setTimeout(resolve, 100));
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

            const historyData = await retryWithBackoff(() =>
                this.kisApi.getDailyPrices(ticker, startDate, endDate)
            );

            const output = historyData.output || [];

            return output.map((item: any) => ({
                close: parseFloat(item.stck_clpr),
                volume: parseFloat(item.acml_vol),
            }));
        } catch (error) {
            logger.warn('Failed to get stock history', { ticker, error });
            return [];
        }
    }
}
