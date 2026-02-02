"use client";

import { useMemo } from "react";
import { MessageSquare, Bell } from "lucide-react";
import type { HelpRequest, IntentBlock } from "@/lib/partykit";
import DiscussionCard from "./DiscussionCard";

type ActiveDiscussionsProps = {
  helpRequests: HelpRequest[];
  intentBlocks: IntentBlock[];
  currentUserId: string;
  currentUserName?: string;
  currentUserEmail?: string;
  onRespond: (requestId: string, response: { vote?: "A" | "B"; comment?: string }) => void;
  onResolve: (requestId: string, option: "A" | "B") => void;
  onCancel: (requestId: string) => void;
  onViewPreview?: (helpRequest: HelpRequest) => void; // View full preview in Intent/Writing panels
};

export default function ActiveDiscussions({
  helpRequests,
  intentBlocks,
  currentUserId,
  currentUserName,
  currentUserEmail,
  onRespond,
  onResolve,
  onCancel,
  onViewPreview,
}: ActiveDiscussionsProps) {
  // Filter to only team discussions
  const activeDiscussions = useMemo(() => {
    const discussions = helpRequests.filter(hr => hr.status === "team" && hr.teamDiscussion);

    // Debug log
    console.log("[ActiveDiscussions] Current user:", currentUserId);
    console.log("[ActiveDiscussions] Active discussions:", discussions.map(d => ({
      id: d.id,
      question: d.question?.substring(0, 30),
      createdBy: d.createdBy,
      isMyDiscussion: d.createdBy === currentUserId,
      requiredResponders: d.teamDiscussion?.requiredResponders,
      optionalResponders: d.teamDiscussion?.optionalResponders,
      amIRequired: d.teamDiscussion?.requiredResponders?.includes(currentUserId),
      amIOptional: d.teamDiscussion?.optionalResponders?.includes(currentUserId),
    })));

    return discussions;
  }, [helpRequests, currentUserId]);

  // Count discussions that need current user's response
  const needsMyResponse = useMemo(() => {
    return activeDiscussions.filter(hr => {
      if (hr.createdBy === currentUserId) return false; // I'm the initiator
      const td = hr.teamDiscussion;
      if (!td) return false;

      // Check if I need to respond
      const isRequired = td.requiredResponders?.includes(currentUserId);
      const isOptional = td.optionalResponders?.includes(currentUserId);
      const hasResponded = td.responses?.some(r => r.userId === currentUserId);

      return (isRequired || isOptional) && !hasResponded;
    }).length;
  }, [activeDiscussions, currentUserId]);

  // Separate into "needs my response" and "others"
  const { needsResponse, others } = useMemo(() => {
    const needsResponse: HelpRequest[] = [];
    const others: HelpRequest[] = [];

    activeDiscussions.forEach(hr => {
      const td = hr.teamDiscussion;
      if (!td) {
        others.push(hr);
        return;
      }

      // If I'm the initiator, it goes to others
      if (hr.createdBy === currentUserId) {
        others.push(hr);
        return;
      }

      // Check if I need to respond
      const isRequired = td.requiredResponders?.includes(currentUserId);
      const isOptional = td.optionalResponders?.includes(currentUserId);
      const hasResponded = td.responses?.some(r => r.userId === currentUserId);

      if ((isRequired || isOptional) && !hasResponded) {
        needsResponse.push(hr);
      } else {
        others.push(hr);
      }
    });

    return { needsResponse, others };
  }, [activeDiscussions, currentUserId]);

  if (activeDiscussions.length === 0) {
    return null;
  }

  return (
    <div className="border-b">
      {/* Header */}
      <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Active Discussions
          </span>
          <span className="text-xs px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded-full">
            {activeDiscussions.length}
          </span>
        </div>
        {needsMyResponse > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
            <Bell className="h-3 w-3" />
            {needsMyResponse} need{needsMyResponse > 1 ? "" : "s"} your response
          </div>
        )}
      </div>

      {/* Discussion list */}
      <div className="p-2 space-y-2 max-h-80 overflow-y-auto">
        {/* Needs my response - show first */}
        {needsResponse.length > 0 && (
          <div className="space-y-2">
            {needsResponse.map(discussion => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                intentBlocks={intentBlocks}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserEmail={currentUserEmail}
                onRespond={(response) => onRespond(discussion.id, response)}
                onResolve={(option) => onResolve(discussion.id, option)}
                onCancel={() => onCancel(discussion.id)}
                onViewPreview={() => onViewPreview?.(discussion)}
              />
            ))}
          </div>
        )}

        {/* Other discussions */}
        {others.length > 0 && (
          <div className="space-y-2">
            {needsResponse.length > 0 && others.length > 0 && (
              <div className="text-xs text-gray-500 px-1 pt-2 border-t">Other Discussions</div>
            )}
            {others.map(discussion => (
              <DiscussionCard
                key={discussion.id}
                discussion={discussion}
                intentBlocks={intentBlocks}
                currentUserId={currentUserId}
                currentUserName={currentUserName}
                currentUserEmail={currentUserEmail}
                onRespond={(response) => onRespond(discussion.id, response)}
                onResolve={(option) => onResolve(discussion.id, option)}
                onCancel={() => onCancel(discussion.id)}
                onViewPreview={() => onViewPreview?.(discussion)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
