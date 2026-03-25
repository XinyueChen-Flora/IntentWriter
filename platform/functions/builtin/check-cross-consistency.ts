import { registerFunction } from '../protocol';

registerFunction({
  id: 'check-cross-consistency',
  name: 'Cross-Section Consistency',
  description: 'Detect consistency issues across sections via dependency chains.',
  icon: 'GitCompare',
  trigger: 'detection',
  target: { type: 'document', description: 'Checks consistency across all sections linked by dependencies' },
  category: 'writing',
  triggerOptions: [
    { value: 'manual', label: 'Manual check' },
    { value: 'after-drift', label: 'After drift detection', config: { dependsOn: 'check-drift' } },
  ],
  defaultTrigger: 'manual',
  dependsOn: ['check-drift'],

  requires: { writing: true, dependencies: true },

  executor: 'api',
  endpoint: '/api/check-cross-consistency',

  outputSchema: {
    inconsistencies: "Array<{ fromSectionId, toSectionId, relationship, issue, severity, fromExcerpt, toExcerpt }>",
    summary: "string",
    overallConsistency: "'consistent' | 'minor-issues' | 'inconsistent'",
  },

  output: {
    type: 'CrossConsistencyResult',
    fields: {
      inconsistencies: 'Array<Inconsistency>',
      summary: 'string',
      overallConsistency: 'ConsistencyLevel',
    },
  },

  ui: [
    {
      type: 'result-list',
      forEach: 'inconsistencies',
      params: {
        title: '{{item.relationship}}',
        badge: '{{item.severity}}',
        badgeVariant: 'warning',
        detail: '{{item.issue}}',
      },
    },
    {
      type: 'section-alert',
      forEach: 'inconsistencies',
      filter: 'item.severity === "conflict"',
      params: {
        sectionId: '{{item.fromSectionId}}',
        title: 'Cross-section inconsistency',
        message: '{{item.issue}}',
        severity: 'error',
      },
    },
    {
      type: 'banner',
      when: 'overallConsistency === "inconsistent"',
      params: {
        title: 'Cross-section inconsistency detected',
        message: '{{summary}}',
        severity: 'error',
      },
    },
  ],

  configFields: [],
  defaultConfig: {},
});
