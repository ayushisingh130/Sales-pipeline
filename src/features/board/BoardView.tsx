import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useEffect, useRef, useState } from 'react';
import { isStage, STAGE_LABELS, STAGES } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import { columnOf, getViewDeal } from '../../sync/store';
import { useStageSummary } from '../pipeline/useStageSummary';
import { BoardColumn, columnDomId } from './BoardColumn';
import { requestMove } from '../selection/requestMove';
import { DealCardPreview } from './DealCard';

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To move a deal without dragging, focus its card and press ] for the next stage, [ for the previous stage, 1 to 7 for a specific stage, or M to choose one. Press ? for all shortcuts.',
};

export function BoardView() {
  const services = useServices();
  const { store, mutations } = services;
  const selectionSize = usePipeline((state) => state.selection.size);
  const columns = usePipeline((state) => state.view.columns);
  const summary = useStageSummary();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // A small distance before a drag starts, so a click on a card still just focuses it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const focusedStage = usePipeline((state) =>
    state.focusedId ? columnOf(state.view, state.focusedId) : undefined,
  );
  const tabbableStage =
    focusedStage ?? STAGES.find((stage) => columns[stage].length > 0) ?? STAGES[0];

  // When focus moves to another column (←/→, or `]` moving the card), DOM focus follows it, but
  // only if the board already had focus. Never steal focus from the toolbar.
  useEffect(() => {
    if (!focusedStage || !boardRef.current?.contains(document.activeElement)) return;
    document.getElementById(columnDomId(focusedStage))?.focus({ preventScroll: true });
  }, [focusedStage]);

  const companyOf = (id: unknown) =>
    getViewDeal(store.getState(), String(id))?.company ?? 'the deal';
  const stageName = (id: unknown) => (isStage(id) ? STAGE_LABELS[id] : 'no stage');
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${companyOf(active.id)}.`,
    onDragOver: ({ over }) => `Over ${stageName(over?.id)}.`,
    onDragEnd: ({ active, over }) =>
      over ? `Dropped ${companyOf(active.id)} on ${stageName(over.id)}.` : 'Dropped. Not moved.',
    onDragCancel: ({ active }) => `Cancelled moving ${companyOf(active.id)}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null);
    if (!isStage(over?.id)) return;
    const id = String(active.id);
    const { selection } = store.getState();
    // Dragging a selected card moves the whole selection; otherwise just this deal. Either way it's
    // the same move action as the keyboard, and dropping on the deal's own column changes nothing.
    if (selection.has(id) && selection.size > 1) requestMove(services, selection, over.id);
    else mutations.moveDeal(id, over.id);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // Drops land on columns, not positions, so there's nothing to scroll toward. Auto-scroll would
      // also scroll the source column and unmount the dragged card.
      autoScroll={false}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
      onDragStart={({ active }) => {
        setDraggingId(String(active.id));
        store.getState().focusDeal(String(active.id));
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div ref={boardRef} className="board" role="region" aria-label="Pipeline board">
        {STAGES.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            summary={summary[stage]}
            tabbable={stage === tabbableStage}
          />
        ))}
      </div>
      {/* Rendered outside the columns, so the preview survives the source card being virtualized away. */}
      <DragOverlay dropAnimation={null}>
        {draggingId ? (
          <DealCardPreview
            id={draggingId}
            count={store.getState().selection.has(draggingId) ? selectionSize : 1}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
