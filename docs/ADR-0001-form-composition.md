# ADR-0001: Composition-based form architecture for step editors

- **Status:** Accepted (proof-of-concept slice implemented)
- **Date:** 2026-08
- **Scope:** Frontend only. The backend contract (per-step JSON `configSchema`, validated with ajv on save/publish, read by each step's `execute`) does not change.

## Context

Every step editor is built from the same small set of atomic inputs — text field, textarea, dropdown, number, tag list, checkbox. Today those atoms are not a shared thing:

- `SchemaForm` renders generic steps via a hardcoded `Field` switch that hand-rolls `<input className="field__input">` etc.
- Each bespoke editor (Communicate, Branches, Trigger, GoTo, ScheduleInterview) *also* hand-rolls its own inputs against the same CSS classes.

So the same input markup is duplicated across editors, there's no design-system layer, no per-field logic layer, and no single way to compose a new step editor. We also want a hard rule that **only backend-meaningful data is persisted** — editor-only UI state must never reach the backend.

## Decision

Introduce a **fractal, composition-based field system** with a strict **frontend/backend data boundary**.

### 1. The Unit shape (fractal)

Every unit — an atom *and* a whole step editor — has the same two-part shape: **a UI component + a data-logic hook**, plus a projection to backend-meaningful config.

- **Atom** = a presentational, controlled component (`TextField`, `Select`, `NumberField`, …) paired with a logic hook (`useTextField`, `useSelectField`, `useNumberField`). The hook owns only *ephemeral* UI state (touched flags, parse buffers) and derives errors; the atom renders from `value` + `onChange`.
- **Step editor** = the same shape one level up: a component composed of atoms, whose "config" is the merge of its fields' values. A group of fields is itself a unit, so units nest into a tree (fields → groups → step), all composed identically.

### 2. Composition

A step editor is declared as data — a map of **field descriptors** (`kind`, `label`, `options`, `visibleWhen`, …). `useStepForm(config, onChange, def)` binds that def to the step's config and returns one bound field per visible descriptor; `<FieldRenderer>` maps each descriptor's `kind` to its atom via the **field registry**. Bespoke needs (conditional fields, dependent options) are expressed with `visibleWhen` and, where richer UX is needed, by composing atoms imperatively with the same `useStepForm` bindings.

The field registry is the design-system counterpart to the step-type registry, one level down: **a new field kind is one atom + one hook + one registry line** (and one `FieldKind` union member) — mirroring how a new step type is one module + one registry line.

### 3. The data boundary ("only meaningful data to the backend")

`projectConfig(config, def)` is the single choke point every change flows through. It keeps only keys declared in the step's field def, drops any field currently hidden by `visibleWhen`, and omits `undefined`. Everything else — touched flags, fetched option lists, previews, in-progress buffers — stays in the editor's frontend-only state and is never persisted. Because the field def enumerates the meaningful keys, the boundary is *enforced*, not merely conventional.

### 4. State ownership (the important constraint)

Per-field hooks **derive**, they don't **own** the committed value. The committed (meaningful) value is read from the single `steps[]` config and written back via `onChange`; only ephemeral UI state is local to a hook. This keeps the three things that already work for free intact — undo/redo (one `steps[]` history), debounced autosave (keyed on `[steps]`), and 409-conflict reconcile (re-hydrates `steps[]`). A naive "each hook holds its own value" model would create N competing sources of truth and break all three; it was explicitly rejected.

## Consequences

**Positive**

- One design-system atom per field kind, reused by generic *and* bespoke editors — no duplicated input markup.
- Adding a field kind is as cheap and localized as adding a step type.
- The frontend/backend data boundary is explicit and enforceable in one function.
- Undo/redo, autosave, and conflict handling are unaffected (single source of truth preserved).
- Editors shrink to a declarative field list (see the migrated `ScheduleInterviewEditor`).

**Negative / cost**

- During migration there is temporary duplication: the new atoms live alongside `SchemaForm`'s old `Field` switch until Phase 2 rewrites it.
- A declarative descriptor format can't express *every* bespoke UI; those keep an imperative escape hatch (compose atoms directly with `useStepForm`).
- For a take-home this is real churn on already-clean code — worth it for the design/talking point, but sequenced behind correctness features.

## Alternatives considered

- **Keep hand-rolled inputs per editor.** Rejected: duplication, no design system, inconsistent styling/validation.
- **Field hooks own committed value state.** Rejected: breaks single-source-of-truth (undo/redo, autosave, conflict reconcile).
- **Fully declarative, data-only editors (no imperative escape).** Rejected as the *sole* mechanism: conditional fields, dependent options, and live previews (e.g. Communicate's recipient-aware variable picker) need an imperative path. Kept as the default for simple steps, with imperative composition available.

## File layout

```
components/fields/     TextField.tsx, Select.tsx, NumberField.tsx        (atoms: UI)
hooks/fields/          useTextField.ts, useSelectField.ts, useNumberField.ts (atoms: logic)
lib/stepForm.ts        FieldDescriptor / StepUnitDef types + projectConfig (the data boundary)
lib/fieldRegistry.tsx  kind -> atom, plus <FieldRenderer>
hooks/useStepForm.ts   binds a field def to (config, onChange) via projectConfig
```

## Migration plan (non-breaking, phased)

1. **[done]** Add the atoms + hooks + field registry + `useStepForm`/`projectConfig`, and migrate one real editor (`ScheduleInterviewEditor`) onto it as proof.
2. **[done]** Rewrite `SchemaForm` to compose the field registry (`schemaToDescriptor` + `<FieldRenderer>`) instead of its hardcoded `Field` switch.
3. **[done]** Migrate the remaining bespoke editors (Communicate, Branches, Trigger, GoTo) onto atoms, deleting the duplicated input markup. Bespoke bits kept: Communicate's variable picker (imperative, with a forwarded textarea ref), Branches' condition SchemaForm, GoTo's `setGoToTarget` edge edit.
4. **[partial]** Added the `tags` and `checkbox` field kinds needed by `SchemaForm`. Still optional/future: extract a dedicated `fields.css` so atoms no longer depend on `editor.css` class names; add `date` and `radio` kinds.

After phases 1–3, every step editor in the app — generic and bespoke — renders through the same atoms + field registry. There are no hand-rolled `<input>`/`<select>`/`<textarea>` left in the editors.

### Brevo-aligned additions (implemented)

After inspecting Brevo's automation editor (see `brevo-architecture-notes.md`), we adopted the
patterns that extend this architecture without rewriting the engine:

- **Container / layout atom** — `Section` (Brevo's `bordered_section`) + an `EditorSection[]`
  layout, so a step editor groups its flat fields under titles. Grouping is presentational only;
  the projected config stays flat. This is the fractal Unit stepping up from leaf field to group.
  Demonstrated in `ScheduleInterviewEditor`.
- **Descriptor DSL + composition** — field factories (`text`/`select`/`number`/`tags`/`checkbox`)
  in `lib/stepForm` are base specs overridden by the options you pass; a shared group is a plain
  descriptor object spread into a def — object spread is the TS-idiomatic form of Brevo's
  `__base__type` inheritance.
- **Backend-served catalog metadata** — `GET /api/step-categories` serves category labels +
  ordering; the palette consumes it instead of hardcoding them. Plus an optional `hidden` gating
  flag on the step-type projection (Brevo's `is_sales_restricted`).
- **Reference-by-id** for heavy content — adopted in principle (our configs are small; no
  separate asset service built).
- **Per-editor data-logic hooks** — each bespoke editor (Schedule Interview, Communicate,
  Branches, Trigger, Go To) now pairs a thin, pure component with its own hook in
  `hooks/editors/*` (over the shared `useStepForm`/`useSectionedForm` engine). This completes
  the fractal contract: every unit — atom *and* step editor — is a UI component + a data-logic
  hook, with the logic testable in isolation from the JSX.

Deliberately not adopted: Brevo's id-keyed node map + prev/next linked-list graph model, and a
fully server-driven form DDL — both are churn without benefit at our scale (rationale in the
notes doc).

## Proof-of-concept in this repo

`ScheduleInterviewEditor` is fully migrated: it declares a three-field def (`mode` select, `room` text, `durationMins` number). `room` has `visibleWhen: mode === "in_person"`, so switching to a video interview both hides the field and drops `room` from the persisted config — demonstrating composition and the data boundary together. `tsc`, `eslint`, and the production build stay green.
