-- ================================================
-- Add name column to decisions table
-- Stores stock name (e.g., "Apple", "삼성전자")
-- ================================================

-- Add name column to decisions table
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Add index for name column (optional, for faster lookups)
CREATE INDEX IF NOT EXISTS idx_decisions_name ON decisions(name);

-- Add comment
COMMENT ON COLUMN decisions.name IS 'Stock name (e.g., "Apple", "삼성전자", "SK하이닉스")';

