import { NextResponse } from 'next/server';
import { requireDocumentOwner, isErrorResponse, withErrorHandler } from '@/lib/api/middleware';

export const DELETE = withErrorHandler(async (request: Request) => {
  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  const ownerResult = await requireDocumentOwner(documentId);
  if (isErrorResponse(ownerResult)) return ownerResult;
  const { admin } = ownerResult;

  // Delete collaborators and invitations first
  await admin.from('document_collaborators').delete().eq('document_id', documentId);
  await admin.from('document_invitations').delete().eq('document_id', documentId);

  // Delete the document
  const { error } = await admin.from('documents').delete().eq('id', documentId);

  if (error) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
