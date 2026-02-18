-- Table: disabled_products
-- Purpose: Log products disabled via Product & Order Management (in addition to API apply)

CREATE TABLE disabled_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL,
  replacement_product_sku TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE disabled_products IS 'Log of products disabled via Product & Order Management';

CREATE INDEX idx_disabled_products_sku ON disabled_products(sku);
CREATE INDEX idx_disabled_products_created_at ON disabled_products(created_at);

-- RLS
ALTER TABLE disabled_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated" ON disabled_products
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow insert for anon" ON disabled_products
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow select for authenticated" ON disabled_products
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow select for anon" ON disabled_products
  FOR SELECT TO anon
  USING (true);

-- Allow updating reason (e.g. from table list)
CREATE POLICY "Allow update for authenticated" ON disabled_products
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow update for anon" ON disabled_products
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);
