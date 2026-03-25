import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";
import { findTextRangeInDoc } from "../utils/textRangeFinder";

// Stable plugin key
export const highlightPluginKey = new PluginKey("highlight");

// ─── Color Maps (used by primitive params) ───

const HIGHLIGHT_COLORS: Record<string, { bg: string; border: string }> = {
  green:  { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' },
  yellow: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' },
  orange: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' },
  red:    { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' },
  blue:   { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)' },
  purple: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.2)' },
};

const DOT_COLORS: Record<string, string> = {
  missing: '#ef4444',
  partial: '#eab308',
  orphan:  '#f97316',
  conflict: '#8b5cf6',
};

// ─── Plugin Options ───

type PrimitiveHighlightPluginOptions = {
  /** Writing-editor primitives from pipeline */
  editorPrimitives: ResolvedPrimitive[];
  /** Hovered intent ID (for hover-linking between outline and editor) */
  hoveredIntentId?: string | null;
};

// ─── Plugin ───

/**
 * Creates a ProseMirror plugin that renders writing-editor primitives
 * as editor decorations. All visual logic comes from the primitives —
 * the plugin only handles the conversion from primitives to ProseMirror decorations.
 *
 * Supported primitive types:
 * - sentence-highlight → Decoration.inline (background color highlight)
 * - issue-dot → Decoration.widget (colored dot at anchor position)
 * - inline-widget → Decoration.widget (block widget with content)
 * - ai-marker → Decoration.inline (AI tint with badge)
 */
export function createHighlightPlugin(options: PrimitiveHighlightPluginOptions) {
  const { editorPrimitives, hoveredIntentId } = options;

  return new Plugin({
    key: highlightPluginKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        const doc = state.doc;

        if (!editorPrimitives || editorPrimitives.length === 0) {
          return DecorationSet.empty;
        }

        for (const prim of editorPrimitives) {
          switch (prim.type) {
            case 'sentence-highlight': {
              // Find the sentence range in the document
              const anchor = parseSentenceAnchor(prim.params.startAnchor);
              if (!anchor) break;

              const range = findTextRangeInDoc(doc, anchor);
              if (!range) break;

              const color = prim.params.color || 'yellow';
              const colors = HIGHLIGHT_COLORS[color] || HIGHLIGHT_COLORS.yellow;

              // Check if this highlight's intent is being hovered (for hover-linking)
              const intentId = prim.sourceItem?.id as string | undefined;
              const isHovered = hoveredIntentId && intentId === hoveredIntentId;

              decorations.push(
                Decoration.inline(range.from, range.to, {
                  style: `background: ${isHovered ? colors.border : colors.bg}; border-bottom: 2px solid ${colors.border}; transition: background 0.15s;`,
                  class: `sentence-highlight ${isHovered ? 'hovered' : ''}`,
                  'data-intent-id': intentId || '',
                }, {
                  inclusiveStart: true,
                  inclusiveEnd: true,
                })
              );

              // Add tooltip if present
              if (prim.params.tooltip) {
                decorations.push(
                  Decoration.widget(range.to, () => {
                    const tooltip = document.createElement('span');
                    tooltip.className = 'sentence-tooltip hidden';
                    tooltip.textContent = prim.params.tooltip;
                    tooltip.style.cssText = 'display:none; position:absolute; font-size:12px; background:white; border:1px solid #e5e7eb; padding:2px 6px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); white-space:nowrap; z-index:10;';
                    return tooltip;
                  }, { side: 1 })
                );
              }
              break;
            }

            case 'issue-dot': {
              // Find anchor position for the dot
              const anchorText = prim.params.anchor;
              let dotPos: number | null = null;

              if (anchorText) {
                const range = findTextRangeInDoc(doc, { start: anchorText.slice(0, 30), end: '' });
                if (range) dotPos = range.to;
              }

              if (dotPos === null) {
                // Fallback: place at end of document
                dotPos = Math.max(1, doc.content.size - 1);
              }

              const issueType = prim.params.type || 'missing';
              const dotColor = DOT_COLORS[issueType] || DOT_COLORS.missing;
              const index = prim.params.index || '';
              const detail = prim.params.detail || '';

              decorations.push(
                Decoration.widget(dotPos, () => {
                  const dot = document.createElement('span');
                  dot.className = 'issue-dot-marker inline-flex items-center cursor-pointer ml-0.5';
                  dot.style.cssText = `display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px; border-radius:50%; border:2px solid ${dotColor}; font-size:10px; font-weight:bold; color:${dotColor}; cursor:pointer; margin-left:2px; vertical-align:middle;`;
                  dot.textContent = index;
                  dot.title = `${issueType}: ${detail}`;
                  dot.dataset.issueType = issueType;
                  dot.dataset.detail = detail;
                  if (prim.sourceItem?.id) {
                    dot.dataset.intentId = prim.sourceItem.id as string;
                  }
                  return dot;
                }, { side: 1 })
              );
              break;
            }

            case 'inline-widget': {
              const variant = prim.params.variant || 'info';
              const content = prim.params.content || '';
              const intentRef = prim.params.intentRef || '';

              // Find insertion position
              let insertPos: number | null = null;
              if (prim.params.anchor) {
                const range = findTextRangeInDoc(doc, { start: prim.params.anchor, end: '' });
                if (range) insertPos = range.to;
              }
              if (insertPos === null) {
                insertPos = Math.max(1, doc.content.size - 1);
              }

              const borderColors: Record<string, string> = {
                suggestion: '#86efac',
                missing: '#fca5a5',
                info: '#93c5fd',
              };
              const bgColors: Record<string, string> = {
                suggestion: '#f0fdf4',
                missing: '#fef2f2',
                info: '#eff6ff',
              };

              decorations.push(
                Decoration.widget(insertPos, () => {
                  const widget = document.createElement('div');
                  widget.className = 'inline-widget-primitive';
                  widget.style.cssText = `display:block; border:2px solid ${borderColors[variant] || '#e5e7eb'}; background:${bgColors[variant] || '#f9fafb'}; border-radius:6px; padding:8px 12px; margin:4px 0; font-size:13px; color:#374151;`;
                  if (intentRef) {
                    widget.dataset.intentRef = intentRef;
                  }

                  const label = document.createElement('span');
                  label.style.cssText = 'font-size:11px; font-weight:500; padding:1px 6px; border-radius:4px; margin-right:6px;';
                  label.style.background = bgColors[variant] || '#f3f4f6';
                  label.style.color = borderColors[variant] || '#6b7280';
                  label.textContent = variant;
                  widget.appendChild(label);

                  const text = document.createElement('span');
                  text.textContent = content;
                  widget.appendChild(text);

                  return widget;
                }, { side: 1 })
              );
              break;
            }

            case 'ai-marker': {
              const anchor = prim.params.startAnchor;
              if (!anchor) break;

              const range = findTextRangeInDoc(doc, { start: anchor, end: '' });
              if (!range) break;

              decorations.push(
                Decoration.inline(range.from, range.to, {
                  style: 'background: rgba(59, 130, 246, 0.06); border-left: 2px solid rgba(59, 130, 246, 0.3); padding-left: 4px;',
                  class: 'ai-marker',
                })
              );
              break;
            }
          }
        }

        return DecorationSet.create(doc, decorations);
      },
    },
  });
}

// ─── Helpers ───

function parseSentenceAnchor(raw: string | undefined): { start: string; end: string } | null {
  if (!raw) return null;

  // Could be a JSON string (array of anchors) or a plain string
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { start: parsed[0].start || '', end: parsed[0].end || '' };
    }
    if (parsed.start) return parsed;
  } catch {
    // Plain string — use as start anchor
    return { start: raw.slice(0, 30), end: '' };
  }
  return null;
}
