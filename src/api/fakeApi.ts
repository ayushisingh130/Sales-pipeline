import { createFakeServer } from './fakeServer';
import { createNetwork } from './network';
import { randomBetween, type Rng } from './random';
import type { SimConfigStore } from './simConfig';
import { createTeammates, type Teammates } from './teammates';
import type { Deal, DealEvent, PipelineApi } from './types';

export interface FakeApi extends PipelineApi {
  teammates: Teammates;
  dispose(): void;
}

export interface FakeApiOptions {
  deals: readonly Deal[];
  config: SimConfigStore;
  rng: Rng;
}

/** Composition root: server + network + teammates, exposed through the PipelineApi interface. */
export function createFakeApi({ deals, config, rng }: FakeApiOptions): FakeApi {
  const getConfig = () => config.getState();
  const server = createFakeServer(deals);
  const network = createNetwork(getConfig, rng);
  const teammates = createTeammates(server, getConfig, rng);

  const listeners = new Set<(event: DealEvent) => void>();
  const heldWhileOffline: DealEvent[] = [];

  // Each event gets its own latency, so events can arrive out of order, as they can over a real socket.
  function deliverLater(event: DealEvent) {
    const { eventLatencyMinMs, eventLatencyMaxMs } = getConfig();
    setTimeout(
      () => listeners.forEach((listener) => listener(event)),
      randomBetween(rng, eventLatencyMinMs, eventLatencyMaxMs),
    );
  }

  const stopServerFeed = server.onChange((event) => {
    if (getConfig().offline) heldWhileOffline.push(event);
    else deliverLater(event);
  });

  // When we come back online, the socket "resumes" and delivers the held events.
  const stopConfigWatch = config.subscribe((state, previous) => {
    if (previous.offline && !state.offline) heldWhileOffline.splice(0).forEach(deliverLater);
  });

  /** Lets the simulator make a teammate edit "win the race" against our save, causing a conflict. */
  function maybeRaceTeammate(id: string) {
    if (rng() < getConfig().conflictRate) teammates.editDeal(id);
  }

  return {
    listDeals: (options) => network.request(() => server.list(), options),

    updateDeal: (request, options) =>
      network.request(() => {
        maybeRaceTeammate(request.id);
        return server.update(request);
      }, options),

    updateDeals: (request, options) =>
      network.request(() => {
        request.items.forEach((item) => maybeRaceTeammate(item.id));
        return server.updateMany(request);
      }, options),

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    teammates,

    dispose() {
      teammates.stop();
      stopServerFeed();
      stopConfigWatch();
      listeners.clear();
    },
  };
}
