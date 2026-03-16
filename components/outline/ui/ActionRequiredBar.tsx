"use client";

import { useMemo, useState } from "react";
import { Vote, UserCheck, MessagesSquare, ArrowRight, X } from "lucide-react";
import { useIntentPanelContext } from "../IntentPanelContext";
import type { SectionNotification } from "../IntentPanelContext";
import UserAvatar from "@/components/user/UserAvatar";

type PendingAction = SectionNotification & { affectedSectionId: string };

export function ActionRequiredBar() {
  const ctx = useIntentPanelContext();
  // Locally dismissed proposal IDs (without casting a vote — user can still vote later)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Collect all pending negotiate-type notifications across all root sections
  const pendingActions = useMemo(() => {
    const actions: PendingAction[] = [];
    const seen = new Set<string>(); // deduplicate by proposalId
    const rootBlocks = ctx.blocks.filter(b => !b.parentId);

    for (const block of rootBlocks) {
      const notifications = ctx.getSectionNotifications(block.id);
      for (const n of notifications) {
        if (n.acknowledged) continue;
        if (n.notifyLevel === 'skip') continue;
        if (n.proposeType !== 'negotiate' && n.proposeType !== 'input' && n.proposeType !== 'discussion') continue;
        if (seen.has(n.proposalId)) continue; // Fix #8: deduplicate
        seen.add(n.proposalId);
        actions.push({ ...n, affectedSectionId: block.id });
      }
    }

    return actions;
  }, [ctx.blocks, ctx.getSectionNotifications]);

  const visibleActions = pendingActions.filter(a => !dismissedIds.has(a.proposalId));
  if (visibleActions.length === 0) return null;

  const handleClick = (action: PendingAction) => {
    // Expand the thread on the source section
    ctx.setExpandedThreadProposalId(action.proposalId);

    // Scroll to source section (where the proposal originates)
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${action.sourceSectionId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDismiss = (action: PendingAction, e: React.MouseEvent) => {
    e.stopPropagation();
    // Just hide locally — don't cast a vote so user can still vote later in ProposalViewer
    setDismissedIds(prev => new Set(prev).add(action.proposalId));
  };

  return (
    <div className="flex-shrink-0 border-b">
      {visibleActions.map(action => (
        <button
          key={action.proposalId}
          onClick={() => handleClick(action)}
          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-90 ${
            action.proposeType === 'negotiate'
              ? 'bg-indigo-50 dark:bg-indigo-950/30'
              : action.proposeType === 'input'
                ? 'bg-emerald-50 dark:bg-emerald-950/30'
                : 'bg-amber-50 dark:bg-amber-950/30'
          }`}
        >
          {/* Icon */}
          {action.proposeType === 'negotiate' && <Vote className="h-4 w-4 text-indigo-500 flex-shrink-0" />}
          {action.proposeType === 'input' && <UserCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />}
          {action.proposeType === 'discussion' && <MessagesSquare className="h-4 w-4 text-amber-500 flex-shrink-0" />}

          {/* Avatar */}
          <UserAvatar
            avatarUrl={action.proposedByAvatar}
            name={action.proposedByName}
            className="h-5 w-5 flex-shrink-0"
          />

          {/* Text */}
          <div className="flex-1 min-w-0 text-xs">
            <span className="font-semibold">{action.proposedByName}</span>
            {action.proposeType === 'negotiate' && (
              <span className="text-muted-foreground"> needs your vote on changes to <span className="font-medium text-foreground">{action.sourceSectionName}</span></span>
            )}
            {action.proposeType === 'input' && (
              <span className="text-muted-foreground"> wants you to decide on changes to <span className="font-medium text-foreground">{action.sourceSectionName}</span></span>
            )}
            {action.proposeType === 'discussion' && (
              <span className="text-muted-foreground"> wants to discuss <span className="font-medium text-foreground">{action.sourceSectionName}</span> with you</span>
            )}
          </div>

          {/* CTA */}
          <div className={`flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 px-2 py-1 rounded-md ${
            action.proposeType === 'negotiate'
              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30'
              : action.proposeType === 'input'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30'
                : 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {action.proposeType === 'negotiate' ? 'Vote' : action.proposeType === 'input' ? 'Decide' : 'Reply'}
            <ArrowRight className="h-3 w-3" />
          </div>

          {/* Dismiss */}
          <button
            onClick={(e) => handleDismiss(action, e)}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </button>
      ))}
    </div>
  );
}
