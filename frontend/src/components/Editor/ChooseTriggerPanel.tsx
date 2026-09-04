import React, { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { useCanvasStore } from "../../state/canvasStore";
import { iconFor, triggerEventLabel } from "../../lib/stepClient";
import "./editor.css";

interface TriggerOption {
  value: string;
  label: string;
  icon: string;
  group: string;
}

/**
 * Shown automatically on a brand-new workflow (steps.length === 0), matching the
 * reference demo's "Choose a trigger" flow: a searchable, grouped list built from the
 * Trigger step type's own configSchema (enum/enumGroups/enumIcons) rather than a
 * hardcoded option list — the same registry-driven pattern ChooseActionPanel uses for
 * step types. Picking one creates the workflow's Trigger step (steps[0]).
 */
export function ChooseTriggerPanel() {
  const { stepClient, setTriggerEvent } = useWorkflowEdit();
  const closePanel = useCanvasStore((s) => s.closePanel);
  const [query, setQuery] = useState("");

  const properties = stepClient.trigger?.configSchema?.properties as
    | Record<string, { enum?: string[]; enumGroups?: string[]; enumIcons?: string[] }>
    | undefined;
  const eventSchema = properties?.event;

  const groups = useMemo(() => {
    const enumValues: string[] = eventSchema?.enum ?? [];
    const enumGroups: string[] = eventSchema?.enumGroups ?? [];
    const enumIcons: string[] = eventSchema?.enumIcons ?? [];

    const options: TriggerOption[] = enumValues.map((value, i) => ({
      value,
      label: triggerEventLabel(value),
      icon: enumIcons[i] ?? "zap",
      group: enumGroups[i] ?? "Triggers",
    }));

    const filtered = query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

    const order: string[] = [];
    const byGroup = new Map<string, TriggerOption[]>();
    filtered.forEach((o) => {
      if (!byGroup.has(o.group)) {
        byGroup.set(o.group, []);
        order.push(o.group);
      }
      byGroup.get(o.group)!.push(o);
    });
    return order.map((group) => ({ group, options: byGroup.get(group)! }));
  }, [eventSchema, query]);

  function choose(event: string) {
    setTriggerEvent(event);
    closePanel();
  }

  return (
    <div className="editor-panel">
      <div className="editor-panel__header">
        <div className="editor-panel__header-text">
          <div className="editor-panel__title">Choose a trigger</div>
        </div>
        <button className="editor-panel__close" onClick={closePanel} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="choose-action__search">
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 9, top: 9, color: "var(--color-text-faint)" }} />
          <input
            className="field__input"
            style={{ paddingLeft: 28 }}
            placeholder="Search triggers"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="editor-panel__body" style={{ paddingTop: 0 }}>
        {groups.map(({ group, options }) => (
          <div key={group} className="choose-action__section">
            <div className="choose-action__section-label">{group}</div>
            {options.map((opt) => {
              const Icon = iconFor(opt.icon);
              return (
                <div key={opt.value} className="choose-action__item" onClick={() => choose(opt.value)}>
                  <Icon size={16} color="#5b5bd6" />
                  {opt.label}
                </div>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <div className="field__hint">No triggers match &quot;{query}&quot;.</div>}
      </div>
    </div>
  );
}
