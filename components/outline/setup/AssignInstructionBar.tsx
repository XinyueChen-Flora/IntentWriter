"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

type AssignInstructionBarProps = {
  assignedCount: number;
  totalCount: number;
  onNextStep: () => void;
};

/**
 * Instruction bar for the Assign tab.
 * Shows assignment progress and guidance.
 */
export function AssignInstructionBar({
  assignedCount,
  totalCount,
  onNextStep,
}: AssignInstructionBarProps) {
  const allAssigned = assignedCount === totalCount;

  return (
    <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${allAssigned ? 'bg-green-500' : 'bg-amber-500'}`} />
        <span className="text-sm">
          {assignedCount === 0 ? (
            <>No sections assigned yet. <strong>Click &ldquo;Assign&rdquo; on each section</strong> to assign a team member.</>
          ) : !allAssigned ? (
            <><strong>{assignedCount} of {totalCount}</strong> sections assigned. Assign team members to the remaining sections.</>
          ) : (
            <>All <strong>{totalCount} sections</strong> have been assigned to team members.</>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={onNextStep}
          size="sm"
          variant="ghost"
          className="text-primary"
        >
          Next: Define Relationships
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
