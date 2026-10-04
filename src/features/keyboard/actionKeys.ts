import type { KeyboardEvent } from 'react';
import { nextStage, previousStage, STAGES, type Stage } from '../../domain/stages';
import type { Services } from '../../services';
import { getViewDeal, needsUser } from '../../sync/store';
import { requestMove } from '../selection/requestMove';
import { focusSearch } from './focus';

/**
 * Shortcuts shared by the board and the List view. Returns true if the key was handled.
 * - `[` / `]`: the keyboard equivalent of dragging the focused card one column back or forward.
 * - `1–7`: move to that stage; the whole selection if there is one, else the focused deal.
 * - Space / `x` select, Ctrl/Cmd+A selects all matching, Esc clears.
 * - `z` undoes the last single move; `r` applies teammates' updates.
 * - `m` Move to…, `?` help, `/` search, `u` the Unsaved changes panel.
 */
export function handleActionKey(
  event: KeyboardEvent<HTMLElement>,
  services: Pick<Services, 'store' | 'mutations'>,
): boolean {
  const { store, mutations } = services;
  const state = store.getState();
  const focused = state.focusedId ? getViewDeal(state, state.focusedId) : undefined;

  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() !== 'a') return false;
    state.setSelection(state.view.ids);
    return true;
  }

  // Holding a key down must not fire a stream of moves.
  const move = (stage: Stage | undefined) => {
    if (focused && stage && !event.repeat) mutations.moveDeal(focused.id, stage);
  };

  switch (event.key) {
    case '[':
      move(focused && previousStage(focused.stage));
      return true;
    case ']':
      move(focused && nextStage(focused.stage));
      return true;
    case ' ':
    case 'x':
      if (focused) state.toggleSelected(focused.id);
      return true;
    case 'Escape':
      if (state.selection.size === 0) return false;
      state.clearSelection();
      return true;
    case 'z':
      if (!event.repeat) mutations.undo();
      return true;
    case 'r':
      state.refreshView();
      return true;
    case 'm':
      if ((focused || state.selection.size > 0) && !event.repeat) state.setOverlay('move');
      return true;
    case '?':
      state.setOverlay('help');
      return true;
    case '/':
      focusSearch();
      return true;
    case 'u':
      if (Array.from(state.pending.values()).some(needsUser)) state.setOverlay('unsaved');
      return true;
    default: {
      if (!/^[1-7]$/.test(event.key)) return false;
      const stage = STAGES[Number(event.key) - 1];
      if (state.selection.size > 0 && stage && !event.repeat) {
        requestMove(services, state.selection, stage);
      } else {
        move(stage);
      }
      return true;
    }
  }
}
