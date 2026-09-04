import React from "react";
import { useCanvasStore } from "../../state/canvasStore";

export function OverviewTab({ name, description }: { name: string; description: string }) {
  const openRunHistory = useCanvasStore((s) => s.openRunHistory);

  return (
    <div className="overview">
      <h3>{name}</h3>
      <span className="overview__meta">Admissions workflow</span>
      <p>{description || "No description yet."}</p>

      <div className="overview__section-label">On the canvas</div>
      <p>
        Click any step to edit it, use the <strong>+</strong> on an edge to insert a step in between, or the dangling{" "}
        <strong>+</strong> after a step to add what comes next.
      </p>

      <div className="overview__section-label">Runs</div>
      <p>Every trigger firing starts its own independent run against a snapshot of the published workflow.</p>
      <button className="btn btn--secondary" style={{ width: "100%" }} onClick={openRunHistory}>
        View run history
      </button>
    </div>
  );
}
