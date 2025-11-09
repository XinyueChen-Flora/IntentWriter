-- Fix document_backups RLS policy to allow users to backup documents they can access

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Authenticated users can create backups" ON document_backups;

-- Create a new policy that checks if user has access to the document
-- Based on the SIMPLE_RLS_SETUP policy: any authenticated user can view any document
CREATE POLICY "Users can backup documents they can access"
  ON document_backups FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can backup if they can view the document
    -- (based on documents_select_policy: any authenticated user can view any document)
    EXISTS (
      SELECT 1 FROM documents
      WHERE id = document_id
    )
  );
