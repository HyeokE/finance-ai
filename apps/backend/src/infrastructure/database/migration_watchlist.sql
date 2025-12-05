-- Watchlist Feature Migration
-- Create table for user-selected stocks to analyze

CREATE TABLE IF NOT EXISTS watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market VARCHAR(20) NOT NULL CHECK (market IN ('DOMESTIC', 'US', 'HK', 'JP', 'CN')),
    ticker VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    enabled BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_market_ticker UNIQUE(market, ticker)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlist_market_enabled ON watchlist(market, enabled);
CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON watchlist(ticker);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER watchlist_updated_at
    BEFORE UPDATE ON watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_watchlist_updated_at();

-- Sample data (optional)
INSERT INTO watchlist (market, ticker, name, notes) VALUES
    ('DOMESTIC', '005930', '삼성전자', '대형 기술주'),
    ('DOMESTIC', '000660', 'SK하이닉스', '반도체'),
    ('US', 'AAPL', 'Apple Inc.', 'Tech giant'),
    ('US', 'MSFT', 'Microsoft Corp.', 'Software')
ON CONFLICT (market, ticker) DO NOTHING;
