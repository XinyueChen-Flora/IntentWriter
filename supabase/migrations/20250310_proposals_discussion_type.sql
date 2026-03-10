-- Add 'discussion' as a valid propose_type
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_propose_type_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_propose_type_check
  CHECK (propose_type IN ('decided', 'input', 'discussion'));

-- Add notification targets and question fields
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS notify_user_ids UUID[] DEFAULT '{}';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS question TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);
