"use client";

import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";

type NotifyLevel = 'skip' | 'heads-up' | 'notify';

type ImpactedSection = {
  sectionId: string;
  sectionName: string;
  impactLevel: 'minor' | 'significant';
  reason: string;
  ownerUserId: string;
  ownerName: string;
};

type InformPanelProps = {
  sections: ImpactedSection[];
  reasoning: string;
  onReasoningChange: (value: string) => void;
  notifyLevels: Map<string, NotifyLevel>;
  onNotifyLevelChange: (sectionId: string, level: NotifyLevel) => void;
  personalNotes: Map<string, string>;
  onPersonalNoteChange: (sectionId: string, note: string) => void;
  onSubmit: () => void;
};

export function InformPanel({
  sections,
  reasoning,
  onReasoningChange,
  notifyLevels,
  onNotifyLevelChange,
  personalNotes,
  onPersonalNoteChange,
}: InformPanelProps) {
  return (
    <div className="mt-3 pt-2.5 border-t mx-0.5 space-y-3">
      {/* Reasoning — shared with everyone */}
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
          What did you change and why?
        </div>
        <AutoResizeTextarea
          value={reasoning}
          onChange={onReasoningChange}
          placeholder="I changed... because..."
          className="w-full px-2.5 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
          minRows={2}
          autoFocus
        />
        <div className="text-[10px] text-muted-foreground mt-1">
          Everyone who is notified will see this.
        </div>
      </div>

      {/* Per-section notification */}
      {sections.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Impacted sections
          </div>
          <div className="space-y-2">
            {sections.map(section => (
              <SectionNotifyCard
                key={section.sectionId}
                section={section}
                level={notifyLevels.get(section.sectionId) || 'skip'}
                onLevelChange={(level) => onNotifyLevelChange(section.sectionId, level)}
                personalNote={personalNotes.get(section.sectionId) || ''}
                onPersonalNoteChange={(note) => onPersonalNoteChange(section.sectionId, note)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Per-section notification card ───

function SectionNotifyCard({
  section,
  level,
  onLevelChange,
  personalNote,
  onPersonalNoteChange,
}: {
  section: ImpactedSection;
  level: NotifyLevel;
  onLevelChange: (level: NotifyLevel) => void;
  personalNote: string;
  onPersonalNoteChange: (note: string) => void;
}) {
  const borderStyle = level === 'notify'
    ? 'border-primary/20 bg-primary/[0.03]'
    : level === 'heads-up'
      ? 'border-border bg-muted/20'
      : 'border-border opacity-60';

  return (
    <div className={`rounded-md border transition-colors ${borderStyle}`}>
      {/* Section header */}
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
          section.impactLevel === 'significant' ? 'bg-amber-500' : 'bg-blue-500'
        }`} />
        <div className="flex-1 min-w-0 text-xs">
          <span className="font-medium">{section.sectionName}</span>
        </div>
        <span className={`text-[10px] flex-shrink-0 ${
          section.impactLevel === 'significant'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-600 dark:text-blue-400'
        }`}>
          {section.impactLevel}
        </span>
      </div>

      {/* Owner + impact reason */}
      <div className="px-2.5 pb-1.5 text-[10px] text-muted-foreground">
        <span>Owner: </span>
        <span className="font-medium text-foreground/70">{section.ownerName}</span>
        {section.reason && (
          <span> — {section.reason}</span>
        )}
      </div>

      {/* Level selection — radio style */}
      <div className="px-2.5 pb-2 space-y-1 border-t pt-1.5 mx-1">
        {/* Don't notify */}
        <label className="flex items-start gap-2 cursor-pointer group">
          <input
            type="radio"
            name={`notify-${section.sectionId}`}
            checked={level === 'skip'}
            onChange={() => onLevelChange('skip')}
            className="mt-0.5 accent-primary"
          />
          <div className="text-xs">
            <div className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Don&apos;t notify {section.ownerName}
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              Only change track on outline
            </div>
          </div>
        </label>

        {/* Heads-up */}
        <label className="flex items-start gap-2 cursor-pointer group">
          <input
            type="radio"
            name={`notify-${section.sectionId}`}
            checked={level === 'heads-up'}
            onChange={() => onLevelChange('heads-up')}
            className="mt-0.5 accent-primary"
          />
          <div className="text-xs">
            <div className="font-medium group-hover:text-foreground transition-colors">
              Heads-up
            </div>
            <div className="text-[10px] text-muted-foreground">
              {section.ownerName} sees a change badge — can review when free
            </div>
          </div>
        </label>

        {/* Notify */}
        <label className="flex items-start gap-2 cursor-pointer group">
          <input
            type="radio"
            name={`notify-${section.sectionId}`}
            checked={level === 'notify'}
            onChange={() => onLevelChange('notify')}
            className="mt-0.5 accent-primary"
          />
          <div className="flex-1 text-xs">
            <div className="font-medium group-hover:text-foreground transition-colors">
              Notify
            </div>
            <div className="text-[10px] text-muted-foreground">
              {section.ownerName} sees full impact + simulation, asked to acknowledge
            </div>
          </div>
        </label>

        {/* Personal note — visible when Notify is selected */}
        {level === 'notify' && (
          <div className="ml-5 mt-1">
            <AutoResizeTextarea
              value={personalNote}
              onChange={onPersonalNoteChange}
              placeholder={section.reason || `How this affects ${section.ownerName}'s section...`}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
              minRows={1}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export type { NotifyLevel, ImpactedSection };
