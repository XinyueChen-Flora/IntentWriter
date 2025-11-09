-- Create table for storing document content backups
CREATE TABLE IF NOT EXISTS document_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Intent and writing block metadata
  intent_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  writing_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Yjs state snapshots (binary data encoded as base64)
  yjs_snapshots JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Backup metadata
  backed_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  backup_version INTEGER NOT NULL DEFAULT 1,

  -- Indexing for quick lookups
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for finding latest backup per document
CREATE INDEX idx_document_backups_document_id ON document_backups(document_id, backed_up_at DESC);

-- Index for cleanup old backups
CREATE INDEX idx_document_backups_created_at ON document_backups(created_at);

-- RLS policies
ALTER TABLE document_backups ENABLE ROW LEVEL SECURITY;

-- Users can view backups for documents they own or collaborate on
CREATE POLICY "Users can view document backups"
  ON document_backups FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE owner_id = auth.uid()
    )
  );

-- Only authenticated users can create backups (typically via service)
CREATE POLICY "Authenticated users can create backups"
  ON document_backups FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE document_backups IS 'Periodic backups of document content from PartyKit/Yjs';
COMMENT ON COLUMN document_backups.yjs_snapshots IS 'Object mapping writing block IDs to base64-encoded Yjs state';
