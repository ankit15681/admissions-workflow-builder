# Admissions Workflow Automation

A workflow automation builder for school admissions — a React canvas for building and
publishing flows, and a Node backend that executes them durably (multi-day waits included).
Built from `CLAUDE_CODE_PROMPT.md` and `Admissions_Workflow_Design_Document.docx` in this
project, keeping the visual design of the provided demo (`workflow-14.netlify.app`) and
swapping two stack choices at the user's request: **Webpack** instead of Vite, and
**RTK Query** instead of React Query.

## Running it

Requires Node 18+.

```bash
npm run install:all   # installs backend/ and frontend/ separately
npm run dev            # runs both dev servers together (Ctrl+C stops both)
```

Or run them separately:

```bash
cd backend && npm install && npm run dev    # http://localhost:4000
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :4000)
```

The backend seeds itself on first boot (an in-repo `data.sqlite` is created and four demo
applications + four demo workflows are inserted) — nothing to configure. Open
`http://localhost:5173`.

## What's fully wired vs. stubbed

Built in the order `CLAUDE_CODE_PROMPT.md` lays out — each a working checkpoint before the
next — rather than all nine step types and four workflows polished at once:

| Piece | Status |
| --- | --- |
| Step type registry, all 9 step types, `GET /api/step-types` | Done |
| Canvas renders generically from `steps[]` via the registry | Done |
| Generic `SchemaForm` (ajv) + custom Branches/Communicate editors | Done |
| Draft autosave (debounced, revision-guarded) + explicit Publish | Done |
| **Workflow 1 — Admission Fee Payment Reminder** | Fully wired, published, executes live |
| **Workflow 3 — Application Review & Staff Assignment** | Fully wired, published, executes live |
| Run history view (polled) | Done |
| **Workflow 2 — Post-Offer → Enrolment** | Seeded as a **draft only** — steps arranged per the doc's table (to show `Request Document` in the builder) but not executed/tested end-to-end |
| **Workflow 4 (design doc's "Incomplete Application Nudge")** | Not built — everything it needs (Trigger, Delay, Branches, Communicate, Set status, Goal) already exists and works in Workflows 1 & 3, so it would be pure repetition rather than new coverage |
| **Scholarship Application Review** (not in the design doc — added on request) | Fully wired, published, executes live. See below. |

Stubbed, per `CLAUDE_CODE_PROMPT.md`'s own instructions:

- **Email/SMS** — `console.log`'d from the backend (`[stub email] to=... subject=...`), not sent anywhere.
- **File storage** — `Request Document` tracks a checklist and a `pending`/`submitted` status
  in SQLite; there's no real upload endpoint or object storage. `POST /document-requests/:id/submit`
  simulates the applicant/guardian side for demo purposes.
- **The admissions system itself** — a small `applications` table stands in for the real SIS.
  `POST /applications/:id/status`, `/submit`, `/start` simulate the events a real system would
  emit and fire the Trigger Listener the same way a webhook would.
- **Auth/roles (FR-12)** — not implemented; out of scope for this exercise per the design doc's
  own framing (C.8 flags it as a production concern, not something the demo needs).

### Seeing it run live

The backend fires one run of each published workflow automatically on startup (against three
of the four seeded demo applications), and all of them use **seconds instead of days** for
their Delay steps so you can watch a full run — including the reminder/escalation loop —
inside a minute or two, without changing the system clock. Open the Run history panel
(Overview tab → "View run history") to watch it progress.

### Scholarship Application Review (added on request, not in the design doc)

Not one of the design doc's Part B examples — added afterward on request, following the same
pattern as the doc's own Workflow 4 framing ("generalising to a different situation" rather
than reinventing one). Its Trigger is scoped to the Scholarship form specifically, via the
`form` field on the Trigger's own `configSchema` (`backend/src/stepTypes/trigger.ts`) that the
"Choose a trigger" flow's Form dropdown already exposed but nothing previously exercised
end-to-end. It chases missing financial-aid documents with a bounded reminder loop (mirroring
Workflow 2's `Request Document` + reminder pattern), then gets a committee decision via
`Assign to Staff / Create Task` with one escalation if the review runs late (mirroring
Workflow 3's task-SLA pattern) — the only one of the four demo workflows to use all nine step
types in a single flow. Fully wired and published; `backend/src/seed/seedWorkflows.ts` fires
one live run on startup the same way Workflows 1 and 3 do.

Fixed one real bug while wiring this up: the canvas card for a form-triggered Trigger always
read "Any Application form" regardless of the Trigger's actual `form` value — a leftover
`summarizeStep` string (`frontend/src/lib/stepClient.ts`) that predated the Form dropdown and
was never updated to read `config.form` back out. It now reads the label from the same
`configSchema.enum`/`enumLabels` the dropdown itself is built from, so a Scholarship-scoped
trigger's card correctly reads "Scholarship form" instead of the wrong, unconditional default.

To drive it manually:

```bash
# Mark the fee-reminder demo applicant's fee as paid — the run's next Branches check
# (within ~8s) will pick this up and end with a "Fee collected" Goal instead of looping.
curl -X POST http://localhost:4000/api/applications/app-fee-demo/fee-status \
  -H 'Content-Type: application/json' -d '{"feeStatus":"paid"}'

# Complete the review-assignment demo's task before its Delay elapses, to see the
# "on time" path instead of the escalation path.
curl -X POST http://localhost:4000/api/tasks/1/complete
```

## Architecture

**Step type registry (backend, single source of truth).** Each step type — Trigger, Delay,
Branches, Communicate, Set status, Go to action, Goal, Request Document, Assign to Staff /
Create Task — is one self-contained module in `backend/src/stepTypes/` exporting
`{ type, label, icon, color, category, summary, summaryFallback, configSchema, defaultConfig, ports, execute }`.
`configSchema` is plain JSON Schema — no Zod. `GET /api/step-types` returns the public
projection (everything except `execute`) exactly as authored, with no conversion step.
Two smaller sub-registries follow the same pattern: `backend/src/stepTypes/conditions/`
(Branches' condition types) and `backend/src/stepTypes/variables/recipientVariables.ts`
(Communicate's recipient → merge-variable map).

**Frontend fetches once, builds everything generically.** `frontend/src/lib/stepClient.ts`
builds a lookup client from the fetched registry. The canvas card (`StepNode`), the Legend
tab, and the "Choose an action" panel are all one generic implementation each, looping over
this client — never a hardcoded switch on step type. The card *subtitle* is driven the same
way: each step type ships a `summary` template (e.g. Delay's `"Wait {amount} {unit}"`) and the
frontend fills the `{field}` tokens generically — enum fields render via their `enumLabels`,
array fields comma-join — so adding a plain step type needs **no** frontend summary code. Only
Trigger and Branches (whose summaries are genuinely config-*shaped*, not flat templates) are
summarized specially, and they're the only two exceptions in `summarizeStep`. Colors are pure
pass-through: the backend ships a portable color *token* and `colorFor` resolves it to a
`var(--step-color-<token>)` whose palette lives once in `globals.css`, so there's no hex map in
JS to keep in sync. The one unavoidable local map is `ICON_MAP` (Lucide icons must be statically
imported to tree-shake — a string can't be turned into a component at runtime).

**Hybrid editor pattern.** Delay, Set status, Goal, Trigger, Request Document, and Assign to
Staff/Create Task all render from `SchemaForm` (`frontend/src/components/Editor/SchemaForm.tsx`),
driven entirely by the fetched JSON Schema and validated client-side with the same `ajv`
library the backend re-validates with. Branches and Communicate register bespoke editors
(`customEditors/BranchesEditor.tsx`, `CommunicateEditor.tsx`) in a small local map
(`customEditors/index.ts`); a step type with no registered custom editor falls back to
`SchemaForm` automatically.

**Canvas as a pure projection, with derived layout.** A workflow is a pure DAG — `steps[]`
plus `next[]` edges, and **no stored positions**. `frontend/src/lib/layoutGraph.ts` computes
every node's coordinates from the graph shape on render (dagre, top-down layered layout;
branch children fan out on the same rank; `go_to_action` back-edges handled by the greedy
acyclicer). `frontend/src/lib/graphMappers.ts`'s `workflowConfigToGraph` then projects
`steps[]` into React Flow nodes/edges using those positions (one generic `stepNode` type
always, `go_to_action` edges dashed), and `buildDisplayGraph.ts` layers the UI-only "+" insert
buttons and dashed "End" markers on top. This is the single biggest structural simplification
in the build: because layout is derived, the whole class of "cards overlap after an insert /
branch / reorder" bugs simply can't occur, and every graph edit is a pure edge edit with no
coordinates to maintain. (The design doc's reverse mapper `graphToWorkflowConfig` was dropped
as dead code — edits go straight to `steps[]` via `workflowOps`, never a canvas-to-config
round-trip.) Dragging a step is now purely a **reorder** gesture: drop it onto another edge to
splice it in there; drop it anywhere else and it snaps back to its computed spot.

**Graph edits are pure functions.** Every canvas mutation — insert, remove, reorder, retarget
a Go to action, set the trigger, edit config — is a pure `steps[] -> steps[]` transform in
`frontend/src/lib/workflowOps.ts`, with no React, no component state, and (now that positions
are derived) no layout math at all. `steps[]` is the whole source of truth, so "editing the
workflow" *is* transforming that array; keeping the transforms pure means each is
unit-testable on its own, and the two splice paths (remove and reorder) share one
edge-reconnection helper instead of each hand-rolling it. The page just does
`apply(prev => ops.something(prev, ...))`.

**Undo/redo.** `useWorkflowDraft` is a small reducer over `{ steps, past, future }`: every
user edit is one `commit` (push `past`, clear `future`); undo/redo move between the stacks;
hydration (load / conflict reconcile) resets history so you can't undo across a workflow
switch. This was nearly free precisely because every edit is already a pure `commit` of a
`workflowOps` transform. Wired to toolbar buttons and ⌘/Ctrl+Z / ⇧⌘/Ctrl+Z (ignored while
typing in a field), and undone/redone states autosave like any other edit.

**Workflow validation.** `frontend/src/lib/validateWorkflow.ts` is a pure set of
graph-integrity checks over `steps[]` — missing/invalid step config (via the same `ajv` the
backend uses), a Goal with an outgoing edge, a Go to action with no target, a dangling edge, an
unreachable step, an unwired branch port, and a `go_to_action` loop with no Branches step to
exit through (the design doc's explicit ask). One computation drives three surfaces: a per-step
badge on the canvas, an issues panel (click an issue to jump to that step), and the **publish
gate** — Publish is disabled while any error stands, so a broken workflow can't go live.
Warnings inform but don't block.

**Draft autosave + explicit publish, no versioning.** The page composes two focused hooks
rather than owning everything itself: `useWorkflowSelection` (the workflow list, which one is
selected, and create/rename/delete/publish/unpublish) and `useWorkflowDraft` (fetch the
detail, hydrate a local editable copy of `steps[]`, debounce-save it, reconcile conflicts).
Canvas edits update local state immediately, then debounce-save the whole draft snapshot to
`PATCH /api/workflows/:id/draft` guarded by a `draft_revision` number; a stale write gets a
`409` back with the server's current draft, which the hook reconciles onto rather than
overwriting. `POST /api/workflows/:id/publish` is a separate, explicit, non-debounced action.
A workflow is only ever `draft` or `published` — no version history — because every
`WorkflowRun` captures its own `steps_snapshot` at trigger time, so a later edit can never
affect a run already in progress (see `db/schema.sql`). `WorkflowBuilderPage.tsx` itself is now
just composition: wire the two hooks together, map the pure ops onto the draft, and render.

**Execution engine.** `backend/src/engine/executor.ts` is a small synchronous-per-tick state
machine: before a step's side effect fires, a `pending` row is reserved in
`run_step_history` for `(run_id, step_id, attempt)` — a unique index on that triple means a
racing resume can't double-execute it (NFR-2). `backend/src/engine/scheduler.ts` is a
1-second `setInterval` that polls `workflow_runs` for anything past its `due_at` — durability
comes from `due_at` being a real column, not from the interval itself, so a restart just means
the next tick picks up whatever's already due (NFR-1), per `CLAUDE_CODE_PROMPT.md`'s
explicit steer away from standing up Redis/BullMQ for this exercise.

**REST only.** No WebSockets or SSE anywhere in the frontend — run history and draft state are
polled (`pollingInterval` on the relevant RTK Query hooks) or refetched on demand.

**Adding a step type** is deliberately a backend-only task in the common case: write one module
in `backend/src/stepTypes/` (`type`, `label`, `icon`, `color`, `category`, `configSchema`,
`defaultConfig`, `ports`, `execute`, plus a `summary` template like `"Assign to {assignee}"`
and a `summaryFallback`), and add one line to `registry.ts`. That's it — the new type shows up
in "Choose an action" under its category, gets a canvas card with a correct title and subtitle,
appears in the Legend, and gets a working editor generated from its `configSchema`, all with no
frontend change. You only touch the frontend if the type needs (a) a Lucide icon not yet in
`ICON_MAP`, (b) a bespoke editor beyond what `SchemaForm` renders (register it in
`customEditors/index.ts`), or (c) a summary too config-shaped for a flat template (the Trigger
and Branches exceptions in `summarizeStep`). Changing an existing step's fields is purely a
`configSchema` edit — `SchemaForm` and the ajv validation both follow automatically.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/step-types` | Public step type registry |
| `GET /api/condition-types` | Branches' condition sub-registry |
| `GET /api/recipient-variables` | Communicate's recipient → variable map |
| `GET/POST /api/workflows` | List / create |
| `GET /api/workflows/:id` | Fetch one (draft + published steps) |
| `PATCH /api/workflows/:id/draft` | Debounced autosave, revision-guarded |
| `POST /api/workflows/:id/publish` | Publish |
| `GET /api/workflows/:id/runs` | Run history for a workflow |
| `GET /api/runs/:id/history` | One run's step-by-step history, document requests, tasks |
| `GET /api/applications` | List the mock applications |
| `POST /api/applications/:id/{submit,start,status}` | Simulate SIS events (fires triggers) |
| `POST /api/applications/:id/fee-status` | Simulate a payment gateway webhook |
| `POST /api/document-requests/:id/submit` | Simulate an applicant uploading documents |
| `POST /api/tasks/:id/complete` | Simulate staff completing a task |

## Deviations from the design doc

Flagged here rather than silently decided, per the doc's own "Open Questions" spirit:

1. **No separate `trigger_config` column.** The design doc's domain model (C.3) lists one, but
   the Trigger step is always `steps[0]`, and its own `config` already *is* the trigger config
   the Trigger Listener matches against. A second copy would just be one more thing that could
   drift from the first — see `backend/src/db/schema.sql`.
2. **Go to action's iteration cap ends the run labelled `escalated`, not a generic `error`.**
   Hitting a loop's hard safety cap is an expected, designed-for outcome that needs a human —
   not a bug — so it surfaces as a Goal-like labelled end state (`"Escalation cap reached — needs
   manual follow-up"`) rather than the same bucket as an actual execution failure.
3. **Workflow 3 has an extra terminal Goal** (`"Decision recorded after escalation"`) after step
   11 in the doc's B.3 table, which sets status but doesn't name a Goal for that path. Every path
   through a run needs a labelled end state (FR-9), so one was added.
4. **Delays are seconds, not days**, in the two fully-wired demo workflows, per
   `CLAUDE_CODE_PROMPT.md`'s own instruction to make them "demoable live."
5. **"New workflow" asks for a name up front via a modal** (`NameWorkflowModal.tsx`), and the
   top bar's pencil icon reopens the same modal to rename the current workflow at any time
   (`PATCH /api/workflows/:id`) — the design doc doesn't specify a naming UI, so this follows
   the reference demo's own flow rather than leaving every workflow called "Untitled workflow".
   The top bar's trash icon deletes the current workflow (`DELETE /api/workflows/:id`, gated
   behind a confirmation modal, not a native `window.confirm`) — deleting cascades to that
   workflow's runs and everything a run owns (history, document requests, tasks), since
   `foreign_keys = ON` would otherwise block the delete the moment any run exists
   (`deleteWorkflow` in `backend/src/db/workflows.ts`).

### New workflow flow

`POST /api/workflows` creates a workflow with `steps: []` — no default Trigger — and the
builder (`frontend/src/pages/WorkflowBuilderPage.tsx`) detects that empty state on load and
opens "Choose a trigger" automatically instead of leaving a blank canvas, matching the
reference demo: the canvas shows a fixed dashed Trigger/Action preview
(`buildSkeletonGraph` in `frontend/src/lib/buildDisplayGraph.ts`) and the top bar's status
badge reads "EXAMPLE" until a trigger is picked. The trigger list itself
(`ChooseTriggerPanel.tsx`) is grouped and iconed generically from the Trigger step type's own
`configSchema` (`enumGroups`/`enumIcons` on the `event` property in
`backend/src/stepTypes/trigger.ts`) — the same registry-driven pattern `ChooseActionPanel`
uses for step types — rather than a hardcoded option list. It offers the 3 events this build
actually executes on (Form started/submitted, Status changed, grouped Forms/Applications);
the demo's list also shows "Final decision marked" and "Application withdrawn", which aren't
included here since neither corresponds to a real event this backend's Trigger Listener can
match (see `backend/src/engine/triggerListener.ts`'s `ApplicationEvent` union) — every option
in this build's picker actually works if chosen.

Once a Trigger is configured, its editor panel (`StepEditorPanel.tsx` + Trigger's bespoke
`customEditors/TriggerEditor.tsx`) shows only the one field relevant to its event — a "Form"
picker (Any/Enquiry/Application/Enrolment/Scholarship) for Form started/submitted, a "Status"
text field for Status changed — rather than a generic dropdown mixed with every trigger field
at once, matching the demo. Re-picking the event itself is a separate action, "Change
trigger" in the footer, which reopens `ChooseTriggerPanel` and swaps `steps[0]`'s config in
place — the rest of the workflow (everything downstream) is untouched. The "Form" field is
real, not decorative: `POST /applications/:id/submit` and `/start` take an optional `form` in
the body, and `triggerMatches()` in `backend/src/engine/triggerListener.ts` only matches a
Trigger configured for a specific form against an event carrying that same form (an unset
form on either side matches everything, so triggers saved before this field existed keep
working unchanged).

## Design fidelity

The demo doesn't ship a design system doc, so colors, spacing, and type were read directly off
`workflow-14.netlify.app` via computed-style inspection (panel widths, the zinc-based neutral
palette, the seven step-type accent colors, corner radii, font stack) rather than eyeballed —
see `frontend/src/styles/globals.css` for the resulting tokens. The two new step types
(Request Document, Assign to Staff / Create Task) get two new accent colors chosen to sit
comfortably in the same palette family, since the demo has no precedent for them.

## Testing

Backend: exercised directly against the running server (draft save, revision-conflict 409,
publish, and a full live run of both Workflow 1 and Workflow 3 through to both their happy and
escalation paths, including the loop-back/counter mechanics).

Frontend: driven end-to-end with a headless Playwright session against the actual dev server —
every panel (editor, custom Branches/Communicate editors, Legend, Choose an action, Run
history), workflow switching, and the variable-picker insertion. That pass caught a real bug
before it shipped: the autosave effect's hydration guard was inverted, so a workflow's very
first page load queued a debounced save of an *empty* `steps[]` that (because the later
real-data hydration only skips its own effect run, not that already-queued one) landed ~800ms
later and wiped the draft. Fixed by defaulting the guard to "skip" instead of "save" — see the
comment above `skipNextSaveRef` in `frontend/src/pages/WorkflowBuilderPage.tsx` — with a second,
belt-and-suspenders check that autosave never persists an empty `steps[]` at all, since a real
workflow always has at least its Trigger step.

Two more bugs were caught and fixed the same way (Playwright against the live dev server, not
just code review):

- **Mid-edge insertion overlapped its neighbor.** Clicking the "+" on an edge between two
  existing steps used to drop the new step at the midpoint of their positions without moving
  anything else, so it visually overlapped the downstream step. `insertStep` in
  `frontend/src/pages/WorkflowBuilderPage.tsx` now gives the new step the target's old position
  and shifts everything at or below that row down by one row height, using a simple y-threshold
  (not graph reachability) so it stays correct on `go_to_action` loop-back edges, where the
  target can sit above its source. Verified via bounding-box comparison of every canvas node
  before/after an insertion — no overlaps introduced. (A pre-existing, unrelated minor overlap
  between adjacent branch columns lower in the graph — present before this fix too, from the
  seeded x-positions — is out of scope; it wasn't the reported bug and this fix doesn't touch it.)
- **The zoom bar's buttons were unclickable.** `ZoomBar.tsx` rendered as a plain positioned
  `<div>` child of `<ReactFlow>`, which paints behind the pane's full-canvas hit-testing layer in
  React Flow's stacking order — Playwright's click on "Fit view" failed with the pane reported as
  intercepting the pointer event. Fixed by wrapping it in React Flow's own `<Panel
  position="bottom-right">`, which is designed to sit above the pane.
- **Steps couldn't be dragged at all — not visually, not persisted.** This app runs React Flow
  fully controlled (nodes come from `steps[]`, no `defaultNodes`), which means React Flow keeps
  no live drag position of its own — the app must apply position changes itself for a drag to
  even render. `WorkflowCanvas.tsx`'s `onNodesChange` only applied a change when
  `type === "position" && dragging === false && position` were all true together, but React
  Flow's own drag pipeline (`@reactflow/core`'s `updateNodePositions`) never emits an event
  satisfying all three: every in-flight move carries `dragging: true` plus the live position,
  and the one event marking the drag's end carries `dragging: false` with no `position` field at
  all (it's called as `updateNodePositions(items, positionChanged=false, dragging=false)` on
  drag end, which deliberately omits position/positionAbsolute from the change). So the filter
  matched nothing, ever — confirmed by logging every raw `NodeChange` during a Playwright-driven
  drag and watching the node's rendered `transform` never move, in-flight or after mouseup.
  Fixed by dropping the `dragging === false` requirement and applying any `position` change as
  it arrives (the standard controlled-nodes pattern, equivalent to `applyNodeChanges`) — this
  gives live visual feedback during the drag and naturally lands on the final position from the
  last `dragging: true` event before the position-less `dragging: false` event arrives as a
  no-op. Verified via Playwright: dragged a step, confirmed its on-canvas position changed
  immediately during the drag (not just after release) and that the new `{x, y}` persisted to
  the backend via the debounced autosave.

### Drag-to-reorder (added on request, not in the design doc)

Once dragging worked at all (above), the follow-up request was to actually be able to reorder
steps by dragging one to a different spot in the chain — not just reposition it cosmetically.
Not in the design doc, which only specs the "+"-on-an-edge insertion affordance for *new* steps
(C.6.2/the demo) — this generalizes that same idea to an *existing* step picked up and moved.

- `frontend/src/lib/dragReorder.ts` is the new small pure module this leans on:
  `isReorderable(step, stepClient)` gates the feature to steps with exactly one outgoing edge —
  every type except Branches (two outputs — which one would continue the chain past the drop
  point?) and Goal (zero); the Trigger is excluded outright since it's never anything but
  `steps[0]`. Every other step type still gets plain free-drag repositioning only, unchanged.
  `findClosestEdge(steps, draggedStepId, draggedPosition)` is the one place that decides "which
  edge would this land on" — nearest-point-on-segment distance from the dragged node's center to
  every real step-to-step edge (skipping any edge touching the dragged step itself), within a
  threshold — used identically by both the live indicator and the actual drop, so they can never
  disagree about the target.
- `WorkflowCanvas.tsx` calls `findClosestEdge` on every `onNodeDrag` tick (not just at drop) and
  stores the result in `canvasStore`'s new `dragOverEdge` — genuinely ephemeral, per-drag UI
  state in the sense C.6.5 already calls out ("drag-in-progress position" is its own example).
  `StepEdge.tsx` reads it and swaps that one edge's "+" button for a pulsing "Drop to insert
  here" pill (`canvas.css`'s `.drop-indicator`) plus a highlighted stroke, so there's an explicit
  visible target rather than a silent snap. `onNodeDragStop` calls the new `reorderStep(stepId,
  edge)` context method if a drop target was live when the mouse came up.
- `reorderStep` in `WorkflowBuilderPage.tsx` does the actual splice in two steps on `steps[]`:
  detach (reconnect whoever pointed at the dragged step straight through to wherever it used to
  point — the same remap `removeStep` already does, reused here without actually deleting the
  step), then attach (the target edge's source now points at the dragged step on the same port,
  and the dragged step points at whatever that edge used to point at). The step's on-canvas
  position is left exactly where the user dropped it rather than snapped onto the old target's
  position the way a brand-new `insertStep` is — the user just placed it there on purpose.
- Verified via Playwright: dragged a linear step (Delay) across three other steps and dropped it
  onto a distant edge, confirmed the "Drop to insert here" indicator appeared mid-drag (before
  release), and confirmed the resulting `steps[].next[]` wiring — both the detach and the
  reattach sides — persisted correctly to the backend. Separately confirmed a non-reorderable
  step (Branches) shows no indicator and still just repositions in place, with its own `next[]`
  untouched, when dragged the same way.

### Later architecture pass: auto-layout, undo/redo, validation

A subsequent pass took on three bigger changes (see the matching entries in the Architecture
section above). **This supersedes the position-based mechanics described in the two "Testing"
bullets above** — the "shift everything down a row on insert" math and the "apply position on
every drag frame so the node moves" fix both belonged to the era when a step stored its own
`{x, y}`. That era is over:

- **Auto-layout.** Steps no longer store a position (dropped from the type, the backend, the DB
  seed, and all of `workflowOps`). `lib/layoutGraph.ts` derives every position from the graph
  with dagre on each render. This retires the entire overlap-bug class those two bullets were
  fighting — there are no coordinates to get wrong any more. Dragging became a pure reorder
  gesture (a transient overlay gives live feedback; on release the step either splices into the
  edge it was dropped on or snaps back to its computed spot). Verified via Playwright:
  zero card overlaps across all four seeded workflows (including the 23-step, all-9-types
  Scholarship flow), and insert/remove/reorder all still produce correct wiring.
- **Undo/redo.** `useWorkflowDraft` became a `{ steps, past, future }` reducer; buttons +
  ⌘/Ctrl+Z / ⇧⌘/Ctrl+Z. Verified: a sequence of inserts undone step-by-step and redone, via
  both buttons and keyboard, with each state persisting through autosave.
- **Validation + publish gate.** `lib/validateWorkflow.ts` runs pure graph-integrity checks;
  errors badge the step, list in an issues panel, and disable Publish. Verified: the four seeded
  workflows report clean; adding an unconfigured Goal raises an error (chip + canvas badge +
  Publish disabled), and fixing its label clears it.

Every throwaway workflow created during these verification runs was deleted afterward, leaving
the four seeded workflows untouched.
