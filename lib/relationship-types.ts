// Predefined relationship types - shared between client and server
export const RELATIONSHIP_TYPES = [
  { value: 'depends-on', label: 'Depends on', description: 'A requires concepts defined in B' },
  { value: 'must-be-consistent', label: 'Must be consistent', description: 'A and B cannot contradict each other' },
  { value: 'builds-upon', label: 'Builds upon', description: 'A extends or elaborates on B' },
  { value: 'contrasts-with', label: 'Contrasts with', description: 'A and B present different perspectives' },
  { value: 'supports', label: 'Supports', description: 'A provides evidence for B' },
] as const;

export type RelationshipType = typeof RELATIONSHIP_TYPES[number]['value'] | 'custom';
