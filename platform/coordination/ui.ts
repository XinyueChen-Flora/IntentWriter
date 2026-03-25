// ─── Coordination UI Bridge ───
//
// Maps coordination path registry data to React-renderable display info.
// Designed to work with ANY registered path — not just the built-ins.

import {
  Vote, UserCheck, MessagesSquare, Bell, Users,
  GraduationCap, ShieldCheck, GitBranch, Eye,
  Scale, Gavel, HandshakeIcon, Flag,
  type LucideIcon,
} from 'lucide-react';
import {
  getCoordinationPath,
  getAllCoordinationPaths,
  type CoordinationPathDefinition,
  type ProtocolAction,
} from './protocol';

// Ensure built-in paths are registered
import './builtin';

// ─── Icon Map ───

const ICON_MAP: Record<string, LucideIcon> = {
  Bell, UserCheck, Vote, MessagesSquare, Users,
  GraduationCap, ShieldCheck, GitBranch, Eye,
  Scale, Gavel, HandshakeIcon, Flag,
};

// ─── Color Map ───

const COLOR_MAP: Record<string, {
  textColor: string;
  bgColor: string;
  badgeBg: string;
  borderColor: string;
  darkTextColor: string;
  darkBgColor: string;
}> = {
  blue: {
    textColor: 'text-blue-600', bgColor: 'bg-blue-50', badgeBg: 'bg-blue-100',
    borderColor: 'border-blue-200', darkTextColor: 'dark:text-blue-400', darkBgColor: 'dark:bg-blue-950/30',
  },
  emerald: {
    textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', badgeBg: 'bg-emerald-100',
    borderColor: 'border-emerald-200', darkTextColor: 'dark:text-emerald-400', darkBgColor: 'dark:bg-emerald-950/30',
  },
  indigo: {
    textColor: 'text-indigo-600', bgColor: 'bg-indigo-50', badgeBg: 'bg-indigo-100',
    borderColor: 'border-indigo-200', darkTextColor: 'dark:text-indigo-400', darkBgColor: 'dark:bg-indigo-950/30',
  },
  amber: {
    textColor: 'text-amber-600', bgColor: 'bg-amber-50', badgeBg: 'bg-amber-100',
    borderColor: 'border-amber-200', darkTextColor: 'dark:text-amber-400', darkBgColor: 'dark:bg-amber-950/30',
  },
  violet: {
    textColor: 'text-violet-600', bgColor: 'bg-violet-50', badgeBg: 'bg-violet-100',
    borderColor: 'border-violet-200', darkTextColor: 'dark:text-violet-400', darkBgColor: 'dark:bg-violet-950/30',
  },
  rose: {
    textColor: 'text-rose-600', bgColor: 'bg-rose-50', badgeBg: 'bg-rose-100',
    borderColor: 'border-rose-200', darkTextColor: 'dark:text-rose-400', darkBgColor: 'dark:bg-rose-950/30',
  },
  slate: {
    textColor: 'text-slate-600', bgColor: 'bg-slate-50', badgeBg: 'bg-slate-100',
    borderColor: 'border-slate-200', darkTextColor: 'dark:text-slate-400', darkBgColor: 'dark:bg-slate-950/30',
  },
};

const FALLBACK_COLORS = {
  textColor: 'text-gray-600', bgColor: 'bg-gray-50', badgeBg: 'bg-gray-100',
  borderColor: 'border-gray-200', darkTextColor: 'dark:text-gray-400', darkBgColor: 'dark:bg-gray-950/30',
};

// ─── Path UI Info ───

export type PathUI = {
  id: string;
  Icon: LucideIcon;
  label: string;
  description: string;
  textColor: string;
  bgColor: string;
  badgeBg: string;
  borderColor: string;
  darkTextColor: string;
  darkBgColor: string;
  receiverLabel: string;
  ctaLabel: string;
  actionText: string;
  definition: CoordinationPathDefinition;
  needsDecision: boolean;
  supportsDiscussion: boolean;
  receiverActions: ProtocolAction[];
};

/** Hardcoded labels for known paths */
const PATH_LABELS: Record<string, { receiverLabel: string; ctaLabel: string; actionText: string }> = {
  decided:    { receiverLabel: 'Notification',   ctaLabel: 'View',   actionText: 'informed you about changes to' },
  input:      { receiverLabel: 'Your Decision',  ctaLabel: 'Decide', actionText: 'wants you to decide on changes to' },
  negotiate:  { receiverLabel: 'Vote Requested', ctaLabel: 'Vote',   actionText: 'needs your vote on changes to' },
  discussion: { receiverLabel: 'Discussion',     ctaLabel: 'Reply',  actionText: 'wants to discuss' },
};

/**
 * Derive labels from a path definition for paths without hardcoded labels.
 * Uses the deliberate.actions to infer what kind of path this is.
 */
function deriveLabels(def: CoordinationPathDefinition): {
  receiverLabel: string;
  ctaLabel: string;
  actionText: string;
} {
  const actions = def.deliberate.actions ?? [];
  const hasApprove = actions.some(a => a.id === 'approve');
  const hasReply = actions.some(a => a.id === 'reply');

  // Derive from resolve.who and deliberate actions
  const isImmediate = def.resolve.who === 'system' && !hasApprove;
  const isDiscussion = def.resolve.who === 'proposer';

  let receiverLabel = 'Action Required';
  if (isImmediate) receiverLabel = 'Notification';
  else if (hasApprove) receiverLabel = 'Review Requested';
  else if (isDiscussion) receiverLabel = 'Discussion';

  let ctaLabel = 'View';
  if (hasApprove) ctaLabel = 'Decide';
  if (hasReply) ctaLabel = 'Reply';

  let actionText = 'proposed changes to';
  if (isImmediate) actionText = 'informed you about changes to';
  if (isDiscussion) actionText = 'wants to discuss';

  return { receiverLabel, ctaLabel, actionText };
}

/**
 * Get display info for a coordination path by ID.
 * Works for ANY registered path — built-in or custom.
 */
export function getPathUI(pathId: string): PathUI | null {
  const def = getCoordinationPath(pathId);
  if (!def) return null;

  const Icon = ICON_MAP[def.icon] ?? Bell;
  const colors = COLOR_MAP[def.color] ?? FALLBACK_COLORS;
  const labels = PATH_LABELS[def.id] ?? deriveLabels(def);

  // Derive capabilities from deliberate actions
  const deliberateActions = def.deliberate.actions ?? [];
  const receiverActions = deliberateActions;
  const needsDecision = deliberateActions.some(a => a.id === 'approve' || a.id === 'reject');
  const supportsDiscussion = deliberateActions.some(a => a.id === 'reply' || a.id === 'comment');

  return {
    id: def.id,
    Icon,
    label: def.name,
    description: def.description,
    ...colors,
    ...labels,
    definition: def,
    needsDecision,
    supportsDiscussion,
    receiverActions,
  };
}

/** Get display info for all registered coordination paths. */
export function getAllPathUIs(): PathUI[] {
  return getAllCoordinationPaths()
    .map((def) => getPathUI(def.id))
    .filter((ui): ui is PathUI => ui !== null);
}
