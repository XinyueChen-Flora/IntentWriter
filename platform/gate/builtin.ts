import { registerGate } from './protocol';
import { getCoordinationPath } from '@/platform/coordination/protocol';
import '../functions/builtin';

// ─── Impact-Based Gate (automatic with optional override) ───
// Runs evaluate-gate → shows result → user can proceed or override.

registerGate({
  id: 'impact-based',
  name: 'Impact-Based Routing',
  description: 'Routes based on impact analysis results. Teams configure thresholds.',

  steps: [
    // Step 1: Evaluate gate rules against stored sense results
    { run: 'evaluate-gate' },
    // Step 2: User confirms the suggested route
    { actions: [
        { id: 'accept-route', label: 'Continue', gate: true },
        { id: 'override', label: 'Choose Path', goto: 'manual-override' },
      ],
      when: 'evaluate-gate.route != "personal"' },
    // Step 3 (override): dynamically built by GateRunner from gate.routes
    { id: 'manual-override',
      run: 'render-route-choices' },
  ],

  functions: ['evaluate-gate', 'render-route-choices'],
  reads: ['assess-impact'],

  availableConditions: [
    { field: 'assess-impact.maxSeverity',
      label: 'Impact severity',
      options: ['minor', 'moderate', 'significant'] },
    { field: 'assess-impact.scope',
      label: 'Impact scope',
      options: ['same-section', 'cross-section'] },
    { field: 'assess-impact.affectedCount',
      label: 'Number of affected sections',
      type: 'number' },
  ],

  routes: ['negotiate', 'discussion', 'decided', 'personal'],

  defaultRules: [
    { when: { 'assess-impact.maxSeverity': 'significant', 'assess-impact.scope': 'cross-section' },
      then: 'negotiate',
      description: 'Significant cross-section impact → Team Vote' },
    { when: { 'assess-impact.scope': 'cross-section' },
      then: 'discussion',
      description: 'Cross-section scope → Discussion' },
    { when: { 'assess-impact.maxSeverity': 'minor' },
      then: 'decided',
      description: 'Minor impact → Inform' },
  ],

  defaultRoute: 'personal',
});


// ─── Manual Gate (user chooses) ───
// Shows route choices as action buttons. User picks, then confirms.

registerGate({
  id: 'manual',
  name: 'Manual Selection',
  description: 'No automatic routing. The writer chooses how to escalate.',

  steps: [
    // Step 1: Show route choices
    { run: 'render-route-choices' },
    // Step 2: User confirms after selecting
    { actions: [
        { label: 'Confirm', gate: true },
        { label: 'Cancel', stop: true },
      ] },
  ],

  functions: ['render-route-choices'],
  reads: [],
  availableConditions: [],
  routes: ['negotiate', 'discussion', 'decided'],
  defaultRules: [],
  defaultRoute: 'decided',
});

// Helper for dev pages
export { getGate, getAllGates } from './protocol';
