import { useCallback, type KeyboardEvent } from 'react';
import { useServices } from '../../services';
import { handleActionKey } from './actionKeys';

/** Shortcuts for the List view's grid. */
export function useGridKeyboard(pageSize: number) {
  const services = useServices();

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.altKey) return;
      const state = services.store.getState();
      if (event.ctrlKey || event.metaKey) {
        if (handleActionKey(event, services)) event.preventDefault();
        return;
      }
      if (event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        state.extendSelection(event.key === 'ArrowDown' ? 1 : -1);
        event.preventDefault();
        return;
      }
      switch (event.key) {
        case 'ArrowDown':
        case 'j':
          state.moveFocus(1);
          break;
        case 'ArrowUp':
        case 'k':
          state.moveFocus(-1);
          break;
        case 'PageDown':
          state.moveFocus(pageSize);
          break;
        case 'PageUp':
          state.moveFocus(-pageSize);
          break;
        case 'Home':
          state.moveFocus('first');
          break;
        case 'End':
          state.moveFocus('last');
          break;
        default:
          if (!handleActionKey(event, services)) return;
      }
      event.preventDefault();
    },
    [services, pageSize],
  );
}
