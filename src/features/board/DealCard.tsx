import { useDraggable } from '@dnd-kit/core';
import { memo } from 'react';
import type { Deal } from '../../api/types';
import { formatCount, formatDate, formatInr } from '../../domain/format';
import { attentionReasons } from '../../domain/priority';
import { CURRENT_USER } from '../../domain/team';
import { useDeal, usePipeline, useServices } from '../../services';
import { SelectBox, selectionClick } from '../selection/SelectBox';
import { outOfPlaceNote, RemoteFlash, useOutOfPlace } from '../sync-status/RemoteChange';
import { SaveStatus } from '../sync-status/SaveStatus';

/** Card height plus the gap below it. Fixed, so the column virtualizer never has to measure. */
export const CARD_SLOT_HEIGHT = 100;

export const cardDomId = (dealId: string) => `deal-card-${dealId}`;

/** What a card shows. Shared by the card in its column and the drag preview. */
function CardContent({ deal, now, note }: { deal: Deal; now: number; note?: string }) {
  const reasons = attentionReasons(deal, now).slice(0, 2);
  return (
    <>
      <div className="card-title">
        <SelectBox id={deal.id} label={deal.company} />
        {deal.company}
      </div>
      <div className="card-meta">
        <span className="num">{formatInr(deal.value)}</span>
        <span>{deal.owner === CURRENT_USER ? 'You' : deal.owner}</span>
      </div>
      <div className="card-meta muted">
        <span>Closes {formatDate(deal.closeDate)}</span>
        <SaveStatus id={deal.id} />
      </div>
      <div className="card-chips">
        {note && <span className="stale-note">{note}</span>}
        {!note &&
          reasons.map((reason) => (
            <span key={reason.kind} className={`chip chip-${reason.kind}`}>
              {reason.label}
            </span>
          ))}
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
  const className = [
    'deal-card',
    focused && 'is-focused',
    selected && 'is-selected',
    isDragging && 'is-dragging',
    outOfPlace && 'is-stale',
  ]
    .filter(Boolean)
    .join(' ');

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
      <div className="deal-card is-preview is-stack">
        <div className="card-title">Moving {formatCount(count)} deals</div>
        <div className="card-meta muted">Drop on a stage</div>
      </div>
    );
  }
  return (
    <div className="deal-card is-preview">
      <CardContent deal={deal} now={now} />
    </div>
  );
}
