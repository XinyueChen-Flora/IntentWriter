"use client";

import { Minus, Plus } from "lucide-react";

type IntentUpdatePreviewPanelProps = {
  currentIntent: string;
  suggestedIntent: string;
  relatedImpacts?: Array<{ id: string; content: string; impact: string }>;
  isLoading?: boolean;
  onAccept: () => void;
  onCancel: () => void;
};

export function IntentUpdatePreviewPanel({
  currentIntent,
  suggestedIntent,
  relatedImpacts,
  isLoading,
  onAccept,
  onCancel,
}: IntentUpdatePreviewPanelProps) {
  return (
    <div className="mt-2 p-3 rounded-lg border bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Suggested Change
        </span>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>

      {/* Current → New */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <Minus className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-red-600 dark:text-red-400 line-through">{currentIntent}</span>
        </div>
        <div className="flex items-start gap-2">
          <Plus className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-emerald-700 dark:text-emerald-300">{suggestedIntent}</span>
        </div>
      </div>

      {/* Loading state for impact assessment */}
      {isLoading && (
        <div className="flex items-center justify-center py-2 gap-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          <span>Assessing impact...</span>
        </div>
      )}

      {/* Impact on related sections */}
      {!isLoading && relatedImpacts && relatedImpacts.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-1">POTENTIAL IMPACT</div>
          <div className="space-y-1">
            {relatedImpacts.map((impact, idx) => (
              <div key={idx} className="p-1.5 rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-xs">
                <div className="font-medium text-amber-800 dark:text-amber-200 truncate">{impact.content}</div>
                <div className="text-amber-600 dark:text-amber-400">{impact.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onAccept}
          disabled={isLoading}
          className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded transition-colors"
        >
          Apply Change
        </button>
      </div>
    </div>
  );
}
