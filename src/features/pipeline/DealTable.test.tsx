import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { generateDeals } from '../../api/seed';
import { ALL_DEALS } from '../../domain/query';
import { ServicesContext } from '../../services';
import { createTestServices } from '../../test/factories';
import { mockLayout } from '../../test/layout';
import { DealTable } from './DealTable';
import { rowDomId } from './DealRow';

beforeEach(() => mockLayout());

function renderTable() {
  const services = createTestServices();
  services.store.getState().setViewMode('list');
  services.store.getState().receiveDeals(generateDeals({ count: 1000, seed: 1 }));
  services.store.getState().setQuery(ALL_DEALS);
  services.store.getState().moveFocus('first');
  render(
    <ServicesContext.Provider value={services}>
      <DealTable />
    </ServicesContext.Provider>,
  );
  return { ids: services.store.getState().view.ids, grid: screen.getByRole('grid') };
}

describe('DealTable', () => {
  it('renders only a window of rows, while telling assistive tech the full count', () => {
    const { grid } = renderTable();
    expect(grid).toHaveAttribute('aria-rowcount', '1001');
    // Header + visible rows + overscan; nowhere near 1000.
    expect(screen.getAllByRole('row').length).toBeLessThan(40);
  });

  it('moves the active row with arrows, j/k, Home and End', async () => {
    const { grid, ids } = renderTable();
    const user = userEvent.setup();
    grid.focus();
    expect(grid).toHaveAttribute('aria-activedescendant', rowDomId(ids[0]!));

    await user.keyboard('{ArrowDown}j');
    expect(grid).toHaveAttribute('aria-activedescendant', rowDomId(ids[2]!));
    await user.keyboard('k');
    expect(grid).toHaveAttribute('aria-activedescendant', rowDomId(ids[1]!));

    await user.keyboard('{End}');
    const lastId = ids.at(-1)!;
    expect(grid).toHaveAttribute('aria-activedescendant', rowDomId(lastId));
    // The virtualizer scrolled the last row into the DOM.
    await waitFor(() => expect(document.getElementById(rowDomId(lastId))).toBeInTheDocument());

    await user.keyboard('{Home}');
    expect(grid).toHaveAttribute('aria-activedescendant', rowDomId(ids[0]!));
  });
});
