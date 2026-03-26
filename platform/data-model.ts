// ─── Data Model ───
//
// Two fundamental data forms produced by the interface:
//   1. Outline — hierarchical intent structure (tree of sections + items)
//   2. Writing — rich text content (one editor per section)
//
// This file defines:
//   A. Core types — the atomic units (nodes, dependencies, members, edits)
//   B. Exposed data — what functions and external consumers see (current state)
//   C. Persisted data — what gets stored to the database (versioned snapshots)


// ═══════════════════════════════════════════════════════
// A. CORE TYPES
// ═══════════════════════════════════════════════════════

// ─── Attribution ───
// Every piece of content tracks who created it and who last modified it.

/** Who performed an action and when */
export type Attribution = {
  userId: string;
  userName: string;
  at: number;  // timestamp
};

// ─── Outline ───

/** A single node in the outline tree (aliased as IntentItem in paper) */
export type OutlineNode = {
  id: string;
  content: string;
  position: number;
  parentId: string | null;
  level: number;  // 0 = section (root), 1+ = child intent

  // Attribution
  createdBy: Attribution;
  modifiedBy?: Attribution;  // absent if never modified after creation
};

/** Paper alias: IntentItem = OutlineNode */
export type IntentItem = OutlineNode;

/** A relationship between two outline nodes */
export type OutlineDependency = {
  id: string;
  fromId: string;
  toId: string;
  type: string;   // 'depends-on' | 'must-be-consistent' | 'builds-upon' | ...
  label: string;
  direction: 'directed' | 'bidirectional';
  source: 'manual' | 'ai-suggested' | 'ai-confirmed';
  confirmed: boolean;
  createdBy: Attribution;
  reason?: string;
};

/** Assignment of a section to a team member */
export type SectionAssignment = {
  sectionId: string;
  assigneeId: string;
  assigneeName: string;
  assigneeEmail?: string;
  assignedAt: number;
};

/** A team member on the document */
export type DocumentMember = {
  userId: string;
  name: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  role: 'owner' | 'editor' | 'viewer' | 'member';
  joinedAt: number;
};


// ─── Writing ───

/** A section of writing content with per-paragraph attribution */
export type WritingContent = {
  sectionId: string;
  /** The intent this writing section corresponds to */
  intentId?: string;
  /** Who is assigned to write this section */
  assignee?: { userId: string; userName: string };
  /** HTML content from TipTap editor */
  html: string;
  /** Plain text (for word count, search, etc.) */
  text: string;
  wordCount: number;
  /** Per-paragraph attribution: who last edited each paragraph */
  paragraphs: ParagraphAttribution[];
};

/** Attribution for a single paragraph in the writing */
export type ParagraphAttribution = {
  /** Paragraph index (0-based, matching DOM order) */
  index: number;
  /** First ~50 chars of paragraph text (for matching after edits) */
  textPrefix: string;
  /** Who last edited this paragraph */
  lastEditBy: Attribution;
};


// ─── Interaction Layer ───

/** A stored result from a function execution (persisted across checks) */
export type StoredFunctionResult = {
  functionId: string;
  targetId: string;
  output: Record<string, unknown>;
  timestamp: number;
};

/** A proposal in the negotiation flow */
export type Proposal = {
  id: string;
  pathId: string;
  proposerId: string;
  targetSectionId: string;
  changes: Array<{ id: string; content: string; status: string }>;
  status: 'pending' | 'approved' | 'rejected';
  attachedResults?: StoredFunctionResult[];
  createdAt: number;
};


// ═══════════════════════════════════════════════════════
// B. EXPOSED DATA — what functions and consumers see
// ═══════════════════════════════════════════════════════
//
// A read-only snapshot of the document's current state.
// Assembled from live PartyKit state + Yjs content.
// This is the single interface that functions receive.

/** The full current state of a document — exposed to functions */
export type DocumentSnapshot = {
  documentId: string;
  phase: 'setup' | 'writing';

  // ── From Outline ──
  /** All outline nodes (flat list; use parentId to reconstruct tree) */
  nodes: OutlineNode[];
  /** Section assignments */
  assignments: SectionAssignment[];
  /** Dependencies between nodes */
  dependencies: OutlineDependency[];

  // ── From Writing ──
  /** Current writing content per section (only available in writing phase) */
  writing: WritingContent[];

  // ── Team ──
  members: DocumentMember[];
  currentUserId: string;

  // ── Interaction Layer (optional) ──
  /** Cached function results from prior checks */
  functionResults?: StoredFunctionResult[];
  /** Active proposals */
  proposals?: Proposal[];
};

/** Helper: extract sections (root nodes) from a snapshot */
export function getSections(snapshot: DocumentSnapshot): OutlineNode[] {
  return snapshot.nodes.filter(n => n.parentId === null).sort((a, b) => a.position - b.position);
}

/** Helper: get children of a node, sorted by position */
export function getChildren(snapshot: DocumentSnapshot, parentId: string): OutlineNode[] {
  return snapshot.nodes.filter(n => n.parentId === parentId).sort((a, b) => a.position - b.position);
}

/** Helper: get writing for a section */
export function getWriting(snapshot: DocumentSnapshot, sectionId: string): WritingContent | undefined {
  return snapshot.writing.find(w => w.sectionId === sectionId);
}

/** Helper: get assignee of a section */
export function getAssignee(snapshot: DocumentSnapshot, sectionId: string): SectionAssignment | undefined {
  return snapshot.assignments.find(a => a.sectionId === sectionId);
}


// ═══════════════════════════════════════════════════════
// C. PERSISTED DATA — what gets stored to the database
// ═══════════════════════════════════════════════════════
//
// Versioned snapshots for history and recovery.
// These are NOT the same shape as the exposed data —
// they include metadata like trigger, who, and diff summaries.

/** A versioned snapshot of the outline (stored in outline_versions table) */
export type OutlineVersion = {
  version: number;
  nodes: OutlineNode[];
  assignments: SectionAssignment[];
  dependencies: OutlineDependency[];
  trigger: 'user-edit' | 'proposal-applied' | 'phase-transition';
  changedBy: Attribution;
  createdAt: number;
  changeSummary?: {
    added: string[];
    modified: string[];
    removed: string[];
    moved: string[];
  };
};

/** A periodic snapshot of one section's writing (stored in writing_snapshots table) */
export type WritingVersion = {
  sectionId: string;
  /** HTML content exported from TipTap */
  contentHtml: string;
  /** Per-paragraph attribution at snapshot time */
  paragraphs: ParagraphAttribution[];
  /** Aggregate contributor stats for this snapshot period */
  contributors: WritingContributor[];
  wordCount: number;
  createdAt: number;
};

/** Aggregate contributor stats in a writing snapshot */
export type WritingContributor = {
  userId: string;
  userName: string;
  /** Approximate character count added/modified in this period */
  charsChanged: number;
};
