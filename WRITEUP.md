# Sales Pipeline – Write-up

## 1. What I built and why

I built a sales pipeline for a team working with around 50,000 deals. It has two views of the same data: a **Kanban board** as the default view and a **List** view for more compact scanning and sorting.

I chose the board because it gives a quick visual understanding of where deals are in the sales process. The app opens on **Needs Attention** because with thousands of deals, the first problem is knowing where to start. It surfaces the user's most relevant deals and gives context such as "Overdue 5d", "Due in 3d", or "No activity 21d".

I kept the feature set focused on the main problems in the brief: large datasets, unreliable saves, concurrent teammate updates, bulk operations, and keyboard accessibility.

**Stack:** React, TypeScript, Zustand, TanStack Virtual, dnd-kit, Tailwind, and Vitest.

I considered React Query, but the harder part of this problem was managing optimistic changes, retries, teammate updates, and bulk saves rather than simply fetching data. A small Zustand store gave me more direct control over that state.

## 2. Key UX decisions and what I rejected

**Drop on a column, not a specific position.**
Deals don't have a meaningful manual order, so cards are ordered by the active sort. This also keeps drag and drop simpler with virtualization.

**Keyboard and mouse use the same actions.**
Moving a deal through drag and drop, keyboard shortcuts, or the move menu uses the same underlying action. Focus follows the deal rather than its screen position, so moving a card doesn't unexpectedly lose focus.

**Single moves are immediate and undoable.**
I avoided confirmation dialogs for normal moves. Moving more than 50 deals, or moving several deals to Lost, requires confirmation and show the number of deals and total value affected.

**My changes are immediate; teammate changes don't unexpectedly rearrange my screen.**
Teammate updates are shown, but the current ordering stays stable until I choose to apply them.

**Alternatives I rejected:** a table-only experience, manual card ordering, and using a heavier grid library such as AG Grid. I preferred keeping the board interaction simple and the core behavior under my control.

## 3. Failed saves and teammates' changes

### Failed saves

The main rule was that **a save should never fail silently**.

A deal moves immediately while the application keeps the last confirmed server state and the user's pending change separately. Network errors, server errors, and timeouts are retried automatically, and each save uses an idempotency key so a lost response can be safely retried.

If the save still fails, the deal stays where the user moved it and is marked **Not Saved**. The header shows the number of unsaved changes, and an unsaved-changes panel allows the user to retry or discard them. I preferred this over simply reverting the card and showing a temporary toast because the user may miss the toast.

Bulk moves follow the same approach: selected deals move immediately, saves are processed in batches, and failed saves can be retried separately.

### Teammates' changes

The goal was to keep the pipeline up to date without making the user's current work difficult.

Teammate updates are batched and older updates are ignored. If someone edits a deal, the card updates in place. If someone moves a deal, it stays in its current position and is marked with the new stage and who moved it. A banner shows pending teammate updates, and pressing `R` applies them and updates the board.

This keeps my own changes immediate while preventing teammate activity from constantly moving cards underneath me.

## 4. What I'd do with more time

I would take the product a little further toward a production CRM experience by:

- **Adding configurable views and filters** for things such as high-value, stale, or no-activity deals, building on the current Needs Attention concept.
- **Making more deal fields editable**, such as value, close date, and owner, using the existing patch-based update flow.
- **Doing a deeper performance and responsive pass** across different dataset sizes and screen sizes, profiling rendering, scrolling, filtering, searching, and bulk operations and optimizing expensive calculations where needed.
- **Strengthening production reliability and testing**, particularly reconnect/synchronization after offline periods, accessibility testing, and browser-level testing of failed saves, conflicts, and concurrent updates.
