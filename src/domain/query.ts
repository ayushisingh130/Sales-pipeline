import type { Deal } from '../api/types';
import { attentionScore } from './priority';
import { isClosed, STAGES, type Stage } from './stages';
import { CURRENT_USER } from './team';

export type StageFilter = Stage | 'open' | 'all';
export type SortKey = 'attention' | 'value' | 'closeDate' | 'lastActivity' | 'company';

export interface Query {
  owner: 'me' | 'anyone';
  stage: StageFilter;
  search: string;
  overdueOnly: boolean;
  sort: SortKey;
}

/** Presets leave `search` alone, so switching views keeps what the user typed. */
export type Preset = Omit<Query, 'search'>;

export const NEEDS_ATTENTION: Preset = {
  owner: 'me',
  stage: 'open',
  overdueOnly: false,
  sort: 'attention',
};
export const ALL_DEALS: Preset = {
  owner: 'anyone',
  stage: 'all',
  overdueOnly: false,
  sort: 'value',
};

export const DEFAULT_QUERY: Query = { ...NEEDS_ATTENTION, search: '' };

export function matchesPreset(query: Query, preset: Preset): boolean {
  return (Object.keys(preset) as (keyof Preset)[]).every((key) => query[key] === preset[key]);
}

export const SORT_LABELS: Record<SortKey, string> = {
  attention: 'Needs attention',
  value: 'Value (high → low)',
  closeDate: 'Close date (soonest)',
  lastActivity: 'Last activity (oldest)',
  company: 'Company (A → Z)',
};

// Deal records are replaced on every write, so caching by object identity never goes stale.
const searchTextCache = new WeakMap<Deal, string>();
function searchText(deal: Deal): string {
  let text = searchTextCache.get(deal);
  if (text === undefined) {
    text = `${deal.company} ${deal.owner} ${deal.id}`.toLowerCase();
    searchTextCache.set(deal, text);
  }
  return text;
}

function matchesStage(stage: Stage, filter: StageFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'open') return !isClosed(stage);
  return stage === filter;
}

/** Every filter except stage. The stage strip uses this to count each stage. */
function matchesBase(deal: Deal, query: Query, now: number, needle: string): boolean {
  if (query.owner === 'me' && deal.owner !== CURRENT_USER) return false;
  if (query.overdueOnly && (isClosed(deal.stage) || deal.closeDate >= now)) return false;
  return needle === '' || searchText(deal).includes(needle);
}

const normalize = (search: string) => search.trim().toLowerCase();

export function matchesQuery(deal: Deal, query: Query, now: number): boolean {
  return (
    matchesStage(deal.stage, query.stage) && matchesBase(deal, query, now, normalize(query.search))
  );
}

/** Ascending sort keys, computed once per deal rather than inside the comparator. */
const SORT_KEY: Record<SortKey, (deal: Deal, now: number) => number | string> = {
  // Score first, then value; values stay well below 1e9.
  attention: (deal, now) => -(attentionScore(deal, now) * 1e9 + deal.value),
  value: (deal) => -deal.value,
  closeDate: (deal) => deal.closeDate,
  lastActivity: (deal) => deal.lastActivityAt,
  // Lowercased and compared directly: Intl.Collator took about 66ms at 50k.
  // Fine for ASCII names; real multilingual data would need the collator.
  company: (deal) => deal.company.toLowerCase(),
};

const compareKeys = <T extends number | string>(a: T, b: T) => (a < b ? -1 : a > b ? 1 : 0);

/** Comparator for one deal against another, e.g. to insert a single deal at its sorted position. */
export function compareDeals(query: Query, now: number): (a: Deal, b: Deal) => number {
  const keyOf = SORT_KEY[query.sort];
  return (a, b) => compareKeys(keyOf(a, now), keyOf(b, now)) || compareKeys(a.id, b.id);
}

/** Filter and sort to an ordered list of ids. This is the expensive call; the store runs it only on user actions. */
export function selectIds(deals: readonly Deal[], query: Query, now: number): string[] {
  const needle = normalize(query.search);
  const keyOf = SORT_KEY[query.sort];
  return deals
    .filter(
      (deal) => matchesStage(deal.stage, query.stage) && matchesBase(deal, query, now, needle),
    )
    .map((deal) => ({ id: deal.id, key: keyOf(deal, now) }))
    .sort((a, b) => compareKeys(a.key, b.key) || compareKeys(a.id, b.id))
    .map(({ id }) => id);
}

export interface StageSummary {
  count: number;
  value: number;
}

/** Count and total value per stage (plus "open" and "all") under the current filters, ignoring the stage filter. */
export function summarizeStages(
  deals: readonly Deal[],
  query: Query,
  now: number,
): Record<StageFilter, StageSummary> {
  const summary = Object.fromEntries(
    (['all', 'open', ...STAGES] as const).map((key) => [key, { count: 0, value: 0 }]),
  ) as Record<StageFilter, StageSummary>;
  const add = (bucket: StageSummary, deal: Deal) => {
    bucket.count += 1;
    bucket.value += deal.value;
  };
  const needle = normalize(query.search);

  for (const deal of deals) {
    if (!matchesBase(deal, query, now, needle)) continue;
    add(summary.all, deal);
    add(summary[deal.stage], deal);
    if (!isClosed(deal.stage)) add(summary.open, deal);
  }
  return summary;
}
