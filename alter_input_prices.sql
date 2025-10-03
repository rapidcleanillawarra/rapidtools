-- Add input_prices column to catalogue_sessions table
-- This column stores custom prices entered via textarea input

ALTER TABLE catalogue_sessions
ADD COLUMN IF NOT EXISTS input_prices JSONB DEFAULT '{}'::jsonb;

-- Add comment to document the column purpose
COMMENT ON COLUMN catalogue_sessions.input_prices IS 'Custom prices entered by user for SKUs, stored as JSON object with SKU as key and price as value';

-- Optional: Create an index for better performance if needed
-- CREATE INDEX IF NOT EXISTS idx_catalogue_sessions_input_prices ON catalogue_sessions USING GIN (input_prices);
