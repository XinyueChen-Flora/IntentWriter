"use client";

import { useRouter } from "next/navigation";
import { useRoom } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import IntentPanel from "../intent/IntentPanel";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Share2, ChevronLeft, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShareDialog from "@/components/share/ShareDialog";
import { LogoIcon } from "@/components/common/Logo";
import { getUserColor } from "@/lib/getUserColor";
import { useDocumentMembers } from "./hooks/useDocumentMembers";
import { useBackup } from "./hooks/useBackup";
import { useIntentBlockOperations } from "../intent/hooks/useIntentBlockOperations";

type RoomShellProps = {
  roomId: string;
  user: User;
  documentTitle: string;
};

export default function RoomShell({
  roomId,
  user,
  documentTitle,
}: RoomShellProps) {
  const router = useRouter();
  const [selectedIntentBlockId, setSelectedIntentBlockId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const { documentMembers, isOwner } = useDocumentMembers(roomId, user.id);

  const {
    state,
    isConnected,
    onlineUsers,
    updateIntentBlock: updateIntentBlockRaw,
    addIntentBlock: addIntentBlockRaw,
    deleteIntentBlock: deleteIntentBlockRaw,
    addWritingBlock: addWritingBlockRaw,
    deleteWritingBlock: deleteWritingBlockRaw,
    updateRoomMeta,
    addDependency,
    updateDependency,
    deleteDependency,
  } = useRoom(roomId, user);

  const writingBlocks = state.writingBlocks;
  const intentBlocks = state.intentBlocks;
  const roomMeta = state.roomMeta;
  const dependencies = state.dependencies;

  const backup = useBackup({ roomId, intentBlocks, writingBlocks, isConnected });

  // Markdown exporter registry for drift detection
  const markdownExportersRef = useRef<Map<string, () => Promise<string>>>(new Map());
  const [markdownExportersVersion, setMarkdownExportersVersion] = useState(0);

  const handleRegisterMarkdownExporter = useCallback((blockId: string, exporter: () => Promise<string>) => {
    markdownExportersRef.current.set(blockId, exporter);
    setMarkdownExportersVersion(v => v + 1);
  }, []);

  const ops = useIntentBlockOperations({
    intentBlocks,
    writingBlocks,
    user,
    updateIntentBlockRaw,
    addIntentBlockRaw,
    deleteIntentBlockRaw,
    addWritingBlockRaw,
    deleteWritingBlockRaw,
  });

  // Handle transition from setup to writing phase
  const handleStartWriting = useCallback(async () => {
    try {
      const response = await fetch('/api/create-baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: roomId,
          intentBlocks,
          dependencies,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        alert(`Failed to create baseline: ${errorText}`);
        return;
      }

      const result = await response.json();
      const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown';
      updateRoomMeta({
        phase: 'writing',
        baselineVersion: result.version || (roomMeta?.baselineVersion || 0) + 1,
        phaseTransitionAt: Date.now(),
        phaseTransitionBy: userName,
      });
    } catch (error) {
      alert(`Error creating baseline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [roomId, intentBlocks, dependencies, roomMeta, user, updateRoomMeta]);

  // Handle transition from writing back to setup phase
  const handleBackToSetup = useCallback(() => {
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown';
    updateRoomMeta({
      phase: 'setup',
      phaseTransitionAt: Date.now(),
      phaseTransitionBy: userName,
    });
  }, [user, updateRoomMeta]);

  const isWritingPhase = roomMeta?.phase === 'writing';
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Get user display info
  const userAvatar = user.user_metadata?.avatar_url;
  const userName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Left: Logo + Navigation + Document Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Back to documents"
            >
              <LogoIcon size={22} />
            </button>
            <div className="h-5 w-px bg-border" />
            <h1 className="text-base font-semibold">{documentTitle}</h1>
          </div>

          {/* Center: Step Indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isWritingPhase && confirm('Go back to outline? Writing editors will be hidden but your content is preserved.')) {
                  handleBackToSetup();
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm transition-colors ${
                !isWritingPhase
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer'
              }`}
            >
              <span className="font-medium">1</span>
              <span>Outline</span>
            </button>
            <div className="w-8 h-px bg-border" />
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
              isWritingPhase
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              <span className="font-medium">2</span>
              <span>Writing</span>
            </div>
          </div>

          {/* Right: Actions + Online Users + User Avatar */}
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div
              className={`h-2 w-2 rounded-full flex-shrink-0 ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            />

            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>

            {/* Save button - only in Writing phase */}
            {isWritingPhase && (
              <Button
                variant={backup.shouldRemindBackup ? "default" : "ghost"}
                size="sm"
                onClick={backup.backupToSupabase}
                disabled={backup.isBackingUp || !isConnected}
                title="Save document"
              >
                {backup.isBackingUp ? "Saving..." : "Save"}
              </Button>
            )}

            {/* Separator */}
            <div className="h-6 w-px bg-border" />

            {/* Other Online Users (excluding current user) */}
            {onlineUsers.filter(u => u.userId !== user.id).length > 0 && (
              <div className="flex -space-x-2">
                {onlineUsers.filter(u => u.userId !== user.id).slice(0, 3).map((onlineUser) => {
                  const initials = onlineUser.userName.substring(0, 2).toUpperCase();
                  return (
                    <div
                      key={onlineUser.connectionId}
                      className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white border-2 border-background"
                      style={!onlineUser.avatarUrl ? { backgroundColor: getUserColor(onlineUser.userId) } : undefined}
                      title={onlineUser.userName}
                    >
                      {onlineUser.avatarUrl ? (
                        <img
                          src={onlineUser.avatarUrl}
                          alt={onlineUser.userName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>
                  );
                })}
                {onlineUsers.filter(u => u.userId !== user.id).length > 3 && (
                  <div
                    className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background"
                    title={`${onlineUsers.filter(u => u.userId !== user.id).length - 3} more`}
                  >
                    +{onlineUsers.filter(u => u.userId !== user.id).length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Current User Avatar + Logout Dropdown */}
            <div className="relative group">
              <button
                className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white border-2 border-primary"
                style={!userAvatar ? { backgroundColor: getUserColor(user.id) } : undefined}
                title={userName}
              >
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  userInitials
                )}
              </button>
              {/* Dropdown on hover */}
              <div className="absolute right-0 top-full mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
                  <div className="px-3 py-2 border-b">
                    <div className="text-sm font-medium truncate">{userName}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <IntentPanel
          blocks={intentBlocks}
          addBlock={ops.addIntentBlock}
          updateBlock={ops.updateIntentBlock}
          assignBlock={ops.assignBlock}
          unassignBlock={ops.unassignBlock}
          deleteBlock={ops.deleteIntentBlock}
          indentBlock={ops.indentBlock}
          outdentBlock={ops.outdentBlock}
          reorderBlocks={ops.reorderBlocks}
          selectedBlockId={selectedIntentBlockId}
          setSelectedBlockId={setSelectedIntentBlockId}
          writingBlocks={writingBlocks}
          importMarkdown={ops.importMarkdownIntents}
          currentUser={user}
          onlineUsers={onlineUsers}
          documentMembers={documentMembers}
          roomId={roomId}
          deleteWritingBlock={ops.deleteWritingBlock}
          updateIntentBlockRaw={updateIntentBlockRaw}
          onRegisterYjsExporter={backup.handleRegisterYjsExporter}
          markdownExporters={markdownExportersRef.current}
          onRegisterMarkdownExporter={handleRegisterMarkdownExporter}
          ensureWritingBlocksForIntents={ops.ensureWritingBlocksForIntents}
          roomMeta={roomMeta}
          dependencies={dependencies}
          addDependency={addDependency}
          updateDependency={updateDependency}
          deleteDependency={deleteDependency}
          onStartWriting={handleStartWriting}
          onBackToSetup={handleBackToSetup}
        />
      </div>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        documentId={roomId}
        isOwner={isOwner}
      />
    </div>
  );
}
