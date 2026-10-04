export const STAGES = [
  'new_lead',
  'contacted',
  'demo_done',
  'proposal_sent',
  'negotiation',
  'won',
  'lost',
] as const;

export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new_lead: 'New Lead',
  contacted: 'Contacted',
  demo_done: 'Demo Done',
  proposal_sent: 'Proposal Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

export function isClosed(stage: Stage): boolean {
  return stage === 'won' || stage === 'lost';
}

/** The next step forward in the funnel. Closed deals have none; Negotiation moves on to Won. */
export function nextStage(stage: Stage): Stage | undefined {
  if (isClosed(stage)) return undefined;
  return STAGES[STAGES.indexOf(stage) + 1];
}

/** One step back. Won and Lost both reopen into Negotiation. */
export function previousStage(stage: Stage): Stage | undefined {
  if (isClosed(stage)) return 'negotiation';
  return STAGES[STAGES.indexOf(stage) - 1];
}

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}
