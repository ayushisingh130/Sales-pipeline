import { useEffect, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { DEFAULT_SIM_CONFIG, type SimConfig } from '../../api/simConfig';
import { useServices } from '../../services';

const FAILURE_MIXES: Record<string, { label: string; mix: SimConfig['failureMix'] }> = {
  mixed: { label: 'Mixed', mix: DEFAULT_SIM_CONFIG.failureMix },
  network: { label: 'Network errors only', mix: { network: 1, server: 0, timeout: 0 } },
  timeout: { label: 'Lost responses only', mix: { network: 0, server: 0, timeout: 1 } },
};

/** The settings used for the demo recording: frequent failures, teammates busy on screen. */
const HEADING = 'mt-1 text-xs font-semibold tracking-wide text-muted uppercase';
const LABEL = 'flex flex-wrap items-center gap-1';
const CHECK = 'flex cursor-pointer items-center gap-1.5';

const DEMO_SETTINGS: Partial<SimConfig> = {
  failureRate: 0.4,
  teammateRate: 5,
  targetVisibleRows: true,
  conflictRate: 0.1,
};

/**
 * Fake-backend controls, adjustable while the app runs. Toggled with the button or the backtick
 * key; also settable from the URL (`?fail=0.4&rate=5&visible=1`). Not a modal: you change a
 * setting and keep using the app, so clicking elsewhere doesn't close it. × or Esc does.
 */
export function SimulatorPanel() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

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
        ref={toggleRef}
        type="button"
        className="btn flex-none"
        aria-expanded={open}
        aria-controls="simulator-panel"
        aria-keyshortcuts="`"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        Simulator <kbd>`</kbd>
      </button>
      {open && <SimulatorControls onClose={close} />}
    </>
  );
}

function SimulatorControls({ onClose }: { onClose: () => void }) {
  const { simulator } = useServices();
  const config = useStore(simulator.config);
  const set = (changes: Partial<SimConfig>) => simulator.config.setState(changes);
  const mixKey =
    Object.entries(FAILURE_MIXES).find(
      ([, { mix }]) => JSON.stringify(mix) === JSON.stringify(config.failureMix),
    )?.[0] ?? 'mixed';

  return (
    <section
      id="simulator-panel"
      className="popover fixed top-14 right-4 z-25 flex max-h-[calc(100vh-72px)] w-[min(340px,calc(100vw-32px))] flex-col gap-2 overflow-auto px-4 py-3 shadow-xl"
      aria-label="Simulator"
      onKeyDown={(event) => event.key === 'Escape' && onClose()}
    >
      <div className="flex items-center justify-between">
        <h2 className={HEADING}>Network</h2>
        <button
          type="button"
          className="-mr-2 cursor-pointer rounded px-2 text-lg leading-none text-muted hover:text-ink"
          aria-label="Close simulator"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <Percent
        label="Failed requests"
        value={config.failureRate}
        onChange={(failureRate) => set({ failureRate })}
      />
      <label className={LABEL}>
        Failure type{' '}
        <select
          className="field"
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
      <div className="flex flex-wrap gap-2">
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
      <label className={CHECK}>
        <input
          type="checkbox"
          className="accent-accent"
          checked={config.offline}
          onChange={(event) => set({ offline: event.target.checked })}
        />{' '}
        Offline (every request fails; teammates' updates wait)
      </label>

      <h2 className={HEADING}>Teammates</h2>
      <label className={LABEL}>
        Edits per second: {config.teammateRate}
        <input
          type="range"
          className="w-full accent-accent"
          min={0}
          max={10}
          step={0.5}
          value={config.teammateRate}
          onChange={(event) => set({ teammateRate: Number(event.target.value) })}
        />
      </label>
      <label className={CHECK}>
        <input
          type="checkbox"
          className="accent-accent"
          checked={config.teammatesPaused}
          onChange={(event) => set({ teammatesPaused: event.target.checked })}
        />{' '}
        Paused
      </label>
      <label className={CHECK}>
        <input
          type="checkbox"
          className="accent-accent"
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
      <button
        type="button"
        className="btn self-start"
        onClick={() => simulator.teammates.editDeal()}
      >
        One teammate edit now
      </button>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => set(DEMO_SETTINGS)}>
          Demo settings
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => simulator.config.setState(DEFAULT_SIM_CONFIG)}
        >
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
    <label className={LABEL}>
      {label}: {Math.round(value * 100)}%
      <input
        type="range"
        className="w-full accent-accent"
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
    <label className={LABEL}>
      {label}{' '}
      <input
        type="number"
        className="field w-20"
        min={0}
        step={100}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />{' '}
      ms
    </label>
  );
}
