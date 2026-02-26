import { sendInviteEmail } from '@/lib/email';
import { NextResponse } from 'next/server';
import { requireDocumentOwner, isErrorResponse, withErrorHandler } from '@/lib/api/middleware';

export const POST = withErrorHandler(async (request: Request) => {
  const { email, documentId } = await request.json();

  if (!email || !documentId) {
    return NextResponse.json({ error: 'Email and documentId are required' }, { status: 400 });
  }

  const ownerResult = await requireDocumentOwner(documentId);
  if (isErrorResponse(ownerResult)) return ownerResult;
  const { user, admin } = ownerResult;

  const normalizedEmail = email.trim().toLowerCase();

  // Prevent self-invite
  if (normalizedEmail === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
  }

  // Get document title for email
  const { data: doc } = await admin
    .from('documents')
    .select('title')
    .eq('id', documentId)
    .single();

  // Get inviter's profile for the email
  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single();

  const inviterName = inviterProfile?.full_name || inviterProfile?.email || user.email || 'Someone';
  const origin = new URL(request.url).origin;

  // Look up email in profiles to see if it's an existing user
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, email')
    .eq('email', normalizedEmail)
    .single();

  if (existingProfile) {
    // Existing user: add directly to document_collaborators
    const { error: collabError } = await admin
      .from('document_collaborators')
      .upsert(
        { document_id: documentId, user_id: existingProfile.id, role: 'editor' },
        { onConflict: 'document_id,user_id', ignoreDuplicates: true }
      );

    if (collabError) {
      return NextResponse.json({ error: 'Failed to add collaborator' }, { status: 500 });
    }

    // Send notification email (best-effort)
    try {
      await sendInviteEmail({
        to: normalizedEmail,
        inviterName,
        documentTitle: doc?.title || 'Untitled',
        inviteUrl: `${origin}/room/${documentId}`,
        isExistingUser: true,
      });
    } catch {
      // Email sending is best-effort
    }

    return NextResponse.json({
      type: 'existing_user',
      message: `${normalizedEmail} has been added as a collaborator`,
    });
  } else {
    // New user: upsert into document_invitations
    const { data: invitation, error: inviteError } = await admin
      .from('document_invitations')
      .upsert(
        {
          document_id: documentId,
          email: normalizedEmail,
          role: 'editor',
          invited_by: user.id,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'document_id,email' }
      )
      .select('token')
      .single();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Send invite email
    try {
      await sendInviteEmail({
        to: normalizedEmail,
        inviterName,
        documentTitle: doc?.title || 'Untitled',
        inviteUrl: `${origin}/invite/${invitation.token}`,
        isExistingUser: false,
      });
    } catch {
      // Email sending is best-effort
    }

    return NextResponse.json({
      type: 'new_user',
      message: `Invitation sent to ${normalizedEmail}`,
    });
  }
});
