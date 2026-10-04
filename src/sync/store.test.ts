import { describe, expect, it } from 'vitest';
import { makeDeal } from '../test/factories';
import { createPipelineStore, viewDeal } from './store';

// Default query: my open deals. All of these are open, owned by the current user, and sorted by value.
function setup() {
  const deals = [3, 2, 1].map((n) =>
    makeDeal({ value: n * 1000, closeDate: 1e15, lastActivityAt: 1e15 }),
  );
  const store = createPipelineStore({ viewMode: 'list' });
  store.getState().receiveDeals(deals);
  return { store, deals, ids: deals.map((deal) => deal.id) };
}

describe('pipeline store', () => {
  it('builds the view on load and focuses the first row', () => {
    const { store, ids } = setup();
    expect(store.getState().load.status).toBe('ready');
    expect(store.getState().view.ids).toEqual(ids);
    expect(store.getState().focusedId).toBe(ids[0]);
  });

  it('keeps focus on the same deal across query changes while it is still listed', () => {
    const { store, ids } = setup();
    store.getState().focusDeal(ids[2]!);

    store.getState().setQuery({ sort: 'company' });
    expect(store.getState().focusedId).toBe(ids[2]);

    store.getState().setQuery({ search: 'no such company' });
    expect(store.getState().focusedId).toBeNull();
  });

  it('moves focus within bounds', () => {
    const { store, ids } = setup();
    const { moveFocus } = store.getState();

    moveFocus(-1);
    expect(store.getState().focusedId).toBe(ids[0]);
    moveFocus(10);
    expect(store.getState().focusedId).toBe(ids[2]);
    moveFocus('first');
    expect(store.getState().focusedId).toBe(ids[0]);
    moveFocus('last');
    expect(store.getState().focusedId).toBe(ids[2]);
  });

  it('keeps the list order frozen until refreshView is called', () => {
    const { store, deals, ids } = setup();
    const server = new Map(store.getState().server);
    server.set(ids[2]!, { ...deals[2]!, value: 9_999_999 });
    store.setState({ server });

    expect(store.getState().view.ids).toEqual(ids);
    store.getState().refreshView();
    expect(store.getState().view.ids[0]).toBe(ids[2]);
  });

  it('shows a pending change on top of the server version', () => {
    const deal = makeDeal({ stage: 'contacted' });
    const pending = {
      mutationId: 'm1',
      patch: { stage: 'won' as const },
      baseVersion: 1,
      status: 'saving' as const,
      attempts: 1,
    };
    expect(viewDeal(deal, pending).stage).toBe('won');
    expect(viewDeal(deal, undefined)).toBe(deal);
  });

  it("applies the user's own change to the frozen list: out when it stops matching, back when undone", () => {
    const { store, ids } = setup();
    const id = ids[1]!;
    store.getState().focusDeal(id);
    const change = {
      mutationId: 'm1',
      patch: { stage: 'won' as const },
      baseVersion: 1,
      status: 'saving' as const,
      attempts: 0,
    };

    // Default query is "my open deals", so a deal moved to Won leaves the list.
    store.getState().setPending(id, change);
    store.getState().placeOwnChange(id);
    expect(store.getState().view.ids).toEqual([ids[0], ids[2]]);
    expect(store.getState().focusedId).toBe(ids[2]);

    // Discarded: it returns at its sorted position.
    store.getState().setPending(id, null);
    store.getState().placeOwnChange(id);
    expect(store.getState().view.ids).toEqual(ids);
  });

  it('ignores server versions older than the one it holds', () => {
    const { store, deals } = setup();
    const deal = deals[0]!;
    store.getState().setServerDeals([{ ...deal, version: 3, value: 1 }]);
    store.getState().setServerDeals([{ ...deal, version: 2, value: 2 }]);
    expect(store.getState().server.get(deal.id)).toMatchObject({ version: 3, value: 1 });
  });

  describe('board', () => {
    const fresh = { closeDate: 1e15, lastActivityAt: 1e15 };
    function boardSetup() {
      const deals = [
        makeDeal({ ...fresh, stage: 'new_lead', value: 3 }),
        makeDeal({ ...fresh, stage: 'new_lead', value: 2 }),
        makeDeal({ ...fresh, stage: 'new_lead', value: 1 }),
        makeDeal({ ...fresh, stage: 'proposal_sent', value: 5 }),
        makeDeal({ ...fresh, stage: 'won', value: 4 }),
      ];
      const store = createPipelineStore();
      store.getState().receiveDeals(deals);
      return { store, ids: deals.map((deal) => deal.id) };
    }

    it('groups every stage into a column, ignoring the stage filter', () => {
      const { store, ids } = boardSetup();
      const { columns } = store.getState().view;
      expect(columns.new_lead).toEqual(ids.slice(0, 3));
      expect(columns.proposal_sent).toEqual([ids[3]]);
      // "Needs attention" filters to open deals, but the board still shows Won so it can be dropped on.
      expect(columns.won).toEqual([ids[4]]);
    });

    it("moves the user's own card to its sorted position in the new column, keeping focus on it", () => {
      const { store, ids } = boardSetup();
      const id = ids[1]!;
      store.getState().focusDeal(id);
      store.getState().setPending(id, {
        mutationId: 'm1',
        patch: { stage: 'proposal_sent' },
        baseVersion: 1,
        status: 'saving',
        attempts: 0,
      });
      store.getState().placeOwnChange(id);

      const { columns } = store.getState().view;
      expect(columns.new_lead).toEqual([ids[0], ids[2]]);
      expect(columns.proposal_sent).toEqual([ids[3], id]);
      expect(store.getState().focusedId).toBe(id);
    });

    it('moves focus within a column, and across columns skipping empty ones', () => {
      const { store, ids } = boardSetup();
      const state = () => store.getState();
      state().focusDeal(ids[2]!);

      state().moveFocus(-1);
      expect(state().focusedId).toBe(ids[1]);
      // Contacted and Demo Done are empty: right goes straight to Proposal Sent.
      state().moveFocusColumn(1);
      expect(state().focusedId).toBe(ids[3]);
      state().moveFocusColumn(1);
      expect(state().focusedId).toBe(ids[4]);
      state().moveFocusColumn(1);
      expect(state().focusedId).toBe(ids[4]);
    });
  });

  describe('selection', () => {
    it('toggles, extends with Shift+arrows, selects a range, and clears on a new query', () => {
      const { store, ids } = setup();
      const state = () => store.getState();

      state().toggleSelected(ids[0]!);
      expect([...state().selection]).toEqual([ids[0]]);

      state().focusDeal(ids[0]!);
      state().extendSelection(1);
      expect(state().focusedId).toBe(ids[1]);
      expect([...state().selection].sort()).toEqual([ids[0], ids[1]].sort());

      state().clearSelection();
      state().toggleSelected(ids[0]!);
      state().selectRange(ids[2]!);
      expect(state().selection.size).toBe(3);

      state().setQuery({ sort: 'company' });
      expect(state().selection.size).toBe(0);
    });
  });

  it('places many own changes at once, keeping the others in their order', () => {
    const { store, ids } = setup();
    const change = (stage: 'won') => ({
      mutationId: 'm',
      patch: { stage },
      baseVersion: 1,
      status: 'saving' as const,
      attempts: 0,
    });
    store.getState().patchPending([
      [ids[0]!, change('won')],
      [ids[2]!, change('won')],
    ]);
    store.getState().placeOwnChanges([ids[0]!, ids[2]!]);
    // List view of "my open deals": both leave, the middle one stays.
    expect(store.getState().view.ids).toEqual([ids[1]]);
    expect(store.getState().focusedId).toBe(ids[1]);
  });
});
