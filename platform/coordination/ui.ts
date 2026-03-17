// ─── Coordination UI Bridge ───
//
// Maps coordination path registry data to React-renderable display info.
// This is the bridge between the string-based registry and the component layer.
//
// Usage:
//   import { getPathUI, getAllPathUIs } from '@/lib/coordination-ui';
//   const ui = getPathUI('negotiate');
//   // ui.Icon, ui.label, ui.textColor, ui.bgColor, ui.ctaLabel, ...

import {
  Vote, UserCheck, MessagesSquare, Bell, Users,
  type LucideIcon,
} from 'lucide-react';
import {
  getCoordinationPath,
  getAllCoordinationPaths,
  type CoordinationPathDefinition,
} from './protocol';

// Ensure built-in paths are registered
import './builtin';

// ─── Icon Map ───
// Contributors: add your icon mappings here when registering new paths.

const ICON_MAP: Record<string, LucideIcon> = {
  Bell,
  UserCheck,
  Vote,
  MessagesSquare,
  Users,
};

// ─── Color Map ───
// Maps path.color (tailwind color name) to concrete class strings.

const COLOR_MAP: Record<string, {
  textColor: string;
  bgColor: string;
  badgeBg: string;
  borderColor: string;
  darkTextColor: string;
  darkBgColor: string;
}> = {
  blue: {
    textColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    badgeBg: 'bg-blue-100',
    borderColor: 'border-blue-200',
    darkTextColor: 'dark:text-blue-400',
    darkBgColor: 'dark:bg-blue-950/30',
  },
  emerald: {
    textColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    badgeBg: 'bg-emerald-100',
    borderColor: 'border-emerald-200',
    darkTextColor: 'dark:text-emerald-400',
    darkBgColor: 'dark:bg-emerald-950/30',
  },
  indigo: {
    textColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    badgeBg: 'bg-indigo-100',
    borderColor: 'border-indigo-200',
    darkTextColor: 'dark:text-indigo-400',
    darkBgColor: 'dark:bg-indigo-950/30',
  },
  amber: {
    textColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    badgeBg: 'bg-amber-100',
    borderColor: 'border-amber-200',
    darkTextColor: 'dark:text-amber-400',
    darkBgColor: 'dark:bg-amber-950/30',
  },
};

const FALLBACK_COLORS = {
  textColor: 'text-gray-600',
  bgColor: 'bg-gray-50',
  badgeBg: 'bg-gray-100',
  borderColor: 'border-gray-200',
  darkTextColor: 'dark:text-gray-400',
  darkBgColor: 'dark:bg-gray-950/30',
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
  /** The header label shown when viewing a proposal of this type (e.g. "Vote Requested") */
  receiverLabel: string;
  /** The CTA button text in action bars (e.g. "Vote", "Decide", "Reply") */
  ctaLabel: string;
  /** The action text describing what the proposer did (e.g. "needs your vote on") */
  actionText: string;
  /** Full definition from registry */
  definition: CoordinationPathDefinition;
};

/** CTA labels and receiver-facing text per path */
const PATH_LABELS: Record<string, { receiverLabel: string; ctaLabel: string; actionText: string }> = {
  decided:    { receiverLabel: 'Notification',  ctaLabel: 'View',   actionText: 'informed you about changes to' },
  input:      { receiverLabel: 'Your Decision', ctaLabel: 'Decide', actionText: 'wants you to decide on changes to' },
  negotiate:  { receiverLabel: 'Vote Requested', ctaLabel: 'Vote',  actionText: 'needs your vote on changes to' },
  discussion: { receiverLabel: 'Discussion',    ctaLabel: 'Reply',  actionText: 'wants to discuss' },
};

const FALLBACK_LABELS = { receiverLabel: 'Action Required', ctaLabel: 'View', actionText: 'proposed changes to' };

/**
 * Get display info for a coordination path by ID.
 * Returns null if path is not registered.
 */
export function getPathUI(pathId: string): PathUI | null {
  const def = getCoordinationPath(pathId);
  if (!def) return null;

  const Icon = ICON_MAP[def.icon] ?? Bell;
  const colors = COLOR_MAP[def.color] ?? FALLBACK_COLORS;
  const labels = PATH_LABELS[def.id] ?? FALLBACK_LABELS;

  return {
    id: def.id,
    Icon,
    label: def.name,
    description: def.description,
    ...colors,
    ...labels,
    definition: def,
  };
}

/** Get display info for all registered coordination paths. */
export function getAllPathUIs(): PathUI[] {
  return getAllCoordinationPaths()
    .map((def) => getPathUI(def.id))
    .filter((ui): ui is PathUI => ui !== null);
}
