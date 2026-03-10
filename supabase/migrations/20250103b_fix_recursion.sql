-- Fix infinite recursion in RLS policies
-- The issue: documents policy checks document_collaborators,
-- and document_collaborators policy checks documents -> circular reference!

-- Solution: Use a SECURITY DEFINER function that bypasses RLS

-- 1. Create a helper function that checks if user is a collaborator (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_collaborator(doc_id uuid, uid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.document_collaborators
    WHERE document_id = doc_id
    AND user_id = uid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop the old policies
DROP POLICY IF EXISTS "Users can view documents they own" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents they own or collaborate on" ON public.documents;
DROP POLICY IF EXISTS "Users can view collaborators of documents they have access to" ON public.document_collaborators;

-- 3. Create new documents policy using the helper function (no circular reference)
CREATE POLICY "Users can view documents they own or collaborate on"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = owner_id
    OR public.is_collaborator(id, auth.uid())
  );

-- 4. Simplified document_collaborators policy (no circular reference)
CREATE POLICY "Users can view their own collaborations"
  ON public.document_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- 5. Allow owners to view all collaborators of their documents
CREATE POLICY "Document owners can view all collaborators"
  ON public.document_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_id
      AND owner_id = auth.uid()
    )
  );
