-- ================================================
-- Auto-Finance Settings Management Schema
-- Migration: Add dynamic configuration tables
-- ================================================

-- ================== Batch Settings ==================
CREATE TABLE IF NOT EXISTS batch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT true,
  mode VARCHAR(20) DEFAULT 'paper' CHECK (mode IN ('paper', 'live', 'backtest')),
  schedule_times JSONB NOT NULL DEFAULT '["09:05", "10:30", "13:30", "15:00"]'::jsonb,
  supported_markets JSONB NOT NULL DEFAULT '["DOMESTIC"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================== Risk Settings ==================
CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Position limits
  max_position_weight_domestic DECIMAL(4, 3) DEFAULT 0.200 CHECK (max_position_weight_domestic BETWEEN 0 AND 1),
  max_position_weight_overseas DECIMAL(4, 3) DEFAULT 0.150 CHECK (max_position_weight_overseas BETWEEN 0 AND 1),
  max_total_investment DECIMAL(4, 3) DEFAULT 0.800 CHECK (max_total_investment BETWEEN 0 AND 1),
  max_overseas_total DECIMAL(4, 3) DEFAULT 0.500 CHECK (max_overseas_total BETWEEN 0 AND 1),
  min_cash_reserve DECIMAL(4, 3) DEFAULT 0.200 CHECK (min_cash_reserve BETWEEN 0 AND 1),
  
  -- Trading rules
  stop_loss_pct DECIMAL(5, 3) DEFAULT -0.030,
  take_profit_pct DECIMAL(5, 3) DEFAULT 0.100,
  min_confidence DECIMAL(4, 3) DEFAULT 0.600 CHECK (min_confidence BETWEEN 0 AND 1),
  max_trades_per_batch INTEGER DEFAULT 10 CHECK (max_trades_per_batch > 0),
  min_order_amount INTEGER DEFAULT 100000 CHECK (min_order_amount > 0),
  
  -- Currency exposure limits
  currency_limits JSONB DEFAULT '{"USD": 0.30, "HKD": 0.20, "JPY": 0.15, "CNY": 0.10}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================== Dashboard Users ==================
CREATE TABLE IF NOT EXISTS dashboard_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================== Indexes ==================
CREATE INDEX IF NOT EXISTS idx_batch_settings_enabled ON batch_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_dashboard_users_email ON dashboard_users(email);

-- ================== Functions ==================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_batch_settings_updated_at ON batch_settings;
CREATE TRIGGER update_batch_settings_updated_at
    BEFORE UPDATE ON batch_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_risk_settings_updated_at ON risk_settings;
CREATE TRIGGER update_risk_settings_updated_at
    BEFORE UPDATE ON risk_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_users_updated_at ON dashboard_users;
CREATE TRIGGER update_dashboard_users_updated_at
    BEFORE UPDATE ON dashboard_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================== Default Data ==================

-- Insert default batch settings (only if empty)
INSERT INTO batch_settings (enabled, mode, schedule_times, supported_markets)
SELECT true, 'paper', 
       '["09:05", "10:30", "13:30", "15:00"]'::jsonb,
       '["DOMESTIC"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM batch_settings);

-- Insert default risk settings (only if empty)
INSERT INTO risk_settings (
  max_position_weight_domestic,
  max_position_weight_overseas,
  max_total_investment,
  max_overseas_total,
  min_cash_reserve,
  stop_loss_pct,
  take_profit_pct,
  min_confidence,
  max_trades_per_batch,
  min_order_amount,
  currency_limits
)
SELECT 
  0.200, 0.150, 0.800, 0.500, 0.200,
  -0.030, 0.100, 0.600, 10, 100000,
  '{"USD": 0.30, "HKD": 0.20, "JPY": 0.15, "CNY": 0.10}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM risk_settings);

-- ================== Comments ==================
COMMENT ON TABLE batch_settings IS 'Configuration for batch execution schedule and markets';
COMMENT ON TABLE risk_settings IS 'Risk management parameters and trading constraints';
COMMENT ON TABLE dashboard_users IS 'Dashboard user authentication and authorization';

COMMENT ON COLUMN batch_settings.enabled IS 'Whether automatic batch execution is enabled';
COMMENT ON COLUMN batch_settings.mode IS 'Trading mode: paper, live, or backtest';
COMMENT ON COLUMN batch_settings.schedule_times IS 'Array of time strings in HH:MM format';
COMMENT ON COLUMN batch_settings.supported_markets IS 'Array of enabled markets: DOMESTIC, US, HK, JP, CN';

COMMENT ON COLUMN risk_settings.currency_limits IS 'JSON object mapping currency codes to exposure limits (0-1)';
