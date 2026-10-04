import type { MouseEvent } from 'react';
import { usePipeline } from '../../services';
import type { PipelineStore } from '../../sync/store';

/**
 * A card's or row's checkbox. Mouse only (tabIndex -1): keyboard users press Space. It stops the
 * pointer event so ticking it never starts a drag.
 */
export function SelectBox({ id, label }: { id: string; label: string }) {
  const selected = usePipeline((state) => state.selection.has(id));
  const toggleSelected = usePipeline((state) => state.toggleSelected);
  return (
    <input
      type="checkbox"
      className="select-box"
      tabIndex={-1}
      aria-label={`Select ${label}`}
      checked={selected}
      onChange={() => toggleSelected(id)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    />
  );
}

/** Shift+click selects a range, Cmd/Ctrl+click toggles; a plain click only focuses. */
export function selectionClick(event: MouseEvent, id: string, store: PipelineStore) {
  const state = store.getState();
  if (event.shiftKey) state.selectRange(id);
  else if (event.metaKey || event.ctrlKey) state.toggleSelected(id);
}
