import { useState, useCallback, useEffect } from "react";
import type { IntentBlock, WritingBlock } from "@/lib/partykit";

interface UseBackupParams {
  roomId: string;
  intentBlocks: readonly IntentBlock[];
  writingBlocks: readonly WritingBlock[];
  isConnected: boolean;
}

export function useBackup({ roomId, intentBlocks, writingBlocks, isConnected }: UseBackupParams) {
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [yjsExporters, setYjsExporters] = useState<Map<string, () => Uint8Array>>(new Map());
  const [shouldRemindBackup, setShouldRemindBackup] = useState(false);
  const [timeSinceLastBackup, setTimeSinceLastBackup] = useState<number>(0);

  // Callback to register Yjs exporters from writing editors
  const handleRegisterYjsExporter = useCallback((blockId: string, exporter: () => Uint8Array) => {
    setYjsExporters((prev) => {
      const newMap = new Map(prev);
      newMap.set(blockId, exporter);
      return newMap;
    });
  }, []);

  // Manual backup to Supabase with full Yjs snapshots
  const backupToSupabase = useCallback(async () => {
    if (isBackingUp) return;

    setIsBackingUp(true);
    try {
      // Collect all Yjs snapshots
      const yjsSnapshots: Record<string, number[]> = {};
      yjsExporters.forEach((exporter, blockId) => {
        try {
          const snapshot = exporter();
          yjsSnapshots[blockId] = Array.from(snapshot);
        } catch {
          // Silent fail for individual snapshot exports
        }
      });

      const response = await fetch('/api/backup-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: roomId,
          intentBlocks,
          writingBlocks,
          yjsSnapshots,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setLastBackup(new Date(result.backedUpAt));
        setShouldRemindBackup(false);
      } else {
        const errorText = await response.text();
        alert(`Backup failed: ${errorText}`);
      }
    } catch (error) {
      alert(`Backup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [roomId, intentBlocks, writingBlocks, yjsExporters, isBackingUp]);

  // Check if user should be reminded to backup
  useEffect(() => {
    if (!isConnected) return;

    const checkBackupReminder = () => {
      const now = Date.now();
      const timeSince = lastBackup ? now - lastBackup.getTime() : now;
      const timeInSeconds = Math.floor(timeSince / 1000);

      setTimeSinceLastBackup(timeInSeconds);

      // Remind after 5 minutes (300 seconds) without backup
      const REMINDER_THRESHOLD = 300;
      if (timeInSeconds > REMINDER_THRESHOLD) {
        setShouldRemindBackup(true);
      }
    };

    // Check immediately
    checkBackupReminder();

    // Then check every 30 seconds
    const interval = setInterval(checkBackupReminder, 30000);

    return () => clearInterval(interval);
  }, [isConnected, lastBackup]);

  return {
    backupToSupabase,
    isBackingUp,
    lastBackup,
    shouldRemindBackup,
    timeSinceLastBackup,
    handleRegisterYjsExporter,
  };
}
