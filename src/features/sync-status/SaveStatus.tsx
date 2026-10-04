import { usePipeline, useServices } from '../../services';
import { MAX_ATTEMPTS } from '../../sync/retry';
import './SaveStatus.css';

/** Save state of one deal. Shared by table rows and board cards. */
export function SaveStatus({ id }: { id: string }) {
  const change = usePipeline((state) => state.pending.get(id));
  const { mutations } = useServices();
  if (!change) return null;

  switch (change.status) {
    case 'saving':
      return <span className="save-status is-saving">Saving…</span>;
    case 'retrying':
      return (
        <span className="save-status is-saving" title={change.error}>
          Retrying ({change.attempts + 1}/{MAX_ATTEMPTS})…
        </span>
      );
    case 'failed':
      return (
        <span className="save-status is-failed" title={change.error}>
          Not saved{' '}
          {/* Mouse shortcut only; keyboard users get Retry in the Unsaved changes panel. */}
          <button type="button" tabIndex={-1} onClick={() => mutations.retry(id)}>
            Retry
          </button>
        </span>
      );
    case 'conflict':
      return (
        <span className="save-status is-conflict" title={change.error}>
          Conflict
        </span>
      );
  }
}
