import { formatCount, formatInrCompact } from '../../domain/format';
import type { StageFilter } from '../../domain/query';
import { STAGE_LABELS, STAGES } from '../../domain/stages';
import { usePipeline } from '../../services';
import { useStageSummary } from './useStageSummary';
import './StageStrip.css';

const FILTERS: StageFilter[] = ['all', 'open', ...STAGES];
const LABELS: Record<StageFilter, string> = { all: 'All', open: 'All open', ...STAGE_LABELS };

/** The pipeline overview: a count and ₹ total per stage, doubling as the stage filter. */
export function StageStrip() {
  const stageFilter = usePipeline((state) => state.query.stage);
  const setQuery = usePipeline((state) => state.setQuery);
  const summary = useStageSummary();

  return (
    <nav aria-label="Filter by stage">
      <ul className="stage-strip">
        {FILTERS.map((filter) => (
          <li key={filter}>
            <button
              type="button"
              aria-pressed={stageFilter === filter}
              onClick={() => setQuery({ stage: filter })}
            >
              <span className="stage-name">{LABELS[filter]}</span>
              <strong>{formatCount(summary[filter].count)}</strong>
              <span className="muted">{formatInrCompact(summary[filter].value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
