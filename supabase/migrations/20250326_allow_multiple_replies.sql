-- Allow multiple replies per user per proposal
-- The old unique constraint (proposal_id, user_id) only allows one vote/reply per user.
-- For discussion threads, users need to send multiple replies.
-- Solution: drop the unique constraint, add an index instead.

ALTER TABLE proposal_votes DROP CONSTRAINT IF EXISTS proposal_votes_proposal_id_user_id_key;

-- Add a non-unique index for performance
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal_user
  ON proposal_votes(proposal_id, user_id);

-- Also add 'comment' as an allowed vote type (for backward compat)
ALTER TABLE proposal_votes DROP CONSTRAINT IF EXISTS proposal_votes_vote_check;
ALTER TABLE proposal_votes ADD CONSTRAINT proposal_votes_vote_check
  CHECK (vote IN ('approve', 'reject', 'acknowledge', 'escalate', 'response', 'comment'));
