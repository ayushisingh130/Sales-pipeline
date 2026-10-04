import { useEffect, type RefObject } from 'react';

export const SEARCH_INPUT_ID = 'deal-search';

/** Back to the deals: the List view's grid, or the board column that holds the focused card. */
export function focusResults() {
  document.querySelector<HTMLElement>('.deal-grid, .column-scroller[tabindex="0"]')?.focus();
}

export function focusSearch() {
  document.getElementById(SEARCH_INPUT_ID)?.focus();
}

/**
 * For dialogs and panels: on mount, focus moves to the element marked `data-autofocus` (or the
 * container itself); on unmount, it goes back where it was. If that element is gone (e.g. the
 * "3 unsaved" button after the last one is resolved), it goes back to the deals instead.
 */
export function useFocusWhileMounted(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const returnTo = document.activeElement;
    const container = ref.current;
    (container?.querySelector<HTMLElement>('[data-autofocus]') ?? container)?.focus();
    return () => {
      if (returnTo instanceof HTMLElement && returnTo.isConnected && returnTo !== document.body) {
        returnTo.focus();
      } else {
        focusResults();
      }
    };
  }, [ref]);
}
