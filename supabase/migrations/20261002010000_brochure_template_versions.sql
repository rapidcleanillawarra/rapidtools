-- Migration: Create brochure_template_versions table
-- Description: Stores historical versions of brochure HTML, CSS, and JS templates for both preventative_maintenance and washroom_fitout brochures

CREATE TABLE IF NOT EXISTS brochure_template_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL,
    version_number integer NOT NULL DEFAULT 1,
    label text NOT NULL DEFAULT '',
    html text NOT NULL DEFAULT '',
    css text NOT NULL DEFAULT '',
    js text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by text DEFAULT ''
);

-- Indices for fast retrieval by slug and chronological order
CREATE INDEX IF NOT EXISTS idx_brochure_template_versions_slug ON brochure_template_versions(slug);
CREATE INDEX IF NOT EXISTS idx_brochure_template_versions_created_at ON brochure_template_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brochure_template_versions_slug_ver ON brochure_template_versions(slug, version_number DESC);

-- Enable Row Level Security
ALTER TABLE brochure_template_versions ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users
DROP POLICY IF EXISTS "Allow public read access to brochure_template_versions" ON brochure_template_versions;
CREATE POLICY "Allow public read access to brochure_template_versions"
    ON brochure_template_versions FOR SELECT
    USING (true);

-- Allow insert/update/delete to all authenticated/anon users
DROP POLICY IF EXISTS "Allow all access to brochure_template_versions" ON brochure_template_versions;
CREATE POLICY "Allow all access to brochure_template_versions"
    ON brochure_template_versions FOR ALL
    USING (true)
    WITH CHECK (true);
