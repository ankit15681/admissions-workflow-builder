import type { Database } from "better-sqlite3";

export interface ApplicationRow {
  id: string;
  applicant_name: string;
  guardian_name: string;
  programme: string;
  status: string;
  fee_status: string;
  fee_amount: string;
  assigned_reviewer: string | null;
  created_at: string;
  status_changed_at: string;
}

export function getApplication(db: Database, id: string): ApplicationRow | undefined {
  return db.prepare(`SELECT * FROM applications WHERE id = ?`).get(id) as ApplicationRow | undefined;
}

export function listApplications(db: Database): ApplicationRow[] {
  return db.prepare(`SELECT * FROM applications ORDER BY created_at DESC`).all() as ApplicationRow[];
}

export function setApplicationField(
  db: Database,
  id: string,
  field: "status" | "fee_status",
  value: string,
  now: string
): void {
  if (field === "status") {
    db.prepare(`UPDATE applications SET status = ?, status_changed_at = ? WHERE id = ?`).run(value, now, id);
  } else {
    db.prepare(`UPDATE applications SET fee_status = ? WHERE id = ?`).run(value, id);
  }
}

export function createApplication(
  db: Database,
  row: Omit<ApplicationRow, "created_at" | "status_changed_at">,
  now: string
): void {
  db.prepare(
    `INSERT INTO applications (id, applicant_name, guardian_name, programme, status, fee_status, fee_amount, assigned_reviewer, created_at, status_changed_at)
     VALUES (@id, @applicant_name, @guardian_name, @programme, @status, @fee_status, @fee_amount, @assigned_reviewer, @created_at, @status_changed_at)`
  ).run({ ...row, created_at: now, status_changed_at: now });
}
