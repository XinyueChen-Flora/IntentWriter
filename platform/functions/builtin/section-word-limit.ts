import { registerFunction } from '../protocol';

registerFunction({
  id: 'section-word-limit',
  name: 'Section Word Limit',
  description: 'Counts words per section and flags sections that exceed a configurable limit.',
  icon: 'Type',

  requires: {
    writing: true,
  },

  executor: 'local',
  fn: ({ snapshot, config }) => {
    const limit = Number((config as Record<string, unknown>)?.limit) || 500;
    const sections = snapshot.writing.map((section) => {
      const wordCount = section.text
        ? section.text.trim().split(/\s+/).filter(Boolean).length
        : 0;
      const outlineNode = snapshot.nodes.find((n) => n.id === section.sectionId);
      return {
        sectionId: section.sectionId,
        sectionTitle: outlineNode?.content || section.sectionId,
        wordCount,
        limit,
        over: wordCount > limit,
      };
    });

    const overSections = sections.filter((s) => s.over).length;

    return {
      data: {
        sections,
        overSections,
        limit,
      },
    };
  },

  outputSchema: {
    sections: 'Array<{ sectionId, sectionTitle, wordCount, limit, over }>',
    overSections: 'number',
    limit: 'number',
  },

  ui: [
    {
      type: 'banner',
      when: 'overSections > 0',
      params: {
        title: 'Sections over word limit',
        message: '{{overSections}} section(s) exceed the {{limit}} word limit.',
        severity: 'warning',
      },
    },
    {
      type: 'banner',
      when: 'overSections === 0',
      params: {
        title: 'Within word limit',
        message: 'All sections are under the {{limit}} word limit.',
        severity: 'success',
      },
    },
    {
      type: 'result-list',
      forEach: 'sections',
      filter: 'item.over',
      params: {
        title: '{{item.sectionTitle}}',
        detail: '{{item.wordCount}} / {{item.limit}} words',
        badge: 'warning',
        badgeVariant: 'warning',
      },
    },
  ],

  configFields: [
    {
      type: 'number',
      key: 'limit',
      label: 'Word limit per section',
      description: 'Sections exceeding this word count will be flagged.',
      default: 500,
    },
  ],
  defaultConfig: { limit: 500 },
});
