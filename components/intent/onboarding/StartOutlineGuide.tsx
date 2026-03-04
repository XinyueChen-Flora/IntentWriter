"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { OutlineIntro } from "./OutlineIntro";

type StartOutlineGuideProps = {
  onAddFirstSection: () => void;
  onImportMarkdown?: (markdown: string) => void;
  ImportMarkdownDialog?: React.ComponentType<{ onImport: (markdown: string) => void; variant: "link" | "button" | "full-button" }>;
};

/**
 * Empty state shown when no outline exists yet.
 * Combines the intro explanation with action buttons.
 */
export function StartOutlineGuide({
  onAddFirstSection,
  onImportMarkdown,
  ImportMarkdownDialog,
}: StartOutlineGuideProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md px-8 py-12 text-center">
        {/* Intro block */}
        <OutlineIntro className="mb-8" />

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={onAddFirstSection}
            className="w-full py-5"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add First Section
          </Button>

          {onImportMarkdown && ImportMarkdownDialog && (
            <>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-muted-foreground">or</span>
                </div>
              </div>
              <ImportMarkdownDialog onImport={onImportMarkdown} variant="full-button" />
            </>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="mt-8 text-xs text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted border rounded font-mono">Enter</kbd> new item
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-muted border rounded font-mono">Tab</kbd> indent
          <span className="mx-2">·</span>
          <kbd className="px-1.5 py-0.5 bg-muted border rounded font-mono">Shift+Tab</kbd> outdent
        </div>
      </div>
    </div>
  );
}
