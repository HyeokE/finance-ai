import { Request, Response } from 'express';
import { SettingsRepository } from '../infrastructure/database/SettingsRepository';
import type { AddWatchlistRequest, UpdateWatchlistRequest } from '@auto-finance/shared';
import { logger } from '../util/logger';

// Lazy initialization
let settingsRepo: SettingsRepository | null = null;
const getSettingsRepo = () => {
    if (!settingsRepo) {
        settingsRepo = new SettingsRepository();
    }
    return settingsRepo;
};

// ================== Watchlist ==================

export const getWatchlist = async (req: Request, res: Response) => {
    try {
        const market = req.params.market;
        const watchlist = await getSettingsRepo().getWatchlist(market);
        res.json({ success: true, data: watchlist });
    } catch (error) {
        logger.error('Failed to get watchlist', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get watchlist',
        });
    }
};

export const addWatchlistItem = async (req: Request, res: Response) => {
    try {
        const item: AddWatchlistRequest = req.body;
        const result = await getSettingsRepo().addWatchlistItem(item);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Failed to add watchlist item', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add watchlist item',
        });
    }
};

export const updateWatchlistItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const updates: UpdateWatchlistRequest = req.body;
        const result = await getSettingsRepo().updateWatchlistItem(id, updates);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Failed to update watchlist item', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update watchlist item',
        });
    }
};

export const deleteWatchlistItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await getSettingsRepo().deleteWatchlistItem(id);
        res.json({ success: true });
    } catch (error) {
        logger.error('Failed to delete watchlist item', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete watchlist item',
        });
    }
};

export const toggleWatchlistItem = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;
        const result = await getSettingsRepo().toggleWatchlistItem(id, enabled);
        res.json({ success: true, data: result });
    } catch (error) {
        logger.error('Failed to toggle watchlist item', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to toggle watchlist item',
        });
    }
};
