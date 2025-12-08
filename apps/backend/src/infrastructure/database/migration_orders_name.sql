-- ================================================
-- Add name column to orders table
-- Stores stock name (e.g., "Apple", "삼성전자")
-- ================================================

-- Add name column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Add index for name column (optional, for faster lookups)
CREATE INDEX IF NOT EXISTS idx_orders_name ON orders(name);

-- Add comment
COMMENT ON COLUMN orders.name IS 'Stock name (e.g., "Apple", "삼성전자", "SK하이닉스")';

