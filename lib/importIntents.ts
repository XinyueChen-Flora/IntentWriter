import type { IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import { parseMarkdownToIntentsAdvanced } from "@/lib/markdownParser";

/**
 * Parses markdown text and adds intent blocks to the room via the provided callback.
 */
export function importMarkdownAsIntents(
  markdown: string,
  existingBlocks: readonly IntentBlock[],
  user: User,
  addIntentBlock: (block: IntentBlock) => void,
) {
  const parsedNodes = parseMarkdownToIntentsAdvanced(markdown);

  // Create a map to track node index -> actual ID
  const idMap = new Map<number, string>();

  // Calculate safe starting position
  let maxPosition = -1;
  if (existingBlocks.length > 0) {
    const positions = existingBlocks
      .map((b) => b.position)
      .filter((p) => typeof p === "number" && !isNaN(p));
    if (positions.length > 0) {
      maxPosition = Math.max(...positions);
    }
  }

  const userName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    undefined;
  const userEmail = user.email || undefined;

  parsedNodes.forEach((node, nodeIndex) => {
    const newId = `intent-${Date.now()}-${Math.random()}-${nodeIndex}`;
    idMap.set(nodeIndex, newId);

    // Determine real parent ID
    let realParentId: string | null = null;
    if (node.parentId) {
      const parentMatch = node.parentId.match(/temp-(\d+)/);
      if (parentMatch) {
        const parentIndex = parseInt(parentMatch[1], 10);
        realParentId = idMap.get(parentIndex) || null;
      }
    }

    const newBlock: IntentBlock = {
      id: newId,
      content: node.content,
      position: maxPosition + 1 + nodeIndex,
      linkedWritingIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      parentId: realParentId,
      level: node.level,
      intentTag: node.intentTag,
      intentCreatedBy: node.intentTag ? user.id : undefined,
      intentCreatedByName: node.intentTag ? userName : undefined,
      intentCreatedByEmail: node.intentTag ? userEmail : undefined,
      intentCreatedAt: node.intentTag ? Date.now() : undefined,
      isCollapsed: false,
      assignee: undefined,
    };

    addIntentBlock(newBlock);
  });
}
