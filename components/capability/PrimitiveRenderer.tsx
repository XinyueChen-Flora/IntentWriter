"use client";

import React from "react";
import type { ResolvedPrimitive } from "@/platform/primitives/resolver";
import type { PrimitiveLocation } from "@/platform/primitives/registry";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type ActionItem = {
  label: string;
  variant: string;
  action: string;
};

export type PrimitiveRendererProps = {
  primitives: ResolvedPrimitive[];
  /** Optional: only render primitives at this location */
  location?: PrimitiveLocation;
  /** Callback when user clicks an action button */
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
};

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

function parseActions(json: string | undefined): ActionItem[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as ActionItem[];
  } catch {
    return [];
  }
}

function parseCounts(json: string | undefined): Record<string, number> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, number>;
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════
// SEVERITY / VARIANT STYLE MAPS
// ═══════════════════════════════════════════════════════

const SEVERITY_STYLES: Record<string, string> = {
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  error: "bg-red-50 border-red-200 text-red-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
};

const SEVERITY_ICONS: Record<string, string> = {
  warning: "\u26A0",
  error: "\u2715",
  info: "\u2139",
  success: "\u2713",
};

const HIGHLIGHT_BG: Record<string, string> = {
  red: "bg-red-100 border-red-300",
  yellow: "bg-yellow-100 border-yellow-300",
  green: "bg-emerald-100 border-emerald-300",
  blue: "bg-blue-100 border-blue-300",
  orange: "bg-orange-100 border-orange-300",
  purple: "bg-purple-100 border-purple-300",
};

const HIGHLIGHT_DOT: Record<string, string> = {
  red: "bg-red-400",
  yellow: "bg-yellow-400",
  green: "bg-emerald-400",
  blue: "bg-blue-400",
  orange: "bg-orange-400",
  purple: "bg-purple-400",
};

const ISSUE_TYPE_STYLES: Record<string, string> = {
  partial: "bg-yellow-100 text-yellow-600",
  missing: "bg-red-100 text-red-600",
  orphan: "bg-orange-100 text-orange-600",
  conflict: "bg-purple-100 text-purple-600",
};

const NODE_STATUS_ICONS: Record<string, string> = {
  covered: "\u2713",
  partial: "\u25D1",
  missing: "\u25CB",
  "ai-covered": "\u2728",
};

const NODE_STATUS_COLORS: Record<string, string> = {
  covered: "text-emerald-500",
  partial: "text-yellow-500",
  missing: "text-red-400",
  "ai-covered": "text-blue-500",
};

const BADGE_STYLES: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700 border-emerald-200",
  modified: "bg-blue-100 text-blue-700 border-blue-200",
  removed: "bg-red-100 text-red-700 border-red-200",
  info: "bg-muted text-muted-foreground border",
  warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const WIDGET_BORDER_STYLES: Record<string, string> = {
  suggestion: "border-emerald-300 bg-emerald-50/50",
  missing: "border-red-300 bg-red-50/50 border-dashed",
  info: "border-blue-300 bg-blue-50/50",
};

const WIDGET_BADGE_STYLES: Record<string, string> = {
  suggestion: "bg-emerald-100 text-emerald-700",
  missing: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
};

const ALERT_BORDER_STYLES: Record<string, string> = {
  warning: "border-amber-300 bg-amber-50",
  error: "border-red-300 bg-red-50",
  info: "border-blue-300 bg-blue-50",
  success: "border-emerald-300 bg-emerald-50",
};

const ALIGNMENT_LEVEL_STYLES: Record<string, string> = {
  aligned: "bg-emerald-100 text-emerald-700",
  drifted: "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-700",
};

const COUNT_DOT_COLORS: Record<string, string> = {
  covered: "bg-emerald-500",
  partial: "bg-yellow-500",
  missing: "bg-red-500",
  "ai-covered": "bg-blue-500",
};

const RESULT_BADGE_STYLES: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700",
  modified: "bg-blue-100 text-blue-700",
  removed: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  info: "bg-muted text-muted-foreground",
  significant: "bg-amber-100 text-amber-700",
  minor: "bg-blue-100 text-blue-700",
};

// ═══════════════════════════════════════════════════════
// ACTION BUTTON HELPER
// ═══════════════════════════════════════════════════════

