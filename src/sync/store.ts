import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Deal, DealEvent, DealPatch } from '../api/types';
import { compareDeals, DEFAULT_QUERY, matchesQuery, selectIds, type Query } from '../domain/query';
import { STAGES, type Stage } from '../domain/stages';

export type SaveStatus = 'saving' | 'retrying' | 'failed' | 'conflict';

/** A local change that the server hasn't confirmed yet. Shown on top of the server's version. */
export interface PendingChange {
  /** Also used as the idempotency key, so every retry of this change is safe. */
  mutationId: string;
  patch: DealPatch;
  /** The server version the user was looking at when they made the change. */
  baseVersion: number;
  status: SaveStatus;
  attempts: number;
  error?: string;
  /** Set when the change belongs to a bulk move; that job sends it, not the per-deal loop. */
  jobId?: string;
}

/** Failed or conflicting: waiting for the user to decide, as opposed to still saving. */
export const needsUser = (change: PendingChange) =>
  change.status === 'failed' || change.status === 'conflict';

export interface BulkJob {
  id: string;
  stage: Stage;
  total: number;
  saved: number;
  failed: number;
  conflicts: number;
  /** Not sent because the user cancelled; those deals went back to the server's version. */
  cancelled: number;
  status: 'running' | 'finished' | 'cancelled';
}

/** A move waiting for the user to confirm it (large, or to Lost). */
export interface MoveRequest {
  ids: readonly string[];
  stage: Stage;
}

