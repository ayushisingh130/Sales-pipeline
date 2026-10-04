import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STAGE_LABELS } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import { needsUser } from '../../sync/store';
import { useFocusWhileMounted } from '../keyboard/focus';

/**
 * "All changes saved" / "Saving 2 changes…" / "3 unsaved", which opens the Unsaved changes panel.
 * The panel also opens with `u` from the board or list.
 */
export function SyncIndicator() {
  const { saving, unsaved } = usePipeline(
    useShallow((state) => {
      let saving = 0;
      let unsaved = 0;
      for (const change of state.pending.values()) {
        if (needsUser(change)) unsaved += 1;
        else saving += 1;
      }
      return { saving, unsaved };
    }),
  );
  const open = usePipeline((state) => state.overlay === 'unsaved');
  const setOverlay = usePipeline((state) => state.setOverlay);

  // Close the panel once nothing is left in it, so it doesn't pop open again on the next failure.
  useEffect(() => {
    if (unsaved === 0 && open) setOverlay(null);
  }, [unsaved, open, setOverlay]);

  const savingText = `Saving ${saving} change${saving === 1 ? '' : 's'}…`;
  if (unsaved === 0) {
    return (
      <span className="ml-auto text-muted">{saving > 0 ? savingText : '✓ All changes saved'}</span>
    );
  }

  return (
    <div className="relative ml-auto">
      <button
        type="button"
        className="btn border-red-200 bg-red-50 font-semibold text-danger hover:bg-red-100"
        aria-expanded={open}
        aria-controls="unsaved-panel"
        onClick={() => setOverlay(open ? null : 'unsaved')}
      >
        ⚠ {unsaved} unsaved{saving > 0 ? ` · ${savingText}` : ''}
      </button>
      {open && <UnsavedPanel onClose={() => setOverlay(null)} />}
    </div>
  );
}

function UnsavedPanel({ onClose }: { onClose: () => void }) {
  const ids = usePipeline(
    useShallow((state) =>
      Array.from(state.pending).flatMap(([id, change]) => (needsUser(change) ? [id] : [])),
    ),
  );
  const { mutations, store } = useServices();
  const panelRef = useRef<HTMLElement>(null);
  useFocusWhileMounted(panelRef);

  const failedIds = ids.filter((id) => store.getState().pending.get(id)?.status === 'failed');

  return (
    <section
      ref={panelRef}
      id="unsaved-panel"
      aria-label="Unsaved changes"
      className="popover absolute top-[calc(100%+6px)] right-0 z-10 max-h-[60vh] w-[min(520px,90vw)] overflow-auto p-3"
      tabIndex={-1}
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <header className="mb-2 flex items-center justify-between">
        <strong>Unsaved changes</strong>
        {failedIds.length > 1 && (
          <button type="button" className="btn" onClick={() => failedIds.forEach(mutations.retry)}>
            Retry all
          </button>
        )}
      </header>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {ids.map((id) => (
          <UnsavedItem key={id} id={id} />
        ))}
      </ul>
    </section>
  );
}

const ITEM = 'flex flex-wrap items-center gap-1.5 py-2';

function UnsavedItem({ id }: { id: string }) {
  const deal = usePipeline((state) => state.server.get(id));
  const change = usePipeline((state) => state.pending.get(id));
  const { mutations } = useServices();
  if (!deal || !change?.patch.stage) return null;
  const target = STAGE_LABELS[change.patch.stage];

  if (change.status === 'conflict') {
    return (
      <li className={ITEM}>
        <span className="basis-full">
          <strong>{deal.company}</strong>: you moved it to {target}, but {deal.updatedBy} changed it
          first (now {STAGE_LABELS[deal.stage]}).
        </span>
        <button type="button" className="btn" onClick={() => mutations.keepTheirs(id)}>
          Keep theirs
        </button>
        <button type="button" className="btn" onClick={() => mutations.applyMine(id)}>
          Apply mine
        </button>
      </li>
    );
  }

  return (
    <li className={ITEM}>
      <span className="basis-full">
        <strong>{deal.company}</strong>: {STAGE_LABELS[deal.stage]} → {target}{' '}
        <span className="muted">({change.error})</span>
      </span>
      <button type="button" className="btn" onClick={() => mutations.retry(id)}>
        Retry
      </button>
      <button type="button" className="btn" onClick={() => mutations.discard(id)}>
        Discard
      </button>
    </li>
  );
}
