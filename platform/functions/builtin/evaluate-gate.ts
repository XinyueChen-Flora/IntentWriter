// ─── Evaluate Gate Function ───
//
// Reads stored sense results, applies gate rules (team or default),
// and outputs the routing decision. Used by gate steps.

import { registerFunction } from '../protocol';
import { getGate, evaluateGate, type GateRule } from '@/platform/gate/protocol';
import { getResult } from '@/platform/interaction-store';

registerFunction({
  id: 'evaluate-gate',
  name: 'Evaluate Gate',
  description: 'Evaluates gate routing rules against stored sense results.',
  icon: 'GitFork',
  executor: 'local',

  fn: (input) => {
    const gateId = (input.config?._gateId as string) || 'impact-based';
    const gate = getGate(gateId);
    if (!gate) {
      return {
        data: { route: 'personal', reason: 'No gate found' },
        ui: [{ type: 'banner', params: { title: 'No Gate', message: 'No gate configured', severity: 'info' } }],
      };
    }

    // Collect stored results from the interaction store
    const storedResults: Record<string, unknown> = {};
    const sectionId = input.focus?.sectionId || 'document';
    for (const readId of gate.reads) {
      const stored = getResult(readId, sectionId);
      if (stored) {
        const output = { ...stored.output } as Record<string, unknown>;
        // Derive computed fields for assess-impact (maxSeverity, scope, affectedCount)
        if (readId === 'assess-impact' && Array.isArray(output.impacts)) {
          const impacts = output.impacts as Array<{ impactLevel?: string; sectionId?: string }>;
          const hasSignificant = impacts.some(i => i.impactLevel === 'significant');
          const hasMinor = impacts.some(i => i.impactLevel === 'minor');
          const nonNone = impacts.filter(i => i.impactLevel !== 'none');
          output.maxSeverity = hasSignificant ? 'significant' : hasMinor ? 'minor' : 'none';
          output.scope = nonNone.length > 0 ? 'cross-section' : 'same-section';
          output.affectedCount = nonNone.length;
        }
        storedResults[readId] = output;
      }
    }

    const teamRules = input.config?._gateRules as GateRule[] | undefined;
    const { route, matchedRule } = evaluateGate(gate, storedResults, teamRules);
    const reason = matchedRule?.description || `Routed to ${route}`;

    return {
      data: {
        route,
        reason,
        matchedRule: matchedRule || null,
        availableRoutes: gate.routes.filter(r => r !== 'personal'),
      },
      ui: [
        { type: 'banner', when: 'route != "personal"', params: {
          title: 'Gate Decision',
          message: '{{reason}}',
          severity: 'info',
        }},
      ],
    };
  },

  requires: {},
  outputSchema: { route: 'string', reason: 'string', availableRoutes: 'Array' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});
