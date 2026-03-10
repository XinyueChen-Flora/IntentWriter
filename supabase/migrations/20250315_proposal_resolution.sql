-- Add resolution tracking columns to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);

-- Update status check to allow approved/rejected
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
