import { formatCount, formatInrCompact } from '../../domain/format';
import type { StageFilter } from '../../domain/query';
import { STAGE_LABELS, STAGES } from '../../domain/stages';
import { usePipeline } from '../../services';
import { useStageSummary } from './useStageSummary';

const FILTERS: StageFilter[] = ['all', 'open', ...STAGES];
const LABELS: Record<StageFilter, string> = { all: 'All', open: 'All open', ...STAGE_LABELS };

/** The pipeline overview: a count and ₹ total per stage, doubling as the stage filter. */
export function StageStrip() {
  const stageFilter = usePipeline((state) => state.query.stage);
  const setQuery = usePipeline((state) => state.setQuery);
  const summary = useStageSummary();

  return (
    <nav aria-label="Filter by stage">
      <ul className="flex gap-2 overflow-x-auto pb-0.5">
        {FILTERS.map((filter) => (
          <li key={filter}>
            <button
              type="button"
              className="flex min-w-28 cursor-pointer flex-col items-start rounded-lg border border-line bg-white px-3 py-1.5 text-left shadow-xs hover:border-slate-300 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:ring-1 aria-pressed:ring-accent"
              aria-pressed={stageFilter === filter}
              onClick={() => setQuery({ stage: filter })}
            >
              <span className="text-xs font-medium text-muted">{LABELS[filter]}</span>
              <strong className="text-base tabular-nums">
                {formatCount(summary[filter].count)}
              </strong>
              <span className="muted">{formatInrCompact(summary[filter].value)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
