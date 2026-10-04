import type { ApiError, PipelineApi } from '../api/types';
import { STAGE_LABELS, type Stage } from '../domain/stages';
import { createBulkMover } from './bulk';
import { CURRENT_USER } from '../domain/team';
import {
  backoffMs,
  classifyError,
  errorMessage,
  MAX_ATTEMPTS,
  REQUEST_TIMEOUT_MS,
  sleep,
  withTimeout,
} from './retry';
import { getViewDeal, type PendingChange, type PipelineStore } from './store';

export interface Mutations {
  /** The single entry point for moving a deal. Drag, keyboard and menus all call this. */
  moveDeal(id: string, stage: Stage, options?: { undoable?: boolean }): void;
  /** One deal goes through moveDeal; several become a bulk job. */
  moveDeals(ids: readonly string[], stage: Stage): void;
  cancelJob(jobId: string): void;
  retryJob(jobId: string): void;
  dismissJob(jobId: string): void;
  retry(id: string): void;
  /** Drops a failed change; the deal goes back to the server's version. */
  discard(id: string): void;
  /** Conflict: accept the teammate's version. */
  keepTheirs(id: string): void;
  /** Conflict: send my change again, now based on the teammate's version. */
  applyMine(id: string): void;
  undo(): void;
}

interface MutationsOptions {
  api: PipelineApi;
  store: PipelineStore;
  actor?: string;
  /** Jitter source for backoff; tests pass a constant. */
  rng?: () => number;
}

/** Changes owned by a bulk job are sent by the job, never by the per-deal loop. */
const isSendable = (change: PendingChange) =>
  !change.jobId && (change.status === 'saving' || change.status === 'retrying');

