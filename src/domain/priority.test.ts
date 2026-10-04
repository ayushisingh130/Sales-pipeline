import { describe, expect, it } from 'vitest';
import { makeDeal } from '../test/factories';
import { attentionReasons, attentionScore, HIGH_VALUE_INR } from './priority';
import { DAY_MS } from './time';

const NOW = 1_000 * DAY_MS;

describe('attentionReasons', () => {
  it('flags overdue, stale and high-value deals, most urgent first', () => {
    const deal = makeDeal({
      closeDate: NOW - 5 * DAY_MS,
      lastActivityAt: NOW - 40 * DAY_MS,
      value: HIGH_VALUE_INR,
    });

    expect(attentionReasons(deal, NOW).map((reason) => reason.label)).toEqual([
      'Overdue 5d',
      'No activity 40d',
      'High value',
    ]);
    expect(attentionScore(deal, NOW)).toBe(3 + 3 + 1);
  });

  it('flags deals closing within a week', () => {
    const today = makeDeal({ closeDate: NOW + DAY_MS / 2, lastActivityAt: NOW });
    const soon = makeDeal({ closeDate: NOW + 3 * DAY_MS, lastActivityAt: NOW });
    const later = makeDeal({ closeDate: NOW + 30 * DAY_MS, lastActivityAt: NOW });

    expect(attentionReasons(today, NOW)[0]?.label).toBe('Due today');
    expect(attentionReasons(soon, NOW)[0]?.label).toBe('Due in 3d');
    expect(attentionReasons(later, NOW)).toEqual([]);
  });

  it('never flags won or lost deals', () => {
    const deal = makeDeal({
      stage: 'lost',
      closeDate: 0,
      lastActivityAt: 0,
      value: HIGH_VALUE_INR,
    });
    expect(attentionReasons(deal, NOW)).toEqual([]);
  });
});
