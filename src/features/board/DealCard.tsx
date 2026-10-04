import { useDraggable } from '@dnd-kit/core';
import { memo } from 'react';
import type { Deal } from '../../api/types';
import { cx } from '../../cx';
import { formatCount, formatDate, formatInr } from '../../domain/format';
import { attentionReasons } from '../../domain/priority';
import { isClosed } from '../../domain/stages';
import { CURRENT_USER } from '../../domain/team';
import { useDeal, usePipeline, useServices } from '../../services';
import { SelectBox, selectionClick } from '../selection/SelectBox';
import { outOfPlaceNote, RemoteFlash, useOutOfPlace } from '../sync-status/RemoteChange';
import { SaveStatus } from '../sync-status/SaveStatus';
import { AttentionSignals } from '../pipeline/AttentionSignals';

/** Card height plus the gap below it. Fixed, so the column virtualizer never has to measure. */
export const CARD_SLOT_HEIGHT = 108;

export const cardDomId = (dealId: string) => `deal-card-${dealId}`;

/** Fixed height for the virtualizer, so long text ends in "…" instead of growing the card. */
const CARD =
  'flex h-[100px] flex-col overflow-hidden rounded-lg border bg-white px-2 py-2 select-none touch-none';
const PREVIEW = 'relative w-[220px] rotate-2 cursor-grabbing border-line';
const META = 'flex justify-between gap-2 text-[11px]/4 *:min-w-0 *:truncate';

/**
 * What a card shows. Shared by the card in its column and the drag preview. Four rows, every one
 * starting at the same left edge: name, value and owner, close date and save status, and why the
 * deal needs attention (or, if a teammate changed it, who did).
 */
function CardContent({ deal, now, note }: { deal: Deal; now: number; note?: string }) {
  // With the "My deals" filter every card would say "You", so the owner only shows for everyone's.
  const showOwner = usePipeline((state) => state.query.owner !== 'me');
  return (
    <>
      <div className="truncate font-semibold" title={deal.company}>
        <SelectBox id={deal.id} label={deal.company} />
        {deal.company}
      </div>
      <div className={META}>
        <span className="num text-slate-700">{formatInr(deal.value)}</span>
        {showOwner && (
          <span className="text-muted">{deal.owner === CURRENT_USER ? 'You' : deal.owner}</span>
        )}
      </div>
      <div className={cx(META, 'text-muted')}>
        <span>
          {isClosed(deal.stage) ? 'Closed' : 'Closes'} {formatDate(deal.closeDate)}
        </span>
        <SaveStatus id={deal.id} />
      </div>
      {/* Always rendered, so the rows above sit at the same height on every card. */}
      <div className="h-[18px]">
        {note ? (
          <div className="truncate text-[11px]/4 text-muted italic" title={note}>
            {note}
          </div>
        ) : (
          <AttentionSignals reasons={attentionReasons(deal, now)} compact />
        )}
      </div>
    </>
  );
}

interface DealCardProps {
  id: string;
  top: number;
}

/** Subscribes to its own deal only, so another deal's change doesn't re-render it. */
export const DealCard = memo(function DealCard({ id, top }: DealCardProps) {
  const deal = useDeal(id);
  const focused = usePipeline((state) => state.focusedId === id);
  const selected = usePipeline((state) => state.selection.has(id));
  const now = usePipeline((state) => state.view.now);
  const focusDeal = usePipeline((state) => state.focusDeal);
  const { store } = useServices();
  const outOfPlace = useOutOfPlace(id);
  const listedStage = usePipeline((state) => state.view.stageOf.get(id));
  // dnd-kit's `attributes` (role=button, tabIndex=0) aren't spread: the column is the listbox and
  // the only tab stop, and keyboard moves use [ ] / 1–7 rather than dnd-kit's keyboard sensor.
  const { setNodeRef, listeners, isDragging } = useDraggable({ id });

  if (!deal) return null;
  const className = cx(
    CARD,
    'absolute inset-x-0 top-0 justify-between cursor-grab shadow-xs transition-shadow hover:shadow-md',
    'aria-selected:border-indigo-300 aria-selected:bg-indigo-50/60',
    focused
      ? 'border-accent before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent'
      : 'border-line',
    isDragging && 'opacity-40',
    outOfPlace && 'opacity-55',
  );

  return (
    <div
      ref={setNodeRef}
      id={cardDomId(id)}
      role="option"
      aria-selected={selected}
      className={className}
      style={{ transform: `translateY(${top}px)` }}
      onMouseDown={() => focusDeal(id)}
      onClick={(event) => selectionClick(event, id, store)}
      {...listeners}
    >
      <RemoteFlash id={id} />
      <CardContent
        deal={deal}
        now={now}
        note={outOfPlace ? outOfPlaceNote(deal, listedStage) : undefined}
      />
    </div>
  );
});

/**
 * The card that follows the pointer, rendered in dnd-kit's DragOverlay outside the virtualized
 * column. When a selected card is dragged, the whole selection goes with it.
 */
export function DealCardPreview({ id, count }: { id: string; count: number }) {
  const deal = useDeal(id);
  const now = usePipeline((state) => state.view.now);
  if (!deal) return null;
  if (count > 1) {
    return (
      <div
        className={cx(
          CARD,
          PREVIEW,
          'justify-center shadow-[4px_4px_0_-1px_#fff,4px_4px_0_0_var(--color-line),8px_8px_0_-1px_#fff,8px_8px_0_0_var(--color-line),0_12px_28px_rgb(0_0_0/25%)]',
        )}
      >
        <div className="truncate font-semibold">Moving {formatCount(count)} deals</div>
        <div className="muted">Drop on a stage</div>
      </div>
    );
  }
  return (
    <div className={cx(CARD, PREVIEW, 'justify-between shadow-xl')}>
      <CardContent deal={deal} now={now} />
    </div>
  );
}
