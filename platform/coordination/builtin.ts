// ─── Built-in Coordination Paths ───
//
// Registers the 4 existing coordination paths into the platform.
// To add a new path: define a CoordinationPathDefinition and call registerCoordinationPath().
// See coordination-protocol.ts for the full type definition.

import { registerCoordinationPath, type CoordinationPathDefinition } from './protocol';

export const NOTIFY_PATH: CoordinationPathDefinition = {
  id: 'decided',
  name: 'Inform',
  description: 'Notify affected people, no approval needed.',
  icon: 'Bell',
  color: 'blue',
  roles: [
    { id: 'proposer', label: 'Proposer', description: 'The person who made the change', assignment: 'proposer' },
    { id: 'receiver', label: 'Receiver', description: 'People affected by the change', assignment: 'impacted-owners' },
  ],
  actions: [
    { id: 'acknowledge', label: 'Acknowledge', icon: 'Check', availableTo: ['receiver'], effect: 'acknowledge' },
    { id: 'escalate', label: 'Escalate', icon: 'ArrowUp', availableTo: ['receiver'], effect: 'escalate' },
  ],
  resolution: { type: 'immediate' },
  configFields: [
    {
      type: 'segment', key: 'notifyLevel', label: 'Notification level',
      options: [
        { value: 'skip', label: 'Silent' },
        { value: 'heads-up', label: 'Heads-up' },
        { value: 'notify', label: 'Notify' },
      ],
    },
  ],
  defaultConfig: { notifyLevel: 'heads-up' },
  proposerSummary: 'Changes apply immediately. Affected people are notified.',
  receiverSummary: 'You\'re being notified of a change.',
};

export const INPUT_PATH: CoordinationPathDefinition = {
  id: 'input',
  name: 'Ask for Input',
  description: 'Get feedback from affected section owners. One approval resolves.',
  icon: 'UserCheck',
  color: 'emerald',
  roles: [
    { id: 'proposer', label: 'Proposer', description: 'The person proposing the change', assignment: 'proposer' },
    { id: 'reviewer', label: 'Reviewer', description: 'Section owner who decides', assignment: 'impacted-owners' },
  ],
  actions: [
    { id: 'approve', label: 'Accept', icon: 'Check', availableTo: ['reviewer'], effect: 'approve' },
    { id: 'reject', label: 'Decline', icon: 'X', availableTo: ['reviewer'], effect: 'reject' },
    { id: 'response', label: 'Suggest changes', icon: 'Edit2', availableTo: ['reviewer'], effect: 'comment' },
  ],
  resolution: { type: 'single-approval' },
  configFields: [
    {
      type: 'segment', key: 'routeTo', label: 'Ask who',
      options: [
        { value: 'impacted-owners', label: 'Affected owners' },
        { value: 'all-members', label: 'Everyone' },
      ],
    },
  ],
  defaultConfig: { routeTo: 'impacted-owners', receiverActions: 'approve-suggest' },
  proposerSummary: 'Affected owners will review and decide.',
  receiverSummary: 'You\'re being asked to decide on a proposed change.',
};

export const VOTE_PATH: CoordinationPathDefinition = {
  id: 'negotiate',
  name: 'Team Vote',
  description: 'The team votes. Threshold determines outcome.',
  icon: 'Vote',
  color: 'indigo',
  roles: [
    { id: 'proposer', label: 'Proposer', description: 'The person proposing the change', assignment: 'proposer' },
    { id: 'voter', label: 'Voter', description: 'Team members who vote', assignment: 'impacted-owners' },
  ],
  actions: [
    { id: 'approve', label: 'Approve', icon: 'Check', availableTo: ['voter'], effect: 'approve' },
    { id: 'reject', label: 'Reject', icon: 'X', availableTo: ['voter'], effect: 'reject' },
  ],
  resolution: { type: 'threshold', thresholdOptions: ['any', 'majority', 'all'] },
  configFields: [
    {
      type: 'segment', key: 'voteThreshold', label: 'Approval threshold',
      options: [
        { value: 'any', label: 'Any one' },
        { value: 'majority', label: 'Majority' },
        { value: 'all', label: 'Unanimous' },
      ],
    },
    {
      type: 'segment', key: 'voters', label: 'Who votes',
      options: [
        { value: 'impacted-owners', label: 'Affected owners' },
        { value: 'all-members', label: 'Everyone' },
      ],
    },
  ],
  defaultConfig: { voteThreshold: 'majority', voters: 'impacted-owners' },
  proposerSummary: 'Team members will vote on this change.',
  receiverSummary: 'You\'re being asked to vote on a proposed change.',
};

export const DISCUSSION_PATH: CoordinationPathDefinition = {
  id: 'discussion',
  name: 'Discussion',
  description: 'Open conversation. Proposer wraps up when ready.',
  icon: 'MessagesSquare',
  color: 'amber',
  roles: [
    { id: 'proposer', label: 'Proposer', description: 'The person who started the discussion', assignment: 'proposer' },
    { id: 'participant', label: 'Participant', description: 'Team members in the discussion', assignment: 'impacted-owners' },
  ],
  actions: [
    { id: 'response', label: 'Reply', icon: 'Send', availableTo: ['participant', 'proposer'], effect: 'comment' },
    { id: 'approve', label: 'Apply Changes', icon: 'Check', availableTo: ['proposer'], effect: 'approve' },
    { id: 'reject', label: 'Drop It', icon: 'X', availableTo: ['proposer'], effect: 'reject' },
  ],
  resolution: { type: 'proposer-closes' },
  configFields: [
    {
      type: 'segment', key: 'participants', label: 'Who participates',
      options: [
        { value: 'impacted-owners', label: 'Affected owners' },
        { value: 'all-members', label: 'Everyone' },
      ],
    },
    {
      type: 'segment', key: 'closedBy', label: 'Who can close',
      options: [
        { value: 'proposer', label: 'Proposer' },
        { value: 'anyone', label: 'Anyone' },
        { value: 'consensus', label: 'Consensus' },
      ],
    },
  ],
  defaultConfig: { participants: 'impacted-owners', closedBy: 'proposer' },
  proposerSummary: 'Open a discussion. You\'ll wrap up when ready.',
  receiverSummary: 'You\'re invited to discuss a proposed change.',
};

export function registerBuiltinPaths(): void {
  registerCoordinationPath(NOTIFY_PATH);
  registerCoordinationPath(INPUT_PATH);
  registerCoordinationPath(VOTE_PATH);
  registerCoordinationPath(DISCUSSION_PATH);
}

registerBuiltinPaths();
