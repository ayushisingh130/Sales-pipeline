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
import './Toolbar.css';

const SEARCH_DEBOUNCE_MS = 150;

export function Toolbar() {
  const query = usePipeline((state) => state.query);
  const setQuery = usePipeline((state) => state.setQuery);
  const resultCount = usePipeline((state) => state.view.ids.length);
  const viewMode = usePipeline((state) => state.viewMode);
  const setViewMode = usePipeline((state) => state.setViewMode);
  const setOverlay = usePipeline((state) => state.setOverlay);

  return (
    <div className="toolbar">
      <div role="group" aria-label="Layout" className="toolbar-group">
        <button
          type="button"
          aria-pressed={viewMode === 'board'}
          onClick={() => setViewMode('board')}
        >
          Board
        </button>
        <button
          type="button"
          aria-pressed={viewMode === 'list'}
          onClick={() => setViewMode('list')}
        >
          List
        </button>
      </div>

      <div role="group" aria-label="Views" className="toolbar-group">
        <button
          type="button"
          aria-pressed={matchesPreset(query, NEEDS_ATTENTION)}
          onClick={() => setQuery(NEEDS_ATTENTION)}
        >
          Needs attention
        </button>
        <button
          type="button"
          aria-pressed={matchesPreset(query, ALL_DEALS)}
          onClick={() => setQuery(ALL_DEALS)}
        >
          All deals
        </button>
      </div>

      <SearchBox />

      <label>
        Owner{' '}
        <select
          value={query.owner}
          onChange={(event) => setQuery({ owner: event.target.value as Query['owner'] })}
        >
          <option value="me">My deals</option>
          <option value="anyone">Everyone</option>
        </select>
      </label>

      <label>
        Sort{' '}
        <select
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

      <label>
        <input
          type="checkbox"
          checked={query.overdueOnly}
          onChange={(event) => setQuery({ overdueOnly: event.target.checked })}
        />{' '}
        Overdue only
      </label>

      <span className="muted">{formatCount(resultCount)} deals</span>

      <button type="button" aria-keyshortcuts="?" onClick={() => setOverlay('help')}>
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
