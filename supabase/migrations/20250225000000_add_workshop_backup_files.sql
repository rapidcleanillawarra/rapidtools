-- Add backup_files column to workshop for cold storage (B2) migration record
ALTER TABLE workshop ADD COLUMN IF NOT EXISTS backup_files jsonb DEFAULT NULL;