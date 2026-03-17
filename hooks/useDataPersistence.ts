import { useCallback, useEffect, useRef } from "react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";
import type { OutlineNode, SectionAssignment, OutlineDependency, Attribution, ParagraphAttribution } from "@/platform/data-model";

// ─── Outline Versioning ───
//
// After outline mutations (add/update/delete/reorder),
// debounce and save a full OutlineVersion to the database.

type UseOutlineVersioningProps = {
  documentId: string;
  intentBlocks: readonly IntentBlock[];
  dependencies: readonly IntentDependency[];
  /** Only persist during these phases */
  isActive: boolean;
};

export function useOutlineVersioning({
  documentId,
  intentBlocks,
  dependencies,
  isActive,
}: UseOutlineVersioningProps) {
  const prevSnapshotRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSavingRef = useRef(false);

  const saveVersion = useCallback(async (trigger: 'user-edit' | 'proposal-applied' | 'phase-transition' = 'user-edit') => {
    if (isSavingRef.current || !documentId) return;

    // Convert IntentBlock[] → OutlineNode[] (strip non-structural fields)
    const nodes: OutlineNode[] = intentBlocks.map(b => ({
      id: b.id,
      content: b.content,
      position: b.position,
      parentId: b.parentId,
      level: b.level,
      createdBy: {
        userId: b.intentCreatedBy ?? '',
        userName: b.intentCreatedByName ?? '',
        at: b.intentCreatedAt ?? b.createdAt,
      },
      ...(b.changeBy ? {
        modifiedBy: {
          userId: b.changeBy,
          userName: b.changeByName ?? '',
          at: b.changeAt ?? b.updatedAt,
        },
      } : {}),
    }));

    // Extract section assignments
    const assignments: SectionAssignment[] = intentBlocks
      .filter(b => b.parentId === null && b.assignee)
      .map(b => ({
        sectionId: b.id,
        assigneeId: b.assignee!,
        assigneeName: b.assigneeName ?? "",
        assigneeEmail: b.assigneeEmail,
        assignedAt: b.updatedAt,
      }));

    // Convert dependencies
    const deps: OutlineDependency[] = dependencies.map(d => ({
      id: d.id,
      fromId: d.fromIntentId,
      toId: d.toIntentId,
      type: d.relationshipType,
      label: d.label,
      direction: d.direction,
      source: d.source,
      confirmed: d.confirmed,
      createdBy: {
        userId: d.createdBy ?? '',
        userName: '',
        at: d.createdAt,
      },
      reason: d.reason,
    }));

    // Quick diff: check if anything actually changed
    const snapshot = JSON.stringify({ nodes, assignments, deps });
    if (snapshot === prevSnapshotRef.current) return;

    // Compute changeSummary by comparing with prev
    let changeSummary = {};
    if (prevSnapshotRef.current) {
      try {
        const prev = JSON.parse(prevSnapshotRef.current);
        const prevIds = new Set((prev.nodes as OutlineNode[]).map(n => n.id));
        const currIds = new Set(nodes.map(n => n.id));

        const added = nodes.filter(n => !prevIds.has(n.id)).map(n => n.id);
        const removed = (prev.nodes as OutlineNode[]).filter(n => !currIds.has(n.id)).map(n => n.id);
        const modified = nodes.filter(n => {
          if (!prevIds.has(n.id)) return false;
          const prevNode = (prev.nodes as OutlineNode[]).find(p => p.id === n.id);
          return prevNode && prevNode.content !== n.content;
        }).map(n => n.id);
        const moved = nodes.filter(n => {
          if (!prevIds.has(n.id)) return false;
          const prevNode = (prev.nodes as OutlineNode[]).find(p => p.id === n.id);
          return prevNode && (prevNode.position !== n.position || prevNode.parentId !== n.parentId);
        }).map(n => n.id);

        changeSummary = { added, removed, modified, moved };
      } catch {
        // first version, no diff
      }
    }

    isSavingRef.current = true;
    try {
      await fetch("/api/outline-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          nodes,
          assignments,
          dependencies: deps,
          trigger,
          changeSummary,
        }),
      });
      prevSnapshotRef.current = snapshot;
    } catch (err) {
      console.error("Failed to save outline version:", err);
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, intentBlocks, dependencies]);

  // Debounced auto-save: 3 seconds after last change
  useEffect(() => {
    if (!isActive || intentBlocks.length === 0) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      saveVersion("user-edit");
    }, 3000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [intentBlocks, dependencies, isActive, saveVersion]);

  return { saveVersion };
}


