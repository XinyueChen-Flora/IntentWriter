-- Add paragraph-level attribution tracking to writing snapshots
-- Stores who last edited each paragraph at snapshot time.

ALTER TABLE writing_snapshots
  ADD COLUMN IF NOT EXISTS paragraph_attributions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN writing_snapshots.paragraph_attributions IS
  'Array of {index, textPrefix, lastEditBy: {userId, userName, at}} — per-paragraph attribution';
