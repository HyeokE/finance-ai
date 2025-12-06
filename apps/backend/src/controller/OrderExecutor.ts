import { KISApiClient } from '../infrastructure/api/KISApiClient';
import { KISApiFactory } from '../infrastructure/api/KISApiFactory';
import { Decision } from '../model/AI';
import { OrderResult, OrderRequest, Market, EXCHANGE_CODES } from '../model/Trading';
import { DatabaseRepository } from '../infrastructure/database/DatabaseRepository';
import { logger } from '../util/logger';
import { TradingError } from '../util/errors';
import { retryWithBackoff, sleep } from '../util/retry';

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
        // Use singleton factory to share access token
        const factory = KISApiFactory.getInstance();
        this.kisApi = factory.create();
        this.db = new DatabaseRepository();
        this.accountNumber = process.env.KIS_ACCOUNT_NUMBER || '';
        this.mode = (process.env.MODE as 'live' | 'paper' | 'backtest') || 'paper';
    }

    /**
     * Execute all validated decisions
     */
    async executeDecisions(runId: string, decisions: Decision[], market: Market): Promise<OrderResult[]> {
        logger.info('Executing decisions...', { 
            run_id: runId, 
            count: decisions.length,
            mode: this.mode,
            market,
        });

        if (this.mode === 'paper') {
            logger.info('📝 PAPER MODE: Executing orders in virtual account (모의투자) via KIS API');
        } else if (this.mode === 'live') {
            logger.warn('🔴 LIVE MODE: Real trades will be executed with real money!');
        } else if (this.mode === 'backtest') {
            logger.info('🧪 BACKTEST MODE: Simulating orders without API calls');
        }

        const results: OrderResult[] = [];

        for (const decision of decisions) {
            if (decision.action === 'HOLD') {
                continue;
            }

            try {
                const result = await this.executeDecision(runId, decision, market);
                results.push(result);

                // Save order to database
                await this.db.saveOrder(runId, null, result);
            } catch (error) {
                logger.error('Failed to execute decision', {
                    ticker: decision.ticker,
                    action: decision.action,
                    error,
                });

                // Create failed order result
                const failedResult: OrderResult = {
                    broker_order_id: '',
                    ticker: decision.ticker,
                    direction: decision.action as 'BUY' | 'SELL',
                    requested_qty: decision.quantity || 0,
                    filled_qty: 0,
                    status: 'failed',
                    error_message: error instanceof Error ? error.message : String(error),
                };

                // Add to results so it's counted in status calculation
                results.push(failedResult);

                // Save failed order to database
                await this.db.saveOrder(runId, null, failedResult);
            }

            // Add delay between trade requests to respect rate limits
            await sleep(1000);
        }

        logger.info('Execution complete', { success_count: results.filter((r) => r.status !== 'failed').length });

        return results;
    }

    /**
     * Execute a single decision
     */
    private async executeDecision(runId: string, decision: Decision, market: Market): Promise<OrderResult> {
        logger.info('Executing decision', {
            ticker: decision.ticker,
            action: decision.action,
            confidence: decision.confidence,
            mode: this.mode,
            market,
        });

        // Paper mode uses virtual account but still makes real API calls to KIS
        // Live mode uses real account with real API calls
        // Only backtest mode simulates without API calls
        if (this.mode === 'backtest') {
            return this.executePaperOrder(decision, market);
        }

        // Paper and Live modes both execute real orders via KIS API
        // Paper mode = virtual account (모의투자)
        // Live mode = real account (실거래)
        if (decision.action === 'BUY') {
            return this.executeBuyOrder(decision, market);
        } else if (decision.action === 'SELL') {
            return this.executeSellOrder(decision, market);
        }

        throw new TradingError(`Invalid action: ${decision.action}`);
    }

    /**
     * Execute buy order (live mode)
     */
    private async executeBuyOrder(decision: Decision, market: Market): Promise<OrderResult> {
        try {
            // Determine quantity: use quantity if provided, otherwise calculate from amount_krw
            let quantity = decision.quantity || 0;
            let currentPrice = 0;
            
            if (quantity === 0 && decision.amount_krw) {
                // Get current price based on market
                if (market === Market.DOMESTIC) {
                    const priceData = await this.kisApi.getCurrentPrice(decision.ticker);
                    currentPrice = parseFloat(priceData.output?.stck_prpr || 0);
                } else {
                    // Overseas stock - determine exchange code
                    const exchangeCode = this.getExchangeCode(market);
                    const priceData = await this.kisApi.getOverseasPrice(decision.ticker, exchangeCode);
                    
                    if (priceData.rt_cd !== '0') {
                        throw new TradingError(`Failed to get overseas price: ${priceData.msg1 || priceData.msg_cd}`);
                    }
                    
                    const output = priceData.output || {};
                    // Handle both array and object responses
                    if (Array.isArray(output)) {
                        currentPrice = parseFloat(output[0]?.last || output[0]?.LAST || output[0]?.xymd_cls_prc || 0);
                    } else {
                        currentPrice = parseFloat(output.last || output.LAST || output.xymd_cls_prc || 0);
                    }
                }

                if (!currentPrice) {
                    throw new TradingError('Failed to get current price');
                }

                // Calculate quantity from amount
                quantity = Math.floor(decision.amount_krw / currentPrice);
            } else if (market !== Market.DOMESTIC) {
                // For overseas stocks, we need current price for limit order (paper mode only supports limit)
                const exchangeCode = this.getExchangeCode(market);
                const priceData = await this.kisApi.getOverseasPrice(decision.ticker, exchangeCode);
                
                if (priceData.rt_cd !== '0') {
                    throw new TradingError(`Failed to get overseas price: ${priceData.msg1 || priceData.msg_cd}`);
                }
                
                const output = priceData.output || {};
                if (Array.isArray(output)) {
                    currentPrice = parseFloat(output[0]?.last || output[0]?.LAST || output[0]?.xymd_cls_prc || 0);
                } else {
                    currentPrice = parseFloat(output.last || output.LAST || output.xymd_cls_prc || 0);
                }
            }

            if (quantity === 0) {
                throw new TradingError('Order quantity is 0');
            }

            logger.info('📤 Placing market buy order', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                market,
                mode: this.mode,
                account_type: this.mode === 'paper' ? 'Virtual (모의투자)' : 'Real (실거래)',
            });

            // Place market order based on market type
            let orderResponse;
            if (market === Market.DOMESTIC) {
                // Domestic stock - use domestic order API
                orderResponse = await retryWithBackoff(() =>
                    this.kisApi.buyOrder(this.accountNumber, decision.ticker, quantity, 0, '00')
                );
            } else {
                // Overseas stock - use overseas order API
                // 모의투자는 지정가만 가능하므로 현재 가격을 지정가로 사용
                const exchangeCode = this.getExchangeCode(market);
                // 현재 가격을 지정가로 사용 (모의투자는 시장가 미지원)
                const limitPrice = currentPrice || 0;
                if (!limitPrice) {
                    throw new TradingError('Failed to get current price for limit order');
                }
                orderResponse = await retryWithBackoff(() =>
                    this.kisApi.buyOverseasOrder(this.accountNumber, decision.ticker, quantity, limitPrice, exchangeCode, '00')
                );
            }

            const orderNumber = orderResponse.output?.ODNO || orderResponse.output?.odno || '';

            if (!orderNumber) {
                throw new TradingError('Failed to get order number from broker');
            }

            logger.info('✅ Buy order placed successfully', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                broker_order_id: orderNumber,
            });

            // Wait a bit for order to be filled, then check actual fill details
            await sleep(2000); // Wait 2 seconds for market order to fill

            // Get actual fill details from order history
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const fillDetails = await this.getOrderFillDetails(orderNumber, today, decision.ticker, market);

            const filledQty = fillDetails.filled_qty || quantity;
            const avgFilledPrice = fillDetails.avg_filled_price || 0;
            const totalAmount = filledQty * avgFilledPrice;

            logger.info('💰 Buy order filled', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                filled_quantity: filledQty,
                avg_filled_price: avgFilledPrice,
                total_amount: totalAmount,
                broker_order_id: orderNumber,
            });

            return {
                broker_order_id: orderNumber,
                ticker: decision.ticker,
                direction: 'BUY',
                requested_qty: quantity,
                filled_qty: filledQty,
                avg_filled_price: avgFilledPrice,
                status: filledQty === quantity ? 'filled' : filledQty > 0 ? 'partial_filled' : 'requested',
            };
        } catch (error) {
            logger.error('❌ Buy order failed', { ticker: decision.ticker, error });
            throw new TradingError('Buy order execution failed', undefined, error);
        }
    }

    /**
     * Execute sell order (live mode)
     */
    private async executeSellOrder(decision: Decision, market: Market): Promise<OrderResult> {
        try {
            const quantity = decision.quantity || 0;

            if (quantity === 0) {
                throw new TradingError('Sell quantity is 0');
            }

            logger.info('📤 Placing market sell order', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                market,
                mode: this.mode,
                account_type: this.mode === 'paper' ? 'Virtual (모의투자)' : 'Real (실거래)',
            });

            // Place market order based on market type
            let orderResponse;
            if (market === Market.DOMESTIC) {
                // Domestic stock - use domestic order API
                orderResponse = await retryWithBackoff(() =>
                    this.kisApi.sellOrder(this.accountNumber, decision.ticker, quantity, 0, '00')
                );
            } else {
                // Overseas stock - use overseas order API
                // 모의투자는 지정가만 가능하므로 현재 가격을 지정가로 사용
                const exchangeCode = this.getExchangeCode(market);
                // 현재 가격 조회
                const priceData = await this.kisApi.getOverseasPrice(decision.ticker, exchangeCode);
                if (priceData.rt_cd !== '0') {
                    throw new TradingError(`Failed to get overseas price: ${priceData.msg1 || priceData.msg_cd}`);
                }
                const output = priceData.output || {};
                const currentPrice = Array.isArray(output) 
                    ? parseFloat(output[0]?.last || output[0]?.LAST || output[0]?.xymd_cls_prc || 0)
                    : parseFloat(output.last || output.LAST || output.xymd_cls_prc || 0);
                
                if (!currentPrice) {
                    throw new TradingError('Failed to get current price for sell order');
                }
                
                // 현재 가격을 지정가로 사용 (모의투자는 시장가 미지원)
                const limitPrice = currentPrice;
                orderResponse = await retryWithBackoff(() =>
                    this.kisApi.sellOverseasOrder(this.accountNumber, decision.ticker, quantity, limitPrice, exchangeCode, '00')
                );
            }

            const orderNumber = orderResponse.output?.ODNO || orderResponse.output?.odno || '';

            if (!orderNumber) {
                throw new TradingError('Failed to get order number from broker');
            }

            logger.info('✅ Sell order placed successfully', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                broker_order_id: orderNumber,
            });

            // Wait a bit for order to be filled, then check actual fill details
            await sleep(2000); // Wait 2 seconds for market order to fill

            // Get actual fill details from order history
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const fillDetails = await this.getOrderFillDetails(orderNumber, today, decision.ticker, market);

            const filledQty = fillDetails.filled_qty || quantity;
            const avgFilledPrice = fillDetails.avg_filled_price || 0;
            const totalAmount = filledQty * avgFilledPrice;

            logger.info('💰 Sell order filled', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                filled_quantity: filledQty,
                avg_filled_price: avgFilledPrice,
                total_amount: totalAmount,
                broker_order_id: orderNumber,
            });

            return {
                broker_order_id: orderNumber,
                ticker: decision.ticker,
                direction: 'SELL',
                requested_qty: quantity,
                filled_qty: filledQty,
                avg_filled_price: avgFilledPrice,
                status: filledQty === quantity ? 'filled' : filledQty > 0 ? 'partial_filled' : 'requested',
            };
        } catch (error) {
            logger.error('❌ Sell order failed', { ticker: decision.ticker, error });
            throw new TradingError('Sell order execution failed', undefined, error);
        }
    }

    /**
     * Execute paper order (simulation mode)
     */
    private async executePaperOrder(decision: Decision, market: Market): Promise<OrderResult> {
        logger.warn('⚠️ PAPER MODE: This is a SIMULATION - No real trades will be executed!', {
            ticker: decision.ticker,
            action: decision.action,
            mode: this.mode,
            note: 'To execute real trades, set MODE=live in environment variables',
        });
        
        logger.info('📄 Paper mode - simulating order', {
            ticker: decision.ticker,
            action: decision.action,
            market,
        });

        // Get current price for simulation based on market
        let currentPrice = 0;
        if (market === Market.DOMESTIC) {
            const priceData = await this.kisApi.getCurrentPrice(decision.ticker);
            currentPrice = parseFloat(priceData.output?.stck_prpr || 0) || 10000; // Fallback price
        } else {
            const exchangeCode = this.getExchangeCode(market);
            const priceData = await this.kisApi.getOverseasPrice(decision.ticker, exchangeCode);
            
            if (priceData.rt_cd === '0') {
                const output = priceData.output || {};
                if (Array.isArray(output)) {
                    currentPrice = parseFloat(output[0]?.last || output[0]?.LAST || output[0]?.xymd_cls_prc || 0);
                } else {
                    currentPrice = parseFloat(output.last || output.LAST || output.xymd_cls_prc || 0);
                }
            }
            
            if (!currentPrice) {
                currentPrice = 100; // Fallback price for overseas stocks
            }
        }

        if (decision.action === 'BUY') {
            // Determine quantity: use quantity if provided, otherwise calculate from amount_krw
            let quantity = decision.quantity || 0;
            
            if (quantity === 0 && decision.amount_krw) {
                quantity = Math.floor(decision.amount_krw / currentPrice);
            }

            if (quantity === 0) {
                throw new TradingError('Order quantity is 0');
            }

            const totalAmount = quantity * currentPrice;

            logger.info('💰 Paper buy order filled', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                filled_quantity: quantity,
                avg_filled_price: currentPrice,
                total_amount: totalAmount,
            });

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

            if (quantity === 0) {
                throw new TradingError('Sell quantity is 0');
            }

            const totalAmount = quantity * currentPrice;

            logger.info('💰 Paper sell order filled', {
                ticker: decision.ticker,
                requested_quantity: quantity,
                filled_quantity: quantity,
                avg_filled_price: currentPrice,
                total_amount: totalAmount,
            });

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
     * Get order fill details from order history
     */
    private async getOrderFillDetails(orderNumber: string, date: string, ticker: string, market: Market): Promise<{
        filled_qty: number;
        avg_filled_price: number;
    }> {
        try {
            let history;
            if (market === Market.DOMESTIC) {
                history = await this.kisApi.getOrderHistory(this.accountNumber, date);
            } else {
                const exchangeCode = this.getExchangeCode(market);
                history = await this.kisApi.getOverseasOrderHistory(this.accountNumber, exchangeCode, date, date);
            }
            
            if (!history.output || !Array.isArray(history.output)) {
                logger.warn('No order history found', { orderNumber, date, market });
                return { filled_qty: 0, avg_filled_price: 0 };
            }

            // Find the order by order number and ticker
            const order = history.output.find((o: any) => 
                (o.odno === orderNumber || o.ODNO === orderNumber || o.ord_no === orderNumber || o.ORD_NO === orderNumber) && 
                (o.pdno === ticker || o.PDNO === ticker || o.symbl === ticker || o.SYMBL === ticker)
            );

            if (!order) {
                logger.warn('Order not found in history', { orderNumber, ticker, date, market });
                return { filled_qty: 0, avg_filled_price: 0 };
            }

            // Parse filled quantity and average price (field names may differ for overseas)
            const filledQty = parseInt(
                order.tot_ccld_qty || order.TOT_CCLD_QTY || order.frcr_ord_qty || order.FRCR_ORD_QTY || '0', 
                10
            );
            const avgPrice = parseFloat(
                order.avg_prcs || order.AVG_PRCS || order.ord_unpr || order.ORD_UNPR || '0'
            );

            return {
                filled_qty: filledQty,
                avg_filled_price: avgPrice,
            };
        } catch (error) {
            logger.warn('Failed to get order fill details', { orderNumber, ticker, market, error });
            return { filled_qty: 0, avg_filled_price: 0 };
        }
    }

    /**
     * Get exchange code for market
     */
    private getExchangeCode(market: Market): string {
        return EXCHANGE_CODES[market] || 'NAS';
    }

    /**
     * Get order status from broker
     */
    async getOrderStatus(orderNumber: string, date: string): Promise<any> {
        const history = await this.kisApi.getOrderHistory(this.accountNumber, date);
        return history;
    }
}
