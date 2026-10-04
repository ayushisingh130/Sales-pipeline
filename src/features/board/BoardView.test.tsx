import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { STAGES } from '../../domain/stages';
import { getViewDeal } from '../../sync/store';
import { createTestServices, makeDeal } from '../../test/factories';
import { mockLayout } from '../../test/layout';
import { cardDomId } from './DealCard';

const COLUMN_WIDTH = 220;

/** jsdom has no layout: give each column a side-by-side position so drops can be hit-tested. */
function mockColumnRects() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const column = this.closest('[data-stage]');
    const index = column ? Array.from(column.parentElement!.children).indexOf(column) : 0;
    return DOMRect.fromRect({
      x: index * COLUMN_WIDTH,
      y: 0,
      width: COLUMN_WIDTH - 10,
      height: 600,
    });
  });
}

// "Needs attention" is the default view: my deals, every stage shown as a column on the board.
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
  return { services, deals, column, stageOf };
}

describe('BoardView', () => {
  beforeEach(() => mockLayout());

  it('shows one column per stage with its cards', () => {
    const { column } = renderBoard();
    expect(screen.getAllByRole('listbox')).toHaveLength(STAGES.length);
    expect(
      within(column('New Lead'))
        .getAllByRole('option')
        .map((card) => card.textContent),
    ).toEqual([expect.stringContaining('Acme'), expect.stringContaining('Globex')]);
    expect(column('Proposal Sent')).toHaveTextContent('Initech');
  });

  it('navigates with arrow keys, and ] moves the card to the next column with focus following it', async () => {
    const { deals, column, stageOf } = renderBoard();
    const [acme, globex, initech] = deals as [
      (typeof deals)[0],
      (typeof deals)[0],
      (typeof deals)[0],
    ];
    const user = userEvent.setup();

    column('New Lead').focus();
    expect(column('New Lead')).toHaveAttribute('aria-activedescendant', cardDomId(acme.id));

    await user.keyboard('{ArrowDown}');
    expect(column('New Lead')).toHaveAttribute('aria-activedescendant', cardDomId(globex.id));

    // Contacted and Demo Done are empty, so → jumps to Proposal Sent.
    await user.keyboard('{ArrowRight}');
    expect(column('Proposal Sent')).toHaveFocus();
    expect(column('Proposal Sent')).toHaveAttribute('aria-activedescendant', cardDomId(initech.id));

    await user.keyboard(']');
    expect(stageOf(initech.id)).toBe('negotiation');
    expect(column('Negotiation')).toHaveTextContent('Initech');
    expect(column('Negotiation')).toHaveFocus();
  });

  it('dragging a card onto another column moves the deal', () => {
    mockColumnRects();
    const { deals, column, stageOf } = renderBoard();
    const acme = deals[0]!;
    const card = document.getElementById(cardDomId(acme.id))!;
    const wonX = STAGES.indexOf('won') * COLUMN_WIDTH + 50;

    act(() => {
      fireEvent.pointerDown(card, { isPrimary: true, button: 0, clientX: 50, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerMove(document, { clientX: 60, clientY: 50 }); // past the 6px threshold
    });
    act(() => {
      fireEvent.pointerMove(document, { clientX: wonX, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerUp(document, { clientX: wonX, clientY: 50 });
    });

    expect(stageOf(acme.id)).toBe('won');
    expect(column('Won')).toHaveTextContent('Acme');
    expect(column('New Lead')).not.toHaveTextContent('Acme');
  });

  it('a drop back on the same column does nothing', () => {
    mockColumnRects();
    const { services, deals, stageOf } = renderBoard();
    const card = document.getElementById(cardDomId(deals[0]!.id))!;

    act(() => {
      fireEvent.pointerDown(card, { isPrimary: true, button: 0, clientX: 50, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerMove(document, { clientX: 70, clientY: 60 });
    });
    act(() => {
      fireEvent.pointerUp(document, { clientX: 70, clientY: 60 });
    });

    expect(stageOf(deals[0]!.id)).toBe('new_lead');
    expect(services.store.getState().pending.size).toBe(0);
  });

  it("a teammate's move leaves the card in place, dimmed, until the user asks for updates", async () => {
    const { services, deals, column } = renderBoard();
    const acme = deals[0]!;
    const user = userEvent.setup();

    act(() => {
      services.store.getState().applyEvents(
        [
          {
            type: 'deal.updated',
            deal: { ...acme, stage: 'won', version: 2, updatedBy: 'Rahul' },
            actor: 'Rahul',
          },
        ],
        'Priya',
      );
    });

    // Still in New Lead, marked; nothing moved under the user.
    expect(column('New Lead')).toHaveTextContent('Moved to Won by Rahul');
    expect(column('Won')).not.toHaveTextContent('Acme');
    expect(screen.getByText('↻ 1 update from teammates')).toBeInTheDocument();

    column('New Lead').focus();
    await user.keyboard('r');

    expect(column('Won')).toHaveTextContent('Acme');
    expect(column('New Lead')).not.toHaveTextContent('Acme');
    expect(screen.queryByText(/update from teammates/)).not.toBeInTheDocument();
  });

  it('a teammate editing a field updates the card in place without any banner', () => {
    const { services, deals, column } = renderBoard();
    const acme = deals[0]!;

    act(() => {
      services.store.getState().applyEvents(
        [
          {
            type: 'deal.updated',
            deal: { ...acme, value: 7_77_000, version: 2 },
            actor: 'Rahul',
          },
        ],
        'Priya',
      );
    });

    expect(column('New Lead')).toHaveTextContent('₹7,77,000');
    expect(screen.queryByText(/from teammates/)).not.toBeInTheDocument();
  });

  it('selects with the keyboard and confirms a multi-deal move to Lost', async () => {
    const { services, deals, column } = renderBoard();
    const user = userEvent.setup();

    column('New Lead').focus();
    await user.keyboard(' ');
    expect(screen.getByRole('region', { name: 'Selected deals' })).toHaveTextContent('1 selected');

    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('region', { name: 'Selected deals' })).toHaveTextContent('3 selected');

    await user.keyboard('7'); // Lost
    const dialog = screen.getByRole('dialog', { name: /Move 3 deals .* to Lost\?/ });
    expect(within(dialog).getByRole('button', { name: 'Move 3 deals' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    for (const deal of deals) expect(column('Lost')).toHaveTextContent(deal.company);
    expect(services.store.getState().selection.size).toBe(0);
  });

  it('Esc cancels the confirmation and moves nothing', async () => {
    const { services, column } = renderBoard();
    const user = userEvent.setup();
    column('New Lead').focus();
    await user.keyboard('{Control>}a{/Control}7');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(services.store.getState().pending.size).toBe(0);
  });

  it('dragging a selected card moves the whole selection', () => {
    mockColumnRects();
    const { services, deals, column } = renderBoard();
    const [acme, globex] = deals;
    services.store.getState().setSelection([acme!.id, globex!.id]);
    const card = document.getElementById(cardDomId(acme!.id))!;
    const proposalX = STAGES.indexOf('proposal_sent') * COLUMN_WIDTH + 50;

    act(() => {
      fireEvent.pointerDown(card, { isPrimary: true, button: 0, clientX: 50, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerMove(document, { clientX: 60, clientY: 50 });
    });
    expect(screen.getByText('Moving 2 deals')).toBeInTheDocument();
    act(() => {
      fireEvent.pointerMove(document, { clientX: proposalX, clientY: 50 });
    });
    act(() => {
      fireEvent.pointerUp(document, { clientX: proposalX, clientY: 50 });
    });

    expect(column('Proposal Sent')).toHaveTextContent('Acme');
    expect(column('Proposal Sent')).toHaveTextContent('Globex');
    expect(column('New Lead')).toHaveTextContent('No deals');
  });
});
