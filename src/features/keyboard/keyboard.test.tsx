import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { getViewDeal } from '../../sync/store';
import { createTestServices, makeDeal } from '../../test/factories';
import { mockLayout } from '../../test/layout';

// The whole flow without a mouse: every step starts from the keyboard and focus must come back.
function renderBoard() {
  const fresh = { closeDate: 1e15, lastActivityAt: 1e15 };
  const deals = [
    makeDeal({ ...fresh, company: 'Acme', stage: 'new_lead', value: 3 }),
    makeDeal({ ...fresh, company: 'Globex', stage: 'new_lead', value: 2 }),
    makeDeal({ ...fresh, company: 'Initech', stage: 'proposal_sent', value: 1 }),
  ];
  const services = createTestServices({ deals });
  services.store.getState().receiveDeals(deals);
  render(<App services={services} />);
  const column = (name: string) => screen.getByRole('listbox', { name: new RegExp(`^${name}`) });
  const stageOf = (id: string) => getViewDeal(services.store.getState(), id)?.stage;
  column('New Lead').focus();
  return {
    services,
    deals: deals as [(typeof deals)[0], (typeof deals)[0], (typeof deals)[0]],
    column,
    stageOf,
  };
}

describe('keyboard-only use', () => {
  beforeEach(() => mockLayout());

  it('m opens Move to…, typing filters, Enter moves the deal and focus follows it', async () => {
    const { deals, column, stageOf } = renderBoard();
    const user = userEvent.setup();

    await user.keyboard('m');
    const dialog = screen.getByRole('dialog', { name: 'Move Acme to…' });
    expect(screen.getByRole('combobox', { name: 'Stage' })).toHaveFocus();
    // Starts on the next stage.
    expect(within(dialog).getByRole('option', { selected: true })).toHaveTextContent('Contacted');

    await user.keyboard('wo');
    expect(within(dialog).getAllByRole('option')).toHaveLength(1);
    await user.keyboard('{Enter}');

    expect(dialog).not.toBeInTheDocument();
    expect(stageOf(deals[0].id)).toBe('won');
    expect(column('Won')).toHaveFocus();
  });

  it('Esc closes Move to… without moving, and focus returns', async () => {
    const { deals, column, stageOf } = renderBoard();
    const user = userEvent.setup();

    await user.keyboard('m{ArrowDown}{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(stageOf(deals[0].id)).toBe('new_lead');
    expect(column('New Lead')).toHaveFocus();
  });

  it('m with a selection goes through the confirmation, and focus comes back to the board', async () => {
    const { deals, column, stageOf } = renderBoard();
    const user = userEvent.setup();

    await user.keyboard('x{ArrowDown}x');
    await user.keyboard('mlost{Enter}');

    // A multi-deal move to Lost is always confirmed; Enter on the focused button confirms.
    expect(screen.getByRole('button', { name: 'Move 2 deals' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(stageOf(deals[0].id)).toBe('lost');
    expect(stageOf(deals[1].id)).toBe('lost');
    expect(column('Lost')).toHaveFocus();
  });

  it('? shows the shortcuts and Esc returns focus', async () => {
    const { column } = renderBoard();
    const user = userEvent.setup();

    await user.keyboard('?');
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(column('New Lead')).toHaveFocus();
  });

  it('/ focuses search; Enter applies it and goes back to the results', async () => {
    const { column } = renderBoard();
    const user = userEvent.setup();

    await user.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Search deals' })).toHaveFocus();

    await user.keyboard('Initech{Enter}');
    expect(column('Proposal Sent')).toHaveFocus();
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('u opens the Unsaved changes panel; Esc returns focus to the board', async () => {
    const { services, deals, column } = renderBoard();
    const user = userEvent.setup();
    services.store.getState().setPending(deals[0].id, {
      mutationId: 'm-1',
      patch: { stage: 'won' },
      baseVersion: 1,
      status: 'failed',
      attempts: 3,
      error: 'Network error',
    });

    await user.keyboard('u');
    const panel = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(panel).toHaveFocus();
    expect(panel).toHaveTextContent('Acme');

    await user.keyboard('{Escape}');
    expect(panel).not.toBeInTheDocument();
    expect(column('New Lead')).toHaveFocus();
  });
});
