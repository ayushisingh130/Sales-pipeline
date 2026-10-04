import { useMemo } from 'react';
import { formatCount, formatInrCompact } from '../../domain/format';
import { STAGE_LABELS, STAGES, type Stage } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import { requestMove } from './requestMove';
import './BulkBar.css';

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
    <div className="bulk-bar" role="region" aria-label="Selected deals">
      <strong>
        {formatCount(selection.size)} selected · {formatInrCompact(totalValue)}
      </strong>
      <label>
        Move to{' '}
        <select
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
        <button type="button" onClick={() => setSelection(matching)}>
          Select all {formatCount(matching.length)} matching
        </button>
      )}
      <button type="button" onClick={clearSelection}>
        Clear (Esc)
      </button>
    </div>
  );
}
