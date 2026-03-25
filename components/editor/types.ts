import type { WritingBlock, IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import type { SentenceAnchor, DependencyIssue, SupportingSentence, OrphanSentence, AlignedIntent } from "@/lib/primitive-to-tiptap";
type SentenceHighlight = { anchor: SentenceAnchor; intentId: string; type: 'covered' | 'partial' | 'orphan' };
import type { ParagraphAttribution } from "@/platform/data-model";

// Sentence highlights - supports both old and new formats
export type SentenceHighlights = {
  // New format
  highlights?: SentenceHighlight[];
  // Old format (for backward compatibility)
  supporting: SupportingSentence[];
  partial: SupportingSentence[];
  orphan: OrphanSentence[];
  conflict: Array<{ anchor: SentenceAnchor; issue: DependencyIssue }>;
};

export type HighlightRange = {
  from: number;
  to: number;
  type: 'supporting' | 'orphan' | 'conflict' | 'partial';
  intentIds?: string[];
  orphanData?: OrphanSentence;
};

export type PendingWritingSuggestion = {
  intentId: string;
  rootIntentId: string;
  intentContent: string;
  suggestedContent: string;
  simulation?: {
    insertAfter?: string;
    insertBefore?: string;
    replaceStart?: string;
    content: string;
    position: 'start' | 'end' | 'after' | 'before' | 'replace';
  };
} | null;

export type OrderedIntentCoverageItem = {
  intentId: string;
  intentContent: string;
  position: number;
  status: 'covered' | 'partial' | 'missing';
  supportingSentences: Array<{ start: string; end: string }>;
  note?: string;
};

export type TipTapEditorProps = {
  // Core
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  // Exporters
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  onRegisterParagraphAttributionExporter?: (blockId: string, exporter: () => ParagraphAttribution[]) => void;
  onParagraphEnd?: (writingBlockId: string, contentHash: string) => void;
  // Pipeline-driven: writing-editor primitives (replaces all old highlight props)
  editorPrimitives?: import("@/platform/primitives/resolver").ResolvedPrimitive[];
  // Hover linking
  hoveredIntentId?: string | null;
  // Legacy props (kept for backward compat during migration)
  onCheckAlignment?: () => void;
  isCheckingAlignment?: boolean;
  sentenceHighlights?: SentenceHighlights;
  alignedIntents?: AlignedIntent[];
  highlightFilter?: 'aligned' | 'partial' | 'missing' | 'orphan' | null;
  hoveredIntentForLink?: string | null;
  hoveredOrphanHint?: string | null;
  onMakeChangeToOutline?: (suggestedIntent: string, orphanStart: string) => void;
  onDismissOrphan?: (orphanStart: string) => void;
  onHoverIntentFromWriting?: (intentId: string | null) => void;
  handledOrphanStarts?: Set<string>;
  markOrphanHandled?: (orphanStart: string) => void;
  intentCoverageMap?: Map<string, 'covered' | 'partial' | 'missing'>;
  orderedIntentCoverage?: OrderedIntentCoverageItem[];
  onAddMissingContent?: (intentId: string, intentContent: string) => void;
  onModifyIntent?: (intentId: string) => void;
  pendingWritingSuggestion?: PendingWritingSuggestion;
  onClearWritingSuggestion?: () => void;
  onAcceptWritingSuggestion?: (intentId: string, sentenceAnchor: SentenceAnchor) => void;
  expandedMissingIntentId?: string | null;
  onExpandMissingIntent?: (intentId: string | null) => void;
  loadingIntentId?: string | null;
  aiCoveredIntents?: Set<string>;
  aiGeneratedSentences?: Map<string, { intentId: string; rootIntentId: string; anchor: SentenceAnchor }>;
  pureWritingMode?: boolean;
};

// Re-export types from drift detection for convenience
export type { SentenceAnchor, SentenceHighlight, DependencyIssue, SupportingSentence, OrphanSentence };
