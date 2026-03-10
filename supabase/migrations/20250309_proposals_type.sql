ALTER TABLE proposals ADD COLUMN IF NOT EXISTS propose_type TEXT NOT NULL DEFAULT 'decided';
DO $$ BEGIN
  ALTER TABLE proposals ADD CONSTRAINT proposals_propose_type_check CHECK (propose_type IN ('decided', 'input'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
