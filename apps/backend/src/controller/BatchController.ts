import { Request, Response } from 'express';
import { BatchOrchestrator } from '../agents/BatchOrchestrator';
import { logger } from '../util/logger';

// Singleton instance to prevent memory leaks
let orchestrator: BatchOrchestrator | null = null;

const getOrchestrator = (): BatchOrchestrator => {
    if (!orchestrator) {
        logger.info('Creating new BatchOrchestrator instance');
        orchestrator = new BatchOrchestrator();
    }
    return orchestrator;
};

/**
 * Manually run batch for a specific market
 * POST /api/batch/run/:market
 */
export async function runBatchManually(req: Request, res: Response) {
    try {
        const { market } = req.params;

        if (!['DOMESTIC', 'US', 'HK', 'JP', 'CN'].includes(market)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid market. Must be one of: DOMESTIC, US, HK, JP, CN',
            });
        }

        logger.info('Manual batch run requested', { market });

        const result = await getOrchestrator().runBatch(market as any);

        return res.status(200).json({
            success: true,
            message: `Batch started for ${market}`,
            data: {
                run_id: result.runId,
                status: result.status,
                market,
            },
        });
    } catch (error: any) {
        logger.error('Failed to run batch manually', { error: error.message });
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to run batch',
        });
    }
}