export function createMutations({
  api,
  store,
  actor = CURRENT_USER,
  rng = Math.random,
}: MutationsOptions): Mutations {
  /** Deals whose sender loop is running. At most one request per deal is in flight. */
  const sending = new Set<string>();
  let lastMove: { id: string; from: Stage; to: Stage } | null = null;

  const state = () => store.getState();
  const pendingOf = (id: string) => state().pending.get(id);
  const companyOf = (id: string) => getViewDeal(state(), id)?.company ?? id;
  const update = (id: string, changes: Partial<PendingChange>) => {
    const change = pendingOf(id);
    if (change) state().setPending(id, { ...change, ...changes });
  };

  /**
   * One loop per deal. It always sends the *latest* intent, so a move made while an earlier one is
   * in flight queues behind it rather than racing it. It stops when nothing is left to send, or
   * when the change needs the user (failed or conflict).
   */
  async function drain(id: string) {
    if (sending.has(id)) return;
    sending.add(id);
    try {
      for (let change = pendingOf(id); change && isSendable(change); change = pendingOf(id)) {
        const retryLater = await sendOnce(id, change);
        if (retryLater) await sleep(backoffMs(pendingOf(id)?.attempts ?? 1, rng));
      }
    } finally {
      sending.delete(id);
    }
  }

  /** Returns true if the change should be retried after a backoff. */
  async function sendOnce(id: string, change: PendingChange): Promise<boolean> {
    try {
      const saved = await withTimeout(
        (signal) =>
          api.updateDeal(
            {
              id,
              patch: change.patch,
              expectedVersion: change.baseVersion,
              idempotencyKey: change.mutationId,
              actor,
            },
            { signal },
          ),
        REQUEST_TIMEOUT_MS,
      );
      state().setServerDeals([saved]);
      const latest = pendingOf(id);
      if (latest?.mutationId === change.mutationId) {
        state().setPending(id, null);
      } else if (latest?.baseVersion === change.baseVersion) {
        // A newer move was queued on top of this one. Our own write moved the version on,
        // so rebase the newer move onto it instead of letting it conflict with ourselves.
        update(id, { baseVersion: saved.version });
      }
      return false;
    } catch (error) {
      // Superseded while in flight: the loop moves straight on to the newer intent.
      if (pendingOf(id)?.mutationId !== change.mutationId) return false;
      return handleFailure(id, change, error);
    }
  }

  function handleFailure(id: string, change: PendingChange, error: unknown): boolean {
    const stage = change.patch.stage ? STAGE_LABELS[change.patch.stage] : 'the new value';

    switch (classifyError(error)) {
      case 'transient': {
        const attempts = change.attempts + 1;
        if (attempts < MAX_ATTEMPTS) {
          update(id, { status: 'retrying', attempts, error: errorMessage(error) });
          return true;
        }
        update(id, { status: 'failed', attempts, error: errorMessage(error) });
        state().pushToast({
          tone: 'error',
          message: `Couldn't save ${companyOf(id)} → ${stage}. It's listed under Unsaved changes.`,
          action: { label: 'Retry', run: () => retry(id) },
        });
        return false;
      }

      case 'conflict': {
        const current = (error as ApiError).current;
        if (current) state().setServerDeals([current]);
        if (current && current.stage === change.patch.stage) {
          // A teammate already put it where we wanted it: nothing to resolve.
          state().setPending(id, null);
          return false;
        }
        if (current?.updatedBy === actor) {
          // The deal was last written by us: an earlier, superseded request of ours landed after all
          // (e.g. a lost response). Our latest intent should win, so rebase it and send again.
          update(id, { baseVersion: current.version });
          return false;
        }
        const who = current?.updatedBy ?? 'A teammate';
        update(id, { status: 'conflict', error: `${who} changed this deal first` });
        state().pushToast({
          tone: 'error',
          message: `${who} changed ${companyOf(id)} before your move saved. Review it under Unsaved changes.`,
        });
        return false;
      }

      case 'gone':
        state().setPending(id, null);
        state().placeOwnChange(id);
        state().pushToast({ tone: 'error', message: `${companyOf(id)} no longer exists.` });
        return false;
    }
  }

  function moveDeal(id: string, stage: Stage, { undoable = true } = {}) {
    const server = state().server.get(id);
    const shown = getViewDeal(state(), id);
    if (!server || !shown || shown.stage === stage) return;

    state().setPending(id, {
      mutationId: crypto.randomUUID(),
      patch: { stage },
      baseVersion: server.version,
      status: 'saving',
      attempts: 0,
    });
    state().placeOwnChange(id);

    if (undoable) {
      lastMove = { id, from: shown.stage, to: stage };
      state().pushToast({
        tone: 'info',
        message: `Moved ${shown.company} to ${STAGE_LABELS[stage]}`,
        action: { label: 'Undo (Z)', run: undo },
      });
    }
    void drain(id);
  }

  // Retrying or re-applying one deal takes it out of its bulk job: it's now sent on its own.
  function retry(id: string) {
    update(id, { status: 'saving', attempts: 0, error: undefined, jobId: undefined });
    void drain(id);
  }

  function discard(id: string) {
    state().setPending(id, null);
    state().placeOwnChange(id);
  }

  function applyMine(id: string) {
    const server = state().server.get(id);
    if (!server) return;
    // A new key: the old one is stored with the conflict as its result.
    update(id, {
      mutationId: crypto.randomUUID(),
      baseVersion: server.version,
      status: 'saving',
      attempts: 0,
      error: undefined,
      jobId: undefined,
    });
    void drain(id);
  }

  function undo() {
    if (!lastMove) return;
    const { id, from, to } = lastMove;
    lastMove = null;
    // Only if nothing else has moved the deal since.
    if (getViewDeal(state(), id)?.stage !== to) return;
    moveDeal(id, from, { undoable: false });
    state().pushToast({
      tone: 'info',
      message: `Moved ${companyOf(id)} back to ${STAGE_LABELS[from]}`,
    });
  }

  const bulk = createBulkMover({ api, store, actor, rng });

  return {
    moveDeal,
    moveDeals: (ids, stage) => {
      if (ids.length === 1) moveDeal(ids[0]!, stage);
      else bulk.start(ids, stage);
    },
    cancelJob: bulk.cancel,
    retryJob: bulk.retryFailed,
    dismissJob: bulk.dismiss,
    retry,
    discard,
    keepTheirs: discard,
    applyMine,
    undo,
  };
}
