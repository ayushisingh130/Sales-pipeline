import { useState, type KeyboardEvent } from 'react';
import { formatCount } from '../../domain/format';
import { nextStage, STAGE_LABELS, STAGES, type Stage } from '../../domain/stages';
import { useDeal, usePipeline, useServices } from '../../services';
import { requestMove } from '../selection/requestMove';
import { Modal } from './Modal';

const optionDomId = (stage: Stage) => `move-option-${stage}`;

/**
 * `m`: "Move to…" for the selection, or the focused deal if nothing is selected. Type to filter
 * (a stage name or its number), ↑/↓ to choose, Enter to move. It goes through the same move action
 * as dragging, so big moves and moves to Lost still ask for confirmation.
 */
export function MoveMenu() {
  const open = usePipeline((state) => state.overlay === 'move');
  return open ? <MoveMenuDialog /> : null;
}

function MoveMenuDialog() {
  const services = useServices();
  const { store, mutations } = services;
  const selectionSize = usePipeline((state) => state.selection.size);
  const focusedId = usePipeline((state) => state.focusedId);
  const focused = useDeal(focusedId ?? '');
  const single = selectionSize === 0 ? focused : undefined;

  const [text, setText] = useState('');
  // Start on the next stage: the most likely move for one deal.
  const [active, setActive] = useState(() => {
    const next = single && nextStage(single.stage);
    return next ? STAGES.indexOf(next) : 0;
  });

  const query = text.trim().toLowerCase();
  const options = STAGES.map((stage, index) => ({ stage, key: String(index + 1) })).filter(
    ({ stage, key }) =>
      !query || key === query || STAGE_LABELS[stage].toLowerCase().includes(query),
  );
  const activeStage = options[Math.min(active, options.length - 1)]?.stage;

  const close = () => store.getState().setOverlay(null);
  const choose = (stage: Stage) => {
    // Close first, in the same update as the move: focus returns to the board, then follows the card.
    close();
    const { selection } = store.getState();
    if (selection.size > 0) requestMove(services, selection, stage);
    else if (single) mutations.moveDeal(single.id, stage);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step && options.length > 0) {
      const current = Math.min(active, options.length - 1);
      setActive((current + step + options.length) % options.length);
      event.preventDefault();
    } else if (event.key === 'Enter' && activeStage) {
      choose(activeStage);
      event.preventDefault();
    }
  };

  const title = single
    ? `Move ${single.company} to…`
    : `Move ${formatCount(selectionSize)} deals to…`;

  return (
    <Modal labelledBy="move-menu-title" onClose={close}>
      <h2 id="move-menu-title">{title}</h2>
      <input
        data-autofocus
        role="combobox"
        aria-label="Stage"
        aria-expanded="true"
        aria-controls="move-options"
        aria-autocomplete="list"
        aria-activedescendant={activeStage ? optionDomId(activeStage) : undefined}
        placeholder="Type a stage or 1–7"
        className="move-input"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="move-options" role="listbox" aria-label="Stages" className="move-options">
        {options.map(({ stage, key }) => (
          <li
            key={stage}
            id={optionDomId(stage)}
            role="option"
            aria-selected={stage === activeStage}
            className={stage === activeStage ? 'is-active' : undefined}
            onClick={() => choose(stage)}
          >
            <kbd>{key}</kbd> {STAGE_LABELS[stage]}
            {single?.stage === stage && <span className="muted"> (current)</span>}
          </li>
        ))}
      </ul>
      {options.length === 0 && <p className="muted">No matching stage</p>}
    </Modal>
  );
}
