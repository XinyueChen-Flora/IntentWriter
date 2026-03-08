// Type for section impact data
export type SectionImpactData = {
  sectionId: string;
  sectionIntent: string;
  impactLevel: 'none' | 'minor' | 'significant';
  reason: string;
  childIntents: Array<{ id: string; content: string; position: number }>;
  suggestedChanges?: Array<{
    action: 'add' | 'modify' | 'remove';
    intentId?: string;
    content: string;
    position: number;
    reason: string;
  }>;
};
