import { nextStage } from '../domain/stages';
import { TEAM, TEAMMATES } from '../domain/team';
import type { FakeServer, TeammateChanges } from './fakeServer';
import { pick, randomBetween, type Rng } from './random';
import type { SimConfig } from './simConfig';
import type { Deal } from './types';

export interface Teammates {
  start(): void;
  stop(): void;
  /** The UI tells us which deals are on screen, for the "target visible rows" option. */
  setVisibleIds(getIds: () => readonly string[]): void;
  /** One teammate edit, on the given deal or on one chosen at random. */
  editDeal(id?: string): Deal | undefined;
}

const TICK_MS = 100;

export function createTeammates(
  server: FakeServer,
  getConfig: () => SimConfig,
  rng: Rng,
): Teammates {
  let timer: ReturnType<typeof setInterval> | undefined;
  let credit = 0;
  let getVisibleIds: () => readonly string[] = () => [];

  function chooseDealId(): string {
    if (getConfig().targetVisibleRows) {
      const visible = getVisibleIds();
      if (visible.length > 0) return pick(rng, visible);
    }
    return pick(rng, server.ids());
  }

  function editDeal(id = chooseDealId()) {
    const deal = server.get(id);
    if (!deal) return undefined;
    return server.applyTeammateEdit(id, randomChange(deal, rng), pick(rng, TEAMMATES));
  }

  // Edits accumulate as fractional credit, so rates below 1 per tick (e.g. 0.5/s) still work.
  function tick() {
    const config = getConfig();
    if (config.teammatesPaused) {
      credit = 0;
      return;
    }
    credit += (config.teammateRate * TICK_MS) / 1000;
    while (credit >= 1) {
      credit -= 1;
      editDeal();
    }
  }

  return {
    start() {
      timer ??= setInterval(tick, TICK_MS);
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
    setVisibleIds(getIds) {
      getVisibleIds = getIds;
    },
    editDeal,
  };
}

/** Mostly stage moves, sometimes a value change, rarely a reassignment to another owner. */
export function randomChange(deal: Deal, rng: Rng): TeammateChanges {
  const roll = rng();
  const next = nextStage(deal.stage);
  if (roll < 0.6 && next) return { stage: rng() < 0.8 ? next : 'lost' };
  if (roll < 0.9 || !next) {
    return { value: Math.round((deal.value * randomBetween(rng, 0.7, 1.3)) / 1000) * 1000 };
  }
  const otherOwners = TEAM.filter((name) => name !== deal.owner);
  return { owner: pick(rng, otherOwners) };
}
