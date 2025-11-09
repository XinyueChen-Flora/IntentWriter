-- Enable collaboration: Allow users to view and access documents they collaborate on
-- Run this in your Supabase SQL Editor

-- 1. Drop the old restrictive policy on documents
DROP POLICY IF EXISTS "Users can view documents they own" ON public.documents;

-- 2. Create new policy that allows viewing documents the user owns OR collaborates on
CREATE POLICY "Users can view documents they own or collaborate on"
  ON public.documents FOR SELECT
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = documents.id
      AND user_id = auth.uid()
    )
  );

-- 3. Update UPDATE policy to allow collaborators with editor role
DROP POLICY IF EXISTS "Users can update documents they own" ON public.documents;

CREATE POLICY "Users can update documents they own or edit"
  ON public.documents FOR UPDATE
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = documents.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  );

-- 4. Add policy for users to join as collaborator (self-join with document ID)
CREATE POLICY "Users can add themselves as collaborators"
  ON public.document_collaborators FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 5. Add policy for users to remove themselves as collaborators
CREATE POLICY "Users can remove themselves as collaborators"
  ON public.document_collaborators FOR DELETE
  USING (user_id = auth.uid());
