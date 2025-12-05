import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './SupabaseClient';
import { Decision, AIOutput } from '../../model/AI';
import { Portfolio, OrderResult } from '../../model/Trading';
import { CompressedMarketData } from '../../model/Market';
import { logger } from '../../util/logger';
import { DatabaseError } from '../../util/errors';

/**
 * Database Repository
 * Handles all database operations following Repository pattern
 */
export class DatabaseRepository {
    private db: SupabaseClient;

    constructor() {
        this.db = getSupabaseClient();
    }

    // ========================================
    // RUNS
    // ========================================

    /**
     * Create a new batch run
     */
    async createRun(mode: 'live' | 'paper' | 'backtest'): Promise<string> {
        try {
            const { data, error } = await this.db
                .from('runs')
                .insert({
                    mode,
                    status: 'running',
                    started_at: new Date().toISOString(),
                })
                .select('id')
                .single();

            if (error) throw new DatabaseError('Failed to create run', error.code, error);

            logger.info('Created new batch run', { run_id: data.id, mode });
            return data.id;
        } catch (error) {
            logger.error('Failed to create run', { error });
            throw error;
        }
    }

    /**
     * Update run status
     */
    async updateRunStatus(
        runId: string,
        status: 'running' | 'success' | 'failed' | 'partial',
        summary?: string,
        errorMessage?: string
    ): Promise<void> {
        try {
            const { error } = await this.db
                .from('runs')
                .update({
                    status,
                    summary_comment: summary,
                    error_message: errorMessage,
                    finished_at: status !== 'running' ? new Date().toISOString() : undefined,
                })
                .eq('id', runId);

            if (error) throw new DatabaseError('Failed to update run', error.code, error);

            logger.info('Updated run status', { run_id: runId, status });
        } catch (error) {
            logger.error('Failed to update run status', { run_id: runId, error });
            throw error;
        }
    }

    /**
     * Get run by ID
     */
    async getRun(runId: string): Promise<any> {
        const { data, error } = await this.db.from('runs').select('*').eq('id', runId).single();

        if (error) throw new DatabaseError('Failed to get run', error.code, error);

        return data;
    }

    // ========================================
    // DECISIONS
    // ========================================

    /**
     * Save AI decisions
     */
    async saveDecisions(runId: string, decisions: Decision[]): Promise<void> {
        try {
            const records = decisions.map((d) => ({
                run_id: runId,
                ticker: d.ticker,
                action: d.action,
                amount_krw: d.amount_krw,
                quantity: d.quantity,
                confidence: d.confidence,
                reason: d.reason,
            }));

            const { error } = await this.db.from('decisions').insert(records);

            if (error) throw new DatabaseError('Failed to save decisions', error.code, error);

            logger.info('Saved AI decisions', { run_id: runId, count: decisions.length });
        } catch (error) {
            logger.error('Failed to save decisions', { run_id: runId, error });
            throw error;
        }
    }

    /**
     * Get decisions for a run
     */
    async getDecisions(runId: string): Promise<Decision[]> {
        const { data, error } = await this.db
            .from('decisions')
            .select('*')
            .eq('run_id', runId)
            .order('confidence', { ascending: false });

        if (error) throw new DatabaseError('Failed to get decisions', error.code, error);

        return data as Decision[];
    }

    // ========================================
    // ORDERS
    // ========================================

    /**
     * Save order result
     */
    async saveOrder(runId: string, decisionId: string | null, order: OrderResult): Promise<void> {
        try {
            const { error } = await this.db.from('orders').insert({
                run_id: runId,
                decision_id: decisionId,
                ticker: order.ticker,
                direction: order.direction,
                requested_qty: order.requested_qty,
                filled_qty: order.filled_qty,
                avg_filled_price: order.avg_filled_price,
                status: order.status,
                broker_order_id: order.broker_order_id,
                error_code: order.error_code,
                error_message: order.error_message,
            });

            if (error) throw new DatabaseError('Failed to save order', error.code, error);

            logger.info('Saved order', { run_id: runId, ticker: order.ticker, status: order.status });
        } catch (error) {
            logger.error('Failed to save order', { run_id: runId, error });
            throw error;
        }
    }

    /**
     * Update order status
     */
    async updateOrder(
        orderId: string,
        status: string,
        filledQty?: number,
        avgPrice?: number
    ): Promise<void> {
        const { error } = await this.db
            .from('orders')
            .update({
                status,
                filled_qty: filledQty,
                avg_filled_price: avgPrice,
            })
            .eq('id', orderId);

        if (error) throw new DatabaseError('Failed to update order', error.code, error);

        logger.info('Updated order status', { order_id: orderId, status });
    }

    // ========================================
    // PORTFOLIO SNAPSHOTS
    // ========================================

    /**
     * Save portfolio snapshot
     */
    async savePortfolioSnapshot(
        runId: string,
        portfolio: Portfolio,
        dailyPnl?: number,
        totalPnl?: number
    ): Promise<void> {
        try {
            const { error } = await this.db.from('portfolio_snapshots').insert({
                run_id: runId,
                total_equity: portfolio.total_equity,
                cash: portfolio.cash,
                positions: portfolio.positions,
                daily_pnl: dailyPnl,
                total_pnl: totalPnl,
            });

            if (error) throw new DatabaseError('Failed to save portfolio snapshot', error.code, error);

            logger.info('Saved portfolio snapshot', {
                run_id: runId,
                total_equity: portfolio.total_equity,
            });
        } catch (error) {
            logger.error('Failed to save portfolio snapshot', { run_id: runId, error });
            throw error;
        }
    }

    // ========================================
    // MARKET SNAPSHOTS
    // ========================================

    /**
     * Save market snapshot
     */
    async saveMarketSnapshot(runId: string, market: CompressedMarketData): Promise<void> {
        try {
            const { error } = await this.db.from('market_snapshots').insert({
                run_id: runId,
                index_info: market.index,
                sentiment: market.sentiment,
                universe_features: market.universe_features,
            });

            if (error) throw new DatabaseError('Failed to save market snapshot', error.code, error);

            logger.info('Saved market snapshot', { run_id: runId });
        } catch (error) {
            logger.error('Failed to save market snapshot', { run_id: runId, error });
            throw error;
        }
    }

    // ========================================
    // ANALYTICS
    // ========================================

    /**
     * Get daily PnL trend
     */
    async getDailyPnLTrend(days: number = 30): Promise<any[]> {
        const { data, error } = await this.db
            .from('portfolio_snapshots')
            .select('created_at, total_equity, daily_pnl')
            .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false });

        if (error) throw new DatabaseError('Failed to get PnL trend', error.code, error);

        return data;
    }

    /**
     * Get order fill rate statistics
     */
    async getOrderStats(): Promise<any> {
        const { data, error } = await this.db.from('orders').select('status');

        if (error) throw new DatabaseError('Failed to get order stats', error.code, error);

        const stats = data.reduce(
            (acc: any, order: any) => {
                acc[order.status] = (acc[order.status] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        const total = data.length;
        const fillRate = total > 0 ? ((stats.filled || 0) / total) * 100 : 0;

        return { stats, total, fillRate };
    }
}
