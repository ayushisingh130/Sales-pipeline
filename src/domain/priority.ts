import type { Deal } from '../api/types';
import { isClosed } from './stages';
import { daysBetween } from './time';

export type ReasonKind = 'overdue' | 'closing_soon' | 'stale' | 'high_value';

export interface AttentionReason {
  kind: ReasonKind;
  label: string;
  weight: number;
}

export const CLOSING_SOON_DAYS = 7;
export const STALE_DAYS = 14;
const VERY_STALE_DAYS = 30;
export const HIGH_VALUE_INR = 30_00_000;

/**
 * Why an open deal needs attention, most urgent first. The score is the sum of the weights,
 * so the order in the list can always be explained by the chips shown on the row.
 */
export function attentionReasons(deal: Deal, now: number): AttentionReason[] {
  if (isClosed(deal.stage)) return [];
  const reasons: AttentionReason[] = [];

  const daysToClose = daysBetween(now, deal.closeDate);
  if (daysToClose < 0) {
    reasons.push({ kind: 'overdue', label: `Overdue ${-daysToClose}d`, weight: 3 });
  } else if (daysToClose <= CLOSING_SOON_DAYS) {
    const label = daysToClose === 0 ? 'Closes today' : `Closes in ${daysToClose}d`;
    reasons.push({ kind: 'closing_soon', label, weight: 2 });
  }

  const idleDays = daysBetween(deal.lastActivityAt, now);
  if (idleDays >= STALE_DAYS) {
    const weight = idleDays >= VERY_STALE_DAYS ? 3 : 2;
    reasons.push({ kind: 'stale', label: `No activity ${idleDays}d`, weight });
  }

  if (deal.value >= HIGH_VALUE_INR) {
    reasons.push({ kind: 'high_value', label: 'High value', weight: 1 });
  }

  return reasons.sort((a, b) => b.weight - a.weight);
}

export function attentionScore(deal: Deal, now: number): number {
  return attentionReasons(deal, now).reduce((score, reason) => score + reason.weight, 0);
}
