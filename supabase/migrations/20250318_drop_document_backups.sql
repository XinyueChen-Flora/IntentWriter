-- Remove redundant document_backups table.
-- Outline structure is now versioned in outline_versions,
-- writing content is snapshotted in writing_snapshots.

DROP TABLE IF EXISTS document_backups;
