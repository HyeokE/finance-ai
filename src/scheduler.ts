import cron from 'node-cron';
import { BatchOrchestrator } from './agents/BatchOrchestrator';
import { logger } from './util/logger';

/**
 * Trading Batch Scheduler
 * Schedules automatic batch execution 4 times per day
 */
export class Scheduler {
    private orchestrator: BatchOrchestrator;
    private jobs: ReturnType<typeof cron.schedule>[] = [];

    constructor() {
        this.orchestrator = new BatchOrchestrator();
    }

    /**
     * Start all scheduled jobs
     */
    start(): void {
        const enabled = process.env.ENABLE_SCHEDULER === 'true';

        if (!enabled) {
            logger.info('⏸️  Scheduler is disabled (ENABLE_SCHEDULER=false)');
            return;
        }

        logger.info('⏰ Starting scheduler...');

        // Get schedules from environment
        const schedules = [
            process.env.BATCH_SCHEDULE_1 || '5 9 * * 1-5', // 09:05 Mon-Fri
            process.env.BATCH_SCHEDULE_2 || '30 10 * * 1-5', // 10:30 Mon-Fri
            process.env.BATCH_SCHEDULE_3 || '30 13 * * 1-5', // 13:30 Mon-Fri
            process.env.BATCH_SCHEDULE_4 || '0 15 * * 1-5', // 15:00 Mon-Fri
        ];

        // Schedule each batch
        schedules.forEach((schedule, index) => {
            const job = cron.schedule(schedule, async () => {
                logger.info(`⏰ Scheduled batch ${index + 1} triggered`, { schedule });
                await this.runBatch();
            });

            this.jobs.push(job);
            logger.info(`✅ Scheduled batch ${index + 1}`, { schedule });
        });

        logger.info('✅ Scheduler started', { job_count: this.jobs.length });
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
     * Run a batch manually
     */
    async runBatch(): Promise<void> {
        try {
            const result = await this.orchestrator.runBatch();
            logger.info('Batch completed', result);
        } catch (error) {
            logger.error('Batch failed', { error });
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
