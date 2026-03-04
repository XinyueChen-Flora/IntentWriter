"use client";

import type { User } from "@supabase/supabase-js";
import dynamic from "next/dynamic";

const RoomShell = dynamic(() => import("@/components/room/RoomShell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading collaborative editor...</p>
      </div>
    </div>
  ),
});

type RoomProps = {
  roomId: string;
  user: User;
  documentTitle: string;
};

export default function Room({ roomId, user, documentTitle }: RoomProps) {
  return <RoomShell roomId={roomId} user={user} documentTitle={documentTitle} />;
}
