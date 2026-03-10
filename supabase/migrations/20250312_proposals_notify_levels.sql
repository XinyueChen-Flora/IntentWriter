-- Add per-section notify levels and personal notes to proposals
-- notify_levels: { "sectionId1": "notify", "sectionId2": "heads-up" }
-- personal_notes: { "sectionId1": "How this affects your section..." }
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS notify_levels JSONB DEFAULT '{}';
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS personal_notes JSONB DEFAULT '{}';
