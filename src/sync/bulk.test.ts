import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApi } from '../api/fakeApi';
import { createRng } from '../api/random';
import { generateDeals } from '../api/seed';
import { createSimConfigStore, type SimConfig } from '../api/simConfig';
import type { PipelineApi } from '../api/types';
import { ALL_DEALS } from '../domain/query';
import { isClosed } from '../domain/stages';
import { createMutations } from './mutations';
import { createPipelineStore } from './store';

/** 100ms requests; the API is wrapped to measure how many bulk requests are in flight at once. */
function setup(count: number, config: Partial<SimConfig> = {}) {
  const deals = generateDeals({ count: count * 2, seed: 3, now: 0 });
  const simConfig = createSimConfigStore({
    latencyMinMs: 100,
    latencyMaxMs: 100,
    timeoutHangMs: 10_000,
    eventLatencyMinMs: 0,
    eventLatencyMaxMs: 0,
    ...config,
  });
  const fakeApi = createFakeApi({ deals, config: simConfig, rng: createRng(1) });

  let inFlight = 0;
  let maxInFlight = 0;
  const api: PipelineApi = {
    ...fakeApi,
    updateDeals: async (...args) => {
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      try {
        return await fakeApi.updateDeals(...args);
      } finally {
        inFlight -= 1;
      }
    },
  };

  const store = createPipelineStore();
  store.getState().receiveDeals(deals);
  store.getState().setQuery(ALL_DEALS);
  const mutations = createMutations({ api, store, rng: () => 0.5 });
  // Open deals only, so none of them is already at the target stage (those are skipped).
  const ids = deals
    .filter((deal) => !isClosed(deal.stage))
    .slice(0, count)
    .map((deal) => deal.id);
  const job = () => store.getState().jobs[0]!;
  return { store, mutations, ids, job, simConfig, maxInFlight: () => maxInFlight };
}

describe('bulk moves', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moves 3,000 deals at a 10% failure rate: 3 requests at a time, and a summary that adds up', async () => {
    const t = setup(3000, { failureRate: 0.1 });
    t.mutations.moveDeals(t.ids, 'lost');

    // Optimistic: every deal shows as Lost straight away.
    expect(t.store.getState().view.columns.lost).toEqual(expect.arrayContaining(t.ids));
    expect(t.job()).toMatchObject({ total: 3000, status: 'running' });

    await vi.advanceTimersByTimeAsync(60_000);

    const { saved, failed, conflicts, status } = t.job();
    expect(status).toBe('finished');
    expect(saved + failed + conflicts).toBe(3000);
    expect(t.store.getState().pending.size).toBe(failed + conflicts);
    const server = t.store.getState().server;
    expect(t.ids.filter((id) => server.get(id)?.stage === 'lost')).toHaveLength(saved);
    expect(t.maxInFlight()).toBe(3);
  });

  it('marks a chunk failed after its retries, and "Retry failed" resends only those deals', async () => {
    const t = setup(500, { failureRate: 1, failureMix: { network: 1, server: 0, timeout: 0 } });
    t.mutations.moveDeals(t.ids, 'won');
    await vi.advanceTimersByTimeAsync(30_000);

    expect(t.job()).toMatchObject({ status: 'finished', saved: 0, failed: 500 });
    expect(t.store.getState().pending.get(t.ids[0]!)?.status).toBe('failed');
    // Still shown where the user put them, marked not saved.
    expect(t.store.getState().view.columns.won).toEqual(expect.arrayContaining(t.ids));

    t.simConfig.setState({ failureRate: 0 });
    t.mutations.retryJob(t.job().id);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(t.job()).toMatchObject({ status: 'finished', saved: 500, failed: 0 });
    expect(t.store.getState().pending.size).toBe(0);
  });

  it('cancel stops sending further chunks and puts the unsent deals back', async () => {
    const t = setup(1000, { failureRate: 0 });
    const originalStage = t.store.getState().view.stageOf.get(t.ids.at(-1)!);
    t.mutations.moveDeals(t.ids, 'won');
    t.mutations.cancelJob(t.job().id);
    await vi.advanceTimersByTimeAsync(10_000);

    // Three chunks of 200 were already in flight and finish; the other two are never sent.
    expect(t.job()).toMatchObject({ status: 'cancelled', saved: 600, cancelled: 400 });
    expect(t.store.getState().pending.size).toBe(0);
    expect(t.store.getState().view.stageOf.get(t.ids.at(-1)!)).toBe(originalStage);
  });
});
