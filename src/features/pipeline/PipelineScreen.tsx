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
import './PipelineScreen.css';

export function PipelineScreen() {
  const load = usePipeline((state) => state.load);
  const viewMode = usePipeline((state) => state.viewMode);
  const { api, store } = useServices();
  useUnsavedChangesWarning();

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Sales Pipeline</h1>
        {load.status === 'ready' && (
          <>
            <Toolbar />
            <SyncIndicator />
          </>
        )}
        {/* Outside the ready check: a failed first load can be fixed here, then retried. */}
        <SimulatorPanel />
      </header>

      {load.status === 'loading' && <p role="status">Loading deals…</p>}

      {load.status === 'error' && (
        <div role="alert" className="load-error">
          Couldn&apos;t load deals ({load.message}).{' '}
          <button type="button" onClick={() => void loadDeals(api, store)}>
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
