import type { Database } from "better-sqlite3";
import { resumeDueRuns } from "./executor";

// A durable-enough scheduler for this exercise: an in-process interval that polls for due
// WorkflowRuns gives the same durability property as Redis/BullMQ without the infrastructure. Durability comes from `due_at`
// being a column in SQLite, not from this interval: a server restart just means the next
// tick picks up any run whose due_at has already passed (NFR-1), it doesn't lose the wait.
export function startScheduler(db: Database, intervalMs = 1000): NodeJS.Timeout {
  return setInterval(() => {
    resumeDueRuns(db).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[scheduler] tick failed:", err);
    });
  }, intervalMs);
}
