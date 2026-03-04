"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Upload, Sparkles, Plus, X, GripVertical } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ParsedSection {
  content: string;
  children: string[];
}

type ImportMarkdownDialogProps = {
  onImport: (markdown: string) => void;
  variant?: 'button' | 'link' | 'full-button';
};

export default function ImportMarkdownDialog({ onImport, variant = 'link' }: ImportMarkdownDialogProps) {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [sections, setSections] = useState<ParsedSection[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!markdown.trim()) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch('/api/parse-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse');
      }

      setSections(data.sections);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Failed to parse outline');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!sections) return;

    // Convert sections to markdown format that the existing parser can handle
    const convertedMarkdown = sections.map((section) => {
      const lines = [`# ${section.content}`];
      section.children.forEach(child => {
        lines.push(`  * ${child}`);
      });
      return lines.join('\n');
    }).join('\n\n');

    onImport(convertedMarkdown);
    handleClose();
  };

  const handleClose = () => {
    setMarkdown("");
    setSections(null);
    setParseError(null);
    setOpen(false);
  };

  // Section editing functions
  const updateSectionTitle = (idx: number, content: string) => {
    if (!sections) return;
    const updated = [...sections];
    updated[idx] = { ...updated[idx], content };
    setSections(updated);
  };

  const updateChildContent = (sectionIdx: number, childIdx: number, content: string) => {
    if (!sections) return;
    const updated = [...sections];
    const newChildren = [...updated[sectionIdx].children];
    newChildren[childIdx] = content;
    updated[sectionIdx] = { ...updated[sectionIdx], children: newChildren };
    setSections(updated);
  };

  const addChild = (sectionIdx: number) => {
    if (!sections) return;
    const updated = [...sections];
    updated[sectionIdx] = {
      ...updated[sectionIdx],
      children: [...updated[sectionIdx].children, "New point"]
    };
    setSections(updated);
  };

  const removeChild = (sectionIdx: number, childIdx: number) => {
    if (!sections) return;
    const updated = [...sections];
    const newChildren = updated[sectionIdx].children.filter((_, i) => i !== childIdx);
    updated[sectionIdx] = { ...updated[sectionIdx], children: newChildren };
    setSections(updated);
  };

  const addSection = () => {
    if (!sections) return;
    setSections([...sections, { content: "New Section", children: [] }]);
  };

  const removeSection = (idx: number) => {
    if (!sections) return;
    setSections(sections.filter((_, i) => i !== idx));
  };

  const examplePlaceholder = `Paste your outline, notes, or any structured text here...

Examples of what you can paste:
- A markdown outline with # headings
- Bullet point notes
- Numbered lists
- Even unstructured notes - AI will organize them`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {variant === 'full-button' ? (
          <Button variant="outline" className="w-full">
            <Upload className="h-4 w-4 mr-2" />
            Import Existing Outline
          </Button>
        ) : variant === 'button' ? (
          <Button variant="outline" size="sm" className="h-8 text-sm">
            Import Outline
          </Button>
        ) : (
          <button className="text-primary hover:underline">
            Import it
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {sections ? 'Edit & Import Outline' : 'Import Outline'}
          </DialogTitle>
          <DialogDescription className="text-base">
            {sections
              ? 'Review and edit your outline, then import.'
              : 'Paste your outline or notes. AI will organize them into sections.'}
          </DialogDescription>
        </DialogHeader>

        {!sections ? (
          // Input step
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
            <Textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={examplePlaceholder}
              className="min-h-[280px] text-base"
            />

            {parseError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                {parseError}
              </div>
            )}
          </div>
        ) : (
          // Edit step - editable preview
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-4">
              {sections.map((section, sectionIdx) => (
                <div key={sectionIdx} className="border rounded-lg p-4 group">
                  <div className="flex items-center gap-2 mb-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                    <Input
                      value={section.content}
                      onChange={(e) => updateSectionTitle(sectionIdx, e.target.value)}
                      className="font-semibold text-base flex-1"
                      placeholder="Section title"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSection(sectionIdx)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="ml-6 space-y-2">
                    {section.children.map((child, childIdx) => (
                      <div key={childIdx} className="flex items-center gap-2 group/child">
                        <span className="text-muted-foreground">•</span>
                        <Input
                          value={child}
                          onChange={(e) => updateChildContent(sectionIdx, childIdx, e.target.value)}
                          className="text-sm flex-1"
                          placeholder="Point content"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeChild(sectionIdx, childIdx)}
                          className="opacity-0 group-hover/child:opacity-100 text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <button
                      onClick={() => addChild(sectionIdx)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary ml-4"
                    >
                      <Plus className="h-3 w-3" />
                      Add point
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addSection}
                className="w-full py-3 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Section
              </button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {sections ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={sections.length === 0}
              >
                Import {sections.length} Section{sections.length !== 1 ? 's' : ''}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={!markdown.trim() || isParsing}
              >
                {isParsing ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Parse with AI
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
