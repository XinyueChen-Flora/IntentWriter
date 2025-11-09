-- ============================================================================
-- SIMPLE RLS SETUP - If you know the ID, you can access it
-- ============================================================================
-- Design: Documents are shareable by ID. If you know the document ID,
-- you can view it and join as a collaborator.
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop ALL existing policies (clean slate)
-- ============================================================================

-- Documents policies
DROP POLICY IF EXISTS "Users can view documents they own" ON public.documents;
DROP POLICY IF EXISTS "Users can view documents they own or collaborate on" ON public.documents;
DROP POLICY IF EXISTS "documents_select_policy" ON public.documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON public.documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents they own" ON public.documents;
DROP POLICY IF EXISTS "Users can update documents they own or edit" ON public.documents;
DROP POLICY IF EXISTS "documents_update_policy" ON public.documents;
DROP POLICY IF EXISTS "Users can delete documents they own" ON public.documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON public.documents;

-- Document_collaborators policies
DROP POLICY IF EXISTS "Users can view collaborators of documents they have access to" ON public.document_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON public.document_collaborators;
DROP POLICY IF EXISTS "Document owners can view all collaborators" ON public.document_collaborators;
DROP POLICY IF EXISTS "collaborators_select_own" ON public.document_collaborators;
DROP POLICY IF EXISTS "collaborators_select_as_owner" ON public.document_collaborators;
DROP POLICY IF EXISTS "Document owners can add collaborators" ON public.document_collaborators;
DROP POLICY IF EXISTS "Users can add themselves as collaborators" ON public.document_collaborators;
DROP POLICY IF EXISTS "collaborators_insert_policy" ON public.document_collaborators;
DROP POLICY IF EXISTS "Document owners can remove collaborators" ON public.document_collaborators;
DROP POLICY IF EXISTS "Users can remove themselves as collaborators" ON public.document_collaborators;
DROP POLICY IF EXISTS "collaborators_delete_policy" ON public.document_collaborators;
DROP POLICY IF EXISTS "collaborators_update_policy" ON public.document_collaborators;

-- Drop helper functions (we don't need them anymore)
DROP FUNCTION IF EXISTS public.is_collaborator(uuid, uuid);
DROP FUNCTION IF EXISTS public.join_document(uuid);

-- ============================================================================
-- STEP 2: Create simple, straightforward policies
-- ============================================================================

-- -------------------------------
-- DOCUMENTS table policies
-- -------------------------------

-- SELECT: Any authenticated user can view any document (if they know the ID)
-- This enables sharing by ID/link
CREATE POLICY "documents_select_policy"
  ON public.documents FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can create documents (they must be the owner)
CREATE POLICY "documents_insert_policy"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Owners and editor collaborators can update
CREATE POLICY "documents_update_policy"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.document_collaborators
      WHERE document_id = id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  );

-- DELETE: Only owners can delete
CREATE POLICY "documents_delete_policy"
  ON public.documents FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- -------------------------------
-- DOCUMENT_COLLABORATORS policies
-- -------------------------------

-- SELECT: Any authenticated user can view collaborators
-- (needed for showing collaborator list in the UI)
CREATE POLICY "collaborators_select_policy"
  ON public.document_collaborators FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can add themselves as collaborators OR owners can add anyone
CREATE POLICY "collaborators_insert_policy"
  ON public.document_collaborators FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()  -- Users can add themselves
    OR EXISTS (           -- OR document owner can add anyone
      SELECT 1 FROM public.documents
      WHERE id = document_id
      AND owner_id = auth.uid()
    )
  );

-- DELETE: Users can remove themselves OR owners can remove anyone
CREATE POLICY "collaborators_delete_policy"
  ON public.document_collaborators FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Users can remove themselves
    OR EXISTS (           -- OR document owner can remove anyone
      SELECT 1 FROM public.documents
      WHERE id = document_id
      AND owner_id = auth.uid()
    )
  );

-- UPDATE: Only owners can update collaborator roles
CREATE POLICY "collaborators_update_policy"
  ON public.document_collaborators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_id
      AND owner_id = auth.uid()
    )
  );

-- ============================================================================
-- Summary:
-- ============================================================================
-- ✅ Any authenticated user can view any document (if they know the ID)
-- ✅ Users can add themselves as collaborators to any document
-- ✅ Owners have full control over their documents
-- ✅ Collaborators with editor role can update documents
-- ✅ No circular dependencies, no complex functions
-- ✅ Perfect for sharing via ID/link
-- ============================================================================
