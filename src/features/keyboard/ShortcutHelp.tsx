import { usePipeline, useServices } from '../../services';
import { Modal } from './Modal';

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
      <dl className="mt-3 grid max-h-[60vh] gap-1.5 overflow-auto">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={keys} className="grid grid-cols-[11em_1fr] gap-2">
            <dt>
              <kbd>{keys}</kbd>
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn" data-autofocus onClick={close}>
          Close
        </button>
      </div>
    </Modal>
  );
}
