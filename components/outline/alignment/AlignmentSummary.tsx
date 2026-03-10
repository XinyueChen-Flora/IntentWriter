"use client";

import { useState } from "react";
import { X, List, PenLine, Sparkles, MessageSquare, ArrowUpRight } from "lucide-react";
import { AlignmentIcon, type AlignmentStatus } from "./AlignmentIcons";

export type AlignmentItem = {
  id: string;
  status: AlignmentStatus;
  intentId?: string;
  intentContent?: string;
  writingText?: string;
  note?: string;
  orphanStart?: string;  // For orphan items: sentence start for highlighting
  aiCovered?: boolean;   // For AI-generated content indicator
};

type AlignmentSummaryProps = {
  items: AlignmentItem[];
  onItemClick?: (item: AlignmentItem) => void;
  onItemHover?: (item: AlignmentItem | null) => void;
  onExpandChange?: (status: AlignmentStatus | null) => void;
  // Actions
  onUpdateWriting?: (item: AlignmentItem) => void;
  onModifyOutline?: (item: AlignmentItem) => void;
  onProposeChange?: (item: AlignmentItem) => void;   // Direct propose (add/remove from outline)
  onAddComment?: (item: AlignmentItem) => void;       // Open discussion with comment
  // Loading states
  loadingItemId?: string | null;
  onClose?: () => void;
};

/**
 * Summary panel showing alignment check results.
 * - Aligned items shown as static count (no review needed)
 * - Issues (partial, missing, orphan) shown as clickable buttons to filter
 * - Click "Alignment Check" or same button again to return to default (all highlights)
 */
export function AlignmentSummary({
  items,
  onItemClick,
  onItemHover,
  onExpandChange,
  onUpdateWriting,
  onModifyOutline,
  onProposeChange,
  onAddComment,
  loadingItemId,
  onClose,
}: AlignmentSummaryProps) {
  const [expandedStatus, setExpandedStatus] = useState<AlignmentStatus | null>(null);

  // Toggle filter - click same button again or "Alignment Check" to clear
  const handleToggleFilter = (status: AlignmentStatus) => {
    const newStatus = expandedStatus === status ? null : status;
    setExpandedStatus(newStatus);
    onExpandChange?.(newStatus);
  };

  // Clear filter - return to default (all highlights)
  const handleClearFilter = () => {
    setExpandedStatus(null);
    onExpandChange?.(null);
  };

  // Count by status
  const alignedItems = items.filter(i => i.status === 'aligned');
  const aiCoveredCount = alignedItems.filter(i => i.aiCovered).length;

  const counts = {
    aligned: alignedItems.length,
    aiCovered: aiCoveredCount,
    partial: items.filter(i => i.status === 'partial').length,
    missing: items.filter(i => i.status === 'missing').length,
    orphan: items.filter(i => i.status === 'orphan').length,
  };

  const issues = counts.partial + counts.missing + counts.orphan;

  // Get items to show in expanded view (only when filtered)
  const expandedItems = expandedStatus
    ? items.filter(i => i.status === expandedStatus)
    : [];

  return (
    <div className="border-b bg-muted/30">
      {/* Summary bar */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Alignment Check - clickable to clear filter */}
          <button
            onClick={handleClearFilter}
            className={`text-sm font-medium transition-colors ${
              expandedStatus ? 'text-muted-foreground hover:text-foreground' : 'text-foreground'
            }`}
          >
            Alignment Check
          </button>

          {/* Aligned count - static (doesn't need review) */}
          {counts.aligned > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
              <AlignmentIcon status="aligned" size="sm" />
              <span>{counts.aligned} aligned</span>
              {counts.aiCovered > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>{counts.aiCovered} AI Assisted</span>
                </span>
              )}
            </div>
          )}

          {/* Issue buttons - clickable to filter (with labels) */}
          {issues > 0 && (
            <div className="flex items-center gap-2 border-l pl-3">
              {counts.partial > 0 && (
                <button
                  onClick={() => handleToggleFilter('partial')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                    expandedStatus === 'partial' ? 'bg-amber-50 dark:bg-amber-900/40' : 'hover:bg-muted'
                  }`}
                >
                  <AlignmentIcon status="partial" size="sm" />
                  <span className="font-medium">{counts.partial}</span>
                  <span className="text-muted-foreground">partial covered</span>
                </button>
              )}

              {counts.missing > 0 && (
                <button
                  onClick={() => handleToggleFilter('missing')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                    expandedStatus === 'missing' ? 'bg-red-50 dark:bg-red-900/40' : 'hover:bg-muted'
                  }`}
                >
                  <AlignmentIcon status="missing" size="sm" />
                  <span className="font-medium">{counts.missing}</span>
                  <span className="text-muted-foreground">missing</span>
                </button>
              )}

              {counts.orphan > 0 && (
                <button
                  onClick={() => handleToggleFilter('orphan')}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                    expandedStatus === 'orphan' ? 'bg-blue-50 dark:bg-blue-900/40' : 'hover:bg-muted'
                  }`}
                >
                  <AlignmentIcon status="orphan" size="sm" />
                  <span className="font-medium">{counts.orphan}</span>
                  <span className="text-muted-foreground">potential new</span>
                </button>
              )}
            </div>
          )}

          {/* All aligned message */}
          {issues === 0 && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              All aligned
            </span>
          )}
        </div>

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Expanded details - only shown when filtered */}
      {expandedStatus && expandedItems.length > 0 && (
        <div className="px-4 pb-2 border-t">
          <div className="mt-2 space-y-1">
            {expandedItems.map((item, idx) => {
              const isLoading = loadingItemId === item.id;
              const isMissing = item.status === 'missing';
              const isOrphan = item.status === 'orphan';
              const isPartial = item.status === 'partial';
              const index = idx + 1;  // 1-based index

              // Color for index badge based on status
              const indexColorClass = isPartial
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                : isMissing
                ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                : isOrphan
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                : 'bg-muted text-muted-foreground';

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => onItemHover?.(item)}
                  onMouseLeave={() => onItemHover?.(null)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {/* Index badge */}
                  <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[10px] font-semibold ${indexColorClass}`}>
                    {index}
                  </span>

                  <AlignmentIcon status={item.status} size="sm" className="flex-shrink-0" />

                  {/* Content + badge */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm truncate">
                      {item.intentContent || item.writingText || 'Unknown'}
                    </span>
                    {/* Show sentence count for orphan items */}
                    {isOrphan && item.note && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        {item.note}
                      </span>
                    )}
                    {isMissing && !isLoading && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        not written
                      </span>
                    )}
                    {isMissing && isLoading && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300 flex items-center gap-1">
                        <div className="h-2 w-2 border border-current border-t-transparent rounded-full animate-spin" />
                        simulating...
                      </span>
                    )}
                  </div>

                  {/* Action buttons - inline */}
                  {!isLoading && (isMissing || isPartial || isOrphan) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {(isMissing || isOrphan) && (
                        <button
                          onClick={() => onProposeChange?.(item)}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border bg-background hover:bg-muted transition-colors"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          <span>Propose</span>
                        </button>
                      )}
                      <button
                        onClick={() => onAddComment?.(item)}
                        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded border bg-background hover:bg-muted transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Comment</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
