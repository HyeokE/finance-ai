-- Auto-Finance Database Schema
-- Version: 1.0
-- Created: 2025-12-06

-- ====================================
-- 1. RUNS TABLE
-- ====================================
-- Stores batch execution logs
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('live', 'paper', 'backtest')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
  summary_comment TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for runs
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_mode_status ON runs(mode, status);

-- ====================================
-- 2. DECISIONS TABLE
-- ====================================
-- Stores AI decision logs
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ticker VARCHAR(20) NOT NULL,
  action VARCHAR(10) NOT NULL CHECK (action IN ('BUY', 'SELL', 'HOLD')),
  amount_krw DECIMAL(15, 2),
  quantity INTEGER,
  confidence DECIMAL(3, 2) CHECK (confidence BETWEEN 0 AND 1),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for decisions
CREATE INDEX IF NOT EXISTS idx_decisions_run_id ON decisions(run_id);
CREATE INDEX IF NOT EXISTS idx_decisions_ticker ON decisions(ticker);
CREATE INDEX IF NOT EXISTS idx_decisions_action ON decisions(action);

-- ====================================
-- 3. ORDERS TABLE
-- ====================================
-- Stores order execution logs
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  decision_id UUID REFERENCES decisions(id),
  ticker VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  order_type VARCHAR(20) DEFAULT 'MARKET',
  requested_qty INTEGER NOT NULL,
  requested_price DECIMAL(15, 2),
  status VARCHAR(20) NOT NULL CHECK (status IN ('requested', 'partial_filled', 'filled', 'canceled', 'failed')),
  filled_qty INTEGER DEFAULT 0,
  avg_filled_price DECIMAL(15, 2),
  broker_order_id VARCHAR(50),
  error_code VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_run_id ON orders(run_id);
CREATE INDEX IF NOT EXISTS idx_orders_ticker ON orders(ticker);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_broker_order_id ON orders(broker_order_id);

-- ====================================
-- 4. PORTFOLIO_SNAPSHOTS TABLE
-- ====================================
-- Stores portfolio state at each batch
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  total_equity DECIMAL(15, 2) NOT NULL,
  cash DECIMAL(15, 2) NOT NULL,
  positions JSONB NOT NULL,
  daily_pnl DECIMAL(15, 2),
  total_pnl DECIMAL(15, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for portfolio_snapshots
CREATE INDEX IF NOT EXISTS idx_portfolio_run_id ON portfolio_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_created_at ON portfolio_snapshots(created_at DESC);

-- ====================================
-- 5. MARKET_SNAPSHOTS TABLE
-- ====================================
-- Stores market context at each batch
CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  index_info JSONB NOT NULL,
  sentiment JSONB NOT NULL,
  universe_features JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for market_snapshots
CREATE INDEX IF NOT EXISTS idx_market_run_id ON market_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_market_created_at ON market_snapshots(created_at DESC);

-- ====================================
-- FUNCTIONS & TRIGGERS
-- ====================================

-- Auto-update `updated_at` timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to runs table
DROP TRIGGER IF EXISTS update_runs_updated_at ON runs;
CREATE TRIGGER update_runs_updated_at
  BEFORE UPDATE ON runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to orders table
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- COMMENTS
-- ====================================

COMMENT ON TABLE runs IS 'Batch execution logs';
COMMENT ON TABLE decisions IS 'AI decision logs for each stock';
COMMENT ON TABLE orders IS 'Order execution and fill tracking';
COMMENT ON TABLE portfolio_snapshots IS 'Portfolio state snapshots';
COMMENT ON TABLE market_snapshots IS 'Market context snapshots including compressed features';

-- ====================================
-- SAMPLE QUERIES
-- ====================================

-- Get latest batch run
-- SELECT * FROM runs ORDER BY started_at DESC LIMIT 1;

-- Get decisions for a specific run
-- SELECT * FROM decisions WHERE run_id = 'your-run-id' ORDER BY confidence DESC;

-- Get order fill rate
-- SELECT 
--   status,
--   COUNT(*) as count,
--   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
-- FROM orders
-- GROUP BY status;

-- Get daily PnL trend
-- SELECT 
--   DATE(created_at) as date,
--   AVG(total_equity) as avg_equity,
--   AVG(daily_pnl) as avg_daily_pnl
-- FROM portfolio_snapshots
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY DATE(created_at)
-- ORDER BY date DESC;
