"use client";

import { Button } from "@/components/ui/button";
import { Plus, ArrowRight } from "lucide-react";

type OutlineInstructionBarProps = {
  rootBlocksCount: number;
  onAddSection: () => void;
  onNextStep: () => void;
  ImportMarkdownDialog?: React.ComponentType<{ onImport: (markdown: string) => void; variant: "link" | "button" | "full-button" }>;
  onImportMarkdown?: (markdown: string) => void;
};

/**
 * Instruction bar for the Outline tab.
 * Shows section count and actions to add/import sections.
 */
export function OutlineInstructionBar({
  rootBlocksCount,
  onAddSection,
  onNextStep,
  ImportMarkdownDialog,
  onImportMarkdown,
}: OutlineInstructionBarProps) {
  return (
    <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary" />
        <span className="text-sm">
          <strong>{rootBlocksCount} sections</strong> in your team&apos;s outline.
          {rootBlocksCount < 2
            ? ' Add more sections to build your document structure.'
            : ' Click on a section to edit, or add more.'}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onAddSection} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" />
          Add Section
        </Button>

        {onImportMarkdown && ImportMarkdownDialog && (
          <ImportMarkdownDialog onImport={onImportMarkdown} variant="button" />
        )}

        {/* Next step hint */}
        {rootBlocksCount >= 2 && (
          <>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              onClick={onNextStep}
              size="sm"
              variant="ghost"
              className="text-primary"
            >
              Next: Assign Authors
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
