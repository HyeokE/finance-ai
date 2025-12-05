import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { BatchOrchestrator } from './agents/BatchOrchestrator';
import { getScheduler } from './scheduler';
import { SupabaseClientManager } from './infrastructure/database/SupabaseClient';
import { logger } from './util/logger';
import {
  getBatchSettings,
  updateBatchSettings,
  getRiskSettings,
  updateRiskSettings,
  getDashboardOverview,
  getRecentDecisions,
} from './controller/SettingsController';

dotenv.config();

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

// Manual batch trigger
app.post('/api/batch/run', async (req: Request, res: Response) => {
  try {
    logger.info('Manual batch trigger requested');

    const result = await orchestrator.runBatch();

    res.json({
      success: true,
      run_id: result.runId,
      status: result.status,
    });
  } catch (error) {
    logger.error('Batch run failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get batch status
app.get('/api/batch/status/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
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

// Batch settings
app.get('/api/settings/batch', getBatchSettings);
app.put('/api/settings/batch', updateBatchSettings);

// Risk settings
app.get('/api/settings/risk', getRiskSettings);
app.put('/api/settings/risk', updateRiskSettings);

// Dashboard data
app.get('/api/dashboard/overview', getDashboardOverview);
app.get('/api/dashboard/recent-decisions', getRecentDecisions);

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
app.listen(PORT, () => {
  logger.info(`🚀 Auto-Finance Server started on http://localhost:${PORT}`);
  logger.info(`📊 Mode: ${process.env.MODE || 'paper'}`);

  // Start scheduler
  const scheduler = getScheduler();
  scheduler.start();
});


