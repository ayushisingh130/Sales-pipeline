import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { loadDeals } from './sync/load';
import { createTestServices } from './test/factories';

describe('App', () => {
  it('shows a loading state, then the board', async () => {
    const services = createTestServices();
    render(<App services={services} />);
    expect(screen.getByText('Loading deals…')).toBeInTheDocument();

    await loadDeals(services.api, services.store);

    expect(await screen.findByRole('region', { name: 'Pipeline board' })).toBeInTheDocument();
  });

  it('shows a load failure and recovers with Retry', async () => {
    const services = createTestServices({ config: { failureRate: 1 } });
    render(<App services={services} />);

    await loadDeals(services.api, services.store);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load deals");

    services.simulator.config.setState({ failureRate: 0 });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('region', { name: 'Pipeline board' })).toBeInTheDocument();
  });
});
