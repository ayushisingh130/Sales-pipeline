import type { Stage } from '../../domain/stages';
import type { Services } from '../../services';
import { getViewDeal } from '../../sync/store';

/** Above this many deals, a move asks for confirmation first. */
export const CONFIRM_ABOVE = 50;

type Deps = Pick<Services, 'store' | 'mutations'>;

/**
 * Moves several deals: drag of a selection, the bulk bar, or 1–7 with a selection.
 * Large moves, and any multi-deal move to Lost, are confirmed first. Single-deal moves don't go
 * through here; they have undo instead.
 */
export function requestMove({ store, mutations }: Deps, ids: Iterable<string>, stage: Stage) {
  const state = store.getState();
  const movable = Array.from(ids).filter((id) => {
    const deal = getViewDeal(state, id);
    return deal && deal.stage !== stage;
  });
  if (movable.length === 0) return;

  if (movable.length > CONFIRM_ABOVE || (movable.length > 1 && stage === 'lost')) {
    state.setMoveRequest({ ids: movable, stage });
    return;
  }
  mutations.moveDeals(movable, stage);
  state.clearSelection();
}

export function confirmMove({ store, mutations }: Deps) {
  const request = store.getState().moveRequest;
  if (!request) return;
  store.getState().setMoveRequest(null);
  mutations.moveDeals(request.ids, request.stage);
  store.getState().clearSelection();
}
