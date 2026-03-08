import type { SentenceAnchor } from "../types";

/**
 * Find text range from anchor - properly handles ProseMirror document positions.
 * Walks through the document to find the exact positions of start and end text.
 */
export function findTextRangeInDoc(
  doc: any,
  anchor: SentenceAnchor
): { from: number; to: number } | null {
  const startLower = anchor.start.toLowerCase();
  const endLower = anchor.end?.toLowerCase() || '';

  let foundFrom: number | null = null;
  let foundTo: number | null = null;

  // Walk through the document to find text positions
  doc.descendants((node: any, pos: number) => {
    if (node.isText && foundFrom === null) {
      const text = node.text || '';
      const textLower = text.toLowerCase();
      const startIdx = textLower.indexOf(startLower);

      if (startIdx !== -1) {
        // Found the start - pos is the position before this text node
        foundFrom = pos + startIdx;

        // Find the end
        if (endLower) {
          const endIdx = textLower.indexOf(endLower, startIdx);
          if (endIdx !== -1) {
            foundTo = pos + endIdx + anchor.end!.length;
          } else {
            // End not in same text node - search in subsequent text
            foundTo = pos + startIdx + anchor.start.length;
          }
        } else {
          foundTo = pos + startIdx + anchor.start.length;
        }
      }
    }
    return foundFrom === null; // Stop searching once found
  });

  // If end wasn't found in the same node, search for it in the full document
  if (foundFrom !== null && foundTo !== null && endLower) {
    let searchPos = foundFrom;
    let textSoFar = '';

    doc.nodesBetween(foundFrom, doc.content.size, (node: any, pos: number) => {
      if (node.isText) {
        const text = node.text || '';
        const combinedText = textSoFar + text;
        const combinedLower = combinedText.toLowerCase();

        // Look for the end anchor in the accumulated text
        const endIdx = combinedLower.indexOf(endLower);
        if (endIdx !== -1) {
          // Calculate the actual document position
          const offsetInCombined = endIdx + anchor.end!.length;
          if (offsetInCombined <= textSoFar.length) {
            // End is in previous text - already handled
          } else {
            const offsetInCurrentNode = offsetInCombined - textSoFar.length;
            foundTo = pos + offsetInCurrentNode;
          }
          return false; // Stop searching
        }
        textSoFar = combinedText;
      }
      return true;
    });
  }

  if (foundFrom !== null && foundTo !== null) {
    return { from: foundFrom, to: foundTo };
  }

  return null;
}

/**
 * Simple fallback for when we don't have doc access.
 * Converts text offset to document position (adds 1 for paragraph start).
 */
export function findTextRange(
  fullText: string,
  anchor: SentenceAnchor
): { from: number; to: number } | null {
  const startLower = anchor.start.toLowerCase();
  const textLower = fullText.toLowerCase();
  const startIdx = textLower.indexOf(startLower);
  if (startIdx === -1) return null;

  let endIdx = startIdx + anchor.start.length;
  if (anchor.end) {
    const endLower = anchor.end.toLowerCase();
    const endSearch = textLower.indexOf(endLower, startIdx);
    if (endSearch !== -1) {
      endIdx = endSearch + anchor.end.length;
    }
  }

  // Convert text offset to document position (add 1 for paragraph start)
  return { from: startIdx + 1, to: endIdx + 1 };
}
