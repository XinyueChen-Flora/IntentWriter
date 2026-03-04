"use client";

import { ListTree } from "lucide-react";

type OutlineIntroProps = {
  className?: string;
};

/**
 * Introduction block explaining the outline-first workflow.
 * Shown before users create their first outline item.
 */
export function OutlineIntro({ className }: OutlineIntroProps) {
  return (
    <div className={className}>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-5">
        <ListTree className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold mb-3">Build Outline with Your Team</h1>
      <p className="text-muted-foreground leading-relaxed">
        Define <strong>what your team wants to write</strong>.
        Add sections and key points — this becomes a shared reference
        that keeps everyone aligned.
      </p>
    </div>
  );
}
