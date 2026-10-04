import { describe, expect, it } from 'vitest';
import { makeDeal } from '../test/factories';
import { DEFAULT_QUERY, selectIds, summarizeStages, type Query } from './query';
import { DAY_MS } from './time';

const NOW = 1_000 * DAY_MS;
const fresh = { closeDate: NOW + 60 * DAY_MS, lastActivityAt: NOW };
const ALL: Query = { ...DEFAULT_QUERY, owner: 'anyone', stage: 'all', sort: 'value' };

describe('selectIds', () => {
  const mine = makeDeal({ ...fresh, company: 'Acme Corp', value: 300 });
  const theirs = makeDeal({ ...fresh, owner: 'Rahul', value: 200 });
  const won = makeDeal({ ...fresh, stage: 'won', value: 100 });
  const overdue = makeDeal({ ...fresh, closeDate: NOW - DAY_MS, value: 50 });
  const deals = [won, theirs, overdue, mine];

  it('filters by owner, open stages, a single stage, search and overdue', () => {
    expect(selectIds(deals, { ...ALL, owner: 'me' }, NOW)).toEqual([mine.id, won.id, overdue.id]);
    expect(selectIds(deals, { ...ALL, stage: 'open' }, NOW)).not.toContain(won.id);
    expect(selectIds(deals, { ...ALL, stage: 'won' }, NOW)).toEqual([won.id]);
    expect(selectIds(deals, { ...ALL, search: '  ACME ' }, NOW)).toEqual([mine.id]);
    expect(selectIds(deals, { ...ALL, search: 'rahul' }, NOW)).toEqual([theirs.id]);
    expect(selectIds(deals, { ...ALL, overdueOnly: true }, NOW)).toEqual([overdue.id]);
  });

  it('sorts by attention score first, then value', () => {
    const urgentSmall = makeDeal({ closeDate: NOW - DAY_MS, lastActivityAt: NOW, value: 10 });
    const urgentLarge = makeDeal({ closeDate: NOW - DAY_MS, lastActivityAt: NOW, value: 20 });
    const calm = makeDeal({ ...fresh, value: 1_000 });

    expect(selectIds([calm, urgentSmall, urgentLarge], { ...ALL, sort: 'attention' }, NOW)).toEqual(
      [urgentLarge.id, urgentSmall.id, calm.id],
    );
  });

  it('supports the other sort orders', () => {
    const a = makeDeal({ company: 'Beta', closeDate: 2, lastActivityAt: 1, value: 1 });
    const b = makeDeal({ company: 'alpha', closeDate: 1, lastActivityAt: 2, value: 2 });

    expect(selectIds([a, b], { ...ALL, sort: 'value' }, NOW)).toEqual([b.id, a.id]);
    expect(selectIds([a, b], { ...ALL, sort: 'closeDate' }, NOW)).toEqual([b.id, a.id]);
    expect(selectIds([a, b], { ...ALL, sort: 'lastActivity' }, NOW)).toEqual([a.id, b.id]);
    expect(selectIds([a, b], { ...ALL, sort: 'company' }, NOW)).toEqual([b.id, a.id]);
  });
});

describe('summarizeStages', () => {
  it('counts every stage under the other filters, ignoring the stage filter', () => {
    const deals = [
      makeDeal({ ...fresh, stage: 'contacted', value: 10 }),
      makeDeal({ ...fresh, stage: 'contacted', value: 20 }),
      makeDeal({ ...fresh, stage: 'lost', value: 5 }),
      makeDeal({ ...fresh, stage: 'contacted', owner: 'Rahul' }),
    ];

    const summary = summarizeStages(deals, { ...ALL, owner: 'me', stage: 'lost' }, NOW);

    expect(summary.contacted).toEqual({ count: 2, value: 30 });
    expect(summary.open).toEqual({ count: 2, value: 30 });
    expect(summary.all).toEqual({ count: 3, value: 35 });
  });
});
