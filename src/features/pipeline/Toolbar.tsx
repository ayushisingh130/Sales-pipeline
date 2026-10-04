import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { formatCount } from '../../domain/format';
import {
  ALL_DEALS,
  matchesPreset,
  NEEDS_ATTENTION,
  SORT_LABELS,
  type Query,
  type SortKey,
} from '../../domain/query';
import { usePipeline, useServices } from '../../services';
import { focusResults, SEARCH_INPUT_ID } from '../keyboard/focus';

const SEARCH_DEBOUNCE_MS = 150;

const SEGMENTED = 'inline-flex rounded-lg border border-line bg-white p-0.5 shadow-xs';
const SEGMENT =
  'cursor-pointer rounded-md px-2.5 py-1 font-medium text-muted hover:text-ink aria-pressed:bg-accent-soft aria-pressed:text-accent';
const LABEL = 'flex items-center gap-1.5 text-muted';

export function Toolbar() {
  const query = usePipeline((state) => state.query);
  const setQuery = usePipeline((state) => state.setQuery);
  const resultCount = usePipeline((state) => state.view.ids.length);
  const viewMode = usePipeline((state) => state.viewMode);
  const setViewMode = usePipeline((state) => state.setViewMode);
  const setOverlay = usePipeline((state) => state.setOverlay);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Layout" className={SEGMENTED}>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={viewMode === 'board'}
          onClick={() => setViewMode('board')}
        >
          Board
        </button>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={viewMode === 'list'}
          onClick={() => setViewMode('list')}
        >
          List
        </button>
      </div>

      <div role="group" aria-label="Views" className={SEGMENTED}>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={matchesPreset(query, NEEDS_ATTENTION)}
          onClick={() => setQuery(NEEDS_ATTENTION)}
        >
          Needs attention
        </button>
        <button
          type="button"
          className={SEGMENT}
          aria-pressed={matchesPreset(query, ALL_DEALS)}
          onClick={() => setQuery(ALL_DEALS)}
        >
          All deals
        </button>
      </div>

      <SearchBox />

      <label className={LABEL}>
        Owner{' '}
        <select
          className="field"
          value={query.owner}
          onChange={(event) => setQuery({ owner: event.target.value as Query['owner'] })}
        >
          <option value="me">My deals</option>
          <option value="anyone">Everyone</option>
        </select>
      </label>

      <label className={LABEL}>
        Sort{' '}
        <select
          className="field"
          value={query.sort}
          onChange={(event) => setQuery({ sort: event.target.value as SortKey })}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          className="size-4 accent-accent"
          checked={query.overdueOnly}
          onChange={(event) => setQuery({ overdueOnly: event.target.checked })}
        />{' '}
        Overdue only
      </label>

      <span className="muted">{formatCount(resultCount)} deals</span>

      <button
        type="button"
        className="btn ml-auto"
        aria-keyshortcuts="?"
        onClick={() => setOverlay('help')}
      >
        Shortcuts <kbd>?</kbd>
      </button>
    </div>
  );
}

/**
 * Keeps its own text state and commits to the store after a pause in typing. `/` from the deals
 * focuses it; Enter applies the search now and goes back to the results, Esc just goes back.
 */
function SearchBox() {
  const { store } = useServices();
  const [text, setText] = useState(() => store.getState().query.search);

  useEffect(() => {
    if (text === store.getState().query.search) return;
    const timer = setTimeout(() => store.getState().setQuery({ search: text }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, store]);

  return (
    <input
      id={SEARCH_INPUT_ID}
      type="search"
      aria-label="Search deals"
      aria-keyshortcuts="/"
      placeholder="Search company, owner or ID"
      className="field w-64 py-1.5"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        // Render the new results first, so focus lands on the column that now holds the focused deal.
        if (event.key === 'Enter') flushSync(() => store.getState().setQuery({ search: text }));
        focusResults();
      }}
    />
  );
}
