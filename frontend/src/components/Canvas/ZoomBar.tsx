import React from "react";
import { useReactFlow, useStore, Panel } from "reactflow";
import { Minus, Plus, Maximize } from "lucide-react";

// Rendered via React Flow's own <Panel> rather than a plain positioned <div>: a raw div
// child of <ReactFlow> paints *before* the pane in DOM order, so the pane's full-size
// hit-testing layer sits on top and swallows clicks meant for it. <Panel> is React
// Flow's own mechanism for exactly this — an overlay guaranteed to sit above the pane.
export function ZoomBar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);

  return (
    <Panel position="bottom-right">
      <div className="canvas-zoom-bar">
        <button onClick={() => zoomOut()} aria-label="Zoom out">
          <Minus size={14} />
        </button>
        <span style={{ width: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => zoomIn()} aria-label="Zoom in">
          <Plus size={14} />
        </button>
        <button onClick={() => fitView({ padding: 0.2 })} aria-label="Fit view">
          <Maximize size={13} />
        </button>
      </div>
    </Panel>
  );
}
