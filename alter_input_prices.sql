-- Add input_prices column to catalogue_sessions table
-- This column stores custom prices entered via textarea input

ALTER TABLE catalogue_sessions
ADD COLUMN IF NOT EXISTS input_prices JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column purpose
COMMENT ON COLUMN catalogue_sessions.input_prices IS 'Custom prices entered by user for SKUs, stored as JSON object with SKU as key and price as value';

-- Optional: Create an index for better performance if needed
-- CREATE INDEX IF NOT EXISTS idx_catalogue_sessions_input_prices ON catalogue_sessions USING GIN (input_prices);

-- ============================================================================
-- Fix orders_past_due_accounts_invoice_tracking table constraint issue
-- ============================================================================

-- Add unique constraint on order_id to support upsert operations
-- This ensures each order can only be tracked once and allows the upsert to work properly
ALTER TABLE orders_past_due_accounts_invoice_tracking
ADD CONSTRAINT orders_past_due_accounts_invoice_tracking_order_id_key UNIQUE (order_id);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT orders_past_due_accounts_invoice_tracking_order_id_key ON orders_past_due_accounts_invoice_tracking IS 'Unique constraint on order_id to support upsert operations and prevent duplicate tracking records';