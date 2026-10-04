# Sales Pipeline

> A shared sales pipeline for a team, with 50,000 deals, a flaky network and teammates editing at the same time.

### Table of Contents

- [Description](#description)
- [Technologies](#technologies)
- [How To Use](#how-to-use)
- [Try it in two minutes](#try-it-in-two-minutes)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Simulator](#simulator)
- [Folder Structure](#folder-structure)
- [Testing](#testing)
- [Deployed Link](#deployed-link)

The design decisions, trade-offs and known limitations are explained in [WRITEUP.md](WRITEUP.md).

---

## Description

This app shows a team's sales pipeline as a Kanban board, plus a List view of the same deals. It's built to handle:

- **50,000 deals** without slowing down (the columns and the list are virtualized)
- **Moving deals** one at a time or in bulk, by drag and drop or with the keyboard
- **A slow, unreliable network.** Saves are retried, and if they still fail they're clearly marked as **Not saved** instead of failing silently.
- **Teammates' live changes** that never move cards around under your cursor
- **Full keyboard use**

There's no real backend. A fake API inside the app simulates latency, failed saves and teammates making changes, and you can change all of these while the app is running.

## Technologies

- React 18 + TypeScript
- Zustand (state and sync)
- TanStack Virtual (virtualized lists)
- dnd-kit (drag and drop)
- Tailwind CSS v4 (styling)
- Vite
- Vitest + React Testing Library

---

## How To Use

#### Setting it up on your machine

1. Clone the repo.
2. Make sure you have Node 22.12+ or Node 24 installed.
3. Run `npm i` to install the dependencies.
4. Run `npm run dev` to start the app.
5. Open http://localhost:5173.

```sh
# install
npm i
# start the app
npm run dev
```

Other scripts:

| Script          | What it does                                            |
| --------------- | ------------------------------------------------------- |
| `npm run build` | Production build                                        |
| `npm run check` | Type check, lint, format check and tests, all in one go |

## Try it in two minutes

1. Press <kbd>`</kbd> (or click **Simulator**) and choose **Demo settings**. This makes 40% of saves fail, has teammates make 5 edits a second on the deals you can see, and makes some saves conflict with a teammate.
2. Drag a card to the next column. It moves right away and shows **Saving…**. If the save fails, it's tried up to 3 times in total. If it still fails, the card stays where you put it, marked **Not saved**, and the header shows **N unsaved**. Click that (or press <kbd>u</kbd>) to retry, discard or resolve a conflict.
3. Watch what teammates change. Values update in place with a short highlight. If a teammate moves a deal, it stays where it is but is dimmed ("Moved to Won by Rahul"), and a banner counts these. Press <kbd>r</kbd> to apply them.
4. Try it without the mouse. Click a column once, then use the arrow keys, <kbd>]</kbd> to move a deal forward, <kbd>m</kbd> to pick a stage and <kbd>z</kbd> to undo. Press <kbd>?</kbd> to see every shortcut.
5. Try a bulk move. Switch to **All deals**, click **Select all** on Negotiation, then drag one of the selected cards to Lost (or press <kbd>7</kbd>). Confirm it, then watch the jobs panel for progress, failures, **Retry failed** and **Cancel**.

## Keyboard Shortcuts

Shortcuts only work while the board or list has focus, so they won't fire while you're typing.

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

The **Simulator** panel (<kbd>`</kbd>) controls the fake backend while the app runs. You can change:

- the failure rate and type of failure, including "lost responses", where the server saves the change but the reply never arrives
- latency, and offline mode
- how often teammates make edits, pausing them, and whether they target the deals on screen
- how often saves conflict with a teammate

You can also set these from the URL, which is handy for repeatable demos:

```
http://localhost:5173/?fail=0.4&rate=5&visible=1&conflict=0.1
```

- `fail`, `conflict`: 0–1
- `rate`: teammate edits per second
- `minMs`, `maxMs`: latency
- `visible`, `paused`, `offline`: 1 or 0

The 50,000 deals come from a fixed seed, so you get the same data on every load. The fake server only lives in memory, so reloading starts everything over.

---

## Folder Structure

- `src/api`: The fake backend behind the `PipelineApi` interface. It has the seed data, the server (versions, idempotency), the network (latency, failures), the teammate simulator and the simulator settings.
- `src/sync`: The core of the app. It has the store (server data + my pending changes), mutations (optimistic saves, retries, conflicts), bulk jobs and batching of live updates.
- `src/domain`: Pure functions for stages, filtering and sorting, and the "needs attention" score.
- `src/features/board`: The Kanban board, columns and cards.
- `src/features/pipeline`: The List view, toolbar and stage summary.
- `src/features/selection`: Multi-select, the bulk bar and the confirm dialog.
- `src/features/sync-status`: Save status, unsaved changes, the jobs panel and the teammate updates banner.
- `src/features/keyboard`: Shortcuts, focus handling, the Move to… menu and the help overlay.
- `src/features/devtools`: The Simulator panel.

The UI only talks to `PipelineApi`, so a real `fetch` + WebSocket version could replace the fake one without touching the UI.

## Testing

Run `npm test` to start Vitest in watch mode, or `npm run test:run` to run it once.

Most of the tests cover `src/sync` and `src/api`. Component tests cover the main flows end to end: drag and drop, keyboard-only moves, failed saves, teammates' updates and bulk moves.

## Demo Link

- Product Walkthrough: https://shorturl.at/W2HKA

## Deployed Link

- Sales pipeline: https://sales-pipeline-nu.vercel.app/
