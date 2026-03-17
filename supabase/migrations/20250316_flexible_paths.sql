-- ─── Flexible Coordination Paths ───
--
-- Remove hardcoded CHECK constraints on propose_type and vote values.
-- The platform now validates against the coordination path registry at runtime,
-- so any registered path ID is valid as a propose_type, and any registered
-- action ID is valid as a vote.
--
-- Also adds path_config column to snapshot the path configuration at proposal time.

-- Drop hardcoded propose_type constraint — allow any registered path ID
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_propose_type_check;

-- Drop hardcoded vote constraint — allow any registered action ID
ALTER TABLE proposal_votes DROP CONSTRAINT IF EXISTS proposal_votes_vote_check;

-- Snapshot the path configuration at proposal creation time.
-- This ensures the resolution logic uses the config that was active when
-- the proposal was created, not whatever the team changes later.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS path_config JSONB DEFAULT NULL;
