-- ================================================
-- Market-Specific Batch Scheduling Migration
-- Replaces global batch_settings with per-market settings
-- ================================================

-- ================== Drop Old Tables ==================
DROP TABLE IF EXISTS batch_settings CASCADE;

-- ================== Market Batch Settings ==================
CREATE TABLE IF NOT EXISTS market_batch_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market VARCHAR(20) NOT NULL UNIQUE CHECK (market IN ('DOMESTIC', 'US', 'HK', 'JP', 'CN')),
  enabled BOOLEAN DEFAULT true,
  schedule_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_stocks INTEGER DEFAULT 50 CHECK (max_stocks > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================== Market Risk Settings ==================
CREATE TABLE IF NOT EXISTS market_risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market VARCHAR(20) NOT NULL UNIQUE CHECK (market IN ('DOMESTIC', 'US', 'HK', 'JP', 'CN')),
  max_position_weight DECIMAL(4, 3) DEFAULT 0.150 CHECK (max_position_weight BETWEEN 0 AND 1),
  max_total_investment DECIMAL(4, 3) DEFAULT 0.500 CHECK (max_total_investment BETWEEN 0 AND 1),
  min_confidence DECIMAL(4, 3) DEFAULT 0.600 CHECK (min_confidence BETWEEN 0 AND 1),
  stop_loss_pct DECIMAL(5, 3) DEFAULT -0.030,
  max_trades_per_batch INTEGER DEFAULT 10 CHECK (max_trades_per_batch > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================== Update Runs Table ==================
ALTER TABLE runs ADD COLUMN IF NOT EXISTS market VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_runs_market ON runs(market);

-- ================== Indexes ==================
CREATE INDEX IF NOT EXISTS idx_market_batch_settings_enabled ON market_batch_settings(enabled);
CREATE INDEX IF NOT EXISTS idx_market_batch_settings_market ON market_batch_settings(market);

-- ================== Triggers ==================
DROP TRIGGER IF EXISTS update_market_batch_settings_updated_at ON market_batch_settings;
CREATE TRIGGER update_market_batch_settings_updated_at
    BEFORE UPDATE ON market_batch_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_market_risk_settings_updated_at ON market_risk_settings;
CREATE TRIGGER update_market_risk_settings_updated_at
    BEFORE UPDATE ON market_risk_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================== Default Data ==================

-- Insert default batch schedules (KST timezone)
INSERT INTO market_batch_settings (market, enabled, schedule_times, max_stocks) VALUES
('DOMESTIC', true, '["09:05", "10:30", "13:30", "15:00"]'::jsonb, 50),
('US', false, '["23:35", "01:00", "03:00", "05:00"]'::jsonb, 30),
('HK', false, '["10:35", "12:00", "14:30", "16:00"]'::jsonb, 30),
('JP', false, '["09:05", "10:30", "12:30", "14:30"]'::jsonb, 30),
('CN', false, '["10:35", "12:00", "14:30", "15:30"]'::jsonb, 30)
ON CONFLICT (market) DO NOTHING;

-- Insert default risk settings
INSERT INTO market_risk_settings (market, max_position_weight, max_total_investment, min_confidence) VALUES
('DOMESTIC', 0.200, 0.800, 0.600),  -- Korea: Higher limits
('US', 0.150, 0.300, 0.650),        -- US: Moderate
('HK', 0.150, 0.200, 0.650),        -- Hong Kong
('JP', 0.150, 0.150, 0.650),        -- Japan
('CN', 0.150, 0.100, 0.700)         -- China: More conservative
ON CONFLICT (market) DO NOTHING;

-- ================== Comments ==================
COMMENT ON TABLE market_batch_settings IS 'Per-market batch execution schedules';
COMMENT ON TABLE market_risk_settings IS 'Per-market risk management parameters';

COMMENT ON COLUMN market_batch_settings.market IS 'Market code: DOMESTIC, US, HK, JP, CN';
COMMENT ON COLUMN market_batch_settings.schedule_times IS 'Array of time strings in HH:MM format (KST)';
COMMENT ON COLUMN market_batch_settings.max_stocks IS 'Maximum stocks to analyze per batch for this market';

COMMENT ON COLUMN market_risk_settings.max_position_weight IS 'Maximum % of portfolio per single position';
COMMENT ON COLUMN market_risk_settings.max_total_investment IS 'Maximum % of portfolio invested in this market';
