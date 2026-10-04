import { usePipeline, useServices } from '../../services';
import { MAX_ATTEMPTS } from '../../sync/retry';

const SAVING = 'shrink-0 text-xs text-muted';
const PROBLEM = 'shrink-0 text-xs font-semibold text-danger';

/** Save state of one deal. Shared by table rows and board cards. */
export function SaveStatus({ id }: { id: string }) {
  const change = usePipeline((state) => state.pending.get(id));
  const { mutations } = useServices();
  if (!change) return null;

  switch (change.status) {
    case 'saving':
      return <span className={SAVING}>Saving…</span>;
    case 'retrying':
      return (
        <span className={SAVING} title={change.error}>
          Retrying ({change.attempts + 1}/{MAX_ATTEMPTS})…
        </span>
      );
    case 'failed':
      return (
        <span className={PROBLEM} title={change.error}>
          Not saved{' '}
          {/* Mouse shortcut only; keyboard users get Retry in the Unsaved changes panel. */}
          <button
            type="button"
            className="cursor-pointer rounded border border-red-200 bg-red-50 px-1.5 leading-tight hover:bg-red-100"
            tabIndex={-1}
            onClick={() => mutations.retry(id)}
          >
            Retry
          </button>
        </span>
      );
    case 'conflict':
      return (
        <span className={PROBLEM} title={change.error}>
          Conflict
        </span>
      );
  }
}
