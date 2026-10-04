import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useEffect, useMemo, useRef } from 'react';
import { formatCount, formatInrCompact } from '../../domain/format';
import type { StageSummary } from '../../domain/query';
import { STAGE_LABELS, type Stage } from '../../domain/stages';
import { cx } from '../../cx';
import { usePipeline } from '../../services';
import { cardDomId, CARD_SLOT_HEIGHT, DealCard } from './DealCard';
import { useBoardKeyboard } from './useBoardKeyboard';

export const columnDomId = (stage: Stage) => `board-column-${stage}`;

/** A colour per stage, on the column's top edge, so the funnel reads left to right at a glance. */
const STAGE_ACCENT: Record<Stage, string> = {
  new_lead: 'border-t-sky-400',
  contacted: 'border-t-cyan-400',
  demo_done: 'border-t-teal-400',
  proposal_sent: 'border-t-indigo-400',
  negotiation: 'border-t-violet-400',
  won: 'border-t-emerald-500',
  lost: 'border-t-rose-400',
};

interface BoardColumnProps {
  stage: Stage;
  summary: StageSummary;
  /** Exactly one column is in the tab order: the one holding the focused card. */
  tabbable: boolean;
}

/**
 * One stage: a drop target (the whole column) and a virtualized listbox of cards. The drop target is
 * the column, never a position inside it; order within a column always comes from the sort.
 */
export const BoardColumn = memo(function BoardColumn({
  stage,
  summary,
  tabbable,
}: BoardColumnProps) {
  const ids = usePipeline((state) => state.view.columns[stage]);
  const focusedId = usePipeline((state) => state.focusedId);
  const selection = usePipeline((state) => state.selection);
  const setSelection = usePipeline((state) => state.setSelection);
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => CARD_SLOT_HEIGHT,
    overscan: 4,
  });

  const focusedIndex = useMemo(
    () => (focusedId === null ? -1 : ids.indexOf(focusedId)),
    [ids, focusedId],
  );

  // Keep the focused card mounted and on screen. Deferred: the virtualizer flushes synchronously.
  useEffect(() => {
    if (focusedIndex < 0) return;
    queueMicrotask(() => virtualizer.scrollToIndex(focusedIndex, { align: 'auto' }));
  }, [focusedIndex, virtualizer]);

  const pageSize = Math.max(
    1,
    Math.floor((virtualizer.scrollRect?.height ?? 0) / CARD_SLOT_HEIGHT) - 1,
  );
  const onKeyDown = useBoardKeyboard(pageSize);
  const headingId = `${columnDomId(stage)}-heading`;

  return (
    <section
      ref={setNodeRef}
      data-stage={stage}
      className={cx(
        'flex min-h-0 min-w-[210px] flex-[1_0_210px] flex-col rounded-xl border border-t-4 border-line bg-slate-100/70 transition-colors',
        STAGE_ACCENT[stage],
        isOver && 'border-accent bg-accent-soft ring-2 ring-accent',
      )}
    >
      <header id={headingId} className="flex flex-col gap-0.5 px-3 pt-2.5 pb-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h2>
          {ids.length > 0 && (
            <button
              type="button"
              className="link-button"
              aria-label={`Select all ${formatCount(ids.length)} in ${STAGE_LABELS[stage]}`}
              onClick={() => setSelection([...selection, ...ids])}
            >
              Select all
            </button>
          )}
        </div>
        <span className="muted">
          {formatCount(summary.count)} · {formatInrCompact(summary.value)}
        </span>
      </header>
      <div
        ref={scrollRef}
        id={columnDomId(stage)}
        role="listbox"
        aria-labelledby={headingId}
        aria-multiselectable="true"
        aria-activedescendant={focusedIndex >= 0 && focusedId ? cardDomId(focusedId) : undefined}
        tabIndex={tabbable ? 0 : -1}
        className="min-h-0 flex-1 overflow-y-auto px-2 focus-visible:-outline-offset-2"
        onKeyDown={onKeyDown}
      >
        {ids.length === 0 ? (
          <p className="my-4 text-center text-muted">No deals</p>
        ) : (
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const id = ids[item.index];
              return id && <DealCard key={id} id={id} top={item.start} />;
            })}
          </div>
        )}
      </div>
    </section>
  );
});
