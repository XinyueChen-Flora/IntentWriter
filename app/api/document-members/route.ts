import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Get document to check ownership
    const { data: doc, error: docError } = await admin
      .from('documents')
      .select('owner_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const isOwner = doc.owner_id === user.id;

    // Auto-register the caller as a collaborator (server-side, bypasses RLS)
    await admin
      .from('document_collaborators')
      .upsert(
        { document_id: documentId, user_id: user.id, role: isOwner ? 'owner' : 'editor' },
        { onConflict: 'document_id,user_id', ignoreDuplicates: true }
      );

    // Fetch collaborators then enrich with profiles
    const { data: collabRows } = await admin
      .from('document_collaborators')
      .select('id, user_id, role')
      .eq('document_id', documentId);

    const userIds = (collabRows || []).map((c: any) => c.user_id);
    let profileMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = p;
        }
      }
    }

    const collaborators = (collabRows || []).map((c: any) => {
      const profile = profileMap[c.user_id];
      return {
        id: c.id,
        userId: c.user_id,
        role: c.role,
        email: profile?.email || '',
        fullName: profile?.full_name || null,
        avatarUrl: profile?.avatar_url || null,
      };
    });

    // Fetch pending invitations (only for owner)
    let pendingInvitations: any[] = [];
    if (isOwner) {
      const { data: invitations } = await admin
        .from('document_invitations')
        .select('id, email, role, status, created_at, expires_at')
        .eq('document_id', documentId)
        .eq('status', 'pending');

      pendingInvitations = invitations || [];
    }

    return NextResponse.json({
      collaborators,
      pendingInvitations,
      isOwner,
    });
  } catch (err) {
    console.error('document-members API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
