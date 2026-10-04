import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Deal, DealEvent, PipelineApi } from '../api/types';
import { makeDeal } from '../test/factories';
import { startRealtime } from './realtime';
import { createPipelineStore } from './store';

/** A push channel the test controls directly. */
function fakeChannel() {
  let listener: ((event: DealEvent) => void) | undefined;
  const api = {
    subscribe: (next: (event: DealEvent) => void) => {
      listener = next;
      return () => (listener = undefined);
    },
  } as unknown as PipelineApi;
  const push = (deal: Deal, actor = 'Rahul') => listener?.({ type: 'deal.updated', deal, actor });
  return { api, push };
}

function setup({ loaded = true } = {}) {
  const deal = makeDeal({ stage: 'contacted', closeDate: 1e15, lastActivityAt: 1e15 });
  const store = createPipelineStore();
  if (loaded) store.getState().receiveDeals([deal]);
  const channel = fakeChannel();
  const stop = startRealtime({ api: channel.api, store, self: 'Priya' });
  const updates = vi.fn();
  store.subscribe(updates);
  return { store, deal, stop, updates, ...channel };
}

describe('realtime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies a burst of events in a single store update', () => {
    const { store, deal, push, updates } = setup();
    for (let version = 2; version <= 20; version++) push({ ...deal, version, value: version });

    expect(updates).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(updates).toHaveBeenCalledTimes(1);
    expect(store.getState().server.get(deal.id)).toMatchObject({ version: 20, value: 20 });
  });

  it('ignores out-of-order (older) versions', () => {
    const { store, deal, push } = setup();
    push({ ...deal, version: 3, value: 3 });
    push({ ...deal, version: 2, value: 2 });
    vi.advanceTimersByTime(300);
    expect(store.getState().server.get(deal.id)).toMatchObject({ version: 3, value: 3 });
  });

  it("marks teammates' changes as remote, but not our own", () => {
    const { store, deal, push } = setup();
    const other = makeDeal();
    store.getState().receiveDeals([deal, other]);

    push({ ...deal, version: 2 }, 'Rahul');
    push({ ...other, version: 2 }, 'Priya');
    vi.advanceTimersByTime(300);

    expect([...store.getState().remoteChanges.keys()]).toEqual([deal.id]);
  });

  it('holds events that arrive while loading, then applies them on top of the listing', () => {
    const { store, deal, push } = setup({ loaded: false });
    push({ ...deal, version: 2, stage: 'won' });
    vi.advanceTimersByTime(1000);
    expect(store.getState().server.size).toBe(0);

    // The listing was taken before the change, so the held event is newer and wins.
    store.getState().receiveDeals([deal]);
    vi.advanceTimersByTime(300);
    expect(store.getState().server.get(deal.id)).toMatchObject({ version: 2, stage: 'won' });
  });

  it('a teammate change under my pending move keeps showing my move', () => {
    const { store, deal, push } = setup();
    store.getState().setPending(deal.id, {
      mutationId: 'm1',
      patch: { stage: 'won' },
      baseVersion: 1,
      status: 'saving',
      attempts: 0,
    });

    push({ ...deal, version: 2, value: 999 });
    vi.advanceTimersByTime(300);

    const shown = {
      ...store.getState().server.get(deal.id),
      ...store.getState().pending.get(deal.id)?.patch,
    };
    expect(shown).toMatchObject({ stage: 'won', value: 999 });
  });
});
