"use client";

import { Plus, Minus, Edit2 } from "lucide-react";

type ChangeStatus = 'added' | 'proposed' | 'modified' | 'removed';

type ChangeStatusBadgeProps = {
  status: ChangeStatus;
};

export function ChangeStatusBadge({ status }: ChangeStatusBadgeProps) {
  switch (status) {
    case 'added':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 rounded">
          <Plus className="h-2.5 w-2.5" />
          NEW
        </span>
      );
    case 'modified':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded">
          <Edit2 className="h-2.5 w-2.5" />
          MODIFIED
        </span>
      );
    case 'proposed':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded">
          <Edit2 className="h-2.5 w-2.5" />
          PROPOSED
        </span>
      );
    case 'removed':
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded">
          <Minus className="h-2.5 w-2.5" />
          REMOVED
        </span>
      );
    default:
      return null;
  }
}
