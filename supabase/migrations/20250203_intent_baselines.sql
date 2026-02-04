-- Create table for storing intent baseline snapshots (v1 at phase transition)
CREATE TABLE IF NOT EXISTS intent_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Baseline version (increments per document)
  version INTEGER NOT NULL DEFAULT 1,

  -- Snapshot of intent structure at this baseline
  intent_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Hash of the structure for quick drift comparison
  structure_hash TEXT NOT NULL DEFAULT '',

  -- Who created this baseline
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding latest baseline per document
CREATE INDEX idx_intent_baselines_document_id ON intent_baselines(document_id, version DESC);

-- Unique constraint on document + version
CREATE UNIQUE INDEX idx_intent_baselines_document_version ON intent_baselines(document_id, version);

-- RLS policies
ALTER TABLE intent_baselines ENABLE ROW LEVEL SECURITY;

-- Users can view baselines for documents they own or collaborate on
CREATE POLICY "Users can view intent baselines"
  ON intent_baselines FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE owner_id = auth.uid()
    )
    OR
    document_id IN (
      SELECT document_id FROM document_collaborators
      WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can create baselines
CREATE POLICY "Authenticated users can create baselines"
  ON intent_baselines FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

COMMENT ON TABLE intent_baselines IS 'Snapshots of intent structure at phase transitions, used for drift detection';
COMMENT ON COLUMN intent_baselines.structure_hash IS 'SHA-256 hash of intent structure for quick comparison';
