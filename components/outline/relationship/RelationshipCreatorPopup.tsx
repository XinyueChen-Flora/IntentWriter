"use client";

import { useState, useEffect, useRef } from "react";
import { RELATIONSHIP_TYPES, type RelationshipType } from "@/lib/partykit";

type RelationshipCreatorPopupProps = {
  x: number;
  y: number;
  onCreate: (label: string, relationshipType: RelationshipType, direction: 'directed' | 'bidirectional') => void;
  onCancel: () => void;
  /** When editing, provide current values */
  currentType?: RelationshipType;
  currentLabel?: string;
  isEditing?: boolean;
};

/**
 * Popup dialog for selecting relationship type between sections.
 * Appears after drag-to-connect interaction or when editing.
 */
export function RelationshipCreatorPopup({
  x,
  y,
  onCreate,
  onCancel,
  currentType,
  currentLabel,
  isEditing = false,
}: RelationshipCreatorPopupProps) {
  const [customLabel, setCustomLabel] = useState(currentType === 'custom' ? (currentLabel || '') : '');
  const [showCustom, setShowCustom] = useState(currentType === 'custom');
  const [position, setPosition] = useState({ left: x, top: y });
  const popupRef = useRef<HTMLDivElement>(null);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      const padding = 10;
      let newLeft = x;
      let newTop = y;

      // Check right edge
      if (x + rect.width > window.innerWidth - padding) {
        newLeft = window.innerWidth - rect.width - padding;
      }
      // Check bottom edge
      if (y + rect.height > window.innerHeight - padding) {
        newTop = window.innerHeight - rect.height - padding;
      }
      // Check left edge
      if (newLeft < padding) newLeft = padding;
      // Check top edge
      if (newTop < padding) newTop = padding;

      setPosition({ left: newLeft, top: newTop });
    }
  }, [x, y]);

  const handleSelect = (type: RelationshipType) => {
    if (type === 'custom') {
      setShowCustom(true);
    } else {
      const typeInfo = RELATIONSHIP_TYPES.find(t => t.value === type);
      onCreate(typeInfo?.label || type, type, 'bidirectional');
    }
  };

  const handleCustomSubmit = () => {
    if (customLabel.trim()) {
      onCreate(customLabel.trim(), 'custom', 'bidirectional');
    }
  };

  return (
    <div
      ref={popupRef}
      className="fixed z-[100] bg-popover border rounded-lg shadow-xl p-2 w-[280px]"
      style={{ left: position.left, top: position.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
        {isEditing ? 'Edit relationship type' : 'Select relationship type'}
      </div>

      {!showCustom ? (
        <div className="space-y-0.5">
          {RELATIONSHIP_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleSelect(type.value)}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors group ${
                currentType === type.value
                  ? 'bg-primary/15 border border-primary/30'
                  : 'hover:bg-primary/10'
              }`}
            >
              <div className="text-sm font-medium">{type.label}</div>
              <div className="text-xs text-muted-foreground">{type.description}</div>
            </button>
          ))}
          <button
            onClick={() => handleSelect('custom')}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors border-t mt-1 pt-2 ${
              currentType === 'custom'
                ? 'bg-primary/15 border border-primary/30'
                : 'hover:bg-muted'
            }`}
          >
            <div className="text-sm text-muted-foreground">Custom...</div>
          </button>
        </div>
      ) : (
        <div className="px-1">
          <input
            autoFocus
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value.slice(0, 30))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCustomSubmit();
              if (e.key === 'Escape') {
                setShowCustom(false);
              }
            }}
            placeholder="Enter custom relationship..."
            className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary mb-2"
            maxLength={30}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowCustom(false)}
              className="flex-1 text-xs py-1.5 rounded border hover:bg-secondary transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleCustomSubmit}
              disabled={!customLabel.trim()}
              className="flex-1 text-xs py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Cancel link */}
      <button
        onClick={onCancel}
        className={`w-full text-xs py-2 mt-1 border-t ${
          isEditing
            ? 'text-muted-foreground hover:text-foreground'
            : 'text-muted-foreground hover:text-destructive'
        }`}
      >
        {isEditing ? 'Cancel' : 'Remove relationship'}
      </button>
    </div>
  );
}
