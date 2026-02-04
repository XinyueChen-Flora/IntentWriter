import { createAdminClient } from '@/lib/supabase/server';
import InviteClient from './InviteClient';

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const admin = createAdminClient();

  // Look up invitation
  const { data: invitation } = await admin
    .from('document_invitations')
    .select('id, document_id, email, status, expires_at, invited_by')
    .eq('token', token)
    .single();

  if (!invitation) {
    return <InviteClient status="not_found" token={token} />;
  }

  if (invitation.status === 'expired' || new Date(invitation.expires_at) < new Date()) {
    return <InviteClient status="expired" token={token} />;
  }

  if (invitation.status === 'accepted') {
    return <InviteClient status="already_accepted" token={token} documentId={invitation.document_id} />;
  }

  // Get document title and inviter name
  const [{ data: doc }, { data: inviter }] = await Promise.all([
    admin.from('documents').select('title').eq('id', invitation.document_id).single(),
    invitation.invited_by
      ? admin.from('profiles').select('full_name, email').eq('id', invitation.invited_by).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <InviteClient
      status="pending"
      token={token}
      documentId={invitation.document_id}
      documentTitle={doc?.title || 'Untitled Document'}
      inviterName={inviter?.full_name || inviter?.email || 'Someone'}
      email={invitation.email}
    />
  );
}
