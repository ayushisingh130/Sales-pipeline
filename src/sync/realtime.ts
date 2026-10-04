import type { DealEvent, PipelineApi } from '../api/types';
import { CURRENT_USER } from '../domain/team';
import type { PipelineStore } from './store';

export const FLUSH_INTERVAL_MS = 300;

interface RealtimeOptions {
  api: PipelineApi;
  store: PipelineStore;
  self?: string;
  flushMs?: number;
}

/**
 * Listens to pushed changes and applies them in batches: at most one store update per ~300ms,
 * however many events arrive. Start it *before* the first load: events that arrive while loading
 * are held, then applied on top of the listing (stale versions are dropped), so nothing that
 * happens between the listing and the subscription is lost.
 * Returns a stop function.
 */
export function startRealtime({
  api,
  store,
  self = CURRENT_USER,
  flushMs = FLUSH_INTERVAL_MS,
}: RealtimeOptions): () => void {
  let buffer: DealEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = () => {
    timer ??= setTimeout(flush, flushMs);
  };

  function flush() {
    timer = undefined;
    if (store.getState().load.status !== 'ready') {
      schedule();
      return;
    }
    const events = buffer;
    buffer = [];
    store.getState().applyEvents(events, self);
  }

  const unsubscribe = api.subscribe((event) => {
    buffer.push(event);
    schedule();
  });

  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
