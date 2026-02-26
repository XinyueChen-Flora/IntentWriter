-- Alignment Tracking Tables
-- Stores intent history, writing snapshots, and alignment check results

-- 1. Intent 变更历史
CREATE TABLE IF NOT EXISTS intent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  intent_id TEXT NOT NULL,

  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  content_before TEXT,
  content_after TEXT,

  -- 额外 metadata（比如 parent 变化、position 变化）
  metadata JSONB DEFAULT '{}',

  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_intent_history_document ON intent_history(document_id, changed_at DESC);
CREATE INDEX idx_intent_history_intent ON intent_history(intent_id, changed_at DESC);

-- 2. Writing 快照表
CREATE TABLE IF NOT EXISTS writing_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,  -- root intent ID

  content_markdown TEXT NOT NULL,

  -- 什么触发了这个快照
  trigger TEXT NOT NULL CHECK (trigger IN ('check', 'manual', 'phase_change')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_writing_snapshots_section ON writing_snapshots(document_id, section_id, created_at DESC);

-- 3. 检测结果表（每次检测一条记录）
CREATE TABLE IF NOT EXISTS alignment_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,  -- 以哪个 section 为中心检测

  -- 关联的 writing 快照
  writing_snapshot_id UUID REFERENCES writing_snapshots(id),

  -- 检测结果
  overall_level TEXT NOT NULL CHECK (overall_level IN ('aligned', 'minor-drift', 'intent-boundary', 'team-impact')),

  -- 详细结果（JSON）
  intent_results JSONB NOT NULL DEFAULT '[]',  -- [{intentId, status, spans, gap, ...}]
  links JSONB NOT NULL DEFAULT '[]',           -- intent-writing links
  missing_content JSONB NOT NULL DEFAULT '[]',
  suggested_expansions JSONB NOT NULL DEFAULT '[]',

  summary TEXT,

  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_alignment_checks_document ON alignment_checks(document_id, checked_at DESC);
CREATE INDEX idx_alignment_checks_section ON alignment_checks(document_id, section_id, checked_at DESC);

-- 4. 依赖冲突表（双向可见，保留历史）
CREATE TABLE IF NOT EXISTS dependency_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  dependency_id TEXT NOT NULL,  -- 哪个 dependency 有冲突

  -- 涉及的两个 section
  section_a_id TEXT NOT NULL,
  section_b_id TEXT NOT NULL,

  -- 冲突详情
  conflict_type TEXT CHECK (conflict_type IN ('contradiction', 'inconsistency')),
  description TEXT,
  severity TEXT CHECK (severity IN ('warning', 'conflict')),

  -- 状态
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'superseded')),

  -- 发现信息
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discovered_by UUID REFERENCES auth.users(id),
  discovered_in_check UUID REFERENCES alignment_checks(id),

  -- 解决信息
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_dependency_conflicts_document ON dependency_conflicts(document_id, discovered_at DESC);
CREATE INDEX idx_dependency_conflicts_sections ON dependency_conflicts(document_id, section_a_id);
CREATE INDEX idx_dependency_conflicts_status ON dependency_conflicts(document_id, status) WHERE status = 'open';

-- 5. 文档对齐最新状态（方便快速查询，每个 section 一条）
CREATE TABLE IF NOT EXISTS document_alignment_latest (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL,

  latest_check_id UUID REFERENCES alignment_checks(id),
  overall_level TEXT,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (document_id, section_id)
);

-- RLS Policies
ALTER TABLE intent_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE alignment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_alignment_latest ENABLE ROW LEVEL SECURITY;

-- Helper function: check document access
CREATE OR REPLACE FUNCTION has_document_access(doc_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM documents WHERE id = doc_id AND owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM document_collaborators WHERE document_id = doc_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies: View (owner or collaborator)
CREATE POLICY "Users can view intent history" ON intent_history
  FOR SELECT USING (has_document_access(document_id));

CREATE POLICY "Users can view writing snapshots" ON writing_snapshots
  FOR SELECT USING (has_document_access(document_id));

CREATE POLICY "Users can view alignment checks" ON alignment_checks
  FOR SELECT USING (has_document_access(document_id));

CREATE POLICY "Users can view dependency conflicts" ON dependency_conflicts
  FOR SELECT USING (has_document_access(document_id));

CREATE POLICY "Users can view alignment latest" ON document_alignment_latest
  FOR SELECT USING (has_document_access(document_id));

-- Policies: Insert (authenticated users with access)
CREATE POLICY "Users can insert intent history" ON intent_history
  FOR INSERT WITH CHECK (has_document_access(document_id));

CREATE POLICY "Users can insert writing snapshots" ON writing_snapshots
  FOR INSERT WITH CHECK (has_document_access(document_id));

CREATE POLICY "Users can insert alignment checks" ON alignment_checks
  FOR INSERT WITH CHECK (has_document_access(document_id));

CREATE POLICY "Users can insert dependency conflicts" ON dependency_conflicts
  FOR INSERT WITH CHECK (has_document_access(document_id));

CREATE POLICY "Users can upsert alignment latest" ON document_alignment_latest
  FOR ALL USING (has_document_access(document_id));

-- Policies: Update (for resolving conflicts, updating latest)
CREATE POLICY "Users can update dependency conflicts" ON dependency_conflicts
  FOR UPDATE USING (has_document_access(document_id));

-- Comments
COMMENT ON TABLE intent_history IS 'Tracks all changes to intent content';
COMMENT ON TABLE writing_snapshots IS 'Markdown snapshots of writing content at check time';
COMMENT ON TABLE alignment_checks IS 'Results of each alignment check, with full history';
COMMENT ON TABLE dependency_conflicts IS 'Cross-section conflicts discovered during checks';
COMMENT ON TABLE document_alignment_latest IS 'Quick lookup for latest alignment state per section';
