import { useMemo } from 'react';
import { formatCount, formatInrCompact } from '../../domain/format';
import { STAGE_LABELS, STAGES, type Stage } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import { requestMove } from './requestMove';

/** Appears while deals are selected. Floats at the bottom so it never shifts the layout. */
export function BulkBar() {
  const services = useServices();
  const selection = usePipeline((state) => state.selection);
  const server = usePipeline((state) => state.server);
  const matching = usePipeline((state) => state.view.ids);
  const { setSelection, clearSelection } = services.store.getState();

  const totalValue = useMemo(() => {
    let total = 0;
    for (const id of selection) total += server.get(id)?.value ?? 0;
    return total;
  }, [selection, server]);

  if (selection.size === 0) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-15 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-slate-900 py-2 pr-2 pl-4 text-white shadow-2xl"
      role="region"
      aria-label="Selected deals"
    >
      <strong>
        {formatCount(selection.size)} selected · {formatInrCompact(totalValue)}
      </strong>
      <label className="flex items-center gap-1.5 text-slate-300">
        Move to{' '}
        <select
          className="field border-white/20 bg-white/10 text-white [&>option]:text-ink"
          value=""
          onChange={(event) => requestMove(services, selection, event.target.value as Stage)}
        >
          <option value="" disabled>
            Choose stage…
          </option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </label>
      {selection.size < matching.length && (
        <button type="button" className="btn btn-inverse" onClick={() => setSelection(matching)}>
          Select all {formatCount(matching.length)} matching
        </button>
      )}
      <button type="button" className="btn btn-inverse" onClick={clearSelection}>
        Clear (Esc)
      </button>
    </div>
  );
}
