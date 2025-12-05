import { KISApiClient } from '../infrastructure/api/KISApiClient';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { Decision } from '../model/AI';
import { OrderResult, OrderRequest } from '../model/Trading';
import { DatabaseRepository } from '../infrastructure/database/DatabaseRepository';
import { logger } from '../util/logger';
import { TradingError } from '../util/errors';
import { retryWithBackoff } from '../util/retry';

/**
 * Order Executor Controller
 * Executes trading orders via KIS API or simulates in paper mode
 */
export class OrderExecutor {
    private kisApi: KISApiClient;
    private db: DatabaseRepository;
    private accountNumber: string;
    private mode: 'live' | 'paper' | 'backtest';

    constructor() {
        const factory = new KISApiFactory();
        this.kisApi = factory.create();
        this.db = new DatabaseRepository();
        this.accountNumber = process.env.KIS_ACCOUNT_NUMBER || '';
        this.mode = (process.env.MODE as 'live' | 'paper' | 'backtest') || 'paper';
    }

    /**
     * Execute all validated decisions
     */
    async executeDecisions(runId: string, decisions: Decision[]): Promise<OrderResult[]> {
        logger.info('Executing decisions...', { run_id: runId, count: decisions.length });

        const results: OrderResult[] = [];

        for (const decision of decisions) {
            if (decision.action === 'HOLD') {
                continue;
            }

            try {
                const result = await this.executeDecision(runId, decision);
                results.push(result);

                // Save order to database
                await this.db.saveOrder(runId, null, result);
            } catch (error) {
                logger.error('Failed to execute decision', {
                    ticker: decision.ticker,
                    action: decision.action,
                    error,
                });

                // Save failed order
                await this.db.saveOrder(runId, null, {
                    ticker: decision.ticker,
                    direction: decision.action as 'BUY' | 'SELL',
                    requested_qty: decision.quantity || 0,
                    filled_qty: 0,
                    status: 'failed',
                    error_message: String(error),
                    broker_order_id: '',
                });
            }
        }

        logger.info('Execution complete', { success_count: results.filter((r) => r.status !== 'failed').length });

        return results;
    }

    /**
     * Execute a single decision
     */
    private async executeDecision(runId: string, decision: Decision): Promise<OrderResult> {
        logger.info('Executing decision', {
            ticker: decision.ticker,
            action: decision.action,
            confidence: decision.confidence,
        });

        if (this.mode === 'paper' || this.mode === 'backtest') {
            return this.executePaperOrder(decision);
        }

        // Live mode
        if (decision.action === 'BUY') {
            return this.executeBuyOrder(decision);
        } else if (decision.action === 'SELL') {
            return this.executeSellOrder(decision);
        }

        throw new TradingError(`Invalid action: ${decision.action}`);
    }

    /**
     * Execute buy order (live mode)
     */
    private async executeBuyOrder(decision: Decision): Promise<OrderResult> {
        try {
            const amount = decision.amount_krw || 0;

            // Get current price
            const priceData = await this.kisApi.getCurrentPrice(decision.ticker);
            const currentPrice = parseFloat(priceData.output?.stck_prpr || 0);

            if (!currentPrice) {
                throw new TradingError('Failed to get current price');
            }

            // Calculate quantity
            const quantity = Math.floor(amount / currentPrice);

            if (quantity === 0) {
                throw new TradingError('Calculated quantity is 0');
            }

            // Place market order
            const orderResponse = await retryWithBackoff(() =>
                this.kisApi.buyOrder(this.accountNumber, decision.ticker, quantity, 0, '00') // Market order
            );

            const orderNumber = orderResponse.output?.ODNO || orderResponse.output?.odno || '';

            logger.info('Buy order placed', {
                ticker: decision.ticker,
                quantity,
                order_number: orderNumber,
            });

            return {
                broker_order_id: orderNumber,
                ticker: decision.ticker,
                direction: 'BUY',
                requested_qty: quantity,
                filled_qty: quantity, // Assume filled for now
                avg_filled_price: currentPrice,
                status: 'filled',
            };
        } catch (error) {
            logger.error('Buy order failed', { ticker: decision.ticker, error });
            throw new TradingError('Buy order execution failed', undefined, error);
        }
    }

    /**
     * Execute sell order (live mode)
     */
    private async executeSellOrder(decision: Decision): Promise<OrderResult> {
        try {
            const quantity = decision.quantity || 0;

            if (quantity === 0) {
                throw new TradingError('Sell quantity is 0');
            }

            // Get current price
            const priceData = await this.kisApi.getCurrentPrice(decision.ticker);
            const currentPrice = parseFloat(priceData.output?.stck_prpr || 0);

            // Place market order
            const orderResponse = await retryWithBackoff(() =>
                this.kisApi.sellOrder(this.accountNumber, decision.ticker, quantity, 0, '00')
            );

            const orderNumber = orderResponse.output?.ODNO || orderResponse.output?.odno || '';

            logger.info('Sell order placed', {
                ticker: decision.ticker,
                quantity,
                order_number: orderNumber,
            });

            return {
                broker_order_id: orderNumber,
                ticker: decision.ticker,
                direction: 'SELL',
                requested_qty: quantity,
                filled_qty: quantity,
                avg_filled_price: currentPrice,
                status: 'filled',
            };
        } catch (error) {
            logger.error('Sell order failed', { ticker: decision.ticker, error });
            throw new TradingError('Sell order execution failed', undefined, error);
        }
    }

    /**
     * Execute paper order (simulation mode)
     */
    private async executePaperOrder(decision: Decision): Promise<OrderResult> {
        logger.info('📄 Paper mode - simulating order', {
            ticker: decision.ticker,
            action: decision.action,
        });

        // Get current price for simulation
        const priceData = await this.kisApi.getCurrentPrice(decision.ticker);
        const currentPrice = parseFloat(priceData.output?.stck_prpr || 0) || 10000; // Fallback price

        if (decision.action === 'BUY') {
            const amount = decision.amount_krw || 0;
            const quantity = Math.floor(amount / currentPrice);

            return {
                broker_order_id: `PAPER_${Date.now()}`,
                ticker: decision.ticker,
                direction: 'BUY',
                requested_qty: quantity,
                filled_qty: quantity,
                avg_filled_price: currentPrice,
                status: 'filled',
            };
        } else {
            const quantity = decision.quantity || 0;

            return {
                broker_order_id: `PAPER_${Date.now()}`,
                ticker: decision.ticker,
                direction: 'SELL',
                requested_qty: quantity,
                filled_qty: quantity,
                avg_filled_price: currentPrice,
                status: 'filled',
            };
        }
    }

    /**
     * Get order status from broker
     */
    async getOrderStatus(orderNumber: string, date: string): Promise<any> {
        const history = await this.kisApi.getOrderHistory(this.accountNumber, date);
        return history;
    }
}
