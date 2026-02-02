"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, HelpCircle, Loader2, MessageSquare, Bot, Send, CheckCircle, AlertTriangle, ArrowRight, GitCompare, Users } from "lucide-react";
import type { HelpRequest, IntentBlock } from "@/lib/partykit";

// Question stems - common uncertainty patterns
const QUESTION_STEMS = [
  {
    id: "choose-between",
    stem: "I'm choosing between:",
    placeholder: "e.g., approach A vs approach B",
    example: "using quotes vs paraphrasing",
  },
  {
    id: "add-remove",
    stem: "Should I add/remove:",
    placeholder: "e.g., a section about...",
    example: "the background section",
  },
  {
    id: "how-much",
    stem: "How much detail about:",
    placeholder: "e.g., the methodology",
    example: "the technical implementation",
  },
  {
    id: "align-with",
    stem: "Does this align with:",
    placeholder: "e.g., our main argument",
    example: "what Sarah is writing",
  },
  {
    id: "terminology",
    stem: "Should we say:",
    placeholder: "e.g., 'users' or 'participants'",
    example: "'framework' or 'model'",
  },
  {
    id: "placement",
    stem: "Where should I put:",
    placeholder: "e.g., the limitations discussion",
    example: "this example",
  },
  {
    id: "other",
    stem: "Other:",
    placeholder: "Describe your question...",
    example: "",
  },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type PanelPhase = "question" | "judging" | "personal-chat" | "team-escalation";

type SectionPreview = {
  intentId: string;
  intentContent: string;
  currentText?: string;
  previewText: string;
  changeType: "modified" | "unchanged" | "new" | "removed";
};

type ImpactPreview = {
  type: string;
  originalText: string;
  optionA?: {
    label: string;
    yourSection: string;
    affectedSections: SectionPreview[];
  };
  optionB?: {
    label: string;
    yourSection: string;
    affectedSections: SectionPreview[];
  };
  // For add-remove
  withContent?: {
    yourSection: string;
    affectedSections: SectionPreview[];
  };
  withoutContent?: {
    yourSection: string;
    affectedSections: SectionPreview[];
  };
  // For how-much
  briefVersion?: {
    yourSection: string;
    affectedSections: SectionPreview[];
  };
  detailedVersion?: {
    yourSection: string;
    affectedSections: SectionPreview[];
  };
};

type InlineHelpPanelProps = {
  selectedText: string;
  selectionPosition: { top: number; left: number };
  writingBlockId: string;
  intentBlockId?: string;
  intentContent?: string;
  allIntents: IntentBlock[];
  userId: string;
  userName?: string;
  userEmail?: string;
  onSubmit: (request: Omit<HelpRequest, 'id' | 'createdAt'>) => void;
  onClose: () => void;
  onAIJudgment?: (request: HelpRequest) => Promise<HelpRequest['aiJudgment']>;
};

export default function InlineHelpPanel({
  selectedText,
  selectionPosition,
  writingBlockId,
  intentBlockId,
  intentContent,
  allIntents,
  userId,
  userName,
  userEmail,
  onSubmit,
  onClose,
  onAIJudgment,
}: InlineHelpPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("question");
  const [selectedStem, setSelectedStem] = useState<string | null>(null);
  const [fillInText, setFillInText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiJudgment, setAiJudgment] = useState<HelpRequest['aiJudgment'] | null>(null);

  // Chat state for personal resolution
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Impact preview state for team escalation
  const [impactPreview, setImpactPreview] = useState<ImpactPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when stem is selected
  useEffect(() => {
    if (selectedStem && inputRef.current && phase === "question") {
      inputRef.current.focus();
    }
  }, [selectedStem, phase]);

  // Focus chat input when entering personal-chat phase
  useEffect(() => {
    if (phase === "personal-chat" && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [phase]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Load impact preview when entering team-escalation phase
  useEffect(() => {
    if (phase === "team-escalation" && !impactPreview && !isLoadingPreview) {
      loadImpactPreview();
    }
  }, [phase]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleStemSelect = (stemId: string) => {
    setSelectedStem(stemId);
    setFillInText("");
  };

  const getFullQuestion = () => {
    if (!selectedStem) return "";
    const stem = QUESTION_STEMS.find(s => s.id === selectedStem);
    if (!stem) return "";
    if (selectedStem === "other") return fillInText;
    return `${stem.stem} ${fillInText}`;
  };

  const loadImpactPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch('/api/generate-impact-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionType: selectedStem,
          question: getFullQuestion(),
          selectedText,
          intentContent,
          allIntents: allIntents.map(i => ({
            id: i.id,
            content: i.content,
            level: i.level,
          })),
        }),
      });

      if (response.ok) {
        const preview = await response.json();
        setImpactPreview(preview);
      }
    } catch (error) {
      console.error('Failed to load impact preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSubmit = async () => {
    const fullQuestion = getFullQuestion();
    if (!fullQuestion.trim()) return;

    setIsSubmitting(true);
    setPhase("judging");

    const helpRequest: Omit<HelpRequest, 'id' | 'createdAt'> = {
      createdBy: userId,
      createdByName: userName,
      createdByEmail: userEmail,
      question: fullQuestion.trim(),
      tags: selectedStem ? [selectedStem] : [],
      writingBlockId,
      intentBlockId,
      selectedText,
      status: 'pending',
    };

    let isTeamRelevant = false;

    if (onAIJudgment) {
      try {
        const fullRequest: HelpRequest = {
          ...helpRequest,
          id: `help-${Date.now()}`,
          createdAt: Date.now(),
        };

        const judgment = await onAIJudgment(fullRequest);
        setAiJudgment(judgment);
        helpRequest.aiJudgment = judgment;
        helpRequest.status = judgment?.isTeamRelevant ? 'team' : 'personal';
        isTeamRelevant = judgment?.isTeamRelevant ?? false;
      } catch (error) {
        console.error('[HelpPanel] AI judgment failed:', error);
        isTeamRelevant = false;
      }
    }

    if (isTeamRelevant) {
      setPhase("team-escalation");
    } else {
      setPhase("personal-chat");
      await getAISuggestion(fullQuestion);
    }

    onSubmit(helpRequest);
    setIsSubmitting(false);
  };

  const getAISuggestion = async (question: string, isFollowUp = false) => {
    setIsChatLoading(true);
    try {
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          questionType: selectedStem,
          selectedText,
          intentContent,
          chatHistory: isFollowUp ? chatMessages : [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, { role: "assistant", content: data.suggestion }]);
      }
    } catch (error) {
      console.error('AI chat failed:', error);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    await getAISuggestion(userMessage, true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (phase === "question" && fillInText.trim()) {
        handleSubmit();
      } else if (phase === "personal-chat" && chatInput.trim()) {
        handleChatSubmit();
      }
    }
  };

  const currentStem = QUESTION_STEMS.find(s => s.id === selectedStem);

  // Render a single section preview block
  const renderSectionBlock = (
    section: SectionPreview,
    colorClass: string
  ) => {
    const bgClass = section.changeType === "modified"
      ? `${colorClass}/10`
      : section.changeType === "unchanged"
        ? "bg-gray-50 dark:bg-gray-800/50"
        : `${colorClass}/5`;

    const borderClass = section.changeType === "modified"
      ? colorClass.replace("bg-", "border-")
      : "border-gray-200 dark:border-gray-700";

    return (
      <div
        key={section.intentId}
        className={`p-2 rounded border ${bgClass} ${borderClass} ${
          section.changeType === "modified" ? "border-l-2" : ""
        }`}
      >
        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 truncate">
          {section.intentContent}
        </div>
        <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
          {section.previewText}
        </div>
        {section.changeType === "modified" && (
          <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
            <ArrowRight className="h-2.5 w-2.5" />
            may need updates
          </div>
        )}
      </div>
    );
  };

  // Render "Choose Between" side-by-side diff preview
  const renderChooseBetweenPreview = () => {
    if (!impactPreview?.optionA || !impactPreview?.optionB) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Option A Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "A"
              ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
          }`}
          onClick={() => setSelectedOption("A")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "A" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold truncate">
              {impactPreview.optionA.label}
            </span>
            {selectedOption === "A" && <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />}
          </div>

          <div className="p-2 space-y-2">
            {/* Your section */}
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.optionA.yourSection}
              </div>
            </div>

            {/* Affected sections */}
            {impactPreview.optionA.affectedSections?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.optionA.affectedSections.map(section =>
                  renderSectionBlock(section, "bg-blue-500")
                )}
              </div>
            )}
          </div>
        </div>

        {/* Option B Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "B"
              ? "border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800"
              : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
          }`}
          onClick={() => setSelectedOption("B")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "B" ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold truncate">
              {impactPreview.optionB.label}
            </span>
            {selectedOption === "B" && <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />}
          </div>

          <div className="p-2 space-y-2">
            {/* Your section */}
            <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-[10px] font-medium text-purple-600 dark:text-purple-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.optionB.yourSection}
              </div>
            </div>

            {/* Affected sections */}
            {impactPreview.optionB.affectedSections?.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.optionB.affectedSections.map(section =>
                  renderSectionBlock(section, "bg-purple-500")
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render "Add/Remove" side-by-side preview
  const renderAddRemovePreview = () => {
    if (!impactPreview?.withContent && !impactPreview?.withoutContent) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {/* With Content Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "A"
              ? "border-green-500 ring-2 ring-green-200 dark:ring-green-800"
              : "border-gray-200 dark:border-gray-700 hover:border-green-300"
          }`}
          onClick={() => setSelectedOption("A")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "A" ? "bg-green-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold">+ Keep / Add</span>
            {selectedOption === "A" && <CheckCircle className="h-3.5 w-3.5" />}
          </div>

          <div className="p-2 space-y-2">
            <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="text-[10px] font-medium text-green-600 dark:text-green-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.withContent?.yourSection}
              </div>
            </div>

            {(impactPreview.withContent?.affectedSections?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.withContent?.affectedSections?.map(section =>
                  renderSectionBlock(section, "bg-green-500")
                )}
              </div>
            )}
          </div>
        </div>

        {/* Without Content Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "B"
              ? "border-red-500 ring-2 ring-red-200 dark:ring-red-800"
              : "border-gray-200 dark:border-gray-700 hover:border-red-300"
          }`}
          onClick={() => setSelectedOption("B")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "B" ? "bg-red-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold">- Remove / Skip</span>
            {selectedOption === "B" && <CheckCircle className="h-3.5 w-3.5" />}
          </div>

          <div className="p-2 space-y-2">
            <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="text-[10px] font-medium text-red-600 dark:text-red-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.withoutContent?.yourSection}
              </div>
            </div>

            {(impactPreview.withoutContent?.affectedSections?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.withoutContent?.affectedSections?.map(section =>
                  renderSectionBlock(section, "bg-red-500")
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render "How Much Detail" side-by-side preview
  const renderHowMuchPreview = () => {
    if (!impactPreview?.briefVersion && !impactPreview?.detailedVersion) return null;

    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Brief Version Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "A"
              ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
              : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
          }`}
          onClick={() => setSelectedOption("A")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "A" ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold">Brief</span>
            {selectedOption === "A" && <CheckCircle className="h-3.5 w-3.5" />}
          </div>

          <div className="p-2 space-y-2">
            <div className="p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <div className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.briefVersion?.yourSection}
              </div>
            </div>

            {(impactPreview.briefVersion?.affectedSections?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.briefVersion?.affectedSections?.map(section =>
                  renderSectionBlock(section, "bg-blue-500")
                )}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Version Column */}
        <div
          className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
            selectedOption === "B"
              ? "border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800"
              : "border-gray-200 dark:border-gray-700 hover:border-purple-300"
          }`}
          onClick={() => setSelectedOption("B")}
        >
          <div className={`px-3 py-2 flex items-center justify-between ${
            selectedOption === "B" ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-gray-800"
          }`}>
            <span className="text-xs font-semibold">Detailed</span>
            {selectedOption === "B" && <CheckCircle className="h-3.5 w-3.5" />}
          </div>

          <div className="p-2 space-y-2">
            <div className="p-2 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
              <div className="text-[10px] font-medium text-purple-600 dark:text-purple-400 mb-1">Your section</div>
              <div className="text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {impactPreview.detailedVersion?.yourSection}
              </div>
            </div>

            {(impactPreview.detailedVersion?.affectedSections?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Others may write:
                </div>
                {impactPreview.detailedVersion?.affectedSections?.map(section =>
                  renderSectionBlock(section, "bg-purple-500")
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (phase) {
      case "question":
        return (
          <>
            {selectedText && (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <div className="text-xs text-muted-foreground mb-1">About this text:</div>
                <div className="text-sm line-clamp-2 text-gray-700 dark:text-gray-300 italic">
                  "{selectedText}"
                </div>
              </div>
            )}

            <div className="p-3 space-y-1.5 max-h-[280px] overflow-y-auto">
              {QUESTION_STEMS.map((stem) => (
                <div
                  key={stem.id}
                  className={`flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    selectedStem === stem.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent'
                  }`}
                  onClick={() => handleStemSelect(stem.id)}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    selectedStem === stem.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'
                  }`}>
                    {selectedStem === stem.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{stem.stem}</div>
                    {stem.example && (
                      <div className="text-xs text-muted-foreground mt-0.5">e.g., "{stem.example}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedStem && (
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                  <span className="text-sm text-blue-800 dark:text-blue-200 font-medium whitespace-nowrap">
                    {currentStem?.stem}
                  </span>
                  <Input
                    ref={inputRef}
                    value={fillInText}
                    onChange={(e) => setFillInText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={currentStem?.placeholder}
                    className="flex-1 h-8 text-sm border-0 bg-white dark:bg-gray-800 focus-visible:ring-1"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3 inline mr-1" />
                AI will check if this needs team input
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSubmit} disabled={!selectedStem || !fillInText.trim() || isSubmitting}>
                  Ask
                </Button>
              </div>
            </div>
          </>
        );

      case "judging":
        return (
          <div className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <div className="text-sm font-medium">Analyzing your question...</div>
            <div className="text-xs text-muted-foreground mt-1">Checking if this needs team input</div>
          </div>
        );

      case "personal-chat":
        return (
          <>
            <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">You can resolve this yourself</span>
              </div>
              {aiJudgment?.reason && (
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">{aiJudgment.reason}</div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <div className="text-xs text-muted-foreground mb-1">Your question:</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{getFullQuestion()}</div>
            </div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[250px]">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                  }`}>
                    {msg.role === 'assistant' && <Bot className="h-3 w-3 inline mr-1 opacity-60" />}
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <Input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a follow-up question..."
                  className="flex-1 h-9 text-sm"
                  disabled={isChatLoading}
                />
                <Button size="sm" onClick={handleChatSubmit} disabled={!chatInput.trim() || isChatLoading} className="h-9 px-3">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <Button size="sm" onClick={onClose}>Done, continue writing</Button>
            </div>
          </>
        );

      case "team-escalation":
        return (
          <>
            <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-100 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800 dark:text-orange-200">This may need team input</span>
              </div>
              {aiJudgment?.reason && (
                <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">{aiJudgment.reason}</div>
              )}
            </div>

            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <GitCompare className="h-4 w-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Preview the options</span>
              </div>
            </div>

            <div className="p-3 overflow-y-auto max-h-[400px]">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500 mb-2" />
                  <div className="text-sm text-muted-foreground">Generating preview...</div>
                </div>
              ) : (
                <>
                  {selectedStem === "choose-between" && renderChooseBetweenPreview()}
                  {selectedStem === "add-remove" && renderAddRemovePreview()}
                  {selectedStem === "how-much" && renderHowMuchPreview()}

                  {/* Generic fallback for other types */}
                  {!["choose-between", "add-remove", "how-much"].includes(selectedStem || "") && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                      This question type affects team coordination. Click "Ask Team" to discuss.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-between px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Decide myself
              </Button>
              <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                <Users className="h-4 w-4 mr-1" />
                Ask Team
              </Button>
            </div>
          </>
        );
    }
  };

  // Wider panel for team escalation with side-by-side preview
  const panelWidth = phase === "team-escalation" ? 600 : 480;

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col`}
      style={{
        width: panelWidth,
        top: Math.min(selectionPosition.top + 10, window.innerHeight - 600),
        left: Math.min(selectionPosition.left, window.innerWidth - panelWidth - 20),
        maxHeight: "600px",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">
            {phase === "question" && "What's your uncertainty?"}
            {phase === "judging" && "Analyzing..."}
            {phase === "personal-chat" && "AI Assistant"}
            {phase === "team-escalation" && "Team Input Needed"}
          </span>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {renderContent()}
    </div>
  );
}
