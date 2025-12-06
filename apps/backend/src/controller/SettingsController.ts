import { Request, Response } from 'express';
import { SettingsRepository } from '../infrastructure/database/SettingsRepository';
import { Market } from '../model/Trading';
import { logger } from '../util/logger';

// Lazy initialization to ensure .env is loaded first
let settingsRepo: SettingsRepository | null = null;
const getSettingsRepo = () => {
    if (!settingsRepo) {
        settingsRepo = new SettingsRepository();
    }
    return settingsRepo;
};

// ================== Market Batch Settings ==================

export const getAllMarketBatchSettings = async (req: Request, res: Response) => {
    try {
        const settings = await getSettingsRepo().getAllMarketBatchSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to get market batch settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get settings',
        });
    }
};

export const getMarketBatchSettings = async (req: Request, res: Response) => {
    try {
        const market = req.params.market as Market;
        const settings = await getSettingsRepo().getMarketBatchSettings(market);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to get market batch settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get settings',
        });
    }
};

export const updateMarketBatchSettings = async (req: Request, res: Response) => {
    try {
        const market = req.params.market as Market;
        const updates = req.body;
        const settings = await getSettingsRepo().updateMarketBatchSettings(market, updates);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to update market batch settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update settings',
        });
    }
};

// ================== Market Risk Settings ==================

export const getMarketRiskSettings = async (req: Request, res: Response) => {
    try {
        const market = req.params.market as Market;
        const settings = await getSettingsRepo().getMarketRiskSettings(market);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to get market risk settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get settings',
        });
    }
};

export const updateMarketRiskSettings = async (req: Request, res: Response) => {
    try {
        const market = req.params.market as Market;
        const updates = req.body;
        const settings = await getSettingsRepo().updateMarketRiskSettings(market, updates);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to update market risk settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update settings',
        });
    }
};

// ================== Legacy Settings (deprecated) ==================

export const getBatchSettings = async (req: Request, res: Response) => {
    try {
        const settings = await getSettingsRepo().getBatchSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to get batch settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get batch settings',
        });
    }
};

export const updateBatchSettings = async (req: Request, res: Response) => {
    try {
        const updates = req.body;
        const settings = await getSettingsRepo().updateBatchSettings(updates);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to update batch settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update batch settings',
        });
    }
};

export const getRiskSettings = async (req: Request, res: Response) => {
    try {
        const settings = await getSettingsRepo().getRiskSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to get risk settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get risk settings',
        });
    }
};

export const updateRiskSettings = async (req: Request, res: Response) => {
    try {
        const updates = req.body;
        const settings = await getSettingsRepo().updateRiskSettings(updates);
        res.json({ success: true, data: settings });
    } catch (error) {
        logger.error('Failed to update risk settings', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update risk settings',
        });
    }
};

// ================== Dashboard ==================

export const getDashboardOverview = async (req: Request, res: Response) => {
    try {
        const overview = await getSettingsRepo().getDashboardOverview();
        res.json({ success: true, data: overview });
    } catch (error) {
        logger.error('Failed to get dashboard overview', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get overview',
        });
    }
};

export const getRecentDecisions = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const decisions = await getSettingsRepo().getRecentDecisions(limit);
        res.json({ success: true, data: decisions });
    } catch (error) {
        logger.error('Failed to get recent decisions', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get decisions',
        });
    }
};

export const getRecentOrders = async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const { data, error } = await getSettingsRepo()['db']
            .from('orders')
            .select('id, run_id, ticker, direction, order_type, requested_qty, requested_price, filled_qty, avg_filled_price, status, broker_order_id, error_code, error_message, created_at, updated_at, runs(id, started_at, status, market)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('Failed to get recent orders', { error });
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get orders',
        });
    }
};
