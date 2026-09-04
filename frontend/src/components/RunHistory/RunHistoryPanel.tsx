import React, { useState } from "react";
import { X } from "lucide-react";
import { useGetRunsQuery, useGetRunDetailQuery } from "../../app/api";
import { useCanvasStore } from "../../state/canvasStore";
import "../Editor/editor.css";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function RunHistoryPanel({ workflowId }: { workflowId: string }) {
  const closePanel = useCanvasStore((s) => s.closePanel);
  const { data: runs } = useGetRunsQuery(workflowId, { pollingInterval: 2000 });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="editor-panel" style={{ width: 460, flexBasis: 460 }}>
      <div className="editor-panel__header">
        <div className="editor-panel__header-text">
          <div className="editor-panel__title">Run history</div>
        </div>
        <button className="editor-panel__close" onClick={closePanel} aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="run-history">
        {!runs || runs.length === 0 ? (
          <p className="field__hint">No runs yet — fire a trigger event against this workflow to start one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Status</th>
                <th>Started</th>
                <th>Next</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <React.Fragment key={run.id}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{run.applicant_name}</div>
                      <div style={{ color: "var(--color-text-faint)" }}>{run.programme}</div>
                    </td>
                    <td>
                      <span className={`status-pill status-pill--${run.status}`}>{run.status}</span>
                    </td>
                    <td>{formatTime(run.started_at)}</td>
                    <td>{run.goal_label ?? (run.status === "waiting" ? `resumes ${formatTime(run.due_at)}` : run.current_step_id ?? "—")}</td>
                  </tr>
                  {expanded === run.id && <RunDetailRow runId={run.id} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RunDetailRow({ runId }: { runId: string }) {
  const { data } = useGetRunDetailQuery(runId, { pollingInterval: 2000 });
  if (!data) return null;
  return (
    <tr>
      <td colSpan={4} style={{ background: "var(--color-bg)" }}>
        {data.history.map((h) => (
          <div key={h.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
            <span>
              {h.step_type} <span style={{ color: "var(--color-text-faint)" }}>({h.result})</span>
            </span>
            <span style={{ color: "var(--color-text-faint)" }}>{formatTime(h.executed_at)}</span>
          </div>
        ))}
      </td>
    </tr>
  );
}
