import { createContext, useContext, useMemo } from 'react';
import { useStore } from 'zustand';
import { createFakeApi } from './api/fakeApi';
import { generateDeals } from './api/seed';
import { createSimConfigStore, simConfigFromUrl, type SimConfigStore } from './api/simConfig';
import type { Teammates } from './api/teammates';
import type { Deal, PipelineApi } from './api/types';
import { createMutations, type Mutations } from './sync/mutations';
import {
  createPipelineStore,
  viewDeal,
  type PipelineState,
  type PipelineStore,
} from './sync/store';

/** Everything the UI needs, injected through context so tests can supply their own. */
export interface Services {
  api: PipelineApi;
  store: PipelineStore;
  mutations: Mutations;
  /** Controls for the dev panel. The app itself only talks to `api`. */
  simulator: { config: SimConfigStore; teammates: Teammates };
}

export function createServices(): Services {
  const config = createSimConfigStore(simConfigFromUrl(window.location.search));
  // The data uses a fixed seed (reproducible demos); network failures use real randomness.
  const fakeApi = createFakeApi({ deals: generateDeals(), config, rng: Math.random });
  const store = createPipelineStore();
  return {
    api: fakeApi,
    store,
    mutations: createMutations({ api: fakeApi, store }),
    simulator: { config, teammates: fakeApi.teammates },
  };
}

export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices() must be used inside <ServicesContext.Provider>');
  return services;
}

export function usePipeline<T>(selector: (state: PipelineState) => T): T {
  return useStore(useServices().store, selector);
}

/** Subscribes to a single deal, so a change to another deal doesn't re-render this component. */
export function useDeal(id: string): Deal | undefined {
  const deal = usePipeline((state) => state.server.get(id));
  const pending = usePipeline((state) => state.pending.get(id));
  return useMemo(() => deal && viewDeal(deal, pending), [deal, pending]);
}
