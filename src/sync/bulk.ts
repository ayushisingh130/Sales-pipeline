import type { BulkItemResult, Deal, PipelineApi } from '../api/types';
import { formatCount } from '../domain/format';
import { STAGE_LABELS, type Stage } from '../domain/stages';
import {
  backoffMs,
  errorMessage,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  sleep,
  withTimeout,
} from './retry';
import { getViewDeal, type BulkJob, type PendingChange, type PipelineStore } from './store';

export const CHUNK_SIZE = 200;
export const CONCURRENCY = 3;

export interface BulkMover {
  start(ids: readonly string[], stage: Stage): void;
  /** Stops sending further chunks. Chunks already in flight finish; unsent deals revert. */
  cancel(jobId: string): void;
  retryFailed(jobId: string): void;
  dismiss(jobId: string): void;
}

interface BulkOptions {
  api: PipelineApi;
  store: PipelineStore;
  actor: string;
  rng: () => number;
}

/**
 * Moves thousands of deals: optimistic overlays for all of them at once, then chunks of 200 with
 * 3 in flight. A chunk that fails is retried as a whole (same idempotency key). A chunk that
 * succeeds can still report per-deal conflicts. The UI never waits on any of this.
 */
export function createBulkMover({ api, store, actor, rng }: BulkOptions): BulkMover {
  const cancelled = new Set<string>();
  const state = () => store.getState();
  const jobOf = (jobId: string) => state().jobs.find((job) => job.id === jobId);
  const updateJob = (jobId: string, changes: (job: BulkJob) => Partial<BulkJob>) => {
    const job = jobOf(jobId);
    if (job) state().upsertJob({ ...job, ...changes(job) });
  };
  /** The change still belongs to this job, i.e. the user hasn't moved the deal again since. */
  const ownedBy = (jobId: string, id: string) => {
    const change = state().pending.get(id);
    return change?.jobId === jobId ? change : undefined;
  };

  function start(ids: readonly string[], stage: Stage) {
    const current = state();
    const jobId = crypto.randomUUID();
    const entries: [string, PendingChange][] = [];
    for (const id of new Set(ids)) {
      const server = current.server.get(id);
      if (!server || getViewDeal(current, id)?.stage === stage) continue;
      entries.push([
        id,
        {
          mutationId: crypto.randomUUID(),
          patch: { stage },
          baseVersion: server.version,
          status: 'saving',
          attempts: 0,
          jobId,
        },
      ]);
    }
    if (entries.length === 0) return;

    const moved = entries.map(([id]) => id);
    current.patchPending(entries);
    current.placeOwnChanges(moved);
    current.upsertJob({
      id: jobId,
      stage,
      total: moved.length,
      saved: 0,
      failed: 0,
      conflicts: 0,
      cancelled: 0,
      status: 'running',
    });
    void run(jobId, stage, moved);
  }

  async function run(jobId: string, stage: Stage, ids: readonly string[]) {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) chunks.push(ids.slice(i, i + CHUNK_SIZE));

    let next = 0;
    const worker = async () => {
      while (next < chunks.length && !cancelled.has(jobId))
        await sendChunk(jobId, stage, chunks[next++]!);
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));

    if (cancelled.delete(jobId)) revertUnsent(jobId, chunks.slice(next).flat());
    finish(jobId);
  }

  async function sendChunk(jobId: string, stage: Stage, ids: readonly string[]) {
    // One key per chunk, reused by its retries: a chunk whose response was lost can't apply twice.
    const idempotencyKey = crypto.randomUUID();
    for (let failures = 0; ;) {
      const items = ids.flatMap((id) => {
        const change = ownedBy(jobId, id);
        return change ? [{ id, expectedVersion: change.baseVersion }] : [];
      });
      if (items.length === 0) return;

      try {
        const results = await withTimeout(
          (signal) =>
            api.updateDeals({ items, patch: { stage }, idempotencyKey, actor }, { signal }),
          REQUEST_TIMEOUT_MS,
        );
        applyResults(jobId, stage, results);
        return;
      } catch (error) {
        // The bulk endpoint reports conflicts per deal, so a failed request is always transient.
        failures += 1;
        if (failures < MAX_ATTEMPTS) {
          await sleep(backoffMs(failures, rng));
          continue;
        }
        const failed = items.flatMap(({ id }) => {
          const change = ownedBy(jobId, id);
          return change
            ? [
                [
                  id,
                  { ...change, status: 'failed', attempts: failures, error: errorMessage(error) },
                ] as const,
              ]
            : [];
        });
        state().patchPending(failed);
        updateJob(jobId, (job) => ({ failed: job.failed + failed.length }));
        return;
      }
    }
  }

  function applyResults(jobId: string, stage: Stage, results: readonly BulkItemResult[]) {
    const serverDeals: Deal[] = [];
    const entries: [string, PendingChange | null][] = [];
    const gone: string[] = [];
    let saved = 0;
    let conflicts = 0;

    for (const result of results) {
      const change = ownedBy(jobId, result.id);
      if (result.ok) {
        saved += 1;
        serverDeals.push(result.deal);
        if (change) entries.push([result.id, null]);
      } else if (result.reason === 'conflict') {
        serverDeals.push(result.current);
        // A teammate already put it where we wanted it: nothing to resolve.
        if (result.current.stage === stage) {
          saved += 1;
          if (change) entries.push([result.id, null]);
        } else {
          conflicts += 1;
          const error = `${result.current.updatedBy} changed this deal first`;
          if (change) entries.push([result.id, { ...change, status: 'conflict', error }]);
        }
      } else {
        gone.push(result.id);
        if (change) entries.push([result.id, null]);
      }
    }

    state().setServerDeals(serverDeals);
    state().patchPending(entries);
    if (gone.length) state().placeOwnChanges(gone);
    updateJob(jobId, (job) => ({ saved: job.saved + saved, conflicts: job.conflicts + conflicts }));
  }

  function revertUnsent(jobId: string, ids: readonly string[]) {
    const unsent = ids.filter((id) => ownedBy(jobId, id));
    state().patchPending(unsent.map((id) => [id, null] as const));
    state().placeOwnChanges(unsent);
    updateJob(jobId, (job) => ({ cancelled: job.cancelled + unsent.length, status: 'cancelled' }));
  }

  function finish(jobId: string) {
    updateJob(jobId, (job) => ({ status: job.status === 'running' ? 'finished' : job.status }));
    const job = jobOf(jobId);
    if (!job) return;
    const problems = [
      job.failed && `${formatCount(job.failed)} failed`,
      job.conflicts && `${formatCount(job.conflicts)} conflicts`,
      job.cancelled && `${formatCount(job.cancelled)} cancelled`,
    ].filter(Boolean);
    state().pushToast({
      tone: job.failed || job.conflicts ? 'error' : 'info',
      message: [
        `Moved ${formatCount(job.saved)} of ${formatCount(job.total)} deals to ${STAGE_LABELS[job.stage]}`,
        ...problems,
      ].join(' · '),
      action: job.failed ? { label: 'Retry failed', run: () => retryFailed(jobId) } : undefined,
    });
  }

  function retryFailed(jobId: string) {
    const job = jobOf(jobId);
    if (!job) return;
    const failed = Array.from(state().pending).filter(
      ([, change]) => change.jobId === jobId && change.status === 'failed',
    );
    if (failed.length === 0) return;
    state().patchPending(
      failed.map(([id, change]) => [
        id,
        { ...change, status: 'saving', attempts: 0, error: undefined },
      ]),
    );
    updateJob(jobId, (current) => ({ failed: current.failed - failed.length, status: 'running' }));
    void run(
      jobId,
      job.stage,
      failed.map(([id]) => id),
    );
  }

  return {
    start,
    cancel: (jobId) => {
      if (jobOf(jobId)?.status === 'running') cancelled.add(jobId);
    },
    retryFailed,
    dismiss: (jobId) => state().removeJob(jobId),
  };
}
