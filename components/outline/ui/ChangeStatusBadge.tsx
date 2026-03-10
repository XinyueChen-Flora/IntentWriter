"use client";

import { Plus, Minus, Edit2 } from "lucide-react";
import UserAvatar from "@/components/user/UserAvatar";

type ChangeStatus = 'added' | 'proposed' | 'modified' | 'removed';

type ChangeStatusBadgeProps = {
  status: ChangeStatus;
  changeBy?: string;
  changeByAvatar?: string;
  changeAt?: number;
  compact?: boolean; // just the label, no detail
};

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const statusConfig = {
  added:    { Icon: Plus,  label: 'NEW',      style: 'text-emerald-600 dark:text-emerald-400' },
  modified: { Icon: Edit2, label: 'MODIFIED',  style: 'text-amber-600 dark:text-amber-400' },
  proposed: { Icon: Edit2, label: 'CHANGES',   style: 'text-blue-600 dark:text-blue-400' },
  removed:  { Icon: Minus, label: 'REMOVED',   style: 'text-red-500 dark:text-red-400' },
} as const;

export function ChangeStatusBadge({ status, changeBy, changeByAvatar, changeAt, compact }: ChangeStatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) return null;
  const { Icon, label, style } = config;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${style}`}>
        <Icon className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${style}`}>
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      <span className="font-semibold">{label}</span>
      {changeBy && (
        <UserAvatar avatarUrl={changeByAvatar} name={changeBy} className="h-3.5 w-3.5" />
      )}
      {changeAt && (
        <span className="font-normal opacity-60">{relativeTime(changeAt)}</span>
      )}
    </span>
  );
}
