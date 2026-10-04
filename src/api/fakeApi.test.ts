import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_USER } from '../domain/team';
import { createFakeApi } from './fakeApi';
import { createRng } from './random';
import { generateDeals } from './seed';
import { createSimConfigStore, type SimConfig } from './simConfig';
import type { UpdateDealRequest } from './types';

/** Fixed latencies make the timing assertions exact. */
function setup(overrides: Partial<SimConfig> = {}) {
  const config = createSimConfigStore({
    latencyMinMs: 100,
    latencyMaxMs: 100,
    eventLatencyMinMs: 50,
    eventLatencyMaxMs: 50,
    timeoutHangMs: 1000,
    failureRate: 0,
    ...overrides,
  });
  const deals = generateDeals({ count: 20, seed: 1, now: 0 });
  const api = createFakeApi({ deals, config, rng: createRng(7) });
  const deal = deals[0]!;
  const request: UpdateDealRequest = {
    id: deal.id,
    patch: { stage: 'won' },
    expectedVersion: deal.version,
    idempotencyKey: 'key-1',
    actor: CURRENT_USER,
  };
  return { api, config, deal, request };
}

const onlyFailure = (kind: 'network' | 'server' | 'timeout'): Partial<SimConfig> => ({
  failureRate: 1,
  failureMix: { network: 0, server: 0, timeout: 0, [kind]: 1 },
});

async function versionOf(
  api: ReturnType<typeof setup>['api'],
  config: ReturnType<typeof setup>['config'],
  id: string,
) {
  config.setState({ failureRate: 0, offline: false });
  const listing = api.listDeals();
  await vi.advanceTimersByTimeAsync(100);
  return (await listing).find((deal) => deal.id === id)?.version;
}

describe('fakeApi', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the configured latency when nothing fails', async () => {
    const { api, request } = setup();
    const onSettled = vi.fn();
    void api.updateDeal(request).then(onSettled);

    await vi.advanceTimersByTimeAsync(99);
    expect(onSettled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onSettled).toHaveBeenCalledWith(expect.objectContaining({ stage: 'won', version: 2 }));
  });

  it.each(['network', 'server'] as const)(
    'a %s failure rejects without applying the write',
    async (kind) => {
      const { api, config, request } = setup(onlyFailure(kind));

      const assertion = expect(api.updateDeal(request)).rejects.toMatchObject({ kind });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;

      expect(await versionOf(api, config, request.id)).toBe(1);
    },
  );

  it('a timeout applies the write but loses the response; a retry with the same key is safe', async () => {
    const { api, config, request } = setup(onlyFailure('timeout'));

    const assertion = expect(api.updateDeal(request)).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(1100);
    await assertion;

    config.setState({ failureRate: 0 });
    const retry = api.updateDeal(request);
    await vi.advanceTimersByTimeAsync(100);
    // Not a conflict, and not applied a second time.
    expect(await retry).toMatchObject({ stage: 'won', version: 2 });
  });

  it('aborting a request rejects it as a timeout', async () => {
    const { api, request } = setup();
    const controller = new AbortController();

    const assertion = expect(
      api.updateDeal(request, { signal: controller.signal }),
    ).rejects.toMatchObject({
      kind: 'timeout',
    });
    controller.abort();
    await assertion;
  });

  it('a teammate winning the race causes a conflict that carries the current deal', async () => {
    const { api, request } = setup({ conflictRate: 1 });

    const assertion = expect(api.updateDeal(request)).rejects.toMatchObject({
      kind: 'conflict',
      current: { version: 2 },
    });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('pushes changes to subscribers after the event latency', async () => {
    const { api, deal } = setup();
    const listener = vi.fn();
    api.subscribe(listener);

    api.teammates.editDeal(deal.id);
    await vi.advanceTimersByTimeAsync(49);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    const event = listener.mock.calls[0]![0];
    expect(event.deal).toMatchObject({ id: deal.id, version: 2 });
    expect(event.actor).not.toBe(CURRENT_USER);
  });

  it('offline: requests fail and events are held until back online', async () => {
    const { api, config, deal, request } = setup({ offline: true });
    const listener = vi.fn();
    api.subscribe(listener);

    const assertion = expect(api.updateDeal(request)).rejects.toMatchObject({ kind: 'network' });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;

    api.teammates.editDeal(deal.id);
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).not.toHaveBeenCalled();

    config.setState({ offline: false });
    await vi.advanceTimersByTimeAsync(50);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
