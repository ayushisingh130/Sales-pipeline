import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDeals } from '../../api/seed';
import type { SimConfig } from '../../api/simConfig';
import { App } from '../../App';
import { createTestServices } from '../../test/factories';
import { mockLayout } from '../../test/layout';
import { rowDomId } from './DealRow';

function renderApp(config: Partial<SimConfig> = {}) {
  const services = createTestServices({ config });
  services.store.getState().setViewMode('list');
  services.store.getState().receiveDeals(generateDeals({ count: 200, seed: 1 }));
  render(<App services={services} />);
  const id = services.store.getState().view.ids[0]!;
  const company = services.store.getState().server.get(id)!.company;
  const row = () => document.getElementById(rowDomId(id));
  const moveToWon = () =>
    fireEvent.change(within(row()!).getByRole('combobox', { name: /Stage for/ }), {
      target: { value: 'won' },
    });
  return { services, id, company, row, moveToWon };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// fireEvent rather than userEvent: these tests run on fake timers (retries, backoff), and
// userEvent's internal waits don't resolve under them.

describe('moving a deal (List view)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLayout();
  });
  afterEach(() => vi.useRealTimers());

  it('moves at once, says so, and confirms the save', async () => {
    const t = renderApp({ latencyMinMs: 100, latencyMaxMs: 100 });

    t.moveToWon();

    // "Needs attention" lists open deals only, so the won deal leaves the list right away.
    expect(t.row()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(`Moved ${t.company} to Won`);
    expect(screen.getByText('Saving 1 change…')).toBeInTheDocument();

    await advance(100);
    expect(screen.getByText('✓ All changes saved')).toBeInTheDocument();
  });

  it('surfaces a save that keeps failing and recovers it from the Unsaved changes panel', async () => {
    const t = renderApp({
      failureRate: 1,
      failureMix: { network: 1, server: 0, timeout: 0 },
    });

    t.moveToWon();
    await advance(1000 + 2000 + 10); // all three attempts fail

    expect(screen.getByRole('status')).toHaveTextContent(`Couldn't save ${t.company} → Won`);
    fireEvent.click(screen.getByRole('button', { name: /1 unsaved/ }));
    const panel = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(panel).toHaveTextContent(`${t.company}`);

    t.services.simulator.config.setState({ failureRate: 0 });
    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    await advance(0);

    expect(screen.getByText('✓ All changes saved')).toBeInTheDocument();
    expect(t.services.store.getState().server.get(t.id)?.stage).toBe('won');
  });
});
