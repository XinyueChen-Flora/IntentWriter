"use client";

import { useRouter } from "next/navigation";
import { useRoom } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import IntentPanel from "../intent/IntentPanel";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import ShareDialog from "@/components/share/ShareDialog";
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="border-b flex-shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
              ← Back
            </Button>
            <h1 className="text-lg font-bold">{documentTitle}</h1>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              roomMeta?.phase === 'writing'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }`}>
              {roomMeta?.phase === 'writing' ? 'Writing' : 'Outline Setup'}
            </span>

            {/* Online Users Display */}
            {onlineUsers.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <div className="flex -space-x-2">
                  {onlineUsers.slice(0, 5).map((onlineUser) => {
                    const initials = onlineUser.userName.substring(0, 2).toUpperCase();
                    const isCurrentUser = onlineUser.userId === user.id;

                    return (
                      <div
                        key={onlineUser.connectionId}
                        className={`h-7 w-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold text-white border-2 border-background ${
                          isCurrentUser ? 'ring-2 ring-primary' : ''
                        }`}
                        style={!onlineUser.avatarUrl ? { backgroundColor: getUserColor(onlineUser.userId) } : undefined}
                        title={`${onlineUser.userName}${isCurrentUser ? ' (You)' : ''}`}
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
                  {onlineUsers.length > 5 && (
                    <div
                      className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background"
                      title={`${onlineUsers.length - 5} more user${onlineUsers.length - 5 === 1 ? '' : 's'}`}
                    >
                      +{onlineUsers.length - 5}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {onlineUsers.length} online
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareDialogOpen(true)}
            >
              <Share2 className="h-4 w-4 mr-1" />
              Share
            </Button>
            {backup.shouldRemindBackup && !backup.isBackingUp && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium animate-pulse">
                Save your work
              </p>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={backup.backupToSupabase}
              disabled={backup.isBackingUp || !isConnected}
              title="Manually save document to Supabase (includes all Yjs content)"
              className={backup.shouldRemindBackup ? "ring-2 ring-amber-400 ring-offset-2" : ""}
            >
              {backup.isBackingUp ? "Saving..." : "Save Backup"}
            </Button>
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-red-500"
              }`}
              title={isConnected ? "Connected" : "Disconnected"}
            />
            {backup.isBackingUp ? (
              <p className="text-xs text-muted-foreground">Backing up...</p>
            ) : backup.lastBackup ? (
              <p className="text-xs text-muted-foreground">
                Saved {Math.floor((Date.now() - backup.lastBackup.getTime()) / 1000)}s ago
              </p>
            ) : backup.shouldRemindBackup ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                No backup yet ({Math.floor(backup.timeSinceLastBackup / 60)}m)
              </p>
            ) : null}
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
