-- Proposals: team-facing change proposals with reasoning and simulation context
-- Created after a user runs impact simulation and decides to propose changes

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Source section this proposal targets
  section_id TEXT NOT NULL,

  -- Who proposed and when
  proposed_by UUID NOT NULL REFERENCES auth.users(id),
  proposed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The reasoning: why the proposer wants this change (required)
  reasoning TEXT NOT NULL,

  -- Proposal intent: 'decided' (FYI, I've decided) or 'input' (need team's input)
  propose_type TEXT NOT NULL DEFAULT 'decided' CHECK (propose_type IN ('decided', 'input')),

  -- Original comment if this came from a comment flow
  comment TEXT,

  -- The proposed outline changes for the source section
  -- [{id, content, status: 'new'|'modified'|'removed', reason?}]
  source_changes JSONB NOT NULL DEFAULT '[]',

  -- AI-assessed impact on other sections
  -- [{sectionId, sectionIntent, impactLevel, reason, suggestedChanges}]
  section_impacts JSONB NOT NULL DEFAULT '[]',

  -- Writing preview diffs (keyed by sectionId)
  -- {sectionId: {mode, currentPreview, changedPreview}}
  writing_previews JSONB NOT NULL DEFAULT '{}',

  -- Proposal lifecycle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_proposals_document ON proposals(document_id, created_at DESC);
CREATE INDEX idx_proposals_section ON proposals(document_id, section_id);
CREATE INDEX idx_proposals_status ON proposals(document_id, status);

-- Votes on proposals
CREATE TABLE IF NOT EXISTS proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
  comment TEXT,  -- optional reasoning for the vote
  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One vote per user per proposal
  UNIQUE(proposal_id, user_id)
);

CREATE INDEX idx_proposal_votes_proposal ON proposal_votes(proposal_id);

-- RLS policies
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;

-- Anyone with document access can view proposals
CREATE POLICY "proposals_select" ON proposals
  FOR SELECT USING (has_document_access(document_id));

-- Any authenticated user with document access can create proposals
CREATE POLICY "proposals_insert" ON proposals
  FOR INSERT WITH CHECK (
    auth.uid() = proposed_by
    AND has_document_access(document_id)
  );

-- Proposer can update (withdraw), resolver can update (approve/reject)
CREATE POLICY "proposals_update" ON proposals
  FOR UPDATE USING (has_document_access(document_id));

-- Votes: document members can view and cast votes
CREATE POLICY "votes_select" ON proposal_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
      AND has_document_access(p.document_id)
    )
  );

CREATE POLICY "votes_insert" ON proposal_votes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM proposals p
      WHERE p.id = proposal_id
      AND has_document_access(p.document_id)
    )
  );

-- Allow users to change their vote
CREATE POLICY "votes_update" ON proposal_votes
  FOR UPDATE USING (auth.uid() = user_id);
