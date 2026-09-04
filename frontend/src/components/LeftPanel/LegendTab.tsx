import React from "react";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { iconFor, colorFor } from "../../lib/stepClient";

// "The Legend tab is literally a loop over it" (C.6.1) — every entry here comes straight
// from the fetched step-type registry, nothing hardcoded per step type.
export function LegendTab() {
  const { stepClient } = useWorkflowEdit();
  const defs = Object.values(stepClient);

  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 0 }}>
        Step types available in the builder today.
      </p>
      {defs.map((def) => {
        const Icon = iconFor(def.icon);
        const color = colorFor(def.color);
        return (
          <div className="legend-row" key={def.type}>
            <div className="legend-row__icon" style={{ backgroundColor: color }}>
              <Icon size={16} color="#fff" />
            </div>
            <div>
              <div className="legend-row__label">{def.label}</div>
              <div className="legend-row__desc">{def.description}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
