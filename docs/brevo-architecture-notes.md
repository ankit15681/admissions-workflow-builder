# Brevo automation editor — architecture notes & what we adopted

Notes from inspecting Brevo's live automation editor and its APIs, and the decision to align
our builder with the parts that fit. Captured so the "why" behind the changes is on record.

## What Brevo's APIs return

- **`getCategoryData?workflow_id=…`** — the palette catalog, served from the backend:
  `trigger_categories`, `action_categories`, `condition_categories` (each a category → list of
  entries), plus `sequence` (category ordering), `icons`, `events_data`. Each catalog entry:
  `{ key, action_type, label (i18n key), icon, color, icon_color, description, source,
  internal_action_id, sub_sequence, is_sales_restricted }`.
- **`unified-ddl`** — `{ status, data: { …~412 entries… } }`. Each entry is a **declarative UI
  field/widget descriptor as data**, keyed `automation_<internalActionId>_brevo_custom_<widget>_<field>`
  (e.g. `…_text_area_message`, `…_multi_select_senders`, `…_common_radio_button_email_type`,
  `…_bordered_section_…`). Descriptors carry props (`labelText`, `placeholder`, `cardComponentProps`,
  `helpButtonProps`, `style`) and use **`__base__type`** to extend a base descriptor — i.e.
  inheritance/composition of field defs. The widget vocabulary includes **container/layout**
  widgets (`bordered_section`, `children_render`, `card`), not just leaf inputs.
- **`/v1/workflow/1`** — the instance: `{ id, name, status, triggers: [...], actions: { "<id>": {...} } }`.
  `actions` is an **id-keyed map**; each node has `next`/`prev` pointers (a doubly-linked list;
  0 = terminal), config **namespaced under a key equal to its `type`** (`send_email: {...}`),
  an `is_condition` flag, and `internal_action_id` linking it to the catalog/DDL. `triggers` is
  an **array** (multiple OR entry points).
- **`/v1/workflow/1/description`** — same shape plus a `description` field; a lighter variant.
- **`unified-templates…/email/templates/1`** — a **separate service** holding the email template
  content (~25KB). The node stores only `template_id` and references it — heavy payloads live
  elsewhere, referenced by id, never inlined in the workflow.

## How it maps to our design

| Concern | Brevo | Ours |
|---|---|---|
| Catalog metadata | served (`getCategoryData`): grouped, ordered, i18n, gating | `GET /api/step-types` + now `GET /api/step-categories` |
| Config-form definition | `unified-ddl`: descriptors-as-data, `__base__type` inheritance | JSON Schema + our field-descriptor DSL (`lib/stepForm`) |
| Atoms / design system | widget registry incl. containers | `components/fields/*` + `lib/fieldRegistry`, incl. `Section` |
| Graph model | id-keyed map + prev/next; multiple triggers | `steps[]` array + `next[]` edges; single trigger |
| Config location | `node[node.type]` | `node.config` |
| Heavy content | referenced by id (template service) | small config inlined; principle adopted for future assets |

## What we adopted ("aligned & additive")

Kept the working engine (steps[] + next[] edges, single trigger) — rewriting it to Brevo's
map+linked-list model is churn without benefit at our scale. Adopted the parts that extend what
we have:

1. **Backend-served catalog metadata.** `GET /api/step-categories` serves category labels +
   ordering (`stepTypes/categories.ts`); the builder consumes it instead of hardcoding
   `CATEGORY_ORDER` / `CATEGORY_LABELS`. Reordering/renaming a category is now a data change.
2. **Gating flag.** Optional `hidden` on a step type's public projection (Brevo's
   `is_sales_restricted`); the palette filters hidden step types. Nothing is gated today — it's
   the mechanism for plan-gated / unreleased actions.
3. **Container / layout atom.** `Section` (Brevo's `bordered_section`) groups fields under a
   title. A step editor can declare an `EditorSection[]` layout; grouping is purely presentational
   and never changes the flat, projected config. This is the fractal Unit stepping up from leaf
   field to group. Demonstrated in `ScheduleInterviewEditor`.
4. **Descriptor DSL + composition (`__base__type` equivalent).** Field factories (`text`, `select`,
   `number`, `tags`, `checkbox`) in `lib/stepForm` are the base specs; passing an options object
   overrides them, and a reusable group is a plain descriptor object spread into a def — object
   spread is the TS-idiomatic form of `__base__type`, so inheritance needs no string-ref machinery.
5. **Reference-by-id principle.** Adopted in principle: heavy assets should be referenced by id
   from a separate store rather than inlined in the workflow (our configs are small today, so no
   separate service was built).

## Deliberately NOT adopted

- **Id-keyed node map + prev/next linked list** — our `steps[]` + `next[]` is an equivalent,
  simpler graph model; switching would touch executor, ops, layout, validation, snapshots, and
  seed for no gain at this scale.
- **Config namespaced under `node[type]`** — cosmetic; `node.config` is fine.
- **Fully server-driven DDL** replacing JSON-Schema forms — our schema-over-API already gives the
  data-driven benefit; a bespoke DDL endpoint is more surface for little added value here.
