-- Add 'negotiate' as a valid propose_type
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_propose_type_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_propose_type_check
  CHECK (propose_type IN ('decided', 'negotiate', 'input', 'discussion'));
