import type { Stage } from '../domain/stages';

export interface Deal {
  id: string;
  company: string;
  licences: number;
  /** Deal value in INR. */
  value: number;
  owner: string;
  stage: Stage;
  /** Expected close date, epoch ms. */
  closeDate: number;
  lastActivityAt: number;
  updatedAt: number;
  updatedBy: string;
  /** Incremented by the server on every write. Used to detect conflicts and stale events. */
  version: number;
}

/** Fields the client may change. Widen this union to make another field editable; the sync code is generic. */
export type EditableField = 'stage';
export type DealPatch = Partial<Pick<Deal, EditableField>>;

export interface RequestOptions {
  /** Aborting rejects the request with an `ApiError` of kind `timeout`. */
  signal?: AbortSignal;
}

export interface UpdateDealRequest {
  id: string;
  patch: DealPatch;
  /** The version this change was based on. If the server has moved on, the request is rejected as a conflict. */
  expectedVersion: number;
  /** Sending the same key again returns the first result instead of applying the change twice. */
  idempotencyKey: string;
  actor: string;
}

export interface BulkUpdateRequest {
  items: ReadonlyArray<{ id: string; expectedVersion: number }>;
  patch: DealPatch;
  idempotencyKey: string;
  actor: string;
}

export type BulkItemResult =
  | { id: string; ok: true; deal: Deal }
  | { id: string; ok: false; reason: 'conflict'; current: Deal }
  | { id: string; ok: false; reason: 'not_found' };

export interface DealEvent {
  type: 'deal.updated';
  deal: Deal;
  actor: string;
}

/** What the UI talks to. The fake backend implements it; a fetch + WebSocket client could replace it. */
export interface PipelineApi {
  listDeals(options?: RequestOptions): Promise<Deal[]>;
  updateDeal(request: UpdateDealRequest, options?: RequestOptions): Promise<Deal>;
  /** Rejects only if the whole request fails. Per-deal conflicts come back as results. */
  updateDeals(request: BulkUpdateRequest, options?: RequestOptions): Promise<BulkItemResult[]>;
  /** Push channel for everyone's changes, including our own. Returns an unsubscribe function. */
  subscribe(listener: (event: DealEvent) => void): () => void;
}

export type ApiErrorKind = 'network' | 'server' | 'timeout' | 'conflict' | 'not_found';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** For conflicts: the server's current version of the deal. */
  readonly current?: Deal;

  constructor(kind: ApiErrorKind, message: string, current?: Deal) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.current = current;
  }
}
