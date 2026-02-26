import { NextResponse } from 'next/server';
import { requireDocumentOwner, isErrorResponse, withErrorHandler } from '@/lib/api/middleware';

export const DELETE = withErrorHandler(async (request: Request) => {
  const { userId, invitationId, documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  const ownerResult = await requireDocumentOwner(documentId);
  if (isErrorResponse(ownerResult)) return ownerResult;
  const { user, admin } = ownerResult;

  if (userId) {
    // Prevent owner from removing themselves
    if (userId === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself as the owner' }, { status: 400 });
    }

    const { error } = await admin
      .from('document_collaborators')
      .delete()
      .eq('document_id', documentId)
      .eq('user_id', userId);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (invitationId) {
    const { error } = await admin
      .from('document_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('document_id', documentId);

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Either userId or invitationId is required' }, { status: 400 });
});
