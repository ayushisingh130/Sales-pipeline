import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRENT_USER } from '../domain/team';
import { createFakeServer } from './fakeServer';
import { createRng } from './random';
import { generateDeals } from './seed';
import { createSimConfigStore, type SimConfig } from './simConfig';
import { createTeammates } from './teammates';

function setup(overrides: Partial<SimConfig> = {}) {
  const config = createSimConfigStore(overrides);
  const server = createFakeServer(generateDeals({ count: 50, seed: 1, now: 0 }));
  const teammates = createTeammates(server, () => config.getState(), createRng(3));
  const edits = vi.fn();
  server.onChange(edits);
  return { config, server, teammates, edits };
}

describe('teammates', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('edits deals at the configured rate, never as the current user', () => {
    const { teammates, edits } = setup({ teammateRate: 5 });
    teammates.start();

    vi.advanceTimersByTime(1000);

    expect(edits).toHaveBeenCalledTimes(5);
    for (const [event] of edits.mock.calls) expect(event.actor).not.toBe(CURRENT_USER);
  });

  it('makes no edits while paused', () => {
    const { teammates, edits } = setup({ teammateRate: 5, teammatesPaused: true });
    teammates.start();

    vi.advanceTimersByTime(1000);

    expect(edits).not.toHaveBeenCalled();
  });

  it('only edits visible deals when targeting visible rows', () => {
    const { teammates, server, edits } = setup({ teammateRate: 10, targetVisibleRows: true });
    const visible = server.ids().slice(0, 3);
    teammates.setVisibleIds(() => visible);
    teammates.start();

    vi.advanceTimersByTime(1000);

    expect(edits).toHaveBeenCalledTimes(10);
    for (const [event] of edits.mock.calls) expect(visible).toContain(event.deal.id);
  });
});
