import { createFakeApi } from '../api/fakeApi';
import { createRng } from '../api/random';
import { generateDeals } from '../api/seed';
import { createSimConfigStore, type SimConfig } from '../api/simConfig';
import type { Deal } from '../api/types';
import { CURRENT_USER } from '../domain/team';
import type { Services } from '../services';
import { createMutations } from '../sync/mutations';
import { createPipelineStore } from '../sync/store';

let nextId = 1;

export function makeDeal(overrides: Partial<Deal> = {}): Deal {
  const id = `T-${String(nextId++).padStart(4, '0')}`;
  return {
    id,
    company: `Company ${id}`,
    licences: 10,
    value: 1_00_000,
    owner: CURRENT_USER,
    stage: 'contacted',
    closeDate: 0,
    lastActivityAt: 0,
    updatedAt: 0,
    updatedBy: CURRENT_USER,
    version: 1,
    ...overrides,
  };
}

/** Real services on a small dataset, with no latency or failures unless the test asks for them. */
export function createTestServices({
  deals = generateDeals({ count: 200, seed: 1 }),
  config = {},
}: { deals?: Deal[]; config?: Partial<SimConfig> } = {}): Services {
  const simConfig = createSimConfigStore({
    latencyMinMs: 0,
    latencyMaxMs: 0,
    failureRate: 0,
    eventLatencyMinMs: 0,
    eventLatencyMaxMs: 0,
    ...config,
  });
  const api = createFakeApi({ deals, config: simConfig, rng: createRng(1) });
  const store = createPipelineStore();
  return {
    api,
    store,
    // Constant jitter: backoff is exactly 1s, 2s, 4s.
    mutations: createMutations({ api, store, rng: () => 0.5 }),
    simulator: { config: simConfig, teammates: api.teammates },
  };
}
