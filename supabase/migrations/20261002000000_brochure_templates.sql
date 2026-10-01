-- Migration: Create brochure_templates table
-- Description: Stores customizable HTML, CSS, and JS templates for brochures (e.g. preventative_maintenance, washroom_fitout)

CREATE TABLE IF NOT EXISTS brochure_templates (
    slug text PRIMARY KEY,
    title text NOT NULL,
    html text NOT NULL DEFAULT '',
    css text NOT NULL DEFAULT '',
    js text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE brochure_templates ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
DROP POLICY IF EXISTS "Allow public read access to brochure_templates" ON brochure_templates;
CREATE POLICY "Allow public read access to brochure_templates"
    ON brochure_templates FOR SELECT
    USING (true);

-- Allow insert/update/delete to all authenticated/anon users
DROP POLICY IF EXISTS "Allow all access to brochure_templates" ON brochure_templates;
CREATE POLICY "Allow all access to brochure_templates"
    ON brochure_templates FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_brochure_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_brochure_templates_updated_at ON brochure_templates;
CREATE TRIGGER trigger_brochure_templates_updated_at
    BEFORE UPDATE ON brochure_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_brochure_templates_updated_at();
