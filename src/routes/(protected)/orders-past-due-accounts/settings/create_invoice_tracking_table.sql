-- Table: orders_past_due_accounts_invoice_tracking
-- Purpose: Track invoices that are pulled from the external system
-- Records when invoices are fetched and their processing status

CREATE TABLE orders_past_due_accounts_invoice_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  does_exists BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE orders_past_due_accounts_invoice_tracking IS 'Tracks invoices pulled from external system and their processing status';

-- Add indexes
CREATE INDEX idx_invoice_tracking_order_id ON orders_past_due_accounts_invoice_tracking(order_id);
CREATE INDEX idx_invoice_tracking_does_exists ON orders_past_due_accounts_invoice_tracking(does_exists);
CREATE INDEX idx_invoice_tracking_completed ON orders_past_due_accounts_invoice_tracking(completed);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_tracking_updated_at
  BEFORE UPDATE ON orders_past_due_accounts_invoice_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();