import { Request, Response } from 'express';
import { SettingsRepository } from '../infrastructure/database/SettingsRepository';
import { logger } from '../util/logger';

const settingsRepo = new SettingsRepository();

/**
 * Get batch settings
 */
export async function getBatchSettings(req: Request, res: Response) {
    try {
        const settings = await settingsRepo.getBatchSettings();
        res.json(settings);
    } catch (error) {
        logger.error('Failed to get batch settings', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get batch settings',
        });
    }
}

/**
 * Update batch settings
 */
export async function updateBatchSettings(req: Request, res: Response) {
    try {
        const updates = req.body;
        const settings = await settingsRepo.updateBatchSettings(updates);

        res.json({
            success: true,
            settings,
        });
    } catch (error) {
        logger.error('Failed to update batch settings', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to update batch settings',
        });
    }
}

/**
 * Get risk settings
 */
export async function getRiskSettings(req: Request, res: Response) {
    try {
        const settings = await settingsRepo.getRiskSettings();
        res.json(settings);
    } catch (error) {
        logger.error('Failed to get risk settings', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get risk settings',
        });
    }
}

/**
 * Update risk settings
 */
export async function updateRiskSettings(req: Request, res: Response) {
    try {
        const updates = req.body;
        const settings = await settingsRepo.updateRiskSettings(updates);

        res.json({
            success: true,
            settings,
        });
    } catch (error) {
        logger.error('Failed to update risk settings', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to update risk settings',
        });
    }
}

/**
 * Get dashboard overview
 */
export async function getDashboardOverview(req: Request, res: Response) {
    try {
        const overview = await settingsRepo.getDashboardOverview();
        res.json(overview);
    } catch (error) {
        logger.error('Failed to get dashboard overview', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get dashboard overview',
        });
    }
}

/**
 * Get recent decisions
 */
export async function getRecentDecisions(req: Request, res: Response) {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const decisions = await settingsRepo.getRecentDecisions(limit);

        res.json(decisions);
    } catch (error) {
        logger.error('Failed to get recent decisions', { error });
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Failed to get recent decisions',
        });
    }
}
