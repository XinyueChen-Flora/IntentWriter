"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, X, ArrowLeft, ArrowRight, Users, FileText, Layers } from "lucide-react";
import type { ImpactPreview, ParagraphPreview } from "@/lib/partykit";

type SplitPreviewEditorProps = {
  preview: ImpactPreview;
  originalContent: string;
  onSelectOption: (option: "A" | "B") => void;
  onCancel: () => void;
  onAskTeam?: () => void;  // Share with team for negotiation
  selectedOption?: "A" | "B";
};

// Component to render paragraph previews
function ParagraphPreviewList({ previews, colorScheme }: { previews: ParagraphPreview[]; colorScheme: "blue" | "purple" }) {
  if (!previews || previews.length === 0) {
    return <div className="text-sm text-gray-500 italic p-4">No paragraph previews available</div>;
  }

  return (
    <div className="space-y-4 p-4">
      {previews.map((para, idx) => (
        <div
          key={para.intentId || idx}
          className={`rounded-lg border ${
            para.changeType === "modified"
              ? colorScheme === "blue"
                ? "border-blue-300 bg-blue-50/50 dark:bg-blue-900/10"
                : "border-purple-300 bg-purple-50/50 dark:bg-purple-900/10"
              : "border-gray-200 bg-gray-50/50 dark:bg-gray-800/50"
          }`}
        >
          {/* Section header */}
          <div className={`px-3 py-2 border-b ${
            para.changeType === "modified"
              ? colorScheme === "blue"
                ? "border-blue-200 bg-blue-100/50"
                : "border-purple-200 bg-purple-100/50"
              : "border-gray-200 bg-gray-100/50 dark:bg-gray-700/50"
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {para.intentContent}
                </span>
              </div>
              {para.changeType === "modified" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  colorScheme === "blue"
                    ? "bg-blue-500 text-white"
                    : "bg-purple-500 text-white"
                }`}>
                  CHANGED
                </span>
              )}
            </div>
            {para.reason && (
              <div className="text-[10px] text-gray-500 mt-1">{para.reason}</div>
            )}
          </div>

          {/* Paragraph content */}
          <div className="p-3">
            {para.changeType === "modified" ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-500 mb-1">Preview:</div>
                <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {para.previewContent}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">
                (unchanged)
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SplitPreviewEditor({
  preview,
  originalContent,
  onSelectOption,
  onCancel,
  onAskTeam,
  selectedOption,
}: SplitPreviewEditorProps) {
  const [hoveredOption, setHoveredOption] = useState<"A" | "B" | null>(null);
  const [viewMode, setViewMode] = useState<"paragraphs" | "intents">("paragraphs");

  // Count modified items
  const countModified = (previews: ParagraphPreview[] | undefined) => {
    return previews?.filter(p => p.changeType === "modified").length || 0;
  };

  const optionAModified = countModified(preview.optionA.paragraphPreviews);
  const optionBModified = countModified(preview.optionB.paragraphPreviews);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Impact Preview
          </div>
          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
            <button
              className={`px-2 py-1 text-xs rounded ${
                viewMode === "paragraphs"
                  ? "bg-white dark:bg-gray-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("paragraphs")}
            >
              <FileText className="h-3 w-3 inline mr-1" />
              Paragraphs
            </button>
            <button
              className={`px-2 py-1 text-xs rounded ${
                viewMode === "intents"
                  ? "bg-white dark:bg-gray-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setViewMode("intents")}
            >
              <Layers className="h-3 w-3 inline mr-1" />
              Intents
            </button>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Close
        </Button>
      </div>

      {/* Affected sections summary */}
      {preview.affectedIntentIds && preview.affectedIntentIds.length > 0 && (
        <div className="px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
          <div className="text-xs text-orange-700 dark:text-orange-300">
            <span className="font-medium">{preview.affectedIntentIds.length}</span> section(s) may be affected by this choice
          </div>
        </div>
      )}

      {/* Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Option A - Left */}
        <div
          className={`flex-1 flex flex-col border-r border-gray-300 dark:border-gray-600 cursor-pointer transition-all ${
            selectedOption === "A"
              ? "bg-blue-50/30 dark:bg-blue-900/10"
              : hoveredOption === "A"
                ? "bg-blue-50/20 dark:bg-blue-900/5"
                : "bg-white dark:bg-gray-800"
          }`}
          onClick={() => onSelectOption("A")}
          onMouseEnter={() => setHoveredOption("A")}
          onMouseLeave={() => setHoveredOption(null)}
        >
          {/* Option A Header */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${
            selectedOption === "A"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 dark:bg-gray-700"
          }`}>
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="font-medium text-sm">{preview.optionA.label}</span>
              {optionAModified > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  selectedOption === "A" ? "bg-white/20" : "bg-blue-100 text-blue-700"
                }`}>
                  {optionAModified} changes
                </span>
              )}
            </div>
            {selectedOption === "A" && <CheckCircle className="h-4 w-4" />}
          </div>

          {/* Option A Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "paragraphs" ? (
              <ParagraphPreviewList
                previews={preview.optionA.paragraphPreviews}
                colorScheme="blue"
              />
            ) : (
              <div className="p-4 space-y-2">
                {preview.optionA.intentChanges?.map((change, idx) => (
                  <div
                    key={change.intentId || idx}
                    className={`text-xs p-2 rounded ${
                      change.changeType === "modified"
                        ? "bg-yellow-50 border-l-2 border-yellow-500"
                        : change.changeType === "added"
                        ? "bg-green-50 border-l-2 border-green-500"
                        : change.changeType === "removed"
                        ? "bg-red-50 border-l-2 border-red-500"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="font-medium">{change.intentContent}</div>
                    <div className="text-gray-500 mt-0.5">{change.previewText}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Divider with VS */}
        <div className="w-8 flex flex-col items-center justify-center bg-gray-200 dark:bg-gray-700">
          <div className="text-xs font-bold text-gray-500 dark:text-gray-400 transform -rotate-90">
            VS
          </div>
        </div>

        {/* Option B - Right */}
        <div
          className={`flex-1 flex flex-col cursor-pointer transition-all ${
            selectedOption === "B"
              ? "bg-purple-50/30 dark:bg-purple-900/10"
              : hoveredOption === "B"
                ? "bg-purple-50/20 dark:bg-purple-900/5"
                : "bg-white dark:bg-gray-800"
          }`}
          onClick={() => onSelectOption("B")}
          onMouseEnter={() => setHoveredOption("B")}
          onMouseLeave={() => setHoveredOption(null)}
        >
          {/* Option B Header */}
          <div className={`flex items-center justify-between px-4 py-2 border-b ${
            selectedOption === "B"
              ? "bg-purple-500 text-white"
              : "bg-gray-100 dark:bg-gray-700"
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{preview.optionB.label}</span>
              {optionBModified > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  selectedOption === "B" ? "bg-white/20" : "bg-purple-100 text-purple-700"
                }`}>
                  {optionBModified} changes
                </span>
              )}
              <ArrowRight className="h-4 w-4" />
            </div>
            {selectedOption === "B" && <CheckCircle className="h-4 w-4" />}
          </div>

          {/* Option B Content */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === "paragraphs" ? (
              <ParagraphPreviewList
                previews={preview.optionB.paragraphPreviews}
                colorScheme="purple"
              />
            ) : (
              <div className="p-4 space-y-2">
                {preview.optionB.intentChanges?.map((change, idx) => (
                  <div
                    key={change.intentId || idx}
                    className={`text-xs p-2 rounded ${
                      change.changeType === "modified"
                        ? "bg-yellow-50 border-l-2 border-yellow-500"
                        : change.changeType === "added"
                        ? "bg-green-50 border-l-2 border-green-500"
                        : change.changeType === "removed"
                        ? "bg-red-50 border-l-2 border-red-500"
                        : "bg-gray-50"
                    }`}
                  >
                    <div className="font-medium">{change.intentContent}</div>
                    <div className="text-gray-500 mt-0.5">{change.previewText}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with action buttons */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedOption ? (
            <>
              Selected: <span className={`font-medium ${
                selectedOption === "A" ? "text-blue-600" : "text-purple-600"
              }`}>
                {selectedOption === "A" ? preview.optionA.label : preview.optionB.label}
              </span>
            </>
          ) : (
            <span>Click an option to select</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          {onAskTeam && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAskTeam}
              className="border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <Users className="h-4 w-4 mr-1" />
              Ask Team
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
