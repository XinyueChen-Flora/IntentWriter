import { useState, useCallback, useEffect, useMemo, type RefObject } from "react";
import type { IntentBlock, IntentDependency, RelationshipType } from "@/lib/partykit";

// Single color for all dependency lines - uses CSS variable for theme alignment
export const DEP_COLOR = 'hsl(var(--primary))'; // theme primary color

export type DepLine = {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  dashed: boolean;
  inherited: boolean;
  dep: IntentDependency;
  color: string;
};

interface UseDependencyLinksParams {
  blocks: readonly IntentBlock[];
  dependencies?: IntentDependency[];
  addDependency?: (dep: IntentDependency) => void;
  updateDependency?: (id: string, updates: Partial<IntentDependency>) => void;
  deleteDependency?: (id: string) => void;
  isSetupPhase: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  blockRefs: RefObject<Map<string, HTMLDivElement>>;
  currentUserId: string;
  collapsedBlocks: Set<string>;
  blockMap: Map<string, IntentBlock[]>;
}

export function useDependencyLinks({
  blocks,
  dependencies,
  addDependency,
  updateDependency,
  deleteDependency,
  isSetupPhase,
  containerRef,
  blockRefs,
  currentUserId,
  collapsedBlocks,
  blockMap,
}: UseDependencyLinksParams) {
  const [depCreator, setDepCreator] = useState<{
    fromIntentId: string;
    toIntentId: string;
    x: number;
    y: number;
    depId?: string; // ID of the dependency to update
    isEditing?: boolean; // True if editing an existing confirmed dependency
  } | null>(null);
  const [isDetectingDeps, setIsDetectingDeps] = useState(false);
  const [depLines, setDepLines] = useState<DepLine[]>([]);
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);
  const [hoveredDepId, setHoveredDepId] = useState<string | null>(null);

  // Drag-to-connect state
  const [dragState, setDragState] = useState<{
    fromIntentId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // All dependencies use the same color for consistency
  const depColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (dependencies || []).forEach((dep) => {
      map.set(dep.id, DEP_COLOR);
    });
    return map;
  }, [dependencies]);

  // Get all block IDs that have connections (for visual indicators)
  const connectedBlockIds = useMemo(() => {
    const ids = new Set<string>();
    (dependencies || []).forEach((dep) => {
      ids.add(dep.fromIntentId);
      ids.add(dep.toIntentId);
    });
    return ids;
  }, [dependencies]);

  // Get visible descendants of a block (stops at collapsed blocks)
  const getVisibleDescendants = useCallback((blockId: string): IntentBlock[] => {
    if (collapsedBlocks.has(blockId)) return [];
    const children = blockMap.get(blockId) || [];
    const result: IntentBlock[] = [];
    for (const child of children) {
      result.push(child);
      result.push(...getVisibleDescendants(child.id));
    }
    return result;
  }, [collapsedBlocks, blockMap]);

  // Compute endpoint coords from a DOM element (content-relative, not viewport-relative)
  const getEndpoint = useCallback((el: HTMLDivElement, containerRect: DOMRect, scrollTop: number) => {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.right - containerRect.left,
      y: rect.top + rect.height / 2 - containerRect.top + scrollTop,
    };
  }, []);

  // Compute SVG dependency lines from DOM positions
  useEffect(() => {
    if (!dependencies?.length || !containerRef.current) {
      setDepLines([]);
      return;
    }

    const computeLines = () => {
      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      if (!containerRect || !container) return;

      const scrollTop = container.scrollTop;
      const lines: DepLine[] = [];
      dependencies.forEach((dep) => {
        const fromEl = blockRefs.current.get(dep.fromIntentId);
        const toEl = blockRefs.current.get(dep.toIntentId);
        if (!fromEl || !toEl) return;

        const from = getEndpoint(fromEl, containerRect, scrollTop);
        const to = getEndpoint(toEl, containerRect, scrollTop);

        // Explicit dependency line
        lines.push({
          id: dep.id,
          x1: from.x, y1: from.y,
          x2: to.x, y2: to.y,
          dashed: dep.source === 'ai-suggested' && !dep.confirmed,
          inherited: false,
          dep,
          color: DEP_COLOR,
        });

      });
      setDepLines(lines);
    };

    computeLines();

    const scrollEl = containerRef.current;
    scrollEl?.addEventListener('scroll', computeLines);
    window.addEventListener('resize', computeLines);

    return () => {
      scrollEl?.removeEventListener('scroll', computeLines);
      window.removeEventListener('resize', computeLines);
    };
  }, [isSetupPhase, dependencies, blocks, containerRef, blockRefs, collapsedBlocks, blockMap, getVisibleDescendants, getEndpoint, depColorMap]);

  // Update dependency with label, type, and direction (dependency was already created in handleDragEnd)
  const handleCreateDependency = useCallback((label: string, relationshipType: RelationshipType, direction: IntentDependency['direction']) => {
    if (!depCreator || !updateDependency) return;

    // Update the existing dependency with user's selection
    if (depCreator.depId) {
      updateDependency(depCreator.depId, {
        label: label.trim() || 'Related',
        relationshipType,
        direction,
        confirmed: true,
      });
    }
    setDepCreator(null);
  }, [depCreator, updateDependency]);

  // AI detect dependencies
  const handleDetectDependencies = useCallback(async () => {
    if (!addDependency || isDetectingDeps) return;
    setIsDetectingDeps(true);
    try {
      const response = await fetch('/api/detect-dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentBlocks: blocks }),
      });
      if (response.ok) {
        const result = await response.json();
        (result.dependencies || []).forEach((dep: any) => {
          addDependency({
            id: `dep-${Date.now()}-${Math.random()}`,
            fromIntentId: dep.fromIntentId,
            toIntentId: dep.toIntentId,
            label: dep.label || 'Related',
            relationshipType: dep.relationshipType || 'custom',
            direction: dep.direction || 'bidirectional',
            source: 'ai-suggested',
            confirmed: false,
            createdAt: Date.now(),
            reason: dep.reason,
          });
        });
      }
    } catch {
      // Silent fail
    } finally {
      setIsDetectingDeps(false);
    }
  }, [blocks, addDependency, isDetectingDeps]);

  // Cancel dependency creation (delete unconfirmed dep and close popup)
  // When editing an existing confirmed dependency, don't delete it
  const handleCancelDependency = useCallback(() => {
    if (depCreator?.depId && deleteDependency && !depCreator.isEditing) {
      deleteDependency(depCreator.depId);
    }
    setDepCreator(null);
  }, [depCreator, deleteDependency]);

  // Close dep creator on click outside (cancels the dependency)
  useEffect(() => {
    if (!depCreator) return;
    const handleClick = () => handleCancelDependency();
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [depCreator, handleCancelDependency]);

  // Drag-to-connect handlers
  const handleDragStart = useCallback((fromIntentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDragState({
      fromIntentId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
  }, []);

  const handleDragEnd = useCallback((targetIntentId: string | null, e: MouseEvent) => {
    if (!dragState || !addDependency) {
      setDragState(null);
      return;
    }

    // If dropped on a valid target (different from source)
    if (targetIntentId && targetIntentId !== dragState.fromIntentId) {
      // First create the dependency (so line shows immediately)
      const newDepId = `dep-${Date.now()}-${Math.random()}`;
      addDependency({
        id: newDepId,
        fromIntentId: dragState.fromIntentId,
        toIntentId: targetIntentId,
        label: 'Unnamed',
        relationshipType: 'custom',
        direction: 'bidirectional',
        source: 'manual',
        confirmed: false, // unconfirmed until user selects type
        createdBy: currentUserId,
        createdAt: Date.now(),
      });

      // Then show popup to let user edit the label
      setDepCreator({
        fromIntentId: dragState.fromIntentId,
        toIntentId: targetIntentId,
        x: e.clientX,
        y: e.clientY,
        depId: newDepId,
      });
    }

    setDragState(null);
  }, [dragState, addDependency, currentUserId]);

  // Track mouse movement during drag
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };

    const handleMouseUp = (e: MouseEvent) => {
      // Find which block we're over
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      let targetId: string | null = null;

      for (const el of elements) {
        const blockEl = el.closest('[data-block-id]');
        if (blockEl) {
          targetId = blockEl.getAttribute('data-block-id');
          break;
        }
      }

      handleDragEnd(targetId, e);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleDragEnd]);

  // Compute preview line coords (from source block to cursor)
  const dragPreviewLine = useMemo(() => {
    if (!dragState || !containerRef.current) return null;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop;

    const fromEl = blockRefs.current.get(dragState.fromIntentId);
    if (!fromEl) return null;

    const fromRect = fromEl.getBoundingClientRect();

    return {
      x1: fromRect.right - containerRect.left,
      y1: fromRect.top + fromRect.height / 2 - containerRect.top + scrollTop,
      x2: dragState.currentX - containerRect.left,
      y2: dragState.currentY - containerRect.top + scrollTop,
    };
  }, [dragState, containerRef, blockRefs]);

  // Open edit popup for an existing dependency
  const openEditPopup = useCallback((dep: IntentDependency, x: number, y: number) => {
    setDepCreator({
      fromIntentId: dep.fromIntentId,
      toIntentId: dep.toIntentId,
      x,
      y,
      depId: dep.id,
      isEditing: dep.confirmed, // Only mark as editing if it was already confirmed
    });
  }, []);

  return {
    depCreator,
    depLines,
    isDetectingDeps,
    handleCreateDependency,
    handleCancelDependency,
    handleDetectDependencies,
    selectedDepId,
    setSelectedDepId,
    hoveredDepId,
    setHoveredDepId,
    depColorMap,
    connectedBlockIds,
    // Drag-to-connect
    dragState,
    handleDragStart,
    dragPreviewLine,
    // Edit existing dependency
    openEditPopup,
  };
}
