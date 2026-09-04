-- Add drawing_urls column to workshop table for drawing request attachments
ALTER TABLE workshop ADD COLUMN IF NOT EXISTS drawing_urls text[] DEFAULT '{}';
