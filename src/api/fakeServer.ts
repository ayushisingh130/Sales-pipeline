import {
  ApiError,
  type BulkItemResult,
  type BulkUpdateRequest,
  type Deal,
  type DealEvent,
  type UpdateDealRequest,
} from './types';

/** What a teammate may change. Wider than DealPatch: teammates edit fields we don't expose yet. */
export type TeammateChanges = Partial<Pick<Deal, 'stage' | 'value' | 'owner'>>;

/**
 * The in-memory "database". It runs synchronously with no latency or failures; network.ts adds those.
 * Records are frozen and replaced on every write, so they can be returned without copying.
 */
export interface FakeServer {
  list(): Deal[];
  get(id: string): Deal | undefined;
  ids(): readonly string[];
  /** Throws ApiError `conflict` or `not_found`. */
  update(request: UpdateDealRequest): Deal;
  updateMany(request: BulkUpdateRequest): BulkItemResult[];
  /** A teammate's write. No version check: it represents a change that already won on the server. */
  applyTeammateEdit(id: string, changes: TeammateChanges, actor: string): Deal | undefined;
  onChange(listener: (event: DealEvent) => void): () => void;
}

type StoredResult = { ok: true; value: unknown } | { ok: false; error: ApiError };

export function createFakeServer(initialDeals: readonly Deal[]): FakeServer {
  const deals = new Map(initialDeals.map((deal) => [deal.id, Object.freeze({ ...deal })]));
  const ids = initialDeals.map((deal) => deal.id);
  const resultsByKey = new Map<string, StoredResult>();
  const listeners = new Set<(event: DealEvent) => void>();

  function write(current: Deal, changes: Partial<Deal>, actor: string): Deal {
    const now = Date.now();
    const next = Object.freeze({
      ...current,
      ...changes,
      version: current.version + 1,
      updatedAt: now,
      updatedBy: actor,
      lastActivityAt: now,
    });
    deals.set(next.id, next);
    for (const listener of listeners) listener({ type: 'deal.updated', deal: next, actor });
    return next;
  }

  /** Idempotency: a repeated key gets the first outcome back (success or error) without running again. */
  function once<T>(key: string, run: () => T): T {
    const stored = resultsByKey.get(key);
    if (stored) {
      if (stored.ok) return stored.value as T;
      throw stored.error;
    }
    try {
      const value = run();
      resultsByKey.set(key, { ok: true, value });
      return value;
    } catch (error) {
      if (error instanceof ApiError) resultsByKey.set(key, { ok: false, error });
      throw error;
    }
  }

  return {
    list: () => Array.from(deals.values()),
    get: (id) => deals.get(id),
    ids: () => ids,

    update: (request) =>
      once(request.idempotencyKey, () => {
        const current = deals.get(request.id);
        if (!current) throw new ApiError('not_found', `Deal ${request.id} not found`);
        if (current.version !== request.expectedVersion) {
          throw new ApiError(
            'conflict',
            `Deal ${request.id} was changed by ${current.updatedBy}`,
            current,
          );
        }
        return write(current, request.patch, request.actor);
      }),

    updateMany: (request) =>
      once(request.idempotencyKey, () =>
        request.items.map(({ id, expectedVersion }): BulkItemResult => {
          const current = deals.get(id);
          if (!current) return { id, ok: false, reason: 'not_found' };
          if (current.version !== expectedVersion) {
            return { id, ok: false, reason: 'conflict', current };
          }
          return { id, ok: true, deal: write(current, request.patch, request.actor) };
        }),
      ),

    applyTeammateEdit(id, changes, actor) {
      const current = deals.get(id);
      return current && write(current, changes, actor);
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
