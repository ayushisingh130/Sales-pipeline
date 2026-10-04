import { createStore, type StoreApi } from 'zustand/vanilla';

export type FailureKind = 'network' | 'server' | 'timeout';

export interface SimConfig {
  latencyMinMs: number;
  latencyMaxMs: number;
  /** Share of requests that fail, 0–1. */
  failureRate: number;
  /**
   * Relative weights of the failure kinds:
   * - network/server: the request is not applied.
   * - timeout: the server applies the write, but the response arrives too late (a lost response).
   */
  failureMix: Record<FailureKind, number>;
  /** How long a timed-out response hangs. Longer than the client's own timeout. */
  timeoutHangMs: number;
  /** Every request fails with a network error. Push events are held until back online. */
  offline: boolean;

  /** Teammate edits per second. */
  teammateRate: number;
  teammatesPaused: boolean;
  /** Teammates edit the deals currently on screen, so their changes are visible in a demo. */
  targetVisibleRows: boolean;
  /** Chance, 0–1, that a teammate edits a deal just before our save for it reaches the server. */
  conflictRate: number;
  eventLatencyMinMs: number;
  eventLatencyMaxMs: number;
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  latencyMinMs: 300,
  latencyMaxMs: 1500,
  failureRate: 0.1,
  failureMix: { network: 0.4, server: 0.4, timeout: 0.2 },
  timeoutHangMs: 8000,
  offline: false,
  teammateRate: 1,
  teammatesPaused: false,
  targetVisibleRows: false,
  conflictRate: 0,
  eventLatencyMinMs: 100,
  eventLatencyMaxMs: 600,
};

export type SimConfigStore = StoreApi<SimConfig>;

/** A plain store (not a hook): the fake API reads it from outside React, and the dev panel binds to it. */
export function createSimConfigStore(overrides: Partial<SimConfig> = {}): SimConfigStore {
  return createStore<SimConfig>()(() => ({ ...DEFAULT_SIM_CONFIG, ...overrides }));
}

const NUMBER_PARAMS = {
  fail: 'failureRate',
  conflict: 'conflictRate',
  rate: 'teammateRate',
  minMs: 'latencyMinMs',
  maxMs: 'latencyMaxMs',
} as const;
const FLAG_PARAMS = {
  offline: 'offline',
  paused: 'teammatesPaused',
  visible: 'targetVisibleRows',
} as const;
const SHARES = new Set<keyof SimConfig>(['failureRate', 'conflictRate']);

/**
 * Settings from the URL, for reproducible demos: `?fail=0.4&rate=5&visible=1`.
 * Invalid values are ignored rather than trusted; shares are capped at 1.
 */
export function simConfigFromUrl(search: string): Partial<SimConfig> {
  const params = new URLSearchParams(search);
  const config: Partial<SimConfig> = {};
  for (const [param, key] of Object.entries(NUMBER_PARAMS)) {
    const raw = params.get(param);
    const value = raw === null || raw === '' ? NaN : Number(raw);
    if (Number.isFinite(value) && value >= 0)
      config[key] = SHARES.has(key) ? Math.min(1, value) : value;
  }
  for (const [param, key] of Object.entries(FLAG_PARAMS)) {
    const raw = params.get(param);
    if (raw !== null) config[key] = raw !== '0' && raw !== 'false';
  }
  return config;
}
