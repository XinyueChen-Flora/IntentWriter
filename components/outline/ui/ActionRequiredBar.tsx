"use client";

import { useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useIntentPanelContext } from "../IntentPanelContext";
import type { SectionNotification } from "../IntentPanelContext";
import UserAvatar from "@/components/user/UserAvatar";
import { getPathUI } from "@/platform/coordination/ui";

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
        // Only show actions for paths that require interaction (not 'decided'/immediate)
        const pathUI = getPathUI(n.proposeType);
        // Skip immediate/inform paths (system resolves, no vote actions)
        if (!pathUI) continue;
        const def = pathUI.definition;
        const isImmediate = def.resolve.who === 'system' && !def.deliberate.actions?.some(a => a.id === 'approve' || a.id === 'reject');
        if (isImmediate) continue;
        if (seen.has(n.proposalId)) continue;
        seen.add(n.proposalId);
        actions.push({ ...n, affectedSectionId: block.id });
      }
    }

    return actions;
  }, [ctx.blocks, ctx.getSectionNotifications]);

  const visibleActions = pendingActions.filter(a => !dismissedIds.has(a.proposalId));
  if (visibleActions.length === 0) return null;

  const handleClick = (action: PendingAction) => {
    // Activate deliberate panel on the SOURCE section (where changes were proposed)
    ctx.startReview(action.proposalId, action.proposeType, action.sourceSectionId, action);
    // Scroll to the source section
    setTimeout(() => {
      const el = document.querySelector(`[data-block-id="${action.sourceSectionId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDismiss = (action: PendingAction, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds(prev => new Set(prev).add(action.proposalId));
  };

  return (
    <div className="flex-shrink-0 border-b">
      {visibleActions.map(action => {
        const ui = getPathUI(action.proposeType);
        if (!ui) return null;
        const { Icon, textColor, bgColor, badgeBg, darkTextColor, darkBgColor, ctaLabel, actionText } = ui;

        return (
          <div
            key={action.proposalId}
            onClick={() => handleClick(action)}
            role="button"
            tabIndex={0}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-90 cursor-pointer ${bgColor} ${darkBgColor}`}
          >
            <Icon className={`h-4 w-4 ${textColor} flex-shrink-0`} />

            <UserAvatar
              avatarUrl={action.proposedByAvatar}
              name={action.proposedByName}
              className="h-5 w-5 flex-shrink-0"
            />

            <div className="flex-1 min-w-0 text-xs">
              <span className="font-semibold">{action.proposedByName}</span>
              <span className="text-muted-foreground"> {actionText} <span className="font-medium text-foreground">{action.sourceSectionName}</span></span>
            </div>

            <div className={`flex items-center gap-1 text-[10px] font-semibold flex-shrink-0 px-2 py-1 rounded-md ${textColor} ${darkTextColor} ${badgeBg} dark:bg-opacity-30`}>
              {ctaLabel}
              <ArrowRight className="h-3 w-3" />
            </div>

            <button
              onClick={(e) => handleDismiss(action, e)}
              className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
