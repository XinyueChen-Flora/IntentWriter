"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare, Vote, Play, Clock, Check, X, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { HelpRequest, IntentBlock, ImpactPreview } from "@/lib/partykit";
import UserAvatar from "@/components/user/UserAvatar";

type DiscussionCardProps = {
  discussion: HelpRequest;
  intentBlocks: IntentBlock[];
  currentUserId: string;
  currentUserName?: string;
  currentUserEmail?: string;
  onRespond: (response: {
    vote?: "A" | "B";
    comment?: string;
  }) => void;
  onResolve?: (option: "A" | "B") => void;
  onCancel?: () => void;
  onViewPreview?: () => void; // View full preview in Intent/Writing panels
};

export default function DiscussionCard({
  discussion,
  intentBlocks,
  currentUserId,
  currentUserName,
  currentUserEmail,
  onRespond,
  onResolve,
  onCancel,
  onViewPreview,
}: DiscussionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedVote, setSelectedVote] = useState<"A" | "B" | null>(null);
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);

  const isInitiator = discussion.createdBy === currentUserId;
  const teamDiscussion = discussion.teamDiscussion;
  const preview = discussion.impactPreview;

  // Debug log for user identification
  console.log("[DiscussionCard] User check:", {
    currentUserId,
    discussionCreatedBy: discussion.createdBy,
    isInitiator,
    requiredResponders: teamDiscussion?.requiredResponders,
    optionalResponders: teamDiscussion?.optionalResponders,
  });

  if (!teamDiscussion || !preview) return null;

  const participationType = teamDiscussion.participationType;

  // Check if current user has already responded
  const myResponse = teamDiscussion.responses?.find(r => r.userId === currentUserId);
  const hasResponded = !!myResponse;

  // Check if current user is required to respond
  const isRequired = teamDiscussion.requiredResponders?.includes(currentUserId);
  const isOptional = teamDiscussion.optionalResponders?.includes(currentUserId);
  const shouldRespond = isRequired || isOptional;

  // Get response stats
  const totalResponses = teamDiscussion.responses?.length || 0;
  const votesForA = teamDiscussion.responses?.filter(r => r.vote === "A").length || 0;
  const votesForB = teamDiscussion.responses?.filter(r => r.vote === "B").length || 0;
  const pendingRequired = teamDiscussion.requiredResponders?.filter(
    id => !teamDiscussion.responses?.some(r => r.userId === id)
  ).length || 0;

  // Get participation type icon and label
  const getParticipationInfo = () => {
    switch (participationType) {
      case "vote":
        return { icon: Vote, label: "Team Vote", color: "text-blue-600" };
      case "feedback":
        return { icon: MessageSquare, label: "Feedback Request", color: "text-purple-600" };
      case "execute":
        return { icon: Play, label: "Execute Decision", color: "text-green-600" };
      case "tentative":
        return { icon: Clock, label: "Tentative Execution", color: "text-orange-600" };
      default:
        return { icon: MessageSquare, label: "Discussion", color: "text-gray-600" };
    }
  };

  const participationInfo = getParticipationInfo();
  const ParticipationIcon = participationInfo.icon;

  // Get affected section names
  const affectedSectionNames = preview.affectedRootIntentIds?.map(id => {
    const intent = intentBlocks.find(i => i.id === id);
    return intent?.content?.substring(0, 30) + (intent?.content && intent.content.length > 30 ? "..." : "");
  }).filter(Boolean) || [];

  const handleSubmitResponse = () => {
    if (participationType === "vote" && !selectedVote) return;

    onRespond({
      vote: selectedVote || undefined,
      comment: comment || undefined,
    });

    // Reset form
    setSelectedVote(null);
    setComment("");
    setShowCommentBox(false);
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isRequired && !hasResponded
        ? "border-red-300 bg-red-50 dark:bg-red-900/10"
        : "border-gray-200"
    }`}>
      {/* Header - Always visible */}
      <div
        className="px-3 py-2 flex items-center gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Participation type icon */}
        <ParticipationIcon className={`h-4 w-4 flex-shrink-0 ${participationInfo.color}`} />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{discussion.question}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <UserAvatar
              name={discussion.createdByName}
              email={discussion.createdByEmail}
              avatarUrl={null}
              className="h-4 w-4"
            />
            <span>{discussion.createdByName || discussion.createdByEmail?.split('@')[0]}</span>
            <span>•</span>
            <span className={participationInfo.color}>{participationInfo.label}</span>
            {teamDiscussion.selectedOption && (
              <>
                <span>•</span>
                <span className="font-medium">Chose {teamDiscussion.selectedOption}</span>
              </>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isRequired && !hasResponded && (
            <span className="text-[10px] px-1.5 py-0.5 bg-red-200 text-red-700 rounded">
              Response Required
            </span>
          )}
          {hasResponded && (
            <span className="text-[10px] px-1.5 py-0.5 bg-green-200 text-green-700 rounded flex items-center gap-0.5">
              <Check className="h-3 w-3" />
              Responded
            </span>
          )}
          {participationType === "vote" && totalResponses > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded">
              A:{votesForA} B:{votesForB}
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t px-3 py-3 space-y-4 bg-white dark:bg-gray-900">
          {/* Initiator's thoughts */}
          {teamDiscussion.initiatorThoughts && (
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
              <div className="text-xs text-gray-500 mb-1">
                {isInitiator ? "Your thoughts:" : `${discussion.createdByName || "Initiator"}'s thoughts:`}
              </div>
              <div>{teamDiscussion.initiatorThoughts}</div>
            </div>
          )}

          {/* Affected sections summary */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Affected sections:</div>
            <div className="flex flex-wrap gap-1">
              {affectedSectionNames.map((name, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Options comparison - compact view */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded border ${
              teamDiscussion.selectedOption === "A" ? "border-blue-400 bg-blue-50" : "border-gray-200"
            }`}>
              <div className="text-xs font-semibold text-blue-600 mb-1">
                A: {preview.optionA.label}
              </div>
              <div className="text-[10px] text-gray-600 line-clamp-2">
                {preview.optionA.paragraphPreviews?.[0]?.previewContent?.substring(0, 100)}...
              </div>
            </div>
            <div className={`p-2 rounded border ${
              teamDiscussion.selectedOption === "B" ? "border-purple-400 bg-purple-50" : "border-gray-200"
            }`}>
              <div className="text-xs font-semibold text-purple-600 mb-1">
                B: {preview.optionB.label}
              </div>
              <div className="text-[10px] text-gray-600 line-clamp-2">
                {preview.optionB.paragraphPreviews?.[0]?.previewContent?.substring(0, 100)}...
              </div>
            </div>
          </div>

          {/* View Full Preview button */}
          {onViewPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewPreview();
              }}
              className="w-full py-2 px-3 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center justify-center gap-2 transition-colors"
            >
              <Eye className="h-4 w-4" />
              View Full Preview in Intent & Writing Panels
            </button>
          )}

          {/* INITIATOR VIEW */}
          {isInitiator && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Response Status</div>

              {/* Response list */}
              {teamDiscussion.responses && teamDiscussion.responses.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {teamDiscussion.responses.map((response, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <UserAvatar
                        name={response.userName}
                        email={response.userEmail}
                        avatarUrl={null}
                        className="h-5 w-5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {response.userName || response.userEmail?.split('@')[0]}
                          </span>
                          {response.vote && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              response.vote === "A"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-purple-100 text-purple-700"
                            }`}>
                              Voted {response.vote}
                            </span>
                          )}
                        </div>
                        {response.comment && (
                          <div className="text-xs text-gray-600 mt-0.5">{response.comment}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic mb-3">No responses yet</div>
              )}

              {/* Pending responders */}
              {pendingRequired > 0 && (
                <div className="text-xs text-orange-600 mb-3">
                  Waiting for {pendingRequired} required response(s)
                </div>
              )}

              {/* Resolve actions */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => onResolve?.("A")}
                >
                  Resolve with A
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => onResolve?.("B")}
                >
                  Resolve with B
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-red-600"
                  onClick={onCancel}
                >
                  Cancel Discussion
                </Button>
              </div>
            </div>
          )}

          {/* RESPONDER VIEW */}
          {!isInitiator && shouldRespond && !hasResponded && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-gray-700 mb-2">Your Response</div>

              {/* Vote buttons for vote type */}
              {participationType === "vote" && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSelectedVote("A")}
                    className={`flex-1 py-2 px-3 rounded border-2 text-sm font-medium transition-all ${
                      selectedVote === "A"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    Vote A
                  </button>
                  <button
                    onClick={() => setSelectedVote("B")}
                    className={`flex-1 py-2 px-3 rounded border-2 text-sm font-medium transition-all ${
                      selectedVote === "B"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    Vote B
                  </button>
                </div>
              )}

              {/* Feedback/execute/tentative response options */}
              {participationType === "feedback" && (
                <div className="mb-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    className="w-full p-2 border rounded text-sm resize-none h-20"
                  />
                </div>
              )}

              {participationType === "execute" && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      setSelectedVote(teamDiscussion.selectedOption as "A" | "B");
                      setComment("Acknowledged. Will adjust my section accordingly.");
                    }}
                    className="flex-1 py-2 px-3 rounded border-2 border-green-300 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100"
                  >
                    <Check className="h-4 w-4 inline mr-1" />
                    Will Execute
                  </button>
                  <button
                    onClick={() => setShowCommentBox(true)}
                    className="flex-1 py-2 px-3 rounded border-2 border-orange-300 bg-orange-50 text-orange-700 text-sm font-medium hover:bg-orange-100"
                  >
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Have Concerns
                  </button>
                </div>
              )}

              {participationType === "tentative" && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => {
                      setSelectedVote(teamDiscussion.selectedOption as "A" | "B");
                      setComment("Looks good. I'll keep my section aligned.");
                    }}
                    className="flex-1 py-2 px-3 rounded border-2 border-green-300 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100"
                  >
                    <Check className="h-4 w-4 inline mr-1" />
                    Accept
                  </button>
                  <button
                    onClick={() => setShowCommentBox(true)}
                    className="flex-1 py-2 px-3 rounded border-2 border-red-300 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                  >
                    <X className="h-4 w-4 inline mr-1" />
                    Request Change
                  </button>
                </div>
              )}

              {/* Comment box (for concerns/change requests) */}
              {showCommentBox && (
                <div className="mb-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Explain your concerns or what changes you'd like..."
                    className="w-full p-2 border rounded text-sm resize-none h-20"
                  />
                </div>
              )}

              {/* Optional comment for vote */}
              {participationType === "vote" && selectedVote && (
                <div className="mb-3">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment (optional)..."
                    className="w-full p-2 border rounded text-sm resize-none h-16"
                  />
                </div>
              )}

              {/* Submit button */}
              <Button
                size="sm"
                onClick={handleSubmitResponse}
                disabled={participationType === "vote" && !selectedVote}
                className="w-full"
              >
                Submit Response
              </Button>
            </div>
          )}

          {/* Already responded */}
          {!isInitiator && hasResponded && (
            <div className="border-t pt-3">
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <div className="text-sm">
                  <span className="text-green-700 font-medium">You responded</span>
                  {myResponse?.vote && (
                    <span className="text-gray-600"> - Voted {myResponse.vote}</span>
                  )}
                </div>
              </div>
              {myResponse?.comment && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  "{myResponse.comment}"
                </div>
              )}
            </div>
          )}

          {/* Other responses (visible to everyone) */}
          {!isInitiator && teamDiscussion.responses && teamDiscussion.responses.length > 0 && (
            <div className="border-t pt-3">
              <div className="text-xs font-medium text-gray-700 mb-2">
                Other Responses ({teamDiscussion.responses.length})
              </div>
              <div className="space-y-1">
                {teamDiscussion.responses
                  .filter(r => r.userId !== currentUserId)
                  .map((response, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <UserAvatar
                        name={response.userName}
                        email={response.userEmail}
                        avatarUrl={null}
                        className="h-4 w-4"
                      />
                      <span>{response.userName || response.userEmail?.split('@')[0]}</span>
                      {response.vote && (
                        <span className={`px-1 py-0.5 rounded ${
                          response.vote === "A" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {response.vote}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
