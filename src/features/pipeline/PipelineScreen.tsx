import { usePipeline, useServices } from '../../services';
import { BoardView } from '../board/BoardView';
import { SimulatorPanel } from '../devtools/SimulatorPanel';
import { MoveMenu } from '../keyboard/MoveMenu';
import { ShortcutHelp } from '../keyboard/ShortcutHelp';
import { loadDeals } from '../../sync/load';
import { BulkBar } from '../selection/BulkBar';
import { ConfirmMoveDialog } from '../selection/ConfirmMoveDialog';
import { JobsPanel } from '../sync-status/JobsPanel';
import { SyncIndicator } from '../sync-status/SyncIndicator';
import { Toasts } from '../sync-status/Toasts';
import { UpdatesBanner } from '../sync-status/UpdatesBanner';
import { useUnsavedChangesWarning } from '../sync-status/useUnsavedChangesWarning';
import { DealTable } from './DealTable';
import { StageStrip } from './StageStrip';
import { Toolbar } from './Toolbar';

export function PipelineScreen() {
  const load = usePipeline((state) => state.load);
  const viewMode = usePipeline((state) => state.viewMode);
  const { api, store } = useServices();
  useUnsavedChangesWarning();

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-none items-center gap-4 border-b border-line bg-white px-4 py-2.5">
        <h1 className="flex items-center gap-2 text-base font-semibold">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
          Sales Pipeline
        </h1>
        {load.status === 'ready' && <SyncIndicator />}
        {/* Outside the ready check: a failed first load can be fixed here, then retried. */}
        <SimulatorPanel />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
        {load.status === 'ready' && <Toolbar />}

        {load.status === 'loading' && (
          <p role="status" className="text-muted">
            Loading deals…
          </p>
        )}

        {load.status === 'error' && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-danger"
          >
            Couldn&apos;t load deals ({load.message}).
            <button type="button" className="btn" onClick={() => void loadDeals(api, store)}>
              Retry
            </button>
          </div>
        )}

        {load.status === 'ready' &&
          (viewMode === 'board' ? (
            <BoardView />
          ) : (
            // The board's columns already are the stages, so the stage strip is List-only.
            <>
              <StageStrip />
              <DealTable />
            </>
          ))}
      </main>

      {load.status === 'ready' && (
        <>
          <UpdatesBanner />
          <BulkBar />
          <JobsPanel />
          <ConfirmMoveDialog />
          <MoveMenu />
          <ShortcutHelp />
        </>
      )}
      <Toasts />
    </div>
  );
}
