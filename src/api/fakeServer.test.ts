import { describe, expect, it, vi } from 'vitest';
import { createFakeServer } from './fakeServer';
import { generateDeals } from './seed';
import { ApiError, type UpdateDealRequest } from './types';

function setup() {
  const deals = generateDeals({ count: 5, seed: 1, now: 0 });
  const server = createFakeServer(deals);
  const deal = deals[0]!;
  const request: UpdateDealRequest = {
    id: deal.id,
    patch: { stage: 'won' },
    expectedVersion: 1,
    idempotencyKey: 'key-1',
    actor: 'Priya',
  };
  return { server, deal, request };
}

describe('fakeServer', () => {
  it('applies an update, bumps the version and emits an event', () => {
    const { server, request } = setup();
    const listener = vi.fn();
    server.onChange(listener);

    const updated = server.update(request);

    expect(updated).toMatchObject({ stage: 'won', version: 2, updatedBy: 'Priya' });
    expect(server.get(request.id)).toBe(updated);
    expect(listener).toHaveBeenCalledWith({ type: 'deal.updated', deal: updated, actor: 'Priya' });
  });

  it('rejects a stale expectedVersion as a conflict and returns the current deal', () => {
    const { server, request } = setup();
    server.applyTeammateEdit(request.id, { stage: 'lost' }, 'Rahul');

    const error = catchError(() => server.update(request));

    expect(error).toMatchObject({ kind: 'conflict', current: { stage: 'lost', version: 2 } });
  });

  it('returns the first result for a repeated idempotency key without applying twice', () => {
    const { server, request } = setup();

    const first = server.update(request);
    const retry = server.update(request);

    expect(retry).toBe(first);
    expect(server.get(request.id)?.version).toBe(2);
  });

  it('reports unknown deals as not_found', () => {
    const { server, request } = setup();
    expect(catchError(() => server.update({ ...request, id: 'nope' }))).toMatchObject({
      kind: 'not_found',
    });
  });

  it('bulk update returns a result per deal, including conflicts', () => {
    const { server } = setup();
    const [a, b] = server.list();
    server.applyTeammateEdit(b!.id, { value: 1000 }, 'Rahul');

    const results = server.updateMany({
      items: [
        { id: a!.id, expectedVersion: 1 },
        { id: b!.id, expectedVersion: 1 },
        { id: 'nope', expectedVersion: 1 },
      ],
      patch: { stage: 'lost' },
      idempotencyKey: 'bulk-1',
      actor: 'Priya',
    });

    expect(results.map((result) => (result.ok ? 'ok' : result.reason))).toEqual([
      'ok',
      'conflict',
      'not_found',
    ]);
  });

  it('returns frozen records so callers cannot mutate server state', () => {
    const { server, deal } = setup();
    expect(Object.isFrozen(server.get(deal.id))).toBe(true);
  });
});

function catchError(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected an ApiError');
}
