import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { BatchOrchestrator } from './agents/BatchOrchestrator';
import { getScheduler } from './scheduler';
import { SupabaseClientManager } from './infrastructure/database/SupabaseClient';
import { logger } from './util/logger';
import {
  getAllMarketBatchSettings,
  getMarketBatchSettings,
  updateMarketBatchSettings,
  getMarketRiskSettings,
  updateMarketRiskSettings,
  getBatchSettings,
  updateBatchSettings,
  getRiskSettings,
  updateRiskSettings,
  getDashboardOverview,
  getRecentDecisions,
  getRecentOrders,
} from './controller/SettingsController';
import {
  getWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  deleteWatchlistItem,
  toggleWatchlistItem,
} from './controller/WatchlistController';
import { runBatchManually } from './controller/BatchController';

// Load .env from project root (monorepo)
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize orchestrator
const orchestrator = new BatchOrchestrator();

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Auto Finance Server',
    mode: process.env.MODE || 'paper',
    version: '1.0.0',
  });
});

app.get('/health', async (req: Request, res: Response) => {
  try {
    const dbConnected = await SupabaseClientManager.testConnection();

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      mode: process.env.MODE || 'paper',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});

// Trigger manual batch run
app.post('/api/batch/run/:market?', async (req, res) => {
  try {
    const market = (req.params.market || 'DOMESTIC') as 'DOMESTIC' | 'US' | 'HK' | 'JP' | 'CN';
    logger.info(`Manual batch trigger requested for market: ${market}`);
    const orchestrator = new BatchOrchestrator();
    const result = await orchestrator.runBatch(market);

    res.json({
      success: true,
      run_id: result.runId,
      market,
      status: result.status,
    });
  } catch (error) {
    logger.error('Failed to trigger batch', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run batch',
    });
  }
});

// Get batch status
app.get('/api/batch/status/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    // Assuming orchestrator is still globally available or re-instantiated if needed for this route
    // If the orchestrator is only instantiated in the /api/batch/run route, this will need adjustment.
    // For now, let's assume the global orchestrator is still intended for this route.
    const orchestrator = new BatchOrchestrator(); // Re-instantiate for consistency with the /run endpoint's new logic
    const status = await orchestrator.getRunStatus(runId);

    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get analytics
app.get('/api/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = await orchestrator.getAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ===================================
// Settings Management
// ===================================

// Market-specific batch settings
app.get('/api/settings/markets', getAllMarketBatchSettings);
app.get('/api/settings/markets/:market/batch', getMarketBatchSettings);
app.put('/api/settings/markets/:market/batch', updateMarketBatchSettings);
app.get('/api/settings/markets/:market/risk', getMarketRiskSettings);
app.put('/api/settings/markets/:market/risk', updateMarketRiskSettings);

// Legacy settings (deprecated)
app.get('/api/settings/batch', getBatchSettings);
app.put('/api/settings/batch', updateBatchSettings);
app.get('/api/settings/risk', getRiskSettings);
app.put('/api/settings/risk', updateRiskSettings);

// Dashboard data
app.get('/api/dashboard/overview', getDashboardOverview);
app.get('/api/dashboard/recent-decisions', getRecentDecisions);
app.get('/api/dashboard/recent-orders', getRecentOrders);

// Watchlist
app.get('/api/watchlist', getWatchlist);
app.get('/api/watchlist/:market', getWatchlist);
app.post('/api/watchlist', addWatchlistItem);
app.put('/api/watchlist/:id', updateWatchlistItem);
app.delete('/api/watchlist/:id', deleteWatchlistItem);
app.patch('/api/watchlist/:id/toggle', toggleWatchlistItem);

// Batch Operations
app.post('/api/batch/run/:market', runBatchManually);

// ===================================
// Error Handling
// ===================================
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Server error', { error: err });
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  app.listen(PORT, async () => {
    logger.info(`🚀 Auto-Finance Server started on http://localhost:${PORT}`);
    logger.info(`📊 Mode: ${process.env.MODE || 'paper'}`);

    // Start scheduler
    try {
      const scheduler = getScheduler();
      await scheduler.start();
    } catch (error) {
      logger.error('Failed to start scheduler', { error });
    }
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
