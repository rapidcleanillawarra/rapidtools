-- Table: orders_past_due_accounts_assignments
-- Purpose: Store assignment and follow-up information for past due accounts

CREATE TABLE orders_past_due_accounts_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  assigned_to TEXT,
  follow_up_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE orders_past_due_accounts_assignments IS 'Stores assignment and follow-up information for past due accounts';

-- Add indexes
CREATE INDEX idx_assignments_order_id ON orders_past_due_accounts_assignments(order_id);
CREATE INDEX idx_assignments_assigned_to ON orders_past_due_accounts_assignments(assigned_to);
CREATE INDEX idx_assignments_follow_up_date ON orders_past_due_accounts_assignments(follow_up_date);

-- Create updated_at trigger (reusing the existing function)
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON orders_past_due_accounts_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();