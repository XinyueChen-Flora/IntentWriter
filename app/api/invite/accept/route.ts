import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 });
  }

  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Look up invitation by token
  const { data: invitation, error: lookupError } = await admin
    .from('document_invitations')
    .select('*')
    .eq('token', token)
    .single();

  if (lookupError || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status === 'accepted') {
    return NextResponse.json({ documentId: invitation.document_id, alreadyAccepted: true });
  }

  if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
  }

  // Add user to document_collaborators (idempotent)
  await admin
    .from('document_collaborators')
    .upsert(
      { document_id: invitation.document_id, user_id: user.id, role: invitation.role },
      { onConflict: 'document_id,user_id', ignoreDuplicates: true }
    );

  // Mark invitation as accepted
  await admin
    .from('document_invitations')
    .update({ status: 'accepted' })
    .eq('id', invitation.id);

  return NextResponse.json({ documentId: invitation.document_id });
}
