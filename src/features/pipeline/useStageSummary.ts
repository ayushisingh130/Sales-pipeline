import { useMemo } from 'react';
import { summarizeStages } from '../../domain/query';
import { usePipeline } from '../../services';
import { viewDeals } from '../../sync/store';

/**
 * Count and ₹ total per stage under the current filters. Unlike the list order, these update live:
 * a number changing doesn't move anything under the cursor.
 */
export function useStageSummary() {
  const server = usePipeline((state) => state.server);
  const pending = usePipeline((state) => state.pending);
  const query = usePipeline((state) => state.query);
  const now = usePipeline((state) => state.view.now);
  return useMemo(
    () => summarizeStages(viewDeals({ server, pending }), query, now),
    [server, pending, query, now],
  );
}
