import React from "react";
import { Handle, Position } from "reactflow";

export function EndNode() {
  return (
    <div className="end-node">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      End
    </div>
  );
}
