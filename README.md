# Sales Pipeline

A shared sales pipeline for 50,000 deals: a Kanban board (and a dense List view), single and bulk moves on a slow, unreliable network, teammates' live changes that never move things under your cursor, and full keyboard use. There's no backend: a fake API inside the app simulates latency, failures and teammates, and every setting can be changed while the app runs.


## Run it

```sh
npm i && npm run dev
```

Then open http://localhost:5173. Needs Node 22.12+ or 24.

| Script          | What it does                                                      |
| --------------- | ----------------------------------------------------------------- |
| `npm run dev`   | Dev server                                                        |
| `npm test`      | Vitest in watch mode (`npm run test:run` for a single run)        |
| `npm run check` | Type check, lint, format check and tests: everything CI would run |
| `npm run build` | Production build                                                  |

## Try it in two minutes

1. Press <kbd>`</kbd> (or click **Simulator**) and choose **Demo settings**: 40% of saves fail, teammates make 5 edits a second on the deals you can see, and some saves race a teammate.
2. Drag a card to the next column. It moves at once and shows **Saving…**. If the save fails, it retries (up to 3 attempts), then stays where you put it, marked **Not saved**, and the header shows **N unsaved**. Open it (or press <kbd>u</kbd>) to retry, discard, or resolve a conflict.
3. Watch teammates' changes: values update in place with a brief highlight. A deal a teammate moved stays where it is, dimmed ("Moved to Won by Rahul"), and a banner counts them. Press <kbd>r</kbd> to apply them.
4. Without the mouse: click a column once, then use <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>, <kbd>]</kbd> to move a deal forward, <kbd>m</kbd> to choose a stage, <kbd>z</kbd> to undo. Press <kbd>?</kbd> for every shortcut.
5. Bulk: switch to **All deals**, click **Select all** on Negotiation, then drag one of the selected cards to Lost (or press <kbd>7</kbd>). Confirm, and watch the job panel: progress, failures, **Retry failed**, **Cancel**.

## Keyboard

The shortcuts work while the board or list has focus (so they never fire while you type).

| Keys                                                                        | Action                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------- |
| <kbd>↑</kbd> <kbd>↓</kbd> / <kbd>j</kbd> <kbd>k</kbd>                       | Previous / next deal                                |
| <kbd>←</kbd> <kbd>→</kbd>                                                   | Previous / next column (board)                      |
| <kbd>Home</kbd> <kbd>End</kbd> <kbd>PgUp</kbd> <kbd>PgDn</kbd>              | First / last deal, a page up / down                 |
| <kbd>]</kbd> <kbd>[</kbd>                                                   | Move the deal to the next / previous stage          |
| <kbd>1</kbd>–<kbd>7</kbd>                                                   | Move to that stage (the selection, if there is one) |
| <kbd>m</kbd>                                                                | Move to… (type a stage, <kbd>Enter</kbd>)           |
| <kbd>z</kbd>                                                                | Undo the last move                                  |
| <kbd>Space</kbd> / <kbd>x</kbd>, <kbd>Shift</kbd>+<kbd>↑</kbd> <kbd>↓</kbd> | Select, extend the selection                        |
| <kbd>Ctrl/⌘</kbd>+<kbd>A</kbd>, <kbd>Esc</kbd>                              | Select all matching, clear the selection            |
| <kbd>r</kbd>                                                                | Show teammates' updates                             |
| <kbd>u</kbd>                                                                | Open unsaved changes                                |
| <kbd>/</kbd>                                                                | Search (<kbd>Enter</kbd> goes back to the deals)    |
| <kbd>?</kbd>                                                                | All shortcuts                                       |

## Simulator

The **Simulator** panel (<kbd>`</kbd>) changes the fake backend live: failure rate and type (including "lost responses", where the server applies a write but the reply never arrives), latency, offline mode, teammate edit rate, pausing teammates, targeting the deals on screen, and the conflict rate.

The same settings can come from the URL, for repeatable demos:

```
http://localhost:5173/?fail=0.4&rate=5&visible=1&conflict=0.1
```

`fail`, `conflict` (0–1) · `rate` (edits/s) · `minMs`, `maxMs` (latency) · `visible`, `paused`, `offline` (1 or 0).

The 50,000 deals come from a fixed seed, so the data is the same on every load. The fake server lives in memory, so a reload starts over.

## Code map

```
src/
  api/        Fake backend behind the PipelineApi interface: seed data, server (versions,
              idempotency), network (latency, failures), teammate simulator, settings
  sync/       The core: store (server state + pending changes), mutations (optimistic
              saves, retries, conflicts), bulk jobs, realtime batching
  domain/     Pure functions: stages, filtering and sorting, the "needs attention" score
  features/   board/, pipeline/ (List view, toolbar), selection/, sync-status/,
              keyboard/, devtools/
```

The UI talks only to `PipelineApi`, so a real `fetch` + WebSocket implementation could replace the fake one. Most tests target `sync/` and `api/`; component tests cover the main flows end to end (drag and drop, keyboard-only moves, failed saves, teammates' updates, bulk moves).
