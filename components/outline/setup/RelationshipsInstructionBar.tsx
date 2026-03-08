"use client";

import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";

type RelationshipsInstructionBarProps = {
  rootBlocksCount: number;
  relationshipCount: number;
  unconfirmedCount: number;
  isDetecting: boolean;
  onDetectWithAI: () => void;
};

/**
 * Instruction bar for the Relationships tab.
 * Shows relationship status and AI detection action.
 */
export function RelationshipsInstructionBar({
  rootBlocksCount,
  relationshipCount,
  unconfirmedCount,
  isDetecting,
  onDetectWithAI,
}: RelationshipsInstructionBarProps) {
  const hasEnoughSections = rootBlocksCount >= 2;
  const allConfirmed = relationshipCount > 0 && unconfirmedCount === 0;

  return (
    <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
          unconfirmedCount > 0 ? 'bg-amber-500' : relationshipCount > 0 ? 'bg-green-500' : 'bg-muted-foreground'
        }`} />
        <span className="text-sm">
          {relationshipCount === 0 ? (
            !hasEnoughSections ? (
              <>Add at least 2 sections to define relationships.</>
            ) : (
              <>Relationships help AI detect conflicts and maintain consistency while your team writes.</>
            )
          ) : unconfirmedCount > 0 ? (
            <><strong>{unconfirmedCount} relationship{unconfirmedCount !== 1 ? 's' : ''}</strong> need confirmation.</>
          ) : (
            <>All <strong>{relationshipCount} relationships</strong> confirmed. Ready to write!</>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          onClick={onDetectWithAI}
          size="sm"
          variant={relationshipCount === 0 ? "default" : "outline"}
          disabled={isDetecting || !hasEnoughSections}
        >
          {isDetecting ? 'Analyzing...' : 'Detect with AI'}
        </Button>
        {hasEnoughSections && (
          <span className="text-xs text-muted-foreground">
            or drag <Link2 className="h-3 w-3 inline mx-0.5" /> to connect manually
          </span>
        )}
      </div>
    </div>
  );
}
