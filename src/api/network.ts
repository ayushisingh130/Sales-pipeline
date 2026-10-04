import { pickWeighted, randomBetween, type Rng } from './random';
import type { SimConfig } from './simConfig';
import { ApiError, type RequestOptions } from './types';

export interface Network {
  /** Runs `operation` as if it were a remote call: with latency, random failures and abort support. */
  request<T>(operation: () => T, options?: RequestOptions): Promise<T>;
}

export function createNetwork(getConfig: () => SimConfig, rng: Rng): Network {
  return {
    request<T>(operation: () => T, { signal }: RequestOptions = {}) {
      return new Promise<T>((resolve, reject) => {
        if (signal?.aborted) {
          reject(new ApiError('timeout', 'Request aborted'));
          return;
        }

        const config = getConfig();
        const latency = randomBetween(rng, config.latencyMinMs, config.latencyMaxMs);
        const failure = config.offline
          ? 'network'
          : rng() < config.failureRate
            ? pickWeighted(rng, config.failureMix)
            : null;

        let timer: ReturnType<typeof setTimeout>;
        const onAbort = () => {
          clearTimeout(timer);
          reject(new ApiError('timeout', 'Request aborted'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        const settle = (finish: () => void) => {
          signal?.removeEventListener('abort', onAbort);
          finish();
        };

        timer = setTimeout(() => {
          if (failure === 'network') {
            return settle(() => reject(new ApiError('network', 'Network error')));
          }
          if (failure === 'server') {
            return settle(() => reject(new ApiError('server', '500 Internal Server Error')));
          }

          let result: T;
          try {
            result = operation();
          } catch (error) {
            return settle(() => reject(error));
          }

          if (failure === 'timeout') {
            // The write is applied, but the response is lost. Only an idempotent retry is safe now.
            timer = setTimeout(
              () => settle(() => reject(new ApiError('timeout', 'Request timed out'))),
              config.timeoutHangMs,
            );
            return;
          }
          settle(() => resolve(result));
        }, latency);
      });
    },
  };
}
