import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Room from "./Room";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Verify user has access to this document
  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !document) {
    redirect("/dashboard");
  }

  return (
    <Room
      roomId={id}
      user={user}
      documentTitle={document.title}
    />
  );
}
