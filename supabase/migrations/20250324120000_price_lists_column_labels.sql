-- Custom print column headings for build price list
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS column_labels jsonb DEFAULT '{}'::jsonb;
