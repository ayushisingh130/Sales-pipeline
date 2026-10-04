# Sales Pipeline – Write-up

## 1. What I built and why

I built one screen where a sales team can manage a shared pipeline of 50,000 deals. You can see the deals as a Kanban board, which is the default because that's how salespeople usually picture a pipeline, or as a list, which is better for scanning and sorting.

When you open the app, it shows **Needs attention**: your own open deals, with the most urgent ones first. Each card tells you why it's there, for example "Due in 3d" or "Idle 21d". I wanted the first screen to answer the question a salesperson actually has in the morning: "which deals should I work on today?"

I chose not to build lots of features. Instead I spent most of my time on the things the brief stressed, because they're easy to get wrong:

- a save fails and the user never finds out
- teammates' updates move cards around while you're working
- a bulk move fails halfway through
- the keyboard stops working properly once lists are virtualized

Right now only the deal's stage can be changed. Saves send a general "patch" of changed fields, so making another field editable later (like the deal value) won't need any new saving logic.

**Tech:** React 18, TypeScript, Zustand, TanStack Virtual, dnd-kit and Vitest.

- I picked **Zustand over React Query**. React Query is built for fetching and caching requests, but this app is mostly about keeping 50k deals in sync: a queue of saves, live updates from teammates and bulk jobs. A small store of my own was easier to reason about than bending React Query to do that.
- I picked **dnd-kit over the browser's built-in drag and drop**. The built-in version doesn't work with keyboard or touch, and it breaks when the dragged card disappears from the DOM, which happens all the time in a virtualized list.

## 2. Key UX decisions, and what I rejected

**You drop a card on a column, not at a specific spot in it.** Cards inside a column are always ordered by the current sort. Deals don't have a meaningful "manual order", and leaving it out removed a whole class of bugs with virtualized columns.

**Everything you can do with the mouse, you can do with the keyboard.** Dragging, the `]` / `[` keys, number keys `1`–`7`, the `m` "Move to…" menu and the bulk bar all use the same move function underneath. Focus is tied to the deal itself, not to its position on screen. So when you move a deal to the next column, focus moves with it, and pressing `]` a few times walks one deal through the whole pipeline. Shortcuts only work when the deals have focus, so typing in the search box never triggers them.

**Single moves happen straight away and can be undone with `z`.** I didn't want an "Are you sure?" popup on every drag. Big bulk moves (more than 50 deals, or any move to Lost) do ask first and show how many deals and how much ₹ is affected, because undoing 3,000 moves isn't realistic.

**Your own changes show up instantly. Teammates' changes wait until you're ready.** This one rule ended up deciding most of the "live updates" behaviour (see section 3).

**Things I tried or considered and dropped:**

- **A table-only screen.** This was my first plan, but the brief needed drag and drop, and a board makes more sense for that.
- **Letting users reorder cards inside a column.** It doesn't mean anything for deals, and it would fight with keeping the screen still while teammates make changes.
- **AG Grid.** It's a heavy library, and it would hide exactly the kind of work this task is testing.
- **Running the fake server in a Web Worker.** It would be more realistic, but it wouldn't show anything new.

## 3. How I handled failed saves and teammates' changes

### Failed saves

My main goal was that **a save never fails silently**.

- When you move a deal, it moves on screen right away. In the background, I keep two copies: what the server last confirmed, and your unsaved change on top of it. That makes undoing a failed change easy (just drop your change). It also means a teammate's update can't accidentally wipe out yours.
- If a save fails because of a network error, server error or timeout, it retries automatically, waiting about 1 second and then 2 seconds (3 tries in total).
- Each save gets an ID that stays the same across its retries, so retrying is safe. This matters for a tricky case the fake API can simulate: the server saves the change, but the reply gets lost. Without the ID, the retry would look like a conflict with my own change. With it, the server recognises the request and returns the original answer.
- If all retries fail, the card stays where you put it and is marked **Not saved**, with a Retry button. The header shows "N unsaved", there's a panel (`u`) to retry or discard, and the browser warns you if you try to close the tab. I chose this over the common "snap the card back and show a toast" approach, because toasts disappear and the card might already be off screen.
- If a teammate changed the same deal first, I don't retry automatically. The panel explains what happened ("you moved it to Won, but Rahul changed it first") and lets you **Keep theirs** or **Apply mine**.

**Bulk moves** use the same idea. All the selected cards move straight away, and the saves go out in batches of 200 in the background. A panel shows progress, with **Cancel** (anything not sent yet goes back) and **Retry failed**, which only resends the deals that failed. You can keep working while it runs.

### Teammates' changes

The tricky part here is that live updates are useful, but cards jumping around under your mouse is really annoying. So:

- Updates from teammates are collected and applied together about every 300ms, so a flood of updates doesn't cause constant re-rendering. Old or out-of-order updates are ignored.
- **The order of cards on screen only changes when _you_ do something**: change a filter or sort, move a deal, or press `r`.
- If a teammate edits a value, the card updates in place with a short highlight.
- If a teammate **moves** a deal, the card stays where it is but is dimmed and labelled "Moved to Won by Rahul". A small banner says how many updates are waiting, and pressing `r` applies them.
- The deal counts in the column headers still update live, since a number changing doesn't move anything.

### Performance

All 50k deals are loaded once. Each card only re-renders when its own deal changes, so one teammate's edit updates one card, not the whole board. Some numbers I measured (in Node, on my laptop):

| What                                       | Time           |
| ------------------------------------------ | -------------- |
| Generate 50k deals                         | 31ms           |
| "Needs attention" filter + sort            | 1.5ms          |
| Sort all 50k (attention / value / company) | 22 / 14 / 27ms |
| Search                                     | 4ms            |
| Apply 10 teammate updates                  | 3.3ms          |
| Start a 10,000-deal bulk move              | 79ms           |

_Browser numbers (React Profiler, scrolling frame rate): still to be measured._

### Known limitations

- All the data is kept in the browser. That's fine for 50k deals, but with millions the server would have to do the filtering and paging.
- If you go offline, updates you missed aren't fetched again when you reconnect. A real backend would need an endpoint like "give me changes since version X".
- It assumes one tab per user.
- There's no undo for bulk moves, only the stage is editable, and the fake server resets on every reload.
