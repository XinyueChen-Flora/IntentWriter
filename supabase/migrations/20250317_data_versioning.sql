-- ═══════════════════════════════════════════════════════
-- Outline Versioning + Writing Snapshots
-- ═══════════════════════════════════════════════════════
--
-- Layer 1 of the data model: versioned outline structure
-- and periodic writing snapshots with contributor tracking.

-- 1. Outline versions — full snapshot on each structural change
CREATE TABLE IF NOT EXISTS outline_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Version number (monotonic per document)
  version INTEGER NOT NULL,

  -- Full outline state at this version
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignments JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What triggered this version
  trigger TEXT NOT NULL CHECK (trigger IN ('user-edit', 'proposal-applied', 'phase-transition')),

  -- Who made the change
  changed_by UUID REFERENCES auth.users(id),
  changed_by_name TEXT,

  -- What changed (for efficient diffing without loading full snapshots)
  change_summary JSONB DEFAULT '{}'::jsonb,
  -- shape: { added: string[], modified: string[], removed: string[], moved: string[] }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_outline_versions_doc_version
  ON outline_versions(document_id, version DESC);

CREATE INDEX idx_outline_versions_doc_latest
  ON outline_versions(document_id, created_at DESC);

-- 2. Extend writing_snapshots with contributor tracking and word count
-- (existing table from 20250206, adding new columns)
ALTER TABLE writing_snapshots
  ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- 3. Function to get next outline version number
CREATE OR REPLACE FUNCTION next_outline_version(doc_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(MAX(version), 0) + 1
  FROM outline_versions
  WHERE document_id = doc_id;
$$ LANGUAGE sql;

-- RLS
ALTER TABLE outline_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view outline versions"
  ON outline_versions FOR SELECT
  USING (has_document_access(document_id));

CREATE POLICY "Users can insert outline versions"
  ON outline_versions FOR INSERT
  WITH CHECK (has_document_access(document_id));

COMMENT ON TABLE outline_versions IS 'Versioned snapshots of outline structure, one per structural change';
COMMENT ON COLUMN outline_versions.nodes IS 'Array of OutlineNode: {id, content, position, parentId, level}';
COMMENT ON COLUMN outline_versions.assignments IS 'Array of SectionAssignment: {sectionId, assigneeId, assigneeName, ...}';
COMMENT ON COLUMN outline_versions.change_summary IS 'IDs of added/modified/removed/moved nodes for quick diff';
