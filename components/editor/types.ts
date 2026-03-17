import type { WritingBlock, IntentBlock } from "@/lib/partykit";
import type { User } from "@supabase/supabase-js";
import type { SentenceAnchor, SentenceHighlight, DependencyIssue, SupportingSentence, OrphanSentence, AlignedIntent } from "@/hooks/useDriftDetection";
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
  intent: IntentBlock;
  writingBlock: WritingBlock;
  roomId: string;
  user: User;
  writingBlocks: WritingBlock[];
  deleteWritingBlock: (blockId: string) => void;
  updateIntentBlock: (blockId: string, updates: Partial<IntentBlock>) => void;
  onRegisterYjsExporter?: (blockId: string, exporter: () => Uint8Array) => void;
  onRegisterMarkdownExporter?: (blockId: string, exporter: () => Promise<string>) => void;
  onRegisterParagraphAttributionExporter?: (blockId: string, exporter: () => ParagraphAttribution[]) => void;
  onParagraphEnd?: (writingBlockId: string, contentHash: string) => void;
  onCheckAlignment?: () => void;
  isCheckingAlignment?: boolean;
  sentenceHighlights?: SentenceHighlights;
  alignedIntents?: AlignedIntent[];  // For inline indicators (missing, new intent)
  // Filter highlights by status (when user expands a specific status in AlignmentSummary)
  highlightFilter?: 'aligned' | 'partial' | 'missing' | 'orphan' | null;
  hoveredIntentForLink?: string | null;
  hoveredOrphanHint?: string | null;
  // Called when user wants to make change to outline - triggers impact preview
  onMakeChangeToOutline?: (suggestedIntent: string, orphanStart: string) => void;
  // Called when user wants to keep writing as is (dismiss the suggestion)
  onDismissOrphan?: (orphanStart: string) => void;
  // Callback when hovering over text that maps to an intent
  onHoverIntentFromWriting?: (intentId: string | null) => void;
  // Orphans that have been handled (added to outline or dismissed) - should not show widget
  handledOrphanStarts?: Set<string>;
  // Mark an orphan as handled
  markOrphanHandled?: (orphanStart: string) => void;
  // Coverage status for each intent (to determine highlight color)
  intentCoverageMap?: Map<string, 'covered' | 'partial' | 'missing'>;
  // Ordered intent coverage - for inline missing intent display
  orderedIntentCoverage?: OrderedIntentCoverageItem[];
  // Callback when user wants to add content for a missing intent
  onAddMissingContent?: (intentId: string, intentContent: string) => void;
  // Callback when user wants to modify the intent instead
  onModifyIntent?: (intentId: string) => void;
  // Pending writing suggestion (from "Update Writing" button on intent side)
  pendingWritingSuggestion?: PendingWritingSuggestion;
  onClearWritingSuggestion?: () => void;
  // Called when user accepts the writing suggestion (to track AI-generated content)
  // Passes intentId and sentence anchor for live mapping
  onAcceptWritingSuggestion?: (intentId: string, sentenceAnchor: SentenceAnchor) => void;
  // Track which missing intent dot is expanded (for click-to-expand)
  expandedMissingIntentId?: string | null;
  onExpandMissingIntent?: (intentId: string | null) => void;
  // Track which intent is currently loading (simulating)
  loadingIntentId?: string | null;
  // Track which intents have been AI-covered (should not show missing indicator)
  aiCoveredIntents?: Set<string>;
  // AI-generated sentence mappings for hover linking
  aiGeneratedSentences?: Map<string, { intentId: string; rootIntentId: string; anchor: SentenceAnchor }>;
  // Pure writing mode - hide all alignment decorations
  pureWritingMode?: boolean;
};

// Re-export types from drift detection for convenience
export type { SentenceAnchor, SentenceHighlight, DependencyIssue, SupportingSentence, OrphanSentence };
