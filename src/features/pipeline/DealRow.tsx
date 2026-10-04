import { memo } from 'react';
import { cx } from '../../cx';
import { formatDate, formatInr } from '../../domain/format';
import { attentionReasons } from '../../domain/priority';
import { STAGE_LABELS, STAGES, type Stage } from '../../domain/stages';
import { CURRENT_USER } from '../../domain/team';
import { useDeal, usePipeline, useServices } from '../../services';
import { outOfPlaceNote, RemoteFlash, useOutOfPlace } from '../sync-status/RemoteChange';
import { SelectBox, selectionClick } from '../selection/SelectBox';
import { SaveStatus } from '../sync-status/SaveStatus';
import { AttentionSignals } from './AttentionSignals';

export const ROW_HEIGHT = 40;

/** Shared by the header row and the deal rows, so the columns line up. */
export const ROW_GRID =
  'grid h-10 grid-cols-[24px_minmax(220px,2fr)_110px_110px_130px_80px_minmax(190px,2fr)_150px] items-center gap-3 border-b px-3';
const CELL = 'truncate';

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
  return (
    <div
      role="row"
      id={rowDomId(id)}
      aria-rowindex={index + 2}
      aria-selected={selected}
      className={cx(
        ROW_GRID,
        'absolute inset-x-0 top-0 border-slate-100',
        focused
          ? 'bg-accent-soft before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent'
          : 'bg-white hover:bg-surface aria-selected:bg-indigo-50/60',
        outOfPlace && 'opacity-55',
      )}
      style={{ transform: `translateY(${top}px)` }}
      onMouseDown={() => focusDeal(id)}
      onClick={(event) => selectionClick(event, id, services.store)}
    >
      <RemoteFlash id={id} />
      <div role="gridcell" className={CELL}>
        <SelectBox id={id} label={deal.company} />
      </div>
      <div role="gridcell" className={CELL} title={`${deal.company} · ${deal.id}`}>
        {deal.company}
        <span className="ml-1.5 muted">{deal.id}</span>
      </div>
      <div role="gridcell" className={cx(CELL, 'num font-medium')}>
        {formatInr(deal.value)}
      </div>
      <div role="gridcell" className={CELL}>
        {deal.owner === CURRENT_USER ? `${deal.owner} (you)` : deal.owner}
      </div>
      <div role="gridcell" className={CELL}>
        {/* For mouse users. tabIndex -1 keeps the grid a single tab stop; keyboard users press [ ] or 1–7. */}
        <select
          className="w-full cursor-pointer rounded border border-transparent bg-transparent p-0.5 hover:border-line"
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
      <div role="gridcell" className={CELL}>
        {formatDate(deal.closeDate)}
      </div>
      <div role="gridcell" className={CELL}>
        {outOfPlace ? (
          <span className="text-xs text-muted italic">{outOfPlaceNote(deal, listedStage)}</span>
        ) : (
          <AttentionSignals reasons={attentionReasons(deal, now)} />
        )}
      </div>
      <div role="gridcell" className={CELL}>
        <SaveStatus id={id} />
      </div>
    </div>
  );
});
