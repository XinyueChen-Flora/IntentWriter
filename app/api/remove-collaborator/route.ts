import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, invitationId, documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
  }

  // Verify requester is document owner
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from('documents')
    .select('owner_id')
    .eq('id', documentId)
    .single();

  if (!doc || doc.owner_id !== user.id) {
    return NextResponse.json({ error: 'Only the document owner can remove collaborators' }, { status: 403 });
  }

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
}
