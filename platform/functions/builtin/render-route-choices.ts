// ─── Render Route Choices Function ───
//
// Shows available negotiate protocols as selectable cards.
// Used by manual gates where the user picks the coordination path.

import { registerFunction } from '../protocol';
import { getGate } from '@/platform/gate/protocol';
import { getCoordinationPath } from '@/platform/coordination/protocol';

registerFunction({
  id: 'render-route-choices',
  name: 'Render Route Choices',
  description: 'Shows available negotiate routes for manual selection.',
  icon: 'List',
  executor: 'local',

  fn: (input) => {
    const gateId = (input.config?._gateId as string) || 'manual';
    const gate = getGate(gateId);
    const routeDetails = (gate?.routes || [])
      .filter(r => r !== 'personal')
      .map(routeId => {
        const protocol = getCoordinationPath(routeId);
        return {
          id: routeId,
          name: protocol?.name || routeId,
          description: protocol?.description || '',
        };
      });

    return {
      data: { routes: routeDetails, route: 'pending' },
      ui: [
        { type: 'route-picker', params: {
          routes: '{{routes}}',
          reason: 'Choose how to coordinate this change',
          action: 'select-route',
        }},
      ],
    };
  },

  requires: {},
  outputSchema: { routes: 'Array', route: 'string' },
  output: { type: 'object', fields: {} },
  configFields: [],
  defaultConfig: {},
  ui: [],
});
