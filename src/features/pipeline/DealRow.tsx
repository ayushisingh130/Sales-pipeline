import { memo } from 'react';
import { formatDate, formatInr } from '../../domain/format';
import { attentionReasons } from '../../domain/priority';
import { STAGE_LABELS, STAGES, type Stage } from '../../domain/stages';
import { CURRENT_USER } from '../../domain/team';
import { useDeal, usePipeline, useServices } from '../../services';
import { outOfPlaceNote, RemoteFlash, useOutOfPlace } from '../sync-status/RemoteChange';
import { SelectBox, selectionClick } from '../selection/SelectBox';
import { SaveStatus } from '../sync-status/SaveStatus';

export const ROW_HEIGHT = 40;

export const rowDomId = (dealId: string) => `deal-row-${dealId}`;

interface DealRowProps {
  id: string;
  index: number;
  top: number;
}

/**
 * Receives only an id and subscribes to that one deal, so a teammate's change to another
 * deal doesn't re-render this row.
 */
export const DealRow = memo(function DealRow({ id, index, top }: DealRowProps) {
  const deal = useDeal(id);
  const focused = usePipeline((state) => state.focusedId === id);
  const selected = usePipeline((state) => state.selection.has(id));
  const now = usePipeline((state) => state.view.now);
  const focusDeal = usePipeline((state) => state.focusDeal);
  const services = useServices();
  const { mutations } = services;
  const outOfPlace = useOutOfPlace(id);
  const listedStage = usePipeline((state) => state.view.stageOf.get(id));

  if (!deal) return null;
  const reasons = attentionReasons(deal, now).slice(0, 2);

  return (
    <div
      role="row"
      id={rowDomId(id)}
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={[
        'deal-row',
        focused && 'is-focused',
        selected && 'is-selected',
        outOfPlace && 'is-stale',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ transform: `translateY(${top}px)` }}
      onMouseDown={() => focusDeal(id)}
      onClick={(event) => selectionClick(event, id, services.store)}
    >
      <RemoteFlash id={id} />
      <div role="gridcell" className="cell">
        <SelectBox id={id} label={deal.company} />
      </div>
      <div role="gridcell" className="cell">
        {deal.company}
        <span className="muted">{deal.id}</span>
      </div>
      <div role="gridcell" className="cell num">
        {formatInr(deal.value)}
      </div>
      <div role="gridcell" className="cell">
        {deal.owner === CURRENT_USER ? `${deal.owner} (you)` : deal.owner}
      </div>
      <div role="gridcell" className="cell">
        {/* For mouse users. tabIndex -1 keeps the grid a single tab stop; keyboard users press [ ] or 1–7. */}
        <select
          className="stage-select"
          aria-label={`Stage for ${deal.company}`}
          tabIndex={-1}
          value={deal.stage}
          onChange={(event) => mutations.moveDeal(id, event.target.value as Stage)}
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>
      <div role="gridcell" className="cell">
        {formatDate(deal.closeDate)}
      </div>
      <div role="gridcell" className="cell">
        {outOfPlace ? (
          <span className="stale-note">{outOfPlaceNote(deal, listedStage)}</span>
        ) : (
          reasons.map((reason) => (
            <span key={reason.kind} className={`chip chip-${reason.kind}`}>
              {reason.label}
            </span>
          ))
        )}
      </div>
      <div role="gridcell" className="cell">
        <SaveStatus id={id} />
      </div>
    </div>
  );
});
