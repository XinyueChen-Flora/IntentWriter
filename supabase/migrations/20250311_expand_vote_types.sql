-- Expand vote types to support Inform/Input/Discussion modes
ALTER TABLE proposal_votes DROP CONSTRAINT IF EXISTS proposal_votes_vote_check;
ALTER TABLE proposal_votes ADD CONSTRAINT proposal_votes_vote_check
  CHECK (vote IN ('approve', 'reject', 'acknowledge', 'escalate', 'response'));
