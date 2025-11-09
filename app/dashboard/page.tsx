import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch documents the user owns
  const { data: ownedDocs } = await supabase
    .from("documents")
    .select("*")
    .eq("owner_id", user.id);

  // Fetch document IDs the user collaborates on
  const { data: collabIds } = await supabase
    .from("document_collaborators")
    .select("document_id")
    .eq("user_id", user.id);

  // Fetch the actual documents for collaborated IDs
  let collaboratedDocs: any[] = [];
  if (collabIds && collabIds.length > 0) {
    const ids = collabIds.map((c) => c.document_id);
    const { data } = await supabase
      .from("documents")
      .select("*")
      .in("id", ids);
    collaboratedDocs = data || [];
  }

  // Combine and sort by updated_at
  const documents = [...(ownedDocs || []), ...collaboratedDocs]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // Fetch user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <DashboardClient
      user={user}
      profile={profile}
      initialDocuments={documents || []}
    />
  );
}
