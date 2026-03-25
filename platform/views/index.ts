// ─── View Layer ───
// Re-exports for the view layer (entity-based capability mapping).

export {
  type EntityType,
  type CapabilityName,
  type CapabilityBinding,
  type EntityCapabilityMapping,
  CAPABILITY_MAPPINGS,
  getPrimitiveForCapability,
  getAllPrimitivesForCapability,
  resolveCapabilityBinding,
} from './capabilities';
