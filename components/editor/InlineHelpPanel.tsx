"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, HelpCircle, Loader2, MessageSquare, Bot, Send, CheckCircle } from "lucide-react";
import type { HelpRequest, IntentBlock, ImpactPreview, WritingBlock } from "@/lib/partykit";

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

type PanelPhase = "question" | "generating" | "personal-chat";

type InlineHelpPanelProps = {
  selectedText: string;
  selectionPosition: { top: number; left: number };
  writingBlockId: string;
  currentWritingContent?: string;
  intentBlockId?: string;
  intentContent?: string;
  allIntents: IntentBlock[];
  allWritingBlocks: WritingBlock[];  // Full document paragraphs
  userId: string;
  userName?: string;
  userEmail?: string;
  onPreviewGenerated: (preview: ImpactPreview, helpRequest: HelpRequest) => void;
  onClose: () => void;
};

export default function InlineHelpPanel({
  selectedText,
  selectionPosition,
  writingBlockId,
  currentWritingContent,
  intentBlockId,
  intentContent,
  allIntents,
  allWritingBlocks,
  userId,
  userName,
  userEmail,
  onPreviewGenerated,
  onClose,
}: InlineHelpPanelProps) {
  const [phase, setPhase] = useState<PanelPhase>("question");
  const [selectedStem, setSelectedStem] = useState<string | null>(null);
  const [fillInText, setFillInText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chat state for personal resolution
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // AI judgment result
  const [aiJudgment, setAiJudgment] = useState<HelpRequest['aiJudgment'] | null>(null);

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

  const handleSubmit = async () => {
    const fullQuestion = getFullQuestion();
    if (!fullQuestion.trim()) return;

    setIsSubmitting(true);
    setPhase("generating");

    // First, judge if this is team-relevant
    try {
      const judgeResponse = await fetch('/api/judge-help-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: fullQuestion,
          selectedText,
          currentIntentId: intentBlockId,
          currentIntentContent: intentContent,
          allIntents: allIntents.map(i => ({
            id: i.id,
            content: i.content,
            parentId: i.parentId,
            level: i.level,
          })),
        }),
      });

      const judgment = await judgeResponse.json();
      setAiJudgment(judgment);

      if (judgment.isTeamRelevant) {
        // Generate preview for team-relevant questions
        // Pass FULL document structure for proper analysis
        const previewResponse = await fetch('/api/generate-impact-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionType: selectedStem,
            question: fullQuestion,
            selectedText,
            currentIntentId: intentBlockId,
            // Full intent hierarchy
            allIntents: allIntents.map(i => ({
              id: i.id,
              content: i.content,
              parentId: i.parentId,
              level: i.level,
            })),
            // Full document paragraphs with their linked intents
            allWritingBlocks: allWritingBlocks.map(wb => ({
              id: wb.id,
              linkedIntentId: wb.linkedIntentId,
              content: wb.content,
            })),
          }),
        });

        const preview = await previewResponse.json();

        // Create HelpRequest with preview
        const helpRequest: HelpRequest = {
          id: `help-${Date.now()}`,
          createdBy: userId,
          createdByName: userName,
          createdByEmail: userEmail,
          createdAt: Date.now(),
          question: fullQuestion,
          questionType: selectedStem || undefined,
          tags: selectedStem ? [selectedStem] : [],
          writingBlockId,
          intentBlockId,
          selectedText,
          aiJudgment: judgment,
          impactPreview: preview,
          status: 'previewing',
        };

        // Notify parent to show preview in editor/intent panels
        onPreviewGenerated(preview, helpRequest);
        onClose(); // Close this panel - preview will show in the actual editor

      } else {
        // Personal question - show AI chat
        setPhase("personal-chat");
        await getAISuggestion(fullQuestion);
      }
    } catch (error) {
      console.error('[HelpPanel] Error:', error);
      setPhase("question");
    } finally {
      setIsSubmitting(false);
    }
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
                Preview will show in the editor
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

      case "generating":
        return (
          <div className="p-6 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <div className="text-sm font-medium">Generating preview...</div>
            <div className="text-xs text-muted-foreground mt-1">This will appear in the editor</div>
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
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[420px] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col"
      style={{
        top: Math.min(selectionPosition.top + 10, window.innerHeight - 500),
        left: Math.min(selectionPosition.left, window.innerWidth - 440),
        maxHeight: "480px",
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">
            {phase === "question" && "What's your uncertainty?"}
            {phase === "generating" && "Generating..."}
            {phase === "personal-chat" && "AI Assistant"}
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
