"use client";

import { ArrowDown, X, Check } from "lucide-react";
import type { IntentBlock, IntentDependency } from "@/lib/partykit";
import { RELATIONSHIP_TYPES } from "@/lib/relationship-types";

type RelationshipSidePanelProps = {
  dependencies: IntentDependency[];
  blocks: readonly IntentBlock[];
  hoveredDepId: string | null;
  selectedDepId: string | null;
  onHoverDep: (id: string | null) => void;
  onConfirm: (id: string) => void;
  onDelete: (id: string) => void;
};

// Get a natural language description for the relationship
function getRelationshipVerb(type: string): string {
  switch (type) {
    case 'depends-on': return 'depends on';
    case 'must-be-consistent': return 'must align with';
    case 'builds-upon': return 'builds upon';
    case 'contrasts-with': return 'contrasts with';
    case 'supports': return 'supports';
    default: return 'relates to';
  }
}

/**
 * Side panel showing AI-detected relationships for review.
 * Only shown when there are unconfirmed AI suggestions.
 */
export function RelationshipSidePanel({
  dependencies,
  blocks,
  hoveredDepId,
  selectedDepId,
  onHoverDep,
  onConfirm,
  onDelete,
}: RelationshipSidePanelProps) {
  const aiSuggested = dependencies.filter(d => d.source === 'ai-suggested' && !d.confirmed);

  if (aiSuggested.length === 0) return null;

  return (
    <div className="w-[340px] border-l bg-muted/5 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background">
        <h3 className="font-medium text-sm">
          Suggested Connections
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI found {aiSuggested.length} potential relationship{aiSuggested.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Suggested list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {aiSuggested.map((dep) => {
          const fromBlock = blocks.find(b => b.id === dep.fromIntentId);
          const toBlock = blocks.find(b => b.id === dep.toIntentId);
          const isHovered = hoveredDepId === dep.id;
          const isSelected = selectedDepId === dep.id;
          const relationshipVerb = getRelationshipVerb(dep.relationshipType);

          return (
            <div
              key={dep.id}
              className={`rounded-lg border transition-all cursor-pointer overflow-hidden ${
                isHovered || isSelected
                  ? 'border-primary shadow-sm'
                  : 'border-border bg-background hover:border-primary/30'
              }`}
              onMouseEnter={() => onHoverDep(dep.id)}
              onMouseLeave={() => onHoverDep(null)}
            >
              {/* First section */}
              <div className={`px-3 py-2 ${isHovered || isSelected ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <div className="text-sm leading-snug line-clamp-2 font-medium">
                  {fromBlock?.content || 'Unknown section'}
                </div>
              </div>

              {/* Relationship connector */}
              <div className="flex items-center justify-center gap-2 py-1.5 bg-background border-y text-xs">
                <ArrowDown className="h-3 w-3 text-primary" />
                <span className="text-primary font-medium">{relationshipVerb}</span>
              </div>

              {/* Second section */}
              <div className={`px-3 py-2 ${isHovered || isSelected ? 'bg-primary/5' : 'bg-muted/30'}`}>
                <div className="text-sm leading-snug line-clamp-2 font-medium">
                  {toBlock?.content || 'Unknown section'}
                </div>
              </div>

              {/* AI explanation */}
              {dep.reason && (
                <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 border-t border-dashed border-amber-200 dark:border-amber-800">
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    💡 {dep.reason}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex border-t">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirm(dep.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Check className="h-3.5 w-3.5" />
                  Keep
                </button>
                <div className="w-px bg-border" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(dep.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
