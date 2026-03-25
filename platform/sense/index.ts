// ─── Sense Protocol ───
// Re-exports protocol types, registry functions, and triggers built-in registration.

export {
  type SenseProtocolDefinition,
  type SenseTriggerOption,
  type SenseConfigField,
  registerSenseProtocol,
  getSenseProtocol,
  getAllSenseProtocols,
} from './protocol';

// Import builtin to trigger side-effect registration
import './builtin';
