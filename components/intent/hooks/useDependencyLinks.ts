import { useState, useCallback, useEffect, useMemo, type RefObject } from "react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";

// Rotating palette for dependency lines
export const DEP_COLORS = [
  '#60a5fa', // blue-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#f472b6', // pink-400
  '#22d3ee', // cyan-400
  '#fbbf24', // amber-400
  '#f87171', // red-400
];

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
  isSetupPhase,
  containerRef,
  blockRefs,
  currentUserId,
  collapsedBlocks,
  blockMap,
}: UseDependencyLinksParams) {
  const [linkMode, setLinkMode] = useState<{ fromIntentId: string } | null>(null);
  const [depCreator, setDepCreator] = useState<{
    fromIntentId: string;
    toIntentId: string;
    x: number;
    y: number;
  } | null>(null);
  const [isDetectingDeps, setIsDetectingDeps] = useState(false);
  const [depLines, setDepLines] = useState<DepLine[]>([]);
  const [selectedDepId, setSelectedDepId] = useState<string | null>(null);
  const [hoveredDepId, setHoveredDepId] = useState<string | null>(null);

  // Map each dependency id to a stable color from the palette
  const depColorMap = useMemo(() => {
    const map = new Map<string, string>();
    (dependencies || []).forEach((dep, idx) => {
      map.set(dep.id, DEP_COLORS[idx % DEP_COLORS.length]);
    });
    return map;
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
          color: depColorMap.get(dep.id) || DEP_COLORS[0],
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

  // Handle clicking an intent block in link mode
  const handleBlockClickForLink = useCallback((blockId: string, e: React.MouseEvent) => {
    if (!linkMode || !addDependency) return;
    if (linkMode.fromIntentId === blockId) {
      setLinkMode(null);
      return;
    }
    setDepCreator({
      fromIntentId: linkMode.fromIntentId,
      toIntentId: blockId,
      x: e.clientX,
      y: e.clientY,
    });
    setLinkMode(null);
  }, [linkMode, addDependency]);

  // Create dependency with label and direction
  const handleCreateDependency = useCallback((label: string, direction: IntentDependency['direction']) => {
    if (!depCreator || !addDependency) return;
    addDependency({
      id: `dep-${Date.now()}-${Math.random()}`,
      fromIntentId: depCreator.fromIntentId,
      toIntentId: depCreator.toIntentId,
      label: label.trim() || 'related',
      direction,
      source: 'manual',
      confirmed: true,
      createdBy: currentUserId,
      createdAt: Date.now(),
    });
    setDepCreator(null);
  }, [depCreator, addDependency, currentUserId]);

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
            label: dep.label || 'related',
            direction: dep.direction || 'directed',
            source: 'ai-suggested',
            confirmed: false,
            createdAt: Date.now(),
          });
        });
      }
    } catch {
      // Silent fail
    } finally {
      setIsDetectingDeps(false);
    }
  }, [blocks, addDependency, isDetectingDeps]);

  // Close dep creator on click outside
  useEffect(() => {
    if (!depCreator) return;
    const handleClick = () => setDepCreator(null);
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [depCreator]);

  return {
    linkMode,
    setLinkMode,
    depCreator,
    depLines,
    isDetectingDeps,
    handleBlockClickForLink,
    handleCreateDependency,
    handleDetectDependencies,
    selectedDepId,
    setSelectedDepId,
    hoveredDepId,
    setHoveredDepId,
    depColorMap,
  };
}
