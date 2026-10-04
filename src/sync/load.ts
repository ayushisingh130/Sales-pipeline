import type { PipelineApi } from '../api/types';
import type { PipelineStore } from './store';

export async function loadDeals(api: PipelineApi, store: PipelineStore): Promise<void> {
  store.getState().setLoad({ status: 'loading' });
  try {
    store.getState().receiveDeals(await api.listDeals());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    store.getState().setLoad({ status: 'error', message });
  }
}
