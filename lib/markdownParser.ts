import type { IntentBlock } from "@/lib/partykit";

export interface ParsedIntentNode {
  content: string;
  level: number;
  intentTag?: string;
  parentId: string | null;
  position: number;
}

interface ParsedLine {
  content: string;
  level: number;
  intentTag?: string;
}

/**
 * Enhanced parser that handles multi-line processing
 */
export function parseMarkdownToIntentsAdvanced(markdown: string): ParsedIntentNode[] {
  const lines = markdown.split('\n');
  const nodes: ParsedIntentNode[] = [];
  const levelStack: { level: number; index: number }[] = [];

  let currentPosition = 0;
  let pendingIntentTag: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    // Check if this line is an [intent]: tag
    const intentMatch = trimmed.match(/^\[intent\]:\s*(.+)/);
    if (intentMatch) {
      pendingIntentTag = intentMatch[1].trim();
      continue; // Don't create a node for intent tags
    }

    // Parse the actual content line
    const parsed = parseLineAdvanced(line);
    if (!parsed) continue;

    const { content, level } = parsed;

    // Determine parent based on level
    let parentId: string | null = null;

    // Pop stack until we find a parent at a lower level
    while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= level) {
      levelStack.pop();
    }

    // Parent is the last item in stack (if any)
    if (levelStack.length > 0) {
      parentId = `temp-${levelStack[levelStack.length - 1].index}`;
    }

    nodes.push({
      content: content.trim(),
      level,
      intentTag: pendingIntentTag,
      parentId,
      position: currentPosition++,
    });

    // Add current node to stack
    levelStack.push({ level, index: nodes.length - 1 });

    // Clear pending intent tag
    pendingIntentTag = undefined;
  }

  return nodes;
}

function parseLineAdvanced(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let match: RegExpMatchArray | null;

  // Calculate indentation level
  const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
  const indentLevel = Math.floor(leadingSpaces / 2);

  // H1-H6 headings
  if ((match = trimmed.match(/^(#{1,6})\s+(.+)/))) {
    const level = match[1].length - 1; // # = 0, ## = 1, etc.
    const content = match[2].trim();
    return { content, level, intentTag: undefined };
  }

  // Numbered list: 1. Item
  if ((match = trimmed.match(/^\d+\.\s+(.+)/))) {
    const content = match[1].trim();
    return { content, level: indentLevel, intentTag: undefined };
  }

  // Bullet list: * Item or - Item
  if ((match = trimmed.match(/^[*\-]\s+(.+)/))) {
    const content = match[1].trim();
    return { content, level: indentLevel + 1, intentTag: undefined };
  }

  // Plain text
  return { content: trimmed, level: indentLevel, intentTag: undefined };
}
