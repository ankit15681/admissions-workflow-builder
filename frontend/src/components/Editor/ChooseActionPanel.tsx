import React, { useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { useCanvasStore } from "../../state/canvasStore";
import { useGetStepCategoriesQuery } from "../../app/api";
import { iconFor, colorFor } from "../../lib/stepClient";
import type { StepCategory, StepCategoryMeta } from "../../types/stepTypes";
import "./editor.css";

// Fallback used only until GET /api/step-categories resolves (or if it fails). The server is
// the source of truth for category labels + ordering (modelled on Brevo's getCategoryData).
const FALLBACK_CATEGORIES: StepCategoryMeta[] = [
  { key: "communication", label: "Communication", order: 1 },
  { key: "flow", label: "Flow control", order: 2 },
  { key: "application", label: "Application", order: 3 },
  { key: "staff", label: "Staff", order: 4 },
  { key: "scheduling", label: "Scheduling", order: 5 },
];

export function ChooseActionPanel({
  insertAfterStepId,
  portId,
  targetStepId,
}: {
  insertAfterStepId: string;
  portId: string;
  targetStepId?: string;
}) {
  const { stepClient, insertStep } = useWorkflowEdit();
  const { closePanel, openEditStep } = useCanvasStore((s) => ({ closePanel: s.closePanel, openEditStep: s.openEditStep }));
  const { data: categoryMeta } = useGetStepCategoriesQuery();
  const [query, setQuery] = useState("");

  const categories = categoryMeta && categoryMeta.length ? categoryMeta : FALLBACK_CATEGORIES;
  const ordered = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);
  const labelOf = (key: StepCategory) => categories.find((c) => c.key === key)?.label ?? key;

  const groups = useMemo(() => {
    // Exclude the trigger (chosen separately) and any step type gated off via `hidden`.
    const defs = Object.values(stepClient).filter((d) => d.type !== "trigger" && !d.hidden);
    const filtered = query.trim()
      ? defs.filter((d) => d.label.toLowerCase().includes(query.trim().toLowerCase()))
      : defs;
    const byCategory = new Map<StepCategory, typeof defs>();
    ordered.forEach((c) => byCategory.set(c.key, []));
    filtered.forEach((d) => byCategory.get(d.category)?.push(d) ?? byCategory.set(d.category, [d]));
    return byCategory;
  }, [stepClient, query, ordered]);

  function choose(stepType: string) {
    const newId = insertStep(insertAfterStepId, portId, stepType, targetStepId);
    openEditStep(newId);
  }

  return (
    <div className="editor-panel">
      <div className="editor-panel__header">
        <div className="editor-panel__header-text">
          <div className="editor-panel__title">Choose an action</div>
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
            placeholder="Search actions"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="editor-panel__body" style={{ paddingTop: 0 }}>
        {ordered.map((cat) => {
          const items = groups.get(cat.key) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat.key} className="choose-action__section">
              <div className="choose-action__section-label">{labelOf(cat.key)}</div>
              {items.map((def) => {
                const Icon = iconFor(def.icon);
                const color = colorFor(def.color);
                return (
                  <div key={def.type} className="choose-action__item" onClick={() => choose(def.type)}>
                    <div className="choose-action__icon" style={{ backgroundColor: color }}>
                      <Icon size={14} color="#fff" />
                    </div>
                    {def.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
