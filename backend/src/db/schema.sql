-- Admissions Workflow Automation — SQLite schema.
-- Mirrors the domain model in the design doc (C.3), with one documented simplification:
-- there is no separate `trigger_config` column on `workflows` — the Trigger step is always
-- steps[0] in `draft_steps`/`published_steps`, and its own `config` *is* the trigger config.
-- One source of truth instead of two copies that could drift. See README "Deviations".

CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  draft_revision INTEGER NOT NULL DEFAULT 0,
  draft_steps TEXT NOT NULL,       -- JSON: Step[]
  published_steps TEXT,            -- JSON: Step[] | null — the single published copy, no version history
  published_revision INTEGER,      -- draft_revision at the moment it was published, for display only
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  programme TEXT NOT NULL,
  status TEXT NOT NULL,
  fee_status TEXT NOT NULL DEFAULT 'not_applicable',
  fee_amount TEXT NOT NULL DEFAULT '',
  assigned_reviewer TEXT,
  created_at TEXT NOT NULL,
  status_changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL REFERENCES workflows(id),
  application_id TEXT NOT NULL REFERENCES applications(id),
  current_step_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'waiting', 'completed', 'escalated', 'error')) DEFAULT 'running',
  goal_label TEXT,
  steps_snapshot TEXT NOT NULL,    -- JSON: Step[] captured at trigger time (FR-11)
  due_at TEXT,                     -- set while status = 'waiting'; scheduler polls this
  started_at TEXT NOT NULL,
  ended_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_due ON workflow_runs (status, due_at);
CREATE INDEX IF NOT EXISTS idx_runs_workflow ON workflow_runs (workflow_id);

CREATE TABLE IF NOT EXISTS run_step_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  step_id TEXT NOT NULL,
  step_type TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  executed_at TEXT NOT NULL,
  result TEXT NOT NULL,            -- 'advance' | 'wait' | 'end' | 'error'
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_run ON run_step_history (run_id);

-- Idempotency guard (NFR-2): a given (run, step, attempt) can only have one history row
-- with result != 'error', so a retried resume can't double-fire a side effect.
CREATE UNIQUE INDEX IF NOT EXISTS uq_history_run_step_attempt ON run_step_history (run_id, step_id, attempt);

CREATE TABLE IF NOT EXISTS document_requests (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  step_id TEXT NOT NULL,
  requested_files TEXT NOT NULL,   -- JSON: string[]
  uploaded_files TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending', 'submitted')) DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  step_id TEXT NOT NULL,
  assignee TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'completed')) DEFAULT 'open',
  created_at TEXT NOT NULL
);

-- Side-effect record for the Schedule Interview step (mirrors document_requests/tasks):
-- the step writes a row when it runs, and the interview_status condition reads it back
-- so a Branch can route on whether the interview has happened yet.
CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id),
  step_id TEXT NOT NULL,
  application_id TEXT NOT NULL REFERENCES applications(id),
  mode TEXT NOT NULL CHECK (mode IN ('in_person', 'video')),
  room TEXT NOT NULL DEFAULT '',
  duration_mins INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'completed', 'no_show')) DEFAULT 'scheduled',
  scheduled_at TEXT NOT NULL,
  completed_at TEXT
);
