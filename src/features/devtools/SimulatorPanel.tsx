import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_SIM_CONFIG, type SimConfig } from '../../api/simConfig';
import { useServices } from '../../services';

const FAILURE_MIXES: Record<string, { label: string; mix: SimConfig['failureMix'] }> = {
  mixed: { label: 'Mixed', mix: DEFAULT_SIM_CONFIG.failureMix },
  network: { label: 'Network errors only', mix: { network: 1, server: 0, timeout: 0 } },
  timeout: { label: 'Lost responses only', mix: { network: 0, server: 0, timeout: 1 } },
};

/** The settings used for the demo recording: frequent failures, teammates busy on screen. */
const DEMO_SETTINGS: Partial<SimConfig> = {
  failureRate: 0.4,
  teammateRate: 5,
  targetVisibleRows: true,
  conflictRate: 0.1,
};

/**
 * Fake-backend controls, adjustable while the app runs. Toggled with the button or the backtick
 * key; also settable from the URL (`?fail=0.4&rate=5&visible=1`). Not a modal: you change a
 * setting and keep using the app.
 */
export function SimulatorPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLInputElement &&
        ['text', 'search', 'number'].includes(event.target.type);
      if (event.key === '`' && !typing) setOpen((isOpen) => !isOpen);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        className="sim-toggle"
        aria-expanded={open}
        aria-controls="simulator-panel"
        aria-keyshortcuts="`"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        Simulator <kbd>`</kbd>
      </button>
      {open && <SimulatorControls />}
    </>
  );
}

function SimulatorControls() {
  const { simulator } = useServices();
  const config = useStore(simulator.config);
  const set = (changes: Partial<SimConfig>) => simulator.config.setState(changes);
  const mixKey =
    Object.entries(FAILURE_MIXES).find(
      ([, { mix }]) => JSON.stringify(mix) === JSON.stringify(config.failureMix),
    )?.[0] ?? 'mixed';

  return (
    <section id="simulator-panel" className="sim-panel" aria-label="Simulator">
      <h2>Network</h2>
      <Percent
        label="Failed requests"
        value={config.failureRate}
        onChange={(failureRate) => set({ failureRate })}
      />
      <label>
        Failure type{' '}
        <select
          value={mixKey}
          onChange={(event) => set({ failureMix: FAILURE_MIXES[event.target.value]!.mix })}
        >
          {Object.entries(FAILURE_MIXES).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="sim-row">
        <Millis
          label="Latency min"
          value={config.latencyMinMs}
          onChange={(latencyMinMs) => set({ latencyMinMs })}
        />
        <Millis
          label="max"
          value={config.latencyMaxMs}
          onChange={(latencyMaxMs) => set({ latencyMaxMs })}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={config.offline}
          onChange={(event) => set({ offline: event.target.checked })}
        />{' '}
        Offline (every request fails; teammates' updates wait)
      </label>

      <h2>Teammates</h2>
      <label>
        Edits per second: {config.teammateRate}
        <input
          type="range"
          min={0}
          max={10}
          step={0.5}
          value={config.teammateRate}
          onChange={(event) => set({ teammateRate: Number(event.target.value) })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.teammatesPaused}
          onChange={(event) => set({ teammatesPaused: event.target.checked })}
        />{' '}
        Paused
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.targetVisibleRows}
          onChange={(event) => set({ targetVisibleRows: event.target.checked })}
        />{' '}
        Edit the deals on screen
      </label>
      <Percent
        label="Conflicts (a teammate edits a deal just before my save lands)"
        value={config.conflictRate}
        onChange={(conflictRate) => set({ conflictRate })}
      />
      <button type="button" onClick={() => simulator.teammates.editDeal()}>
        One teammate edit now
      </button>

      <div className="sim-row">
        <button type="button" onClick={() => set(DEMO_SETTINGS)}>
          Demo settings
        </button>
        <button type="button" onClick={() => simulator.config.setState(DEFAULT_SIM_CONFIG)}>
          Reset
        </button>
      </div>
      <p className="muted">
        Also from the URL: <code>?fail=0.4&amp;rate=5&amp;visible=1&amp;conflict=0.1</code>
      </p>
    </section>
  );
}

function Percent({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}: {Math.round(value * 100)}%
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}

function Millis({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}{' '}
      <input
        type="number"
        min={0}
        step={100}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />{' '}
      ms
    </label>
  );
}
