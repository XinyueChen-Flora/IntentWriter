// ─── Built-in Functions ───
// Each file registers a function via side-effect import.
// Paper defines 10 awareness functions + 1 on-demand.

// Detection (run during/after writing)
import './check-drift';
import './detect-dependencies';
import './check-cross-consistency';

// Proposal (run when proposing a change)
import './assess-impact';
import './preview-writing-impact';
import './analyze-removal-impact';
import './frame-proposal';
import './preview-alternatives';
import './preview-resolution-effect';
import './section-word-limit';

// On-demand (invoked by user action)
import './simulate-comment';
import './generate-gap-suggestion';

// Proposal data & resolution (used by negotiate protocols)
import './proposal-functions';

// Gate evaluation (used by gate protocols)
import './evaluate-gate';
import './render-route-choices';
