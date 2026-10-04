import { usePipeline, useServices } from '../../services';
import { Modal } from './Modal';
import './ShortcutHelp.css';

const SHORTCUTS: [keys: string, action: string][] = [
  ['↑ ↓ or j k', 'Previous / next deal'],
  ['← →', 'Previous / next column (board)'],
  ['Home End PgUp PgDn', 'First / last deal, a page up / down'],
  ['] [', 'Move the deal to the next / previous stage'],
  ['1 – 7', 'Move to that stage (the selection, if any)'],
  ['m', 'Move to… (type a stage, Enter)'],
  ['z', 'Undo the last move'],
  ['Space or x', 'Select / deselect the deal'],
  ['Shift + ↑ ↓', 'Extend the selection'],
  ['Ctrl/⌘ + A', 'Select all matching deals'],
  ['Esc', 'Clear the selection'],
  ['r', "Show teammates' updates"],
  ['u', 'Open unsaved changes'],
  ['/', 'Search (Enter goes back to the deals)'],
  ['?', 'This help'],
];

/** `?`: every shortcut on one screen. They work while the board or list has focus. */
export function ShortcutHelp() {
  const open = usePipeline((state) => state.overlay === 'help');
  const { store } = useServices();
  if (!open) return null;
  const close = () => store.getState().setOverlay(null);

  return (
    <Modal labelledBy="shortcut-help-title" onClose={close}>
      <h2 id="shortcut-help-title">Keyboard shortcuts</h2>
      <p className="muted">These work while the board or list has focus. Dragging is optional.</p>
      <dl className="shortcut-list">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys}>
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <div className="modal-actions">
        <button type="button" data-autofocus onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}
