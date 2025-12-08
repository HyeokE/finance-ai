import { Request, Response } from 'express';
import { BatchOrchestrator } from '../agents/BatchOrchestrator';
import { Market } from '../model/Trading';
import { logger } from '../util/logger';
import { canTradeMarket, getMarketHoursDisplay } from '../util/marketTiming';

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
 * Get current market status and trading availability
 * GET /api/batch/market-status
 */
export async function getMarketStatus(req: Request, res: Response) {
    try {
        const now = new Date();
        const markets = Object.values(Market);

        const status = markets.map((market) => {
            const tradingCheck = canTradeMarket(market as Market, now);
            return {
                market,
                isOpen: tradingCheck.allowed,
                tradingHours: getMarketHoursDisplay(market as Market),
                currentTime: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} KST`,
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                currentTime: now.toISOString(),
                markets: status,
            },
        });
    } catch (error: any) {
        logger.error('Failed to get market status', { error: error.message });
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get market status',
        });
    }
}

/**
 * Manually run batch for a specific market
 * POST /api/batch/run/:market
 */
export async function runBatchManually(req: Request, res: Response) {
    try {
        const { market } = req.params;

        // Validate market string and convert to enum
        const marketEnum = Object.values(Market).find(m => m === market);
        if (!marketEnum) {
            return res.status(400).json({
                success: false,
                error: `Invalid market. Must be one of: ${Object.values(Market).join(', ')}`,
            });
        }

        // ⚠️ Check if market is open for trading
        const tradingCheck = canTradeMarket(marketEnum);
        if (!tradingCheck.allowed) {
            logger.warn('Batch request rejected - market closed', { 
                market: marketEnum, 
                reason: tradingCheck.reason,
                currentMarket: tradingCheck.currentMarket,
            });
            return res.status(400).json({
                success: false,
                error: tradingCheck.reason,
                data: {
                    market: marketEnum,
                    tradingHours: getMarketHoursDisplay(marketEnum),
                    currentMarket: tradingCheck.currentMarket,
                },
            });
        }

        logger.info('Manual batch run requested', { market: marketEnum });

        const result = await getOrchestrator().runBatch(marketEnum);

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
