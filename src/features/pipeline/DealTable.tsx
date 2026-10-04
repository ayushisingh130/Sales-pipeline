import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef } from 'react';
import { usePipeline } from '../../services';
import { useGridKeyboard } from '../keyboard/useGridKeyboard';
import { DealRow, ROW_HEIGHT, rowDomId } from './DealRow';
import './DealTable.css';

const COLUMNS = [
  'Select',
  'Company',
  'Value',
  'Owner',
  'Stage',
  'Close date',
  'Needs attention',
  'Save status',
];

/**
 * The grid element keeps DOM focus and points at the active row with aria-activedescendant.
 * Rows mount and unmount as you scroll, so focus can't live on a row element.
 */
export function DealTable() {
  const ids = usePipeline((state) => state.view.ids);
  const focusedId = usePipeline((state) => state.focusedId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/incompatible-library -- known for TanStack Virtual; the virtualizer is never passed to memoized children
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const focusedIndex = useMemo(
    () => (focusedId === null ? -1 : ids.indexOf(focusedId)),
    [ids, focusedId],
  );

  // Keep the focused row mounted and on screen, so aria-activedescendant always points at a real element.
  // Deferred to a microtask: the virtualizer flushes synchronously, which React disallows during commit.
  useEffect(() => {
    if (focusedIndex < 0) return;
    queueMicrotask(() => virtualizer.scrollToIndex(focusedIndex, { align: 'auto' }));
  }, [focusedIndex, virtualizer]);

  const pageSize = Math.max(1, Math.floor((virtualizer.scrollRect?.height ?? 0) / ROW_HEIGHT) - 1);
  const onKeyDown = useGridKeyboard(pageSize);

  return (
    <div
      role="grid"
      aria-label="Deals"
      aria-rowcount={ids.length + 1}
      aria-colcount={COLUMNS.length}
      aria-multiselectable="true"
      aria-activedescendant={focusedIndex >= 0 && focusedId ? rowDomId(focusedId) : undefined}
      tabIndex={0}
      className="deal-grid"
      onKeyDown={onKeyDown}
    >
      <div role="row" aria-rowindex={1} className="deal-row deal-header">
        {COLUMNS.map((column) => (
          <div key={column} role="columnheader" className="cell">
            {column === 'Select' ? <span className="visually-hidden">{column}</span> : column}
          </div>
        ))}
      </div>

      {ids.length === 0 ? (
        <p className="empty">No deals match these filters.</p>
      ) : (
        // tabIndex -1: browsers make scrollable areas tabbable; the grid is the only tab stop.
        <div ref={scrollRef} className="deal-scroller" tabIndex={-1}>
          <div role="rowgroup" className="deal-body" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const id = ids[item.index];
              return id && <DealRow key={id} id={id} index={item.index} top={item.start} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
