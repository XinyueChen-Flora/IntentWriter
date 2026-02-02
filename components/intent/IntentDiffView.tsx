"use client";

import { Plus, Minus, Edit2 } from "lucide-react";
import type { ImpactPreview, SectionPreview, IntentBlock } from "@/lib/partykit";

type IntentDiffViewProps = {
  preview: ImpactPreview;
  selectedOption: "A" | "B" | null;
  allIntents: IntentBlock[];
};

export default function IntentDiffView({
  preview,
  selectedOption,
  allIntents,
}: IntentDiffViewProps) {
  // Get the changes for the selected option (or show both if none selected)
  const optionAChanges = preview.optionA.intentChanges;
  const optionBChanges = preview.optionB.intentChanges;

  // Merge all intents with their changes
  const getMergedView = (changes: SectionPreview[]) => {
    const changeMap = new Map(changes.map(c => [c.intentId, c]));

    return allIntents.map(intent => {
      const change = changeMap.get(intent.id);
      return {
        intent,
        change,
      };
    });
  };

  const renderChangeIndicator = (changeType: SectionPreview["changeType"]) => {
    switch (changeType) {
      case "added":
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500 text-white text-xs font-bold">
            <Plus className="h-3 w-3" />
          </span>
        );
      case "removed":
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-500 text-white text-xs font-bold">
            <Minus className="h-3 w-3" />
          </span>
        );
      case "modified":
        return (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-yellow-500 text-white text-xs font-bold">
            <Edit2 className="h-3 w-3" />
          </span>
        );
      default:
        return null;
    }
  };

  const renderDiffLine = (
    intent: IntentBlock,
    change: SectionPreview | undefined,
    colorScheme: "blue" | "purple"
  ) => {
    if (!change || change.changeType === "unchanged") {
      // Unchanged - show normally
      return (
        <div
          key={intent.id}
          className="flex items-start gap-2 py-1.5 px-2 text-gray-500 dark:text-gray-500"
          style={{ paddingLeft: `${intent.level * 16 + 8}px` }}
        >
          <span className="w-5 h-5 flex-shrink-0" /> {/* Spacer for alignment */}
          <span className="text-sm">{intent.content}</span>
        </div>
      );
    }

    const bgClass = change.changeType === "added"
      ? "bg-green-50 dark:bg-green-900/20"
      : change.changeType === "removed"
        ? "bg-red-50 dark:bg-red-900/20"
        : "bg-yellow-50 dark:bg-yellow-900/20";

    const textClass = change.changeType === "removed"
      ? "line-through text-red-700 dark:text-red-300"
      : change.changeType === "added"
        ? "text-green-700 dark:text-green-300"
        : "text-yellow-700 dark:text-yellow-300";

    return (
      <div
        key={intent.id}
        className={`flex items-start gap-2 py-1.5 px-2 ${bgClass} border-l-2 ${
          change.changeType === "added"
            ? "border-green-500"
            : change.changeType === "removed"
              ? "border-red-500"
              : "border-yellow-500"
        }`}
        style={{ paddingLeft: `${intent.level * 16 + 8}px` }}
      >
        {renderChangeIndicator(change.changeType)}
        <div className="flex-1">
          <div className={`text-sm font-medium ${textClass}`}>
            {change.changeType === "modified" ? change.previewText : intent.content}
          </div>
          {change.changeType === "modified" && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              was: {intent.content}
            </div>
          )}
        </div>
      </div>
    );
  };

  // If no option selected, show side-by-side comparison
  if (!selectedOption) {
    return (
      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="px-3 py-2 bg-orange-100 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800">
          <div className="text-xs font-medium text-orange-800 dark:text-orange-200">
            Preview: How intent structure may change
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-gray-300 dark:divide-gray-600">
          {/* Option A changes */}
          <div>
            <div className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-800 dark:text-blue-200 border-b border-blue-200 dark:border-blue-800">
              {preview.optionA.label}
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {getMergedView(optionAChanges).map(({ intent, change }) =>
                renderDiffLine(intent, change, "blue")
              )}
            </div>
          </div>

          {/* Option B changes */}
          <div>
            <div className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-xs font-medium text-purple-800 dark:text-purple-200 border-b border-purple-200 dark:border-purple-800">
              {preview.optionB.label}
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {getMergedView(optionBChanges).map(({ intent, change }) =>
                renderDiffLine(intent, change, "purple")
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show single selected option's changes
  const changes = selectedOption === "A" ? optionAChanges : optionBChanges;
  const label = selectedOption === "A" ? preview.optionA.label : preview.optionB.label;
  const colorScheme = selectedOption === "A" ? "blue" : "purple";

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div className={`px-3 py-2 border-b ${
        colorScheme === "blue"
          ? "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800"
          : "bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800"
      }`}>
        <div className={`text-xs font-medium ${
          colorScheme === "blue" ? "text-blue-800 dark:text-blue-200" : "text-purple-800 dark:text-purple-200"
        }`}>
          Preview: {label}
        </div>
      </div>

      <div className="max-h-[250px] overflow-y-auto">
        {getMergedView(changes).map(({ intent, change }) =>
          renderDiffLine(intent, change, colorScheme)
        )}
      </div>
    </div>
  );
}
