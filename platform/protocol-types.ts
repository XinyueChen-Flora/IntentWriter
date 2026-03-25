// ─── Unified Protocol Types ───
//
// Shared by Sense and Negotiate protocols.
// The two building blocks:
//   - ProtocolStep: one thing in a sequence (run function, show result, render actions)
//   - ProtocolAction: a button the user can click (continue, goto, trigger sub-steps)
//
// All "doing" is in Functions. Protocols only orchestrate.

// ─── Step ───

export type StepDispatch =
  | {
      type: 'cross-section';
      /** Field on result.data that contains an array of items per section */
      collection: string;
      /** Property on each item referencing the target sectionId */
      sectionField: string;
    };

export type ProtocolStep = {
  /** Step ID — target for goto branching */
  id?: string;

  /** Run a registered function. The function's display bindings handle all rendering. */
  run?: string;

  /** Show the stored result of a previously-run function (no re-execution). */
  show?: string;

  /** Parameters to pass to the function (supports {{config.xxx}} and {{prev.field}} templates). */
  params?: Record<string, string>;

  /** Condition: only execute this step if true (references prior function outputs, e.g. 'check-drift.drift != "none"'). */
  when?: string;

  /** Action buttons to show after this step's content. */
  actions?: ProtocolAction[];

  /** Dispatch instructions (e.g., cross-section impacts). Experimental. */
  dispatch?: StepDispatch;
};

// ─── Action ───

export type ProtocolAction = {
  /** Action identifier */
  id?: string;

  /** Button label */
  label: string;

  /** Continue to the next step in sequence */
  continue?: boolean;

  /** Jump to a named step (by step.id) */
  goto?: string;

  /** Exit the protocol and enter the Gate */
  gate?: boolean;

  /** Stop the protocol (dismiss / cancel) */
  stop?: boolean;

  /** Execute a sub-sequence of steps when this action is clicked
   *  (e.g., counter-propose: fill text → run assess-impact → run preview) */
  steps?: ProtocolStep[];

  /** Role filter: only users with these roles see this action.
   *  If omitted, everyone sees it. */
  who?: string[];
};
