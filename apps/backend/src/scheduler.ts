import cron from 'node-cron';
import { BatchOrchestrator } from './agents/BatchOrchestrator';
import { SettingsRepository } from './infrastructure/database/SettingsRepository';
import { Market } from './model/Trading';
import { logger } from './util/logger';

/**
 * Trading Batch Scheduler
 * Dynamically schedules batches based on market settings from database
 */
export class Scheduler {
    private orchestrator: BatchOrchestrator;
    private settingsRepo: SettingsRepository;
    private jobs: ReturnType<typeof cron.schedule>[] = [];

    constructor() {
        this.orchestrator = new BatchOrchestrator();
        this.settingsRepo = new SettingsRepository();
    }

    /**
     * Start all scheduled jobs based on database settings
     */
    async start(): Promise<void> {
        const enabled = process.env.ENABLE_SCHEDULER === 'true';

        if (!enabled) {
            logger.info('⏸️  Scheduler is disabled (ENABLE_SCHEDULER=false)');
            return;
        }

        logger.info('⏰ Starting market-specific scheduler...');

        try {
            // Load enabled markets from database
            const enabledMarkets = await this.settingsRepo.getEnabledMarkets();

            if (enabledMarkets.length === 0) {
                logger.warn('⚠️  No markets enabled in database');
                return;
            }

            // Schedule batches for each enabled market
            for (const marketConfig of enabledMarkets) {
                const market = marketConfig.market as Market;
                const times = marketConfig.schedule_times;

                logger.info(`📊 Setting up schedules for ${market} market`, {
                    times,
                    max_stocks: marketConfig.max_stocks,
                });

                // Create cron job for each scheduled time
                for (const time of times) {
                    const cronExpression = this.timeToCron(time);

                    const job = cron.schedule(cronExpression, async () => {
                        logger.info(`⏰ Scheduled batch triggered for ${market} at ${time}`);
                        await this.runMarketBatch(market);
                    });

                    this.jobs.push(job);
                    logger.info(`✅ Scheduled ${market} batch at ${time}`, { cron: cronExpression });
                }
            }

            logger.info('✅ Scheduler started', {
                markets: enabledMarkets.map((m) => m.market),
                total_jobs: this.jobs.length,
            });
        } catch (error) {
            logger.error('Failed to start scheduler', { error });
            throw error;
        }
    }

    /**
     * Stop all scheduled jobs
     */
    stop(): void {
        logger.info('⏹️  Stopping scheduler...');

        this.jobs.forEach((job) => job.stop());
        this.jobs = [];

        logger.info('✅ Scheduler stopped');
    }

    /**
     * Convert time string (HH:MM) to cron expression
     * Example: "09:05" -> "5 9 * * *"
     */
    private timeToCron(time: string): string {
        const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));
        // Run every day at specified time
        return `${minute} ${hour} * * *`;
    }

    /**
     * Run a batch for a specific market
     */
    private async runMarketBatch(market: Market): Promise<void> {
        try {
            const result = await this.orchestrator.runBatch(market);
            logger.info(`Batch completed for ${market}`, result);
        } catch (error) {
            logger.error(`Batch failed for ${market}`, { error });
        }
    }
}

// Export singleton instance
let schedulerInstance: Scheduler | null = null;

export const getScheduler = (): Scheduler => {
    if (!schedulerInstance) {
        schedulerInstance = new Scheduler();
    }
    return schedulerInstance;
};
