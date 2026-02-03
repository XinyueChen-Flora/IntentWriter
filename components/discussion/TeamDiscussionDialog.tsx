"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Users, Vote, MessageSquare, Play, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImpactPreview, HelpRequest, IntentBlock, SectionPreview, ParagraphPreview } from "@/lib/partykit";
import UserAvatar from "@/components/user/UserAvatar";

// Participation types for team discussion
export type ParticipationType =
  | "vote"           // Let team vote
  | "feedback"       // Get feedback
  | "execute"        // Execute my decision
  | "tentative";     // Tentative execution

type TeamDiscussionDialogProps = {
  helpRequest: HelpRequest;
  preview: ImpactPreview;
  intentBlocks: IntentBlock[];
  selectedOption: "A" | "B" | null;
  currentUserId: string;
  currentUserName?: string;
  onClose: () => void;
  onSubmit: (discussion: {
    participationType: ParticipationType;
    myThoughts: string;
    selectedOption: "A" | "B" | null;
    requiredResponders: string[];  // User IDs who must respond
    optionalResponders: string[];  // User IDs who can optionally respond
  }) => void;
};

export default function TeamDiscussionDialog({
  helpRequest,
  preview,
  intentBlocks,
  selectedOption: initialSelectedOption,
  currentUserId,
  currentUserName,
  onClose,
  onSubmit,
}: TeamDiscussionDialogProps) {
  const [participationType, setParticipationType] = useState<ParticipationType>("feedback");
  const [myThoughts, setMyThoughts] = useState("");
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(initialSelectedOption);
  const [requiredResponders, setRequiredResponders] = useState<Set<string>>(new Set());
  const [optionalResponders, setOptionalResponders] = useState<Set<string>>(new Set());

  // Get affected sections with their assignees
  const affectedSections = useMemo(() => {
    const sections: Array<{
      intentId: string;
      intentContent: string;
      assigneeId?: string;
      assigneeName?: string;
      assigneeEmail?: string;
      isCurrentUser: boolean;
      optionA: {
        intentChange: SectionPreview | undefined;
        writingPreview: ParagraphPreview | undefined;
      };
      optionB: {
        intentChange: SectionPreview | undefined;
        writingPreview: ParagraphPreview | undefined;
      };
    }> = [];

    // Get all affected root intent IDs
    const affectedRootIds = preview.affectedRootIntentIds || [];

    affectedRootIds.forEach(intentId => {
      const intent = intentBlocks.find(i => i.id === intentId);
      if (!intent) return;

      // Find intent changes for this section
      const intentChangeA = preview.optionA.intentChanges?.find(c => c.intentId === intentId);
      const intentChangeB = preview.optionB.intentChanges?.find(c => c.intentId === intentId);

      // Find writing previews for this section
      const writingPreviewA = preview.optionA.paragraphPreviews?.find(p => p.intentId === intentId);
      const writingPreviewB = preview.optionB.paragraphPreviews?.find(p => p.intentId === intentId);

      sections.push({
        intentId,
        intentContent: intent.content,
        assigneeId: intent.assignee,
        assigneeName: intent.assigneeName,
        assigneeEmail: intent.assigneeEmail,
        isCurrentUser: intent.assignee === currentUserId,
        optionA: {
          intentChange: intentChangeA,
          writingPreview: writingPreviewA,
        },
        optionB: {
          intentChange: intentChangeB,
          writingPreview: writingPreviewB,
        },
      });
    });

    return sections;
  }, [preview, intentBlocks, currentUserId]);

  // Auto-select affected assignees as required responders
  useEffect(() => {
    const affected = new Set<string>();
    affectedSections.forEach(section => {
      if (section.assigneeId && section.assigneeId !== currentUserId) {
        affected.add(section.assigneeId);
      }
    });
    setRequiredResponders(affected);
  }, [affectedSections, currentUserId]);

  // Get all unique assignees for the responder selection
  const allAssignees = useMemo(() => {
    const assignees = new Map<string, { name?: string; email?: string; isAffected: boolean }>();

    intentBlocks.forEach(intent => {
      if (intent.assignee && intent.assignee !== currentUserId) {
        const isAffected = affectedSections.some(s => s.assigneeId === intent.assignee);
        if (!assignees.has(intent.assignee) || isAffected) {
          assignees.set(intent.assignee, {
            name: intent.assigneeName,
            email: intent.assigneeEmail,
            isAffected,
          });
        }
      }
    });

    const result = Array.from(assignees.entries()).map(([id, info]) => ({
      id,
      ...info,
    }));

    return result;
  }, [intentBlocks, currentUserId, affectedSections]);

  const handleResponderToggle = (userId: string, required: boolean) => {
    if (required) {
      const newRequired = new Set(requiredResponders);
      if (newRequired.has(userId)) {
        newRequired.delete(userId);
      } else {
        newRequired.add(userId);
        // Remove from optional if adding to required
        const newOptional = new Set(optionalResponders);
        newOptional.delete(userId);
        setOptionalResponders(newOptional);
      }
      setRequiredResponders(newRequired);
    } else {
      const newOptional = new Set(optionalResponders);
      if (newOptional.has(userId)) {
        newOptional.delete(userId);
      } else {
        newOptional.add(userId);
        // Remove from required if adding to optional
        const newRequired = new Set(requiredResponders);
        newRequired.delete(userId);
        setRequiredResponders(newRequired);
      }
      setOptionalResponders(newOptional);
    }
  };

  const handleSubmit = () => {
    onSubmit({
      participationType,
      myThoughts,
      selectedOption,
      requiredResponders: Array.from(requiredResponders),
      optionalResponders: Array.from(optionalResponders),
    });
  };

  // Participation type descriptions
  const participationOptions = [
    {
      type: "vote" as ParticipationType,
      icon: Vote,
      label: "Team Vote",
      description: "Let everyone vote for A or B, majority decides",
      requiresSelection: false,
    },
    {
      type: "feedback" as ParticipationType,
      icon: MessageSquare,
      label: "Get Feedback",
      description: "I want to hear everyone's thoughts before deciding",
      requiresSelection: false,
    },
    {
      type: "execute" as ParticipationType,
      icon: Play,
      label: "Execute My Decision",
      description: selectedOption
        ? `I've chosen ${selectedOption}, please adjust affected sections accordingly`
        : "I've made a decision, please adjust affected sections accordingly",
      requiresSelection: true,
    },
    {
      type: "tentative" as ParticipationType,
      icon: Clock,
      label: "Tentative Execution",
      description: selectedOption
        ? `I'm proceeding with ${selectedOption} for now. If you want to change, help me handle affected parts`
        : "I'm proceeding with one option for now. If you want to change, help me handle affected parts",
      requiresSelection: true,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Start Team Discussion
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question */}
          <div>
            <div className="text-sm text-gray-500 mb-1">My Question</div>
            <div className="text-base font-medium">{helpRequest.question}</div>
          </div>

          {/* Affected Sections Comparison */}
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>📍</span>
              Affected Sections Comparison
            </div>

            <div className="space-y-4">
              {affectedSections.map((section) => (
                <div key={section.intentId} className="border rounded-lg overflow-hidden">
                  {/* Section header */}
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b flex items-center justify-between">
                    <div className="font-medium text-sm truncate flex-1">
                      {section.intentContent}
                    </div>
                    <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                      {section.assigneeId && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <UserAvatar
                            name={section.assigneeName}
                            email={section.assigneeEmail}
                            avatarUrl={null}
                            className="h-5 w-5"
                          />
                          <span>
                            {section.isCurrentUser
                              ? "My section"
                              : `${section.assigneeName || section.assigneeEmail?.split('@')[0] || 'User'}'s section`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 divide-x">
                    {/* Option A */}
                    <div className="p-3">
                      <div className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-blue-100 rounded">A</span>
                        {preview.optionA.label}
                      </div>

                      {/* Intent change */}
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 mb-0.5">Intent:</div>
                        <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {section.optionA.intentChange?.changeType === "removed" ? (
                            <span className="text-red-600 line-through">{section.intentContent}</span>
                          ) : section.optionA.intentChange?.previewText ? (
                            <span>{section.optionA.intentChange.previewText}</span>
                          ) : (
                            <span className="text-gray-600">{section.intentContent}</span>
                          )}
                          {!section.optionA.intentChange && (
                            <span className="text-gray-400 text-[10px] ml-1">(unchanged)</span>
                          )}
                        </div>
                      </div>

                      {/* Writing preview */}
                      <div>
                        <div className="text-[10px] text-gray-500 mb-0.5">Writing:</div>
                        <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded max-h-32 overflow-y-auto">
                          {section.optionA.writingPreview?.previewContent || (
                            <span className="text-gray-400 italic">(Preview not generated)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Option B */}
                    <div className="p-3">
                      <div className="text-xs font-semibold text-purple-600 mb-2 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 bg-purple-100 rounded">B</span>
                        {preview.optionB.label}
                      </div>

                      {/* Intent change */}
                      <div className="mb-2">
                        <div className="text-[10px] text-gray-500 mb-0.5">Intent:</div>
                        <div className="text-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {section.optionB.intentChange?.changeType === "removed" ? (
                            <span className="text-red-600 line-through">{section.intentContent}</span>
                          ) : section.optionB.intentChange?.changeType === "added" ? (
                            <span className="text-green-600">{section.optionB.intentChange.previewText}</span>
                          ) : section.optionB.intentChange?.changeType === "modified" ? (
                            <span className="text-purple-600">{section.optionB.intentChange.previewText}</span>
                          ) : (
                            <span className="text-gray-600">{section.intentContent}</span>
                          )}
                          {section.optionB.intentChange && (
                            <span className={`text-[10px] ml-1 px-1 py-0.5 rounded ${
                              section.optionB.intentChange.changeType === "modified" ? "bg-yellow-100 text-yellow-700" :
                              section.optionB.intentChange.changeType === "added" ? "bg-green-100 text-green-700" :
                              section.optionB.intentChange.changeType === "removed" ? "bg-red-100 text-red-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {section.optionB.intentChange.changeType === "modified" ? "MODIFIED" :
                               section.optionB.intentChange.changeType === "added" ? "NEW" :
                               section.optionB.intentChange.changeType === "removed" ? "REMOVED" : ""}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Writing preview */}
                      <div>
                        <div className="text-[10px] text-gray-500 mb-0.5">Writing:</div>
                        <div className="text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded max-h-32 overflow-y-auto">
                          {section.optionB.writingPreview?.previewContent || (
                            <span className="text-gray-400 italic">(Preview not generated)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* My thoughts */}
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
              <span>💭</span>
              My Thoughts
            </div>
            <textarea
              value={myThoughts}
              onChange={(e) => setMyThoughts(e.target.value)}
              placeholder="Share your preference, considerations, or points you want to discuss with the team..."
              className="w-full p-3 border rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Participation type */}
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>🎯</span>
              How should the team participate?
            </div>
            <div className="space-y-2">
              {participationOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = participationType === option.type;
                const isDisabled = option.requiresSelection && !selectedOption;

                return (
                  <label
                    key={option.type}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 hover:border-gray-300"
                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <input
                      type="radio"
                      name="participationType"
                      value={option.type}
                      checked={isSelected}
                      onChange={() => !isDisabled && setParticipationType(option.type)}
                      disabled={isDisabled}
                      className="mt-1"
                    />
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.description}
                      </div>
                      {isDisabled && (
                        <div className="text-xs text-orange-600 mt-1">
                          Please select an option (A or B) first
                        </div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Option selection for execute/tentative */}
            {(participationType === "execute" || participationType === "tentative") && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-xs text-gray-600 mb-2">Select the option to execute:</div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedOption("A")}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedOption === "A"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    Option A: {preview.optionA.label}
                  </button>
                  <button
                    onClick={() => setSelectedOption("B")}
                    className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      selectedOption === "B"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:border-purple-300"
                    }`}
                  >
                    Option B: {preview.optionB.label}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Responders */}
          <div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <span>👥</span>
              Who should respond?
            </div>

            {allAssignees.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                No other team members are assigned to intent blocks
              </div>
            ) : (
              <div className="space-y-2">
                {allAssignees.map((assignee) => {
                  const isRequired = requiredResponders.has(assignee.id);
                  const isOptional = optionalResponders.has(assignee.id);

                  return (
                    <div
                      key={assignee.id}
                      className={`flex items-center justify-between p-2 border rounded-lg ${
                        assignee.isAffected ? "border-orange-200 bg-orange-50 dark:bg-orange-900/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          name={assignee.name}
                          email={assignee.email}
                          avatarUrl={null}
                          className="h-6 w-6"
                        />
                        <span className="text-sm">
                          {assignee.name || assignee.email?.split('@')[0] || 'User'}
                        </span>
                        {assignee.isAffected && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-orange-200 text-orange-700 rounded">
                            Affected
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResponderToggle(assignee.id, true)}
                          className={`px-2 py-1 text-xs rounded ${
                            isRequired
                              ? "bg-red-100 text-red-700 border border-red-300"
                              : "bg-gray-100 text-gray-600 hover:bg-red-50"
                          }`}
                        >
                          Required
                        </button>
                        <button
                          onClick={() => handleResponderToggle(assignee.id, false)}
                          className={`px-2 py-1 text-xs rounded ${
                            isOptional
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : "bg-gray-100 text-gray-600 hover:bg-blue-50"
                          }`}
                        >
                          Optional
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50 dark:bg-gray-800">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(participationType === "execute" || participationType === "tentative") && !selectedOption}
          >
            Start Discussion
          </Button>
        </div>
      </div>
    </div>
  );
}
