import { registerFunction } from '@/platform/functions/protocol';

registerFunction({
  id: 'paragraph-word-count',
  name: 'Paragraph Word Count',
  description: 'Check each paragraph against a word limit. Highlights paragraphs that are too long.',
  icon: 'Hash',
  trigger: 'detection',

  requires: {
    writing: true,
  },

  executor: 'local',
  fn: (input) => {
    const limit = Number(input.config.limit) || 40;
    const paragraphs = [];

    for (const w of input.snapshot.writing) {
      const paras = w.text.split('\n\n').filter(p => p.trim());
      for (const para of paras) {
        const wordCount = para.split(/\s+/).length;
        paragraphs.push({
          sectionId: w.sectionId,
          text: para.slice(0, 60) + (para.length > 60 ? '...' : ''),
          wordCount,
          limit,
          over: wordCount > limit,
        });
      }
    }

    const overCount = paragraphs.filter(p => p.over).length;
    return {
      data: { paragraphs, overCount, totalCount: paragraphs.length },
    };
  },

  outputSchema: {
    paragraphs: 'Array<{ sectionId, text, wordCount, limit, over }>',
    overCount: 'number',
    totalCount: 'number',
  },

  ui: [
    {
      type: 'sentence-highlight',
      forEach: 'paragraphs',
      filter: 'item.over',
      params: {
        startAnchor: '{{item.text}}',
        color: 'red',
        tooltip: '{{item.wordCount}}/{{item.limit}} words',
      },
    },
    {
      type: 'banner',
      when: 'overCount > 0',
      params: {
        title: 'Word count issues',
        message: '{{overCount}} of {{totalCount}} paragraphs exceed the limit',
        severity: 'warning',
      },
    },
  ],

  configFields: [
    {
      type: 'number', key: 'limit', label: 'Word limit per paragraph',
      min: 10, max: 500,
    },
  ],
  defaultConfig: { limit: 40 },
});