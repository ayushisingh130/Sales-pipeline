import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../App';
import { loadDeals } from '../../sync/load';
import { createTestServices } from '../../test/factories';

describe('SimulatorPanel', () => {
  it('opens with ` and changes the fake API while the app runs, even after a failed load', async () => {
    const services = createTestServices({ config: { failureRate: 1 } });
    render(<App services={services} />);
    await loadDeals(services.api, services.store);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load deals");

    await userEvent.keyboard('`');
    const slider = screen.getByRole('slider', { name: /Failed requests/ });
    fireEvent.change(slider, { target: { value: '0' } });
    expect(services.simulator.config.getState().failureRate).toBe(0);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('region', { name: 'Pipeline board' })).toBeInTheDocument();
  });

  it('closes with × or Esc and returns focus to the Simulator button', async () => {
    render(<App services={createTestServices()} />);
    const toggle = screen.getByRole('button', { name: /Simulator/ });

    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Close simulator' }));
    expect(screen.queryByRole('region', { name: 'Simulator' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();

    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('slider', { name: /Failed requests/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Simulator' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });
});
