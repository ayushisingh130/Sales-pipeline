import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDeals } from '../api/seed';
import type { SimConfig } from '../api/simConfig';
import { isClosed } from '../domain/stages';
import { createTestServices } from '../test/factories';
import { getViewDeal } from './store';

/** 100ms saves; a lost response hangs well past the 4s client timeout. Backoff is exactly 1s, 2s. */
function setup(config: Partial<SimConfig> = {}) {
  const deals = generateDeals({ count: 20, seed: 1, now: 0 });
  const services = createTestServices({
    deals,
    config: { latencyMinMs: 100, latencyMaxMs: 100, timeoutHangMs: 10_000, ...config },
  });
  services.store.getState().receiveDeals(deals);
  const deal = deals.find((candidate) => !isClosed(candidate.stage))!;
  const state = () => services.store.getState();
  return {
    ...services,
    deal,
    pending: () => state().pending.get(deal.id),
    server: () => state().server.get(deal.id)!,
    shown: () => getViewDeal(state(), deal.id)!,
    setConfig: (changes: Partial<SimConfig>) => services.simulator.config.setState(changes),
  };
}

const onlyFailure = (kind: 'network' | 'timeout'): Partial<SimConfig> => ({
  failureRate: 1,
  failureMix: { network: 0, server: 0, timeout: 0, [kind]: 1 },
});

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('mutations', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a move immediately and clears the pending change once the server confirms it', async () => {
    const t = setup();
    t.mutations.moveDeal(t.deal.id, 'won');

    expect(t.shown().stage).toBe('won');
    expect(t.server().stage).toBe(t.deal.stage);
    expect(t.pending()?.status).toBe('saving');

    await advance(100);
    expect(t.pending()).toBeUndefined();
    expect(t.server()).toMatchObject({ stage: 'won', version: 2 });
  });

  it('retries transient failures with backoff, then marks the change as not saved', async () => {
    const t = setup(onlyFailure('network'));
    t.mutations.moveDeal(t.deal.id, 'won');

    await advance(100);
    expect(t.pending()).toMatchObject({ status: 'retrying', attempts: 1 });
    await advance(1000 + 100);
    expect(t.pending()).toMatchObject({ status: 'retrying', attempts: 2 });
    await advance(2000 + 100);
    expect(t.pending()).toMatchObject({ status: 'failed', attempts: 3, error: 'Network error' });
    // The user still sees what they asked for, marked as not saved.
    expect(t.shown().stage).toBe('won');
    expect(t.store.getState().toasts.at(-1)).toMatchObject({ tone: 'error' });

    t.setConfig({ failureRate: 0 });
    t.mutations.retry(t.deal.id);
    await advance(100);
    expect(t.pending()).toBeUndefined();
    expect(t.server().stage).toBe('won');
  });

  it('discarding a failed change goes back to the server version', async () => {
    const t = setup({ ...onlyFailure('network'), latencyMinMs: 0, latencyMaxMs: 0 });
    t.mutations.moveDeal(t.deal.id, 'won');
    await advance(1000 + 2000 + 10);
    expect(t.pending()?.status).toBe('failed');

    t.mutations.discard(t.deal.id);
    expect(t.pending()).toBeUndefined();
    expect(t.shown().stage).toBe(t.deal.stage);
  });

  it('retries a lost response safely: the same idempotency key, no double write, no false conflict', async () => {
    const t = setup(onlyFailure('timeout'));
    t.mutations.moveDeal(t.deal.id, 'won');

    // The server applies it at 100ms, but the response never arrives; the client gives up at 4s.
    await advance(4000);
    expect(t.pending()).toMatchObject({ status: 'retrying', error: 'Request aborted' });

    t.setConfig({ failureRate: 0 });
    await advance(1000 + 100);
    expect(t.pending()).toBeUndefined();
    expect(t.server()).toMatchObject({ stage: 'won', version: 2 });
  });

  it('a second move made while the first is in flight waits for it, then wins', async () => {
    const t = setup();
    t.mutations.moveDeal(t.deal.id, 'won');
    await advance(50);
    t.mutations.moveDeal(t.deal.id, 'lost');
    expect(t.shown().stage).toBe('lost');

    await advance(50);
    // The first save landed (v2); the second is rebased onto it rather than conflicting with it.
    expect(t.server()).toMatchObject({ stage: 'won', version: 2 });
    expect(t.pending()).toMatchObject({ patch: { stage: 'lost' }, baseVersion: 2 });

    await advance(100);
    expect(t.pending()).toBeUndefined();
    expect(t.server()).toMatchObject({ stage: 'lost', version: 3 });
  });

  it("a teammate's earlier change causes a conflict; applying mine resends on top of theirs", async () => {
    const t = setup({ conflictRate: 1 });
    t.mutations.moveDeal(t.deal.id, 'won');
    await advance(100);

    expect(t.pending()).toMatchObject({ status: 'conflict' });
    expect(t.server().version).toBe(2);
    expect(t.server().updatedBy).not.toBe('Priya');

    t.setConfig({ conflictRate: 0 });
    t.mutations.applyMine(t.deal.id);
    await advance(100);
    expect(t.pending()).toBeUndefined();
    expect(t.server()).toMatchObject({ stage: 'won', version: 3 });
  });

  it('keep theirs drops my change', async () => {
    const t = setup({ conflictRate: 1 });
    t.mutations.moveDeal(t.deal.id, 'won');
    await advance(100);

    t.mutations.keepTheirs(t.deal.id);
    expect(t.pending()).toBeUndefined();
    expect(t.shown()).toBe(t.server());
  });

  it('undo moves the deal back with a new save', async () => {
    const t = setup();
    t.mutations.moveDeal(t.deal.id, 'won');
    await advance(100);

    t.mutations.undo();
    expect(t.shown().stage).toBe(t.deal.stage);
    await advance(100);
    expect(t.server()).toMatchObject({ stage: t.deal.stage, version: 3 });
  });
});
