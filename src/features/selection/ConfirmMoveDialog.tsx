import { useMemo } from 'react';
import { formatCount, formatInrCompact } from '../../domain/format';
import { STAGE_LABELS } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import { Modal } from '../keyboard/Modal';
import { confirmMove } from './requestMove';

/** "Move 3,214 deals (₹42.1Cr) to Lost?" Focus starts on the confirm button, so Enter confirms. */
export function ConfirmMoveDialog() {
  const services = useServices();
  const request = usePipeline((state) => state.moveRequest);
  const server = usePipeline((state) => state.server);

  const totalValue = useMemo(
    () => request?.ids.reduce((sum, id) => sum + (server.get(id)?.value ?? 0), 0) ?? 0,
    [request, server],
  );

  if (!request) return null;
  const count = formatCount(request.ids.length);
  const cancel = () => services.store.getState().setMoveRequest(null);

  return (
    <Modal labelledBy="confirm-move-title" onClose={cancel}>
      <h2 id="confirm-move-title">
        Move {count} deals ({formatInrCompact(totalValue)}) to {STAGE_LABELS[request.stage]}?
      </h2>
      <p className="muted">
        They move right away and save in the background. You can keep working while they do.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="btn btn-primary"
          data-autofocus
          onClick={() => confirmMove(services)}
        >
          Move {count} deals
        </button>
        <button type="button" className="btn" onClick={cancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
