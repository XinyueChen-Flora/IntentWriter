import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthContext = {
  user: User;
  supabase: SupabaseClient;
};

export type DocumentContext = AuthContext & {
  document: { id: string; owner_id: string };
  admin: SupabaseClient;
};

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Verify the request is authenticated. Returns user + supabase client, or a 401 response.
 */
export async function requireAuth(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { user, supabase };
}

// ─── Document access ─────────────────────────────────────────────────────────

/**
 * Verify auth + document access via RLS. Returns user, supabase, admin client, and document.
 * Reads `documentId` from the provided body object.
 */
export async function requireDocument(
  documentId: string
): Promise<DocumentContext | NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { user, supabase } = authResult;

  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, owner_id")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  return { user, supabase, document, admin };
}

// ─── Document owner ──────────────────────────────────────────────────────────

/**
 * Verify auth + document ownership. Returns 403 if user is not the owner.
 */
export async function requireDocumentOwner(
  documentId: string
): Promise<DocumentContext | NextResponse> {
  const result = await requireDocument(documentId);
  if (result instanceof NextResponse) return result;

  if (result.document.owner_id !== result.user.id) {
    return NextResponse.json(
      { error: "Only the document owner can perform this action" },
      { status: 403 }
    );
  }

  return result;
}

// ─── Error handler ───────────────────────────────────────────────────────────

/**
 * Wraps an API handler in try/catch, returning 500 on unhandled errors.
 */
export function withErrorHandler(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request): Promise<NextResponse> => {
    try {
      return await handler(request);
    } catch (error) {
      console.error("API error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Type guard: check if a middleware result is an error response */
export function isErrorResponse(
  result: AuthContext | DocumentContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