function ActionButtons({
  actions,
  primitive,
  onAction,
}: {
  actions: ActionItem[];
  primitive: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  if (actions.length === 0) return null;
  return (
    <div className="flex gap-1.5 mt-2">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => onAction?.(a.action, primitive)}
          className={`text-sm px-2.5 py-1 rounded-md transition-colors ${
            a.variant === "primary"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : a.variant === "destructive"
              ? "border text-red-600 border-red-200 hover:bg-red-50"
              : "border hover:bg-muted/50"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// INDIVIDUAL PRIMITIVE RENDERERS
// ═══════════════════════════════════════════════════════

function BannerPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const s = prim.params.severity || "info";
  const style = SEVERITY_STYLES[s] || SEVERITY_STYLES.info;
  const icon = SEVERITY_ICONS[s] || SEVERITY_ICONS.info;
  return (
    <div
      className={`flex items-start gap-2.5 px-4 py-3 rounded-md text-xs ${style}`}
    >
      <span className="text-base leading-none mt-0.5">{icon}</span>
      <div className="flex-1">
        <div className="font-semibold text-sm font-semibold">{prim.params.title}</div>
        <div className="mt-0.5 opacity-80">{prim.params.message}</div>
      </div>
    </div>
  );
}

function SentenceHighlightPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const color = prim.params.color || "yellow";
  const bg = HIGHLIGHT_BG[color] || HIGHLIGHT_BG.yellow;
  const dot = HIGHLIGHT_DOT[color] || HIGHLIGHT_DOT.yellow;
  return (
    <div className={`rounded border px-3 py-2 ${bg}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <span className="text-xs">{prim.params.startAnchor}</span>
      </div>
      {prim.params.tooltip && (
        <div className="text-sm text-muted-foreground mt-1 ml-4">
          {prim.params.tooltip}
        </div>
      )}
    </div>
  );
}

function IssueDotPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const typeColor =
    ISSUE_TYPE_STYLES[prim.params.type] || "bg-muted text-muted-foreground";
  const actions = parseActions(prim.params.actions);
  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${typeColor}`}
        >
          {prim.params.index}
        </span>
        <span className="text-xs">
          {prim.params.anchor?.slice(0, 50)}
        </span>
        {prim.params.detail && (
          <span className="text-sm text-muted-foreground ml-auto">
            {prim.params.detail}
          </span>
        )}
      </div>
      <ActionButtons actions={actions} primitive={prim} onAction={onAction} />
    </div>
  );
}

function InlineWidgetPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const variant = prim.params.variant || "info";
  const borderStyle =
    WIDGET_BORDER_STYLES[variant] || "border bg-muted/10";
  const badgeStyle = WIDGET_BADGE_STYLES[variant] || "bg-muted";
  const actions = parseActions(prim.params.actions);
  return (
    <div className={`border-2 rounded-md p-3 ${borderStyle}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${badgeStyle}`}
        >
          {variant}
        </span>
        {prim.params.intentRef && (
          <span className="text-xs text-muted-foreground italic">
            for: {prim.params.intentRef}
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">{prim.params.content}</div>
      <ActionButtons actions={actions} primitive={prim} onAction={onAction} />
    </div>
  );
}

function AiMarkerPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  return (
    <div className="bg-blue-50/50 border-l-2 border-blue-200 pl-2 px-3 py-1.5">
      <span className="inline-flex items-center gap-0.5 text-xs text-blue-500 font-medium mr-1">
        {"\u2728"} AI
      </span>
      <span className="text-xs">{prim.params.startAnchor}</span>
    </div>
  );
}

function NodeIconPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const icon = NODE_STATUS_ICONS[prim.params.status] || "\u25CB";
  const color =
    NODE_STATUS_COLORS[prim.params.status] || "text-muted-foreground";
  // Show intent content from sourceItem, truncate long IDs
  let label = (prim.sourceItem?.content as string) || prim.params.nodeId || '';
  // Clean up raw IDs like "[intent-17741173...]" → show just the content
  if (label.startsWith('[') || label.startsWith('Section [')) {
    label = label.replace(/\[intent-[a-f0-9-]+\]\s*/gi, '').replace(/^Section\s*/i, '').trim() || 'Untitled';
  }
  const status = prim.params.status;
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`text-base flex-shrink-0 ${color}`}>{icon}</span>
      <span className="text-sm truncate flex-1">{label}</span>
      {status && status !== 'covered' && (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
          status === 'missing' ? 'bg-red-100 text-red-700 border border-red-200' :
          status === 'partial' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
          'bg-muted text-muted-foreground border'
        }`}>{status}</span>
      )}
      {prim.params.tooltip && (
        <span className="text-xs text-muted-foreground italic flex-shrink-0">
          {prim.params.tooltip}
        </span>
      )}
    </div>
  );
}

function NodeBadgePrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const style =
    BADGE_STYLES[prim.params.variant] ||
    "bg-muted text-muted-foreground border";
  // Show intent content from sourceItem if available, otherwise nodeId
  const label = (prim.sourceItem?.content as string) || prim.params.nodeId;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span className="text-xs truncate flex-1">{label}</span>
      <span
        className={`text-xs font-medium px-1.5 py-0.5 rounded-full border flex-shrink-0 ${style}`}
      >
        {prim.params.label}
      </span>
    </div>
  );
}

function SectionAlertPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const borderColor =
    ALERT_BORDER_STYLES[prim.params.severity] || "border bg-muted/20";
  const actions = parseActions(prim.params.actions);
  return (
    <div className={`border-l-2 rounded-r-md px-3 py-2 ${borderColor}`}>
      <div className="text-xs font-semibold">{prim.params.title}</div>
      <div className="text-sm text-muted-foreground mt-0.5">
        {prim.params.message}
      </div>
      <ActionButtons actions={actions} primitive={prim} onAction={onAction} />
    </div>
  );
}

function SummaryBarPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const counts = parseCounts(prim.params.counts);
  const levelStyle =
    ALIGNMENT_LEVEL_STYLES[prim.params.level] ||
    ALIGNMENT_LEVEL_STYLES.partial;
  return (
    <div className="border rounded-lg px-3 py-2 bg-muted/20">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-medium">Alignment</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${levelStyle}`}>
          {prim.params.level}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1.5">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1 text-sm">
            <span
              className={`w-2 h-2 rounded-full inline-block ${
                COUNT_DOT_COLORS[k] || "bg-muted-foreground"
              }`}
            />
            {v} {k}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResultListPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const badgeKey = prim.params.badgeVariant || prim.params.badge;
  const badgeStyle =
    RESULT_BADGE_STYLES[badgeKey || ""] || "bg-muted text-muted-foreground";
  const actions = parseActions(prim.params.actions);
  // Status icon matching outline style
  const badge = prim.params.badge;
  const statusIcon = NODE_STATUS_ICONS[badge || ''] || '';
  const statusColor = NODE_STATUS_COLORS[badge || ''] || 'text-muted-foreground';
  return (
    <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
      {statusIcon && <span className={`text-sm flex-shrink-0 ${statusColor}`}>{statusIcon}</span>}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{prim.params.title}</span>
        {prim.params.detail && (
          <span className="text-xs text-muted-foreground ml-1.5">{prim.params.detail}</span>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => onAction?.(a.action, prim)}
              className="text-xs px-2 py-0.5 rounded border hover:bg-muted/50 transition-colors whitespace-nowrap"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      {prim.params.badge && (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${badgeStyle}`}>
          {prim.params.badge}
        </span>
      )}
    </div>
  );
}

function DiffViewPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const before = prim.params.before || '';
  const after = prim.params.after || '';

  return (
    <div className="border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center gap-3 text-xs text-muted-foreground">
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-300 mr-1" />removed</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-primary/50 mr-1" />added</span>
      </div>
      <div className="px-3 py-2.5 text-sm leading-relaxed">
        <WordDiffInline oldText={before} newText={after} />
      </div>
    </div>
  );
}

/** Inline word-level diff — shows removed (strikethrough) and added (underline) text together */
function WordDiffInline({ oldText, newText }: { oldText: string; newText: string }) {
  if (oldText === newText) return <span>{newText}</span>;

  // Tokenize
  const oldTokens = oldText.match(/\S+|\s+/g) || [];
  const newTokens = newText.match(/\S+|\s+/g) || [];

  // LCS
  const m = oldTokens.length, n = newTokens.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = oldTokens[i-1] === newTokens[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);

  // Backtrack
  const ops: Array<{ type: 'equal' | 'added' | 'removed'; token: string }> = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (oldTokens[i-1] === newTokens[j-1]) { ops.push({ type: 'equal', token: oldTokens[i-1] }); i--; j--; }
    else if (dp[i-1][j] >= dp[i][j-1]) { ops.push({ type: 'removed', token: oldTokens[i-1] }); i--; }
    else { ops.push({ type: 'added', token: newTokens[j-1] }); j--; }
  }
  while (i > 0) { ops.push({ type: 'removed', token: oldTokens[i-1] }); i--; }
  while (j > 0) { ops.push({ type: 'added', token: newTokens[j-1] }); j--; }
  ops.reverse();

  // Merge consecutive
  const merged: Array<{ type: 'equal' | 'added' | 'removed'; text: string }> = [];
  for (const op of ops) {
    const last = merged[merged.length - 1];
    if (last && last.type === op.type) last.text += op.token;
    else merged.push({ type: op.type, text: op.token });
  }

  return (
    <>
      {merged.map((seg, idx) => {
        if (seg.type === 'equal') return <span key={idx}>{seg.text}</span>;
        if (seg.type === 'removed') return <span key={idx} className="line-through text-red-400/70 bg-red-50">{seg.text}</span>;
        return <span key={idx} className="text-primary font-medium bg-primary/5 underline decoration-primary/30 underline-offset-2">{seg.text}</span>;
      })}
    </>
  );
}

function ActionGroupPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const actions = parseActions(prim.params.actions);
  return (
    <div className="flex gap-2 pt-2 border-t">
      {actions.map((a, i) => (
        <button
          key={i}
          onClick={() => onAction?.(a.action, prim)}
          className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
            a.variant === "primary"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : a.variant === "destructive"
              ? "border text-red-600 border-red-200 hover:bg-red-50"
              : "border hover:bg-muted/50"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// INTERACTION PRIMITIVES (for coordination flows)
// ═══════════════════════════════════════════════════════

function TextInputPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const [value, setValue] = React.useState("");
  const rows = parseInt(prim.params.rows || "3", 10);

  // Emit value on every change so parent can capture it
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (prim.params.action) {
      onAction?.(prim.params.action, { ...prim, params: { ...prim.params, value: newValue } });
    }
  };

  return (
    <div>
      {prim.params.label && (
        <label className="text-xs font-medium text-muted-foreground block mb-1">
          {prim.params.label}
        </label>
      )}
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={prim.params.placeholder}
        rows={rows}
        className="w-full px-2.5 py-2 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function CommentThreadPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const actionColors: Record<string, string> = {
    approve: "rgb(16, 185, 129)",
    reject: "rgb(239, 68, 68)",
    comment: "rgb(148, 163, 184)",
    response: "rgb(148, 163, 184)",
    acknowledge: "rgb(100, 116, 139)",
  };
  return (
    <div
      className="flex items-start gap-2 text-xs border-l-2 pl-2.5 py-1"
      style={{ borderColor: actionColors[prim.params.action] || "rgb(148, 163, 184)" }}
    >
      <span className="font-medium">{prim.params.author}</span>
      <span className="text-muted-foreground">
        {prim.params.action}
        {prim.params.text ? `: ${prim.params.text}` : ""}
      </span>
      {prim.params.timestamp && (
        <span className="text-muted-foreground/50 ml-auto text-[10px]">
          {prim.params.timestamp}
        </span>
      )}
    </div>
  );
}

function ProgressBarPrimitive({
  prim,
}: {
  prim: ResolvedPrimitive;
}) {
  const current = parseInt(prim.params.current || "0", 10);
  const total = parseInt(prim.params.total || "1", 10);
  const pct = total > 0 ? (current / total) * 100 : 0;
  const variant = prim.params.variant || "default";
  const barColor =
    variant === "success" ? "bg-emerald-500" :
    variant === "warning" ? "bg-amber-500" :
    "bg-primary";
  return (
    <div className="space-y-1">
      {prim.params.label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{prim.params.label}</span>
          <span>{current}/{total}</span>
        </div>
      )}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DRAFT EDITOR PRIMITIVE (for coordination flows)
// ═══════════════════════════════════════════════════════

function OutlineDraftPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const items: Array<{
    id: string; content: string; status: string; originalContent?: string; reason?: string;
  }> = (() => {
    try { return JSON.parse(prim.params.items || '[]'); } catch { return []; }
  })();

  const statusStyles: Record<string, { border: string; bg: string; badge: string; badgeColor: string; icon: string }> = {
    unchanged: { border: 'border-border', bg: '', badge: '', badgeColor: '', icon: '·' },
    changed: { border: 'border-blue-300', bg: 'bg-blue-50/50', badge: 'suggested', badgeColor: 'bg-blue-100 text-blue-700', icon: '✎' },
    added: { border: 'border-emerald-300', bg: 'bg-emerald-50/50', badge: 'new', badgeColor: 'bg-emerald-100 text-emerald-700', icon: '+' },
    removed: { border: 'border-red-300', bg: 'bg-red-50/50', badge: 'remove', badgeColor: 'bg-red-100 text-red-700', icon: '−' },
  };

  // First item is typically the section root, rest are children
  const isFirstRoot = items.length > 0;

  return (
    <div className="space-y-0.5">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Proposed Outline</div>
      {items.map((item, i) => {
        const style = statusStyles[item.status] || statusStyles.unchanged;
        const isRoot = i === 0;
        return (
          <div
            key={item.id || i}
            className={`flex items-start gap-2 border-l-2 rounded-r px-3 py-1.5 ${style.border} ${style.bg}`}
            style={{ marginLeft: isRoot ? 0 : 16 }}
          >
            <span className="text-sm text-muted-foreground flex-shrink-0 w-4 text-center mt-0.5">{style.icon}</span>
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${item.status === 'removed' ? 'line-through text-muted-foreground' : isRoot ? 'font-semibold' : 'font-medium'}`}>
                {item.content}
              </span>
              {item.reason && (
                <div className="text-xs text-muted-foreground mt-0.5 italic">{item.reason}</div>
              )}
            </div>
            {style.badge && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${style.badgeColor}`}>
                {style.badge}
              </span>
            )}
          </div>
        );
      })}
      {(prim.params.proposeAction || prim.params.dismissAction) && (
        <div className="flex gap-1.5 mt-2">
          {prim.params.proposeAction && (
            <button
              onClick={() => onAction?.(prim.params.proposeAction, prim)}
              className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Propose this change
            </button>
          )}
          {prim.params.dismissAction && (
            <button
              onClick={() => onAction?.(prim.params.dismissAction, prim)}
              className="px-3 py-1.5 text-sm font-medium rounded-md border hover:bg-muted/50"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DraftEditorPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const [items, setItems] = React.useState<Array<{
    id: string; content: string; originalContent: string; isNew: boolean; isRemoved: boolean; reason?: string;
  }>>(() => {
    try { return JSON.parse(prim.params.items || '[]'); } catch { return []; }
  });

  const addLabel = prim.params.addLabel || 'Add item';

  const emitChange = (updated: typeof items) => {
    setItems(updated);
    onAction?.(prim.params.action, {
      ...prim,
      params: { ...prim.params, value: JSON.stringify(updated) },
    });
  };

  const updateContent = (index: number, content: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], content };
    emitChange(updated);
  };

  const toggleRemove = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], isRemoved: !updated[index].isRemoved };
    emitChange(updated);
  };

  const addItem = () => {
    const newItem = {
      id: `new-${Date.now()}`,
      content: '',
      originalContent: '',
      isNew: true,
      isRemoved: false,
    };
    emitChange([...items, newItem]);
  };

  const deleteNew = (index: number) => {
    emitChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => {
        const isModified = !item.isNew && !item.isRemoved && item.content !== item.originalContent;
        return (
          <div key={item.id} className={`border rounded px-2.5 py-1.5 ${
            item.isRemoved ? 'bg-red-50/50 border-red-200' :
            item.isNew ? 'bg-emerald-50/50 border-emerald-200' :
            isModified ? 'bg-blue-50/50 border-blue-200' :
            'border-border'
          }`}>
            <div className="flex items-start gap-2">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${
                item.isRemoved ? 'bg-red-100 text-red-600' :
                item.isNew ? 'bg-emerald-100 text-emerald-600' :
                isModified ? 'bg-blue-100 text-blue-600' :
                'bg-muted text-muted-foreground'
              }`}>
                {item.isRemoved ? 'remove' : item.isNew ? 'new' : isModified ? 'edit' : ''}
              </span>
              <textarea
                value={item.content}
                onChange={(e) => updateContent(i, e.target.value)}
                disabled={item.isRemoved}
                rows={1}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                className={`flex-1 text-sm bg-transparent border-none focus:outline-none resize-none overflow-hidden ${
                  item.isRemoved ? 'line-through text-muted-foreground' : ''
                }`}
                placeholder="Intent description..."
              />
              {item.isRemoved ? (
                <button onClick={() => toggleRemove(i)} className="text-xs text-blue-600 hover:text-blue-800 flex-shrink-0 mt-0.5">Restore</button>
              ) : item.isNew ? (
                <button onClick={() => deleteNew(i)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 mt-0.5">&times;</button>
              ) : (
                <button onClick={() => toggleRemove(i)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 mt-0.5">&times;</button>
              )}
            </div>
            {/* AI explanation for modified items */}
            {isModified && item.reason && (
              <div className="mt-1 ml-7 text-xs text-blue-600/70 italic">
                AI: {item.reason}
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={addItem}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2.5 py-1.5"
      >
        + {addLabel}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ROUTE PICKER (for gate protocol)
// ═══════════════════════════════════════════════════════

function RoutePickerPrimitive({
  prim,
  onAction,
}: {
  prim: ResolvedPrimitive;
  onAction?: (action: string, primitive: ResolvedPrimitive) => void;
}) {
  const reason = prim.params.reason;
  const actionPrefix = prim.params.action || 'select-route';
  let routes: Array<{ id: string; name: string; description?: string }> = [];
  try {
    const raw = prim.params.routes;
    routes = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch { /* ignore */ }

  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      {reason && (
        <div className="text-xs text-muted-foreground">{reason}</div>
      )}
      <div className="grid gap-2">
        {routes.map((route) => (
          <button
            key={route.id}
            onClick={() => {
              setSelected(route.id);
              onAction?.(`${actionPrefix}:${route.id}`, prim);
            }}
            className={`flex flex-col items-start gap-0.5 border rounded-lg p-3 text-left transition-colors ${
              selected === route.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <div className="text-sm font-medium">{route.name}</div>
            {route.description && (
              <div className="text-xs text-muted-foreground">{route.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DISPATCH TABLE
// ═══════════════════════════════════════════════════════

const RENDERERS: Record<
  string,
  React.FC<{
    prim: ResolvedPrimitive;
    onAction?: (action: string, primitive: ResolvedPrimitive) => void;
  }>
> = {
  banner: BannerPrimitive,
  "sentence-highlight": SentenceHighlightPrimitive,
  "issue-dot": IssueDotPrimitive,
  "inline-widget": InlineWidgetPrimitive,
  "ai-marker": AiMarkerPrimitive,
  "node-icon": NodeIconPrimitive,
  "node-badge": NodeBadgePrimitive,
  "section-alert": SectionAlertPrimitive,
  "summary-bar": SummaryBarPrimitive,
  "result-list": ResultListPrimitive,
  "diff-view": DiffViewPrimitive,
  "action-group": ActionGroupPrimitive,
  "text-input": TextInputPrimitive,
  "comment-thread": CommentThreadPrimitive,
  "progress-bar": ProgressBarPrimitive,
  "outline-draft": OutlineDraftPrimitive,
  "draft-editor": DraftEditorPrimitive,
  "route-picker": RoutePickerPrimitive,
};

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function PrimitiveRenderer({
  primitives,
  location,
  onAction,
}: PrimitiveRendererProps) {
  const filtered = location
    ? primitives.filter((p) => p.location === location)
    : primitives;

  if (filtered.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {filtered.map((prim, i) => {
        const Renderer = RENDERERS[prim.type];
        if (!Renderer) {
          return (
            <div
              key={i}
              className="text-sm text-muted-foreground font-mono px-3 py-1"
            >
              [{prim.type}] {JSON.stringify(prim.params)}
            </div>
          );
        }
        return (
          <Renderer key={i} prim={prim} onAction={onAction} />
        );
      })}
    </div>
  );
}
