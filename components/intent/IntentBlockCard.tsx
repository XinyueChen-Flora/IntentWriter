"use client";

import type { IntentBlock } from "@/lib/partykit";
import { RootIntentBlock } from "./blocks/RootIntentBlock";
import { ChildIntentBlock } from "./blocks/ChildIntentBlock";

type IntentBlockCardProps = {
  block: IntentBlock;
  isRoot: boolean;
  depth: number;
  rootIndex?: number;
};

/**
 * Router component that delegates to RootIntentBlock or ChildIntentBlock
 * based on whether this is a root-level block or a child.
 */
export function IntentBlockCard({ block, isRoot, depth, rootIndex = 0 }: IntentBlockCardProps) {
  if (isRoot) {
    return <RootIntentBlock block={block} rootIndex={rootIndex} />;
  }

  return <ChildIntentBlock block={block} depth={depth} />;
}
