import Ajv from "ajv";
import type { Step } from "../types/workflow";
import type { StepClient } from "./stepClient";

/**
 * Pure workflow-integrity checks over steps[] — the builder validates the *graph*, not just
 * individual step configs. Publish is gated on there being no errors (warnings don't block).
 * Every check is a pure function of (steps, stepClient), so it's trivially testable and the
 * same result drives the canvas badges, the issues panel, and the publish gate — one source
 * of truth, they can never disagree.
 */

export type IssueLevel = "error" | "warning";

export interface ValidationIssue {
  level: IssueLevel;
  /** The step this issue is about, if any (used to badge that card on the canvas). */
  stepId?: string;
  code: string;
  message: string;
}

const ajv = new Ajv({ allErrors: true, strict: false });

// Reachable set from `start` following next[] edges.
function reachableFrom(steps: Step[], start: string): Set<string> {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const n of byId.get(id)?.next ?? []) stack.push(n.targetId);
  }
  return seen;
}

// Set of nodes that can reach `target` (reverse reachability).
function reaching(steps: Step[], target: string): Set<string> {
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const s of steps) {
      if (s.next.some((n) => n.targetId === id)) stack.push(s.id);
    }
  }
  return seen;
}

export function validateWorkflow(steps: Step[], stepClient: StepClient): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (steps.length === 0) return issues; // brand-new workflow — nothing to validate yet

  const ids = new Set(steps.map((s) => s.id));
  const triggers = steps.filter((s) => s.type === "trigger");

  if (triggers.length === 0) {
    issues.push({ level: "error", code: "no_trigger", message: "The workflow has no trigger to start it." });
  } else if (triggers.length > 1) {
    issues.push({ level: "error", code: "multiple_triggers", message: "A workflow can only have one trigger." });
  }

  // Per-step config validation against each type's own JSON Schema (same ajv the backend
  // re-validates with), plus a few structural, per-type graph rules.
  for (const step of steps) {
    const def = stepClient[step.type];
    if (!def) {
      issues.push({ level: "error", stepId: step.id, code: "unknown_type", message: `Unknown step type "${step.type}".` });
      continue;
    }

    const validate = ajv.compile(def.configSchema);
    if (!validate(step.config)) {
      const detail = (validate.errors ?? [])
        .map((e) => (e.params as { missingProperty?: string })?.missingProperty ?? e.instancePath.replace(/^\//, "") ?? "value")
        .filter(Boolean)
        .join(", ");
      issues.push({
        level: "error",
        stepId: step.id,
        code: "invalid_config",
        message: `${def.label} is missing or has invalid: ${detail || "required fields"}.`,
      });
    }

    // Dangling edges — a next[] pointing at a step that no longer exists.
    for (const n of step.next) {
      if (!ids.has(n.targetId)) {
        issues.push({ level: "error", stepId: step.id, code: "dangling_edge", message: `${def.label} points at a step that no longer exists.` });
      }
    }

    const outputs = def.ports.outputs;

    // A Goal (or any zero-output terminal) must not have an outgoing edge.
    if (outputs.length === 0 && step.next.length > 0) {
      issues.push({ level: "error", stepId: step.id, code: "goal_not_terminal", message: `${def.label} is a terminal step but has an outgoing connection.` });
    }

    // A Go to action with no target set does nothing (it exists only to jump).
    if (step.type === "go_to_action" && step.next.length === 0) {
      issues.push({ level: "error", stepId: step.id, code: "goto_no_target", message: "Go to action has no target step to jump to." });
    }

    // A Branches port left unwired means that path silently goes nowhere — likely a mistake
    // in a split (a single linear step ending the run is normal, so only flag multi-output).
    if (outputs.length > 1) {
      for (const port of outputs) {
        if (!step.next.some((n) => n.portId === port.id)) {
          issues.push({
            level: "warning",
            stepId: step.id,
            code: "unwired_branch",
            message: `${def.label}: the "${port.label ?? port.id}" path isn't connected to anything.`,
          });
        }
      }
    }
  }

  // Reachability — every step should be reachable from the trigger.
  if (triggers.length === 1) {
    const reachable = reachableFrom(steps, triggers[0].id);
    for (const step of steps) {
      if (!reachable.has(step.id)) {
        issues.push({ level: "warning", stepId: step.id, code: "unreachable", message: `${stepClient[step.type]?.label ?? step.type} can't be reached from the trigger.` });
      }
    }
  }

  // Loop safety (the design doc's ask): a go_to_action forms a cycle; if nothing in that
  // cycle is a Branches step, the run can never take a different path out of it — only the
  // platform's hard iteration cap would stop it. Flag it so the author adds an exit.
  for (const goto of steps.filter((s) => s.type === "go_to_action")) {
    const target = goto.next[0]?.targetId;
    if (!target || !ids.has(target)) continue;
    const forward = reachableFrom(steps, target);
    if (!forward.has(goto.id)) continue; // no cycle back to this goto
    const back = reaching(steps, goto.id);
    const cycleNodes = [...forward].filter((id) => back.has(id));
    const hasBranch = cycleNodes.some((id) => steps.find((s) => s.id === id)?.type === "branches");
    if (!hasBranch) {
      issues.push({
        level: "warning",
        stepId: goto.id,
        code: "unbreakable_loop",
        message: "This loop has no Branches step to exit through — only the hard iteration cap will stop it.",
      });
    }
  }

  return issues;
}

export function countByLevel(issues: ValidationIssue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === "error").length,
    warnings: issues.filter((i) => i.level === "warning").length,
  };
}
