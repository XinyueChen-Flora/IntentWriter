"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ImportMarkdownDialogProps = {
  onImport: (markdown: string) => void;
};

export default function ImportMarkdownDialog({ onImport }: ImportMarkdownDialogProps) {
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");

  const handleImport = () => {
    if (markdown.trim()) {
      onImport(markdown);
      setMarkdown("");
      setOpen(false);
    }
  };

  const exampleMarkdown = `# Research Statement

1. **Introduction**
   * **Hook** — AI assistance dilemma
     [intent]: Establish necessity
   * **Thesis** — Middle-layer AI
     [intent]: State one big idea

2. **Framework**
   * **Gap** — Missing cognitive layer
     [intent]: Differentiate approach`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Import Structure
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Writing Structure from Markdown</DialogTitle>
          <DialogDescription>
            Paste your hierarchical writing structure. Supports headings (#), numbered lists (1.), bullet points (*), and [intent]: tags.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
          <Textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={exampleMarkdown}
            className="min-h-[300px] font-mono text-sm"
          />

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Supported formats:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li># Heading (top level)</li>
              <li>1. Numbered item (auto-indented)</li>
              <li>* Bullet point (child level)</li>
              <li>[intent]: Tag for marking intentions</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!markdown.trim()}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
