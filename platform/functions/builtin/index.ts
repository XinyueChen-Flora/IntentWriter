// ─── Built-in Functions ───
// Each file registers a function via side-effect import.

// Detection (run during/after writing)
import './check-drift';
import './detect-dependencies';

// Proposal (run when proposing a change)
import './assess-impact';
import './preview-writing-impact';
import './analyze-removal-impact';

// On-demand (invoked by user action)
import './simulate-comment';
import './generate-gap-suggestion';
