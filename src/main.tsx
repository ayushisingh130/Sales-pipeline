// Global styles first, so each component's own CSS (imported by the component) comes after it.
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { STAGES } from './domain/stages';
import { createServices } from './services';
import { loadDeals } from './sync/load';
import { startRealtime } from './sync/realtime';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const services = createServices();
const { store, simulator } = services;

// Started outside React, so StrictMode's double-invoked effects can't subscribe or load twice.
// Subscribe first, then load: events that arrive meanwhile are held and applied after the listing.
startRealtime(services);
void loadDeals(services.api, store);
simulator.teammates.start();

// For the simulator's "target visible rows" option: an approximation of what's on screen
// (the top of each column, or the rows around the focused one), without reading scroll positions.
simulator.teammates.setVisibleIds(() => {
  const { view, viewMode, focusedId } = store.getState();
  if (viewMode === 'board') return STAGES.flatMap((stage) => view.columns[stage].slice(0, 6));
  const index = Math.max(0, focusedId ? view.ids.indexOf(focusedId) : 0);
  return view.ids.slice(Math.max(0, index - 5), index + 10);
});

createRoot(root).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
