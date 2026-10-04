import { isClosed, type Stage } from '../domain/stages';
import { TEAM } from '../domain/team';
import { DAY_MS } from '../domain/time';
import { createRng, pick, pickWeighted, randomInt } from './random';
import type { Deal } from './types';

export const DEFAULT_DEAL_COUNT = 50_000;

/** Skewed so that New Lead and Lost each hold more than 10k of the 50k deals. */
const STAGE_WEIGHTS: Record<Stage, number> = {
  new_lead: 11,
  contacted: 8,
  demo_done: 6,
  proposal_sent: 5,
  negotiation: 4,
  won: 4,
  lost: 12,
};

// prettier-ignore
const PREFIXES = [
  'Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli', 'Vandelay', 'Soylent',
  'Tyrell', 'Cyberdyne', 'Wonka', 'Oscorp', 'Gringotts', 'Monarch', 'Aperture', 'Nakatomi',
  'Pied Piper', 'Dunder', 'Sterling', 'Bluth', 'Prestige', 'Zenith', 'Orion', 'Nimbus',
  'Lotus', 'Saffron', 'Indigo', 'Banyan', 'Kestrel', 'Falcon', 'Everest', 'Ganges', 'Neem',
  'Coral', 'Quartz', 'Pinnacle', 'Summit', 'Vertex', 'Horizon',
];
// prettier-ignore
const SUFFIXES = [
  'Corp', 'Logistics', 'Labs', 'Systems', 'Foods', 'Motors', 'Pharma', 'Textiles', 'Retail',
  'Finance', 'Health', 'Media', 'Energy', 'Steel', 'Software', 'Telecom', 'Realty', 'Travel',
  'Analytics', 'Robotics', 'Agro', 'Insurance', 'Chemicals', 'Studios', 'Capital',
];
// prettier-ignore
const CITIES = [
  'Mumbai', 'Delhi', 'Bengaluru', 'Pune', 'Hyderabad', 'Chennai', 'Kolkata', 'Ahmedabad',
  'Jaipur', 'Kochi',
];

export interface GenerateOptions {
  count?: number;
  seed?: number;
  /** Dates are generated relative to this. */
  now?: number;
}

/** Same options → same deals, so demos and tests are reproducible. */
export function generateDeals({
  count = DEFAULT_DEAL_COUNT,
  seed = 42,
  now = Date.now(),
}: GenerateOptions = {}): Deal[] {
  const rng = createRng(seed);
  const deals: Deal[] = [];

  for (let i = 0; i < count; i++) {
    const stage = pickWeighted(rng, STAGE_WEIGHTS);
    const closed = isClosed(stage);
    const owner = pick(rng, TEAM);
    // Most deals are small; a few are very large.
    const licences = Math.round(5 + rng() ** 2 * 495);
    const pricePerLicence = randomInt(rng, 4, 20) * 1000;
    // Skewed toward recent activity, with a long tail of stale deals.
    const lastActivityAt = now - Math.floor(rng() ** 2 * (closed ? 180 : 60) * DAY_MS);

    deals.push({
      id: `D-${String(i + 1).padStart(5, '0')}`,
      company: `${pick(rng, PREFIXES)} ${pick(rng, SUFFIXES)} (${pick(rng, CITIES)})`,
      licences,
      value: licences * pricePerLicence,
      owner,
      stage,
      // Open deals can already be overdue (up to 30 days past their close date).
      closeDate: now + (closed ? -randomInt(rng, 1, 180) : randomInt(rng, -30, 120)) * DAY_MS,
      lastActivityAt,
      updatedAt: lastActivityAt,
      updatedBy: owner,
      version: 1,
    });
  }

  return deals;
}
