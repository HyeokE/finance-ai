import { getSupabaseClient } from './SupabaseClient';
import { logger } from '../../util/logger';
import { DatabaseError } from '../../util/errors';

/**
 * Settings stored in database
 */
export interface BatchSettings {
    id?: string;
    enabled: boolean;
    mode: 'paper' | 'live' | 'backtest';
    schedule_times: string[]; // ["09:05", "10:30", ...]
    supported_markets: string[]; // ["DOMESTIC", "US", ...]
    created_at?: Date;
    updated_at?: Date;
}

export interface RiskSettings {
    id?: string;
    max_position_weight_domestic: number;
    max_position_weight_overseas: number;
    max_total_investment: number;
    max_overseas_total: number;
    min_cash_reserve: number;
    stop_loss_pct: number;
    take_profit_pct: number;
    min_confidence: number;
    max_trades_per_batch: number;
    min_order_amount: number;
    currency_limits: Record<string, number>;
    created_at?: Date;
    updated_at?: Date;
}

/**
 * Repository for settings management
 */
export class SettingsRepository {
    private db = getSupabaseClient();

    /**
     * Get batch settings
     */
    async getBatchSettings(): Promise<BatchSettings> {
        try {
            const { data, error } = await this.db
                .from('batch_settings')
                .select('*')
                .limit(1)
                .single();

            if (error) throw error;

            return data as BatchSettings;
        } catch (error) {
            logger.error('Failed to get batch settings', { error });
            throw new DatabaseError('Failed to get batch settings', undefined, error);
        }
    }

    /**
     * Update batch settings
     */
    async updateBatchSettings(settings: Partial<BatchSettings>): Promise<BatchSettings> {
        try {
            // Get current settings first
            const current = await this.getBatchSettings();

            const { data, error } = await this.db
                .from('batch_settings')
                .update(settings)
                .eq('id', current.id!)
                .select()
                .single();

            if (error) throw error;

            logger.info('Batch settings updated', { settings });

            return data as BatchSettings;
        } catch (error) {
            logger.error('Failed to update batch settings', { error });
            throw new DatabaseError('Failed to update batch settings', undefined, error);
        }
    }

    /**
     * Get risk settings
     */
    async getRiskSettings(): Promise<RiskSettings> {
        try {
            const { data, error } = await this.db
                .from('risk_settings')
                .select('*')
                .limit(1)
                .single();

            if (error) throw error;

            return data as RiskSettings;
        } catch (error) {
            logger.error('Failed to get risk settings', { error });
            throw new DatabaseError('Failed to get risk settings', undefined, error);
        }
    }

    /**
     * Update risk settings
     */
    async updateRiskSettings(settings: Partial<RiskSettings>): Promise<RiskSettings> {
        try {
            // Get current settings first
            const current = await this.getRiskSettings();

            const { data, error } = await this.db
                .from('risk_settings')
                .update(settings)
                .eq('id', current.id!)
                .select()
                .single();

            if (error) throw error;

            logger.info('Risk settings updated', { settings });

            return data as RiskSettings;
        } catch (error) {
            logger.error('Failed to update risk settings', { error });
            throw new DatabaseError('Failed to update risk settings', undefined, error);
        }
    }

    /**
     * Get dashboard overview data
     */
    async getDashboardOverview(): Promise<any> {
        try {
            // Get latest run
            const { data: latestRun } = await this.db
                .from('runs')
                .select('*')
                .order('started_at', { ascending: false })
                .limit(1)
                .single();

            // Get count of runs today
            const today = new Date().toISOString().split('T')[0];
            const { count: todayRunsCount } = await this.db
                .from('runs')
                .select('*', { count: 'exact', head: true })
                .gte('started_at', `${today}T00:00:00`)
                .lte('started_at', `${today}T23:59:59`);

            // Get success rate (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            const { data: recentRuns } = await this.db
                .from('runs')
                .select('status')
                .gte('started_at', thirtyDaysAgo);

            const totalRuns = recentRuns?.length || 0;
            const successRuns = recentRuns?.filter((r) => r.status === 'success').length || 0;
            const successRate = totalRuns > 0 ? successRuns / totalRuns : 0;

            // Get total orders today
            const { count: todayOrdersCount } = await this.db
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', `${today}T00:00:00`)
                .lte('created_at', `${today}T23:59:59`);

            return {
                latest_run: latestRun,
                today_runs: todayRunsCount || 0,
                today_orders: todayOrdersCount || 0,
                success_rate_30d: successRate,
            };
        } catch (error) {
            logger.error('Failed to get dashboard overview', { error });
            throw new DatabaseError('Failed to get dashboard overview', undefined, error);
        }
    }

    /**
     * Get recent decisions
     */
    async getRecentDecisions(limit: number = 20): Promise<any[]> {
        try {
            const { data, error } = await this.db
                .from('decisions')
                .select('*, runs(status, started_at)')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return data || [];
        } catch (error) {
            logger.error('Failed to get recent decisions', { error });
            throw new DatabaseError('Failed to get recent decisions', undefined, error);
        }
    }
}
