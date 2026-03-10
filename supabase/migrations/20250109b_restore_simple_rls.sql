-- Restore the SIMPLE RLS policy for documents
-- This allows any authenticated user to view documents (needed for Join Room feature)

-- Drop the restrictive policy if it exists
DROP POLICY IF EXISTS "documents_select_policy" ON public.documents;

-- Recreate the permissive policy
-- Any authenticated user can view any document (if they know the ID)
CREATE POLICY "documents_select_policy"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

-- Note: This is intentionally permissive to enable the "Join Room" feature
-- Users can only see documents in their Dashboard if they:
-- 1. Own the document (owner_id = user.id)
-- 2. Have joined it (exists in document_collaborators)
-- But they CAN query any document by ID to join it
