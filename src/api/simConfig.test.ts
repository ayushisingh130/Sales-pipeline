import { describe, expect, it } from 'vitest';
import { simConfigFromUrl } from './simConfig';

describe('simConfigFromUrl', () => {
  it('reads numbers and flags', () => {
    expect(simConfigFromUrl('?fail=0.4&rate=5&visible=1&paused=0&minMs=0')).toEqual({
      failureRate: 0.4,
      teammateRate: 5,
      targetVisibleRows: true,
      teammatesPaused: false,
      latencyMinMs: 0,
    });
  });

  it('ignores invalid values and caps shares at 1', () => {
    expect(simConfigFromUrl('?fail=7&conflict=-1&rate=abc&maxMs=')).toEqual({ failureRate: 1 });
  });
});
