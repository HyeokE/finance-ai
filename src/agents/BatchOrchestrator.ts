import { DataCollector } from '../module/DataCollector';
import { ContextCompressor } from '../module/ContextCompressor';
import { RiskValidator } from '../module/RiskValidator';
import { AIDecisionEngine } from './AIDecisionEngine';
import { OrderExecutor } from '../controller/OrderExecutor';
import { DatabaseRepository } from '../infrastructure/database/DatabaseRepository';
import { DEFAULT_CONSTRAINTS, AIInput } from '../model/AI';
import { Portfolio } from '../model/Trading';
import { logger } from '../util/logger';
import { formatKRW } from '../util/formatters';

/**
 * Batch Orchestrator Agent
 * Coordinates the entire trading batch process
 */
export class BatchOrchestrator {
    private dataCollector: DataCollector;
    private contextCompressor: ContextCompressor;
    private riskValidator: RiskValidator;
    private aiEngine: AIDecisionEngine;
    private orderExecutor: OrderExecutor;
    private db: DatabaseRepository;

    constructor() {
        this.dataCollector = new DataCollector();
        this.contextCompressor = new ContextCompressor(this.dataCollector);
        this.riskValidator = new RiskValidator(DEFAULT_CONSTRAINTS);
        this.aiEngine = new AIDecisionEngine();
        this.orderExecutor = new OrderExecutor();
        this.db = new DatabaseRepository();
    }

    /**
     * Run a complete batch cycle
     */
    async runBatch(): Promise<{ runId: string; status: 'success' | 'failed' | 'partial' }> {
        const mode = (process.env.MODE as 'live' | 'paper' | 'backtest') || 'paper';
        let runId = '';
        let status: 'success' | 'failed' | 'partial' = 'failed';

        try {
            logger.info('🚀 Starting batch execution', { mode });

            // Step 1: Create run record
            runId = await this.db.createRun(mode);
            logger.info('Created batch run', { run_id: runId });

            // Step 2: Collect account and market data
            logger.info('📊 Step 1/6: Collecting data...');
            const accountBalance = await this.dataCollector.collectAccountData();
            const indexInfo = await this.dataCollector.collectIndexInfo();
            const sentiment = await this.dataCollector.collectSentiment();

            // Build portfolio
            const portfolio: Portfolio = {
                total_equity: accountBalance.total_equity,
                cash: accountBalance.cash,
                positions: accountBalance.positions,
                total_market_value: accountBalance.securities_value,
                cash_weight: accountBalance.cash / accountBalance.total_equity,
            };

            logger.info('Portfolio loaded', {
                equity: formatKRW(portfolio.total_equity),
                cash: formatKRW(portfolio.cash),
                positions: portfolio.positions.length,
            });

            // Step 3: Get stock universe and compress context
            logger.info('🔍 Step 2/6: Compressing context...');
            const topTickers = await this.dataCollector.collectTopStocksByVolume(100);
            const heldTickers = portfolio.positions.map((p) => p.ticker);
            const universe = this.contextCompressor.filterStockUniverse(topTickers, heldTickers, 50);

            const compressedMarket = await this.contextCompressor.compressMarketData(
                universe,
                indexInfo,
                sentiment
            );

            // Save market snapshot
            await this.db.saveMarketSnapshot(runId, compressedMarket);

            // Save portfolio snapshot
            await this.db.savePortfolioSnapshot(runId, portfolio);

            // Step 4: Get AI decisions
            logger.info('🤖 Step 3/6: Getting AI decisions...');
            const aiInput: AIInput = {
                portfolio,
                market: {
                    index: indexInfo,
                    sentiment,
                },
                stocks: compressedMarket.universe_features,
                constraints: DEFAULT_CONSTRAINTS,
            };

            const aiOutput = await this.aiEngine.getDecisions(aiInput);

            logger.info('AI decisions received', {
                total_decisions: aiOutput.decisions.length,
                market_view: aiOutput.market_view,
                risk_level: aiOutput.risk_level,
            });

            // Save decisions
            await this.db.saveDecisions(runId, aiOutput.decisions);

            // Step 5: Validate decisions
            logger.info('✅ Step 4/6: Validating decisions...');
            const validatedDecisions = this.riskValidator.validateDecisions(aiOutput.decisions, portfolio);

            logger.info('Decisions validated', {
                input: aiOutput.decisions.length,
                output: validatedDecisions.length,
                filtered: aiOutput.decisions.length - validatedDecisions.length,
            });

            // Step 6: Execute orders
            logger.info('💰 Step 5/6: Executing orders...');
            const orderResults = await this.orderExecutor.executeDecisions(runId, validatedDecisions);

            const successCount = orderResults.filter((r) => r.status === 'filled').length;
            const failCount = orderResults.filter((r) => r.status === 'failed').length;

            logger.info('Orders executed', {
                total: orderResults.length,
                success: successCount,
                failed: failCount,
            });

            // Step 7: Finalize
            logger.info('📝 Step 6/6: Finalizing...');

            // Determine final status
            if (failCount === 0) {
                status = 'success';
            } else if (successCount > 0) {
                status = 'partial';
            } else {
                status = 'failed';
            }

            const summary = `Completed with ${successCount} successful orders, ${failCount} failed. Market: ${aiOutput.market_view}`;

            await this.db.updateRunStatus(runId, status, summary);

            logger.info('✅ Batch execution completed', { run_id: runId, status });

            return { runId, status };
        } catch (error) {
            logger.error('❌ Batch execution failed', { run_id: runId, error });

            if (runId) {
                await this.db.updateRunStatus(
                    runId,
                    'failed',
                    undefined,
                    error instanceof Error ? error.message : String(error)
                );
            }

            return { runId, status: 'failed' };
        }
    }

    /**
     * Get batch run status
     */
    async getRunStatus(runId: string): Promise<any> {
        const run = await this.db.getRun(runId);
        const decisions = await this.db.getDecisions(runId);

        return {
            run,
            decision_count: decisions.length,
            decisions: decisions.slice(0, 10), // First 10 for preview
        };
    }

    /**
     * Get performance analytics
     */
    async getAnalytics(): Promise<any> {
        const [pnlTrend, orderStats] = await Promise.all([
            this.db.getDailyPnLTrend(30),
            this.db.getOrderStats(),
        ]);

        return {
            pnl_trend: pnlTrend,
            order_stats: orderStats,
        };
    }
}