export type LoadState =
  { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export type ViewMode = 'board' | 'list';

/** Which keyboard-opened layer is showing. One at a time, so they can't stack. */
export type Overlay = 'move' | 'help' | 'unsaved' | null;

export type Columns = Record<Stage, readonly string[]>;

/** A frozen ordering. It is rebuilt only on the user's own actions, never on teammates' events. */
export interface ViewSnapshot {
  /** Every listed deal in sort order (the List view). */
  ids: readonly string[];
  /** The same deals grouped by stage, each column in sort order (the board). */
  columns: Columns;
  /** Which column each listed deal sits in: O(1) lookups for "is this card out of place?". */
  stageOf: ReadonlyMap<string, Stage>;
  /** The clock used for this snapshot, so time-based labels stay consistent with the order. */
  now: number;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

export interface PipelineState {
  load: LoadState;
  /** Last confirmed server state. Never edited optimistically. */
  server: ReadonlyMap<string, Deal>;
  pending: ReadonlyMap<string, PendingChange>;
  query: Query;
  viewMode: ViewMode;
  view: ViewSnapshot;
  focusedId: string | null;
  toasts: readonly Toast[];
  /** Deals that teammates changed since the snapshot was built, with when the change arrived. */
  remoteChanges: ReadonlyMap<string, number>;
  selection: ReadonlySet<string>;
  /** Where a Shift+click range starts. */
  selectionAnchor: string | null;
  jobs: readonly BulkJob[];
  moveRequest: MoveRequest | null;
  overlay: Overlay;

  setLoad(load: LoadState): void;
  receiveDeals(deals: readonly Deal[]): void;
  /** Merges server versions, ignoring any that are older than what we already hold. */
  setServerDeals(deals: readonly Deal[]): void;
  setPending(id: string, change: PendingChange | null): void;
  /** Many pending changes in one store update (null removes). */
  patchPending(entries: Iterable<readonly [string, PendingChange | null]>): void;
  /** A batch of pushed changes in one update. Newer versions only; our own events aren't "remote". */
  applyEvents(events: readonly DealEvent[], self: string): void;
  /** Applies the user's own change to the frozen view: insert, remove, or move between columns. */
  placeOwnChange(id: string): void;
  /** The same for many deals at once (bulk moves): one merge pass per affected column. */
  placeOwnChanges(ids: readonly string[]): void;
  setQuery(changes: Partial<Query>): void;
  setViewMode(mode: ViewMode): void;
  refreshView(): void;
  focusDeal(id: string | null): void;
  /** Moves within the list, or within the focused card's column on the board. */
  moveFocus(move: number | 'first' | 'last'): void;
  /** Board only: to the nearest non-empty column on the left (-1) or right (1), at the same height. */
  moveFocusColumn(direction: -1 | 1): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: number): void;

  toggleSelected(id: string): void;
  /** Shift+click: everything between the anchor and `id`, in the same list or column. */
  selectRange(id: string): void;
  /** Shift+↑/↓: select the focused deal, move focus, select the next one. */
  extendSelection(delta: 1 | -1): void;
  setSelection(ids: Iterable<string>): void;
  clearSelection(): void;
  setMoveRequest(request: MoveRequest | null): void;
  setOverlay(overlay: Overlay): void;
  upsertJob(job: BulkJob): void;
  removeJob(id: string): void;
}

export type PipelineStore = StoreApi<PipelineState>;

const MAX_TOASTS = 3;
let nextToastId = 1;

/** The deal as the user sees it: the server's version with any pending local change on top. */
export function viewDeal(deal: Deal, pending: PendingChange | undefined): Deal {
  return pending ? { ...deal, ...pending.patch } : deal;
}

export function viewDeals(state: Pick<PipelineState, 'server' | 'pending'>): Deal[] {
  const deals = Array.from(state.server.values());
  if (state.pending.size === 0) return deals;
  return deals.map((deal) => viewDeal(deal, state.pending.get(deal.id)));
}

export function getViewDeal(
  state: Pick<PipelineState, 'server' | 'pending'>,
  id: string,
): Deal | undefined {
  const deal = state.server.get(id);
  return deal && viewDeal(deal, state.pending.get(id));
}

/** The board's columns are the stages, so the stage filter only applies to the List view. */
export function effectiveQuery(state: Pick<PipelineState, 'query' | 'viewMode'>): Query {
  return state.viewMode === 'board' ? { ...state.query, stage: 'all' } : state.query;
}

/** The column a card is listed in. After a teammate's change this can differ from its live stage. */
export function columnOf(view: ViewSnapshot, id: string): Stage | undefined {
  return view.stageOf.get(id);
}

type PlacementInputs = Pick<PipelineState, 'server' | 'pending' | 'query' | 'viewMode' | 'view'>;

/**
 * Whether a listed deal no longer belongs where the frozen view shows it: it stopped matching the
 * filters, or (on the board) its stage changed. Such deals are dimmed until the user refreshes.
 */
export function isOutOfPlace(state: PlacementInputs, id: string): boolean {
  const deal = getViewDeal(state, id);
  const listed = state.view.stageOf.get(id);
  if (!deal) return listed !== undefined;
  const matches = matchesQuery(deal, effectiveQuery(state), state.view.now);
  if (listed === undefined) return matches;
  return !matches || (state.viewMode === 'board' && listed !== deal.stage);
}

/** How many teammate changes the "N updates" banner offers to show. */
export function countOutOfPlace(state: PlacementInputs & Pick<PipelineState, 'remoteChanges'>) {
  let count = 0;
  for (const id of state.remoteChanges.keys()) if (isOutOfPlace(state, id)) count += 1;
  return count;
}

const emptyColumns = (): Record<Stage, string[]> =>
  Object.fromEntries(STAGES.map((stage) => [stage, []])) as unknown as Record<Stage, string[]>;

type ViewInputs = Pick<PipelineState, 'server' | 'pending' | 'query' | 'viewMode'>;

function buildView(state: ViewInputs): ViewSnapshot {
  const now = Date.now();
  const ids = selectIds(viewDeals(state), effectiveQuery(state), now);
  const columns = emptyColumns();
  const stageOf = new Map<string, Stage>();
  for (const id of ids) {
    const stage = getViewDeal(state, id)?.stage;
    if (!stage) continue;
    columns[stage].push(id);
    stageOf.set(id, stage);
  }
  return { ids, columns, stageOf, now };
}

/** Focus follows the deal (by id) when it's still listed; otherwise it falls back to the first one. */
function keepFocus(view: ViewSnapshot, focusedId: string | null): string | null {
  if (focusedId !== null && view.ids.includes(focusedId)) return focusedId;
  return view.ids[0] ?? null;
}

/**
 * Merges `additions` into an already-sorted list in one pass, without reordering what's there.
 * The frozen list may be slightly out of order because of deferred teammate changes; a
 * near-correct position is fine.
 */
function mergeSorted(
  state: ViewInputs,
  list: readonly string[],
  additions: readonly Deal[],
  compare: (a: Deal, b: Deal) => number,
): readonly string[] {
  if (additions.length === 0) return list;
  const sorted = additions.toSorted(compare);
  const merged: string[] = [];
  let next = 0;
  for (const id of list) {
    const deal = getViewDeal(state, id);
    while (next < sorted.length && deal && compare(sorted[next]!, deal) < 0) {
      merged.push(sorted[next++]!.id);
    }
    merged.push(id);
  }
  for (; next < sorted.length; next++) merged.push(sorted[next]!.id);
  return merged;
}

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

export function createPipelineStore(initial: Partial<PipelineState> = {}): PipelineStore {
  return createStore<PipelineState>()((set, get) => ({
    load: { status: 'loading' },
    server: new Map(),
    pending: new Map(),
    query: DEFAULT_QUERY,
    viewMode: 'board',
    view: { ids: [], columns: emptyColumns(), stageOf: new Map(), now: Date.now() },
    focusedId: null,
    toasts: [],
    remoteChanges: new Map(),
    selection: new Set(),
    selectionAnchor: null,
    jobs: [],
    moveRequest: null,
    overlay: null,

    setLoad: (load) => set({ load }),

    receiveDeals(deals) {
      const server = new Map(deals.map((deal) => [deal.id, deal]));
      const view = buildView({ ...get(), server });
      set({
        load: { status: 'ready' },
        server,
        view,
        focusedId: keepFocus(view, get().focusedId),
        remoteChanges: new Map(),
      });
    },

    setServerDeals(deals) {
      const current = get().server;
      const newer = deals.filter((deal) => (current.get(deal.id)?.version ?? 0) < deal.version);
      if (newer.length === 0) return;
      const server = new Map(current);
      for (const deal of newer) server.set(deal.id, deal);
      set({ server });
    },

    setPending(id, change) {
      const pending = new Map(get().pending);
      if (change) pending.set(id, change);
      else pending.delete(id);
      set({ pending });
    },

    patchPending(entries) {
      const pending = new Map(get().pending);
      for (const [id, change] of entries) {
        if (change) pending.set(id, change);
        else pending.delete(id);
      }
      set({ pending });
    },

    applyEvents(events, self) {
      const current = get().server;
      let server: Map<string, Deal> | undefined;
      let remoteChanges: Map<string, number> | undefined;
      const now = Date.now();
      for (const { deal, actor } of events) {
        // Out-of-order or already-known versions (including echoes of our own saves) are ignored.
        const known = (server ?? current).get(deal.id);
        if (known && known.version >= deal.version) continue;
        server ??= new Map(current);
        server.set(deal.id, deal);
        if (actor !== self) (remoteChanges ??= new Map(get().remoteChanges)).set(deal.id, now);
      }
      if (server) set(remoteChanges ? { server, remoteChanges } : { server });
    },

    placeOwnChange(id) {
      get().placeOwnChanges([id]);
    },

    placeOwnChanges(changedIds) {
      const state = get();
      const { view } = state;
      const query = effectiveQuery(state);
      const compare = compareDeals(query, view.now);

      const leaving = new Set<string>(); // listed, but no longer match
      const joining: Deal[] = []; // match, but not listed yet
      const removeFrom = new Map<Stage, Set<string>>();
      const addTo = new Map<Stage, Deal[]>();
      const stageOf = new Map(view.stageOf);

      for (const id of new Set(changedIds)) {
        const deal = getViewDeal(state, id);
        const matches = deal !== undefined && matchesQuery(deal, query, view.now);
        const from = view.stageOf.get(id);
        if (!matches && from) leaving.add(id);
        if (matches && !from) joining.push(deal);

        // Board: the card moves from its old column to its new one.
        const to = matches ? deal.stage : undefined;
        if (from === to) continue;
        if (from) removeFrom.set(from, (removeFrom.get(from) ?? new Set()).add(id));
        if (to) addTo.set(to, [...(addTo.get(to) ?? []), deal!]);
        if (to) stageOf.set(id, to);
        else stageOf.delete(id);
      }

      // List order: matching deals that were already listed stay exactly where they are.
      const ids = mergeSorted(
        state,
        leaving.size ? view.ids.filter((id) => !leaving.has(id)) : view.ids,
        joining,
        compare,
      );
      const columns = { ...view.columns };
      for (const stage of new Set([...removeFrom.keys(), ...addTo.keys()])) {
        const removed = removeFrom.get(stage);
        const kept = removed ? columns[stage].filter((id) => !removed.has(id)) : columns[stage];
        columns[stage] = mergeSorted(state, kept, addTo.get(stage) ?? [], compare);
      }

      // If the focused deal left the view, focus moves to the one that took its place.
      let focusedId = state.focusedId;
      if (focusedId !== null && !stageOf.has(focusedId)) {
        const from = view.stageOf.get(focusedId);
        const onBoard = state.viewMode === 'board' && from;
        const before = onBoard ? view.columns[from] : view.ids;
        const after = onBoard ? columns[from] : ids;
        const position = before.indexOf(focusedId);
        focusedId = after[position] ?? after.at(-1) ?? ids[0] ?? null;
      }

      set({ view: { ...view, ids, columns, stageOf }, focusedId });
    },

    setQuery(changes) {
      const query = { ...get().query, ...changes };
      const view = buildView({ ...get(), query });
      // A new query shows different deals, so the selection is cleared (like Gmail).
      set({
        query,
        view,
        focusedId: keepFocus(view, get().focusedId),
        remoteChanges: new Map(),
        selection: new Set(),
      });
    },

    setViewMode(viewMode) {
      if (viewMode === get().viewMode) return;
      const view = buildView({ ...get(), viewMode });
      set({
        viewMode,
        view,
        focusedId: keepFocus(view, get().focusedId),
        remoteChanges: new Map(),
        selection: new Set(),
      });
    },

    refreshView() {
      const view = buildView(get());
      set({ view, focusedId: keepFocus(view, get().focusedId), remoteChanges: new Map() });
    },

    focusDeal: (focusedId) => set({ focusedId }),

    moveFocus(move) {
      const { view, focusedId, viewMode } = get();
      const column = viewMode === 'board' && focusedId ? columnOf(view, focusedId) : undefined;
      const list = column ? view.columns[column] : view.ids;
      if (list.length === 0) return;
      const last = list.length - 1;
      const current = focusedId === null ? -1 : list.indexOf(focusedId);
      const target = move === 'first' ? 0 : move === 'last' ? last : clamp(current + move, last);
      set({ focusedId: list[target] ?? null });
    },

    moveFocusColumn(direction) {
      const { view, focusedId } = get();
      const from = focusedId ? columnOf(view, focusedId) : undefined;
      if (!from || !focusedId) return;
      const row = view.columns[from].indexOf(focusedId);
      for (let i = STAGES.indexOf(from) + direction; i >= 0 && i < STAGES.length; i += direction) {
        const column = view.columns[STAGES[i]!];
        if (column.length > 0) {
          set({ focusedId: column[clamp(row, column.length - 1)] ?? null });
          return;
        }
      }
    },

    pushToast(toast) {
      set({ toasts: [...get().toasts, { ...toast, id: nextToastId++ }].slice(-MAX_TOASTS) });
    },

    dismissToast(id) {
      set({ toasts: get().toasts.filter((toast) => toast.id !== id) });
    },

    toggleSelected(id) {
      const selection = new Set(get().selection);
      if (selection.has(id)) selection.delete(id);
      else selection.add(id);
      set({ selection, selectionAnchor: id });
    },

    selectRange(id) {
      const { view, viewMode, selectionAnchor, focusedId, selection } = get();
      const anchor = selectionAnchor ?? focusedId;
      const stage = view.stageOf.get(id);
      const list = viewMode === 'board' && stage ? view.columns[stage] : view.ids;
      const from = anchor ? list.indexOf(anchor) : -1;
      const to = list.indexOf(id);
      if (from === -1 || to === -1) {
        get().toggleSelected(id);
        return;
      }
      const next = new Set(selection);
      for (const other of list.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(other);
      set({ selection: next });
    },

    extendSelection(delta) {
      const start = get().focusedId;
      if (!start) return;
      get().moveFocus(delta);
      const end = get().focusedId;
      const selection = new Set(get().selection).add(start);
      if (end) selection.add(end);
      set({ selection, selectionAnchor: get().selectionAnchor ?? start });
    },

    setSelection: (ids) => set({ selection: new Set(ids), selectionAnchor: null }),

    clearSelection: () => set({ selection: new Set(), selectionAnchor: null }),

    setMoveRequest: (moveRequest) => set({ moveRequest }),
    setOverlay: (overlay) => set({ overlay }),

    upsertJob(job) {
      const jobs = get().jobs;
      const exists = jobs.some((other) => other.id === job.id);
      set({
        jobs: exists ? jobs.map((other) => (other.id === job.id ? job : other)) : [...jobs, job],
      });
    },

    removeJob: (id) => set({ jobs: get().jobs.filter((job) => job.id !== id) }),

    ...initial,
  }));
}
