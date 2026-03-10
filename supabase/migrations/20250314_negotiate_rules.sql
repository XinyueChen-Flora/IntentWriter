-- Store negotiate rules (vote threshold, discussion resolution, etc.)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS negotiate_rules JSONB DEFAULT NULL;