// ─── Writing Snapshots ───
//
// Periodically export Yjs content as markdown and persist to DB.

type UseWritingSnapshotsProps = {
  documentId: string;
  /** Map: writingBlockId → markdown exporter */
  markdownExporters: Map<string, () => Promise<string>>;
  /** Map: writingBlockId → paragraph attribution exporter */
  paragraphAttributionExporters: Map<string, () => ParagraphAttribution[]>;
  /** Map: rootIntentId → writingBlock */
  intentToWritingMap: Map<string, { id: string }>;
  /** Root intent blocks (sections) */
  rootBlocks: readonly IntentBlock[];
  /** Current user info */
  currentUserId?: string;
  currentUserName?: string;
  /** Only snapshot during writing phase */
  isActive: boolean;
  /** Interval in ms (default: 60000 = 1 minute) */
  intervalMs?: number;
};

export function useWritingSnapshots({
  documentId,
  markdownExporters,
  paragraphAttributionExporters,
  intentToWritingMap,
  rootBlocks,
  currentUserId,
  currentUserName,
  isActive,
  intervalMs = 30_000,
}: UseWritingSnapshotsProps) {
  const prevContentRef = useRef<Map<string, string>>(new Map());
  const isSavingRef = useRef(false);

  const saveSnapshots = useCallback(async () => {
    if (isSavingRef.current || !documentId || !isActive) return;

    isSavingRef.current = true;
    try {
      for (const rootBlock of rootBlocks) {
        const writingBlock = intentToWritingMap.get(rootBlock.id);
        if (!writingBlock) continue;

        const exporter = markdownExporters.get(writingBlock.id);
        if (!exporter) continue;

        let markdown: string;
        try {
          markdown = await exporter();
        } catch {
          continue;
        }

        // Skip if content hasn't changed since last snapshot
        const prevContent = prevContentRef.current.get(rootBlock.id);
        if (prevContent === markdown) continue;

        // Skip empty content
        if (!markdown.trim()) continue;

        const wordCount = markdown.split(/\s+/).filter(Boolean).length;

        const contributors = currentUserId
          ? [{
              userId: currentUserId,
              userName: currentUserName ?? "Unknown",
              charsChanged: Math.abs((markdown.length) - (prevContent?.length ?? 0)),
            }]
          : [];

        // Collect paragraph attributions
        let paragraphAttributions: ParagraphAttribution[] = [];
        const attrExporter = paragraphAttributionExporters.get(writingBlock.id);
        if (attrExporter) {
          try {
            paragraphAttributions = attrExporter();
          } catch {
            // Silent fail
          }
        }

        await fetch("/api/writing-snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            sectionId: rootBlock.id,
            contentMarkdown: markdown,
            contributors,
            wordCount,
            paragraphAttributions,
          }),
        });

        prevContentRef.current.set(rootBlock.id, markdown);
      }
    } catch (err) {
      console.error("Failed to save writing snapshots:", err);
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, markdownExporters, paragraphAttributionExporters, intentToWritingMap, rootBlocks, currentUserId, currentUserName, isActive]);

  // Periodic timer
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(saveSnapshots, intervalMs);
    return () => clearInterval(timer);
  }, [isActive, intervalMs, saveSnapshots]);

  return { saveSnapshots };
}
