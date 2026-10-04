import { formatCount } from '../../domain/format';
import { STAGE_LABELS } from '../../domain/stages';
import { usePipeline, useServices } from '../../services';
import type { BulkJob } from '../../sync/store';
import './JobsPanel.css';

/** Progress of bulk moves. Bottom-left, out of the way; the rest of the UI stays usable. */
export function JobsPanel() {
  const jobs = usePipeline((state) => state.jobs);
  if (jobs.length === 0) return null;
  return (
    <section className="jobs-panel" aria-label="Bulk moves">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </section>
  );
}

function JobRow({ job }: { job: BulkJob }) {
  const { mutations } = useServices();
  const processed = job.saved + job.failed + job.conflicts + job.cancelled;
  const stage = STAGE_LABELS[job.stage];
  const running = job.status === 'running';

  const details = [
    `${formatCount(job.saved)} saved`,
    job.failed > 0 && `${formatCount(job.failed)} failed`,
    job.conflicts > 0 && `${formatCount(job.conflicts)} conflicts (see Unsaved changes)`,
    job.cancelled > 0 && `${formatCount(job.cancelled)} cancelled`,
  ].filter(Boolean);

  return (
    <div className="job">
      <div>
        <strong>
          {running ? 'Moving' : 'Moved'} {formatCount(job.total)} deals → {stage}
        </strong>
        <progress
          max={job.total}
          value={processed}
          aria-label={`Moving deals to ${stage}`}
          aria-valuetext={`${formatCount(processed)} of ${formatCount(job.total)}`}
        />
        <div className="muted">{details.join(' · ')}</div>
      </div>
      <div className="job-actions">
        {running && (
          <button type="button" onClick={() => mutations.cancelJob(job.id)}>
            Cancel
          </button>
        )}
        {!running && job.failed > 0 && (
          <button type="button" onClick={() => mutations.retryJob(job.id)}>
            Retry failed ({formatCount(job.failed)})
          </button>
        )}
        {!running && (
          <button type="button" aria-label="Dismiss" onClick={() => mutations.dismissJob(job.id)}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
