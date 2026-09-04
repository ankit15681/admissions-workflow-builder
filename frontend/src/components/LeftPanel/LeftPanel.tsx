import React from "react";
import { useCanvasStore } from "../../state/canvasStore";
import { OverviewTab } from "./OverviewTab";
import { LegendTab } from "./LegendTab";
import "./leftPanel.css";

export function LeftPanel({ workflowName, workflowDescription }: { workflowName: string; workflowDescription: string }) {
  const { leftTab, setLeftTab } = useCanvasStore((s) => ({ leftTab: s.leftTab, setLeftTab: s.setLeftTab }));

  return (
    <div className="left-panel">
      <div className="left-panel__tabs">
        <button
          className={`left-panel__tab${leftTab === "brief" ? " left-panel__tab--active" : ""}`}
          onClick={() => setLeftTab("brief")}
        >
          Overview
        </button>
        <button
          className={`left-panel__tab${leftTab === "legend" ? " left-panel__tab--active" : ""}`}
          onClick={() => setLeftTab("legend")}
        >
          Legend
        </button>
      </div>
      <div className="left-panel__body">
        {leftTab === "brief" ? (
          <OverviewTab name={workflowName} description={workflowDescription} />
        ) : (
          <LegendTab />
        )}
      </div>
    </div>
  );
}
