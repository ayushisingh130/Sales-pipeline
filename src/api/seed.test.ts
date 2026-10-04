import { describe, expect, it } from 'vitest';
import { STAGES } from '../domain/stages';
import { DEFAULT_DEAL_COUNT, generateDeals } from './seed';

describe('generateDeals', () => {
  it('is deterministic for a given seed', () => {
    const options = { count: 500, seed: 7, now: 0 };
    expect(generateDeals(options)).toEqual(generateDeals(options));
    expect(generateDeals({ ...options, seed: 8 })).not.toEqual(generateDeals(options));
  });

  it('generates 50k unique deals, with some stages holding over 10k', () => {
    const deals = generateDeals({ now: 0 });

    expect(deals).toHaveLength(DEFAULT_DEAL_COUNT);
    expect(new Set(deals.map((deal) => deal.id)).size).toBe(DEFAULT_DEAL_COUNT);

    const perStage = Object.fromEntries(
      STAGES.map((stage) => [stage, deals.filter((deal) => deal.stage === stage).length]),
    );
    expect(perStage.new_lead).toBeGreaterThan(10_000);
    expect(perStage.lost).toBeGreaterThan(10_000);
    expect(deals.every((deal) => deal.value > 0 && deal.version === 1)).toBe(true);
  });
});
