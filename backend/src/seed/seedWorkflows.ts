import type { Database } from "better-sqlite3";
import { createApplication } from "../db/applications";
import { createWorkflow, publishWorkflow, type Step } from "../db/workflows";
import { dispatchApplicationEvent } from "../engine/triggerListener";

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Workflow 1 — Admission Fee Payment Reminder (design doc B.1), fully wired and
// published. Delays are seconds instead of days so it's demoable live, per
// CLAUDE_CODE_PROMPT.md step 5 ("Use a short delay ... so it's demoable live").
// ---------------------------------------------------------------------------
function buildWorkflow1Steps(): Step[] {
  const ids = {
    trigger: "w1-1-trigger",
    setPending: "w1-2-set-pending",
    invoice: "w1-3-invoice",
    delay1: "w1-4-delay",
    feePaidBranch: "w1-5-branch",
    setPaid: "w1-6-set-paid",
    goalPaid: "w1-7-goal-paid",
    reminderCountBranch: "w1-8-branch",
    reminderEmail: "w1-9-reminder",
    delay2: "w1-10-delay",
    loopBack: "w1-11-goto",
    setOverdue: "w1-12-set-overdue",
    notifyStaff: "w1-13-notify-staff",
    goalEscalated: "w1-14-goal-escalated",
  };

  const steps: Step[] = [
    {
      id: ids.trigger,
      type: "trigger",
      config: { event: "status_changed", targetStatus: "Offer Accepted" },
      next: [{ portId: "next", targetId: ids.setPending }],
    },
    {
      id: ids.setPending,
      type: "set_status",
      config: { field: "status", value: "Fee Pending" },
      next: [{ portId: "next", targetId: ids.invoice }],
    },
    {
      id: ids.invoice,
      type: "communicate",
      config: {
        recipient: "both",
        subject: "Your admission fee is due — {{applicant_name}}",
        message:
          "Hi {{guardian_name}},\n\nCongratulations again on {{applicant_name}}'s offer for {{programme}}! " +
          "The admission fee of {{fee_amount}} is now due. Pay via {{portal_link}}.",
      },
      next: [{ portId: "next", targetId: ids.delay1 }],
    },
    {
      id: ids.delay1,
      type: "delay",
      config: { amount: 8, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.feePaidBranch }],
    },
    {
      id: ids.feePaidBranch,
      type: "branches",
      config: { conditionType: "status_equals", conditionConfig: { field: "fee_status", value: "paid" } },
      next: [
        { portId: "yes", targetId: ids.setPaid },
        { portId: "no", targetId: ids.reminderCountBranch },
      ],
    },
    {
      id: ids.setPaid,
      type: "set_status",
      config: { field: "status", value: "Fee Paid" },
      next: [{ portId: "next", targetId: ids.goalPaid }],
    },
    {
      id: ids.goalPaid,
      type: "goal",
      config: { label: "Fee collected" },
      next: [],
    },
    {
      id: ids.reminderCountBranch,
      type: "branches",
      config: {
        conditionType: "run_counter",
        conditionConfig: { counterStepId: ids.reminderEmail, comparator: "less_than", limit: 3 },
      },
      next: [
        { portId: "yes", targetId: ids.reminderEmail },
        { portId: "no", targetId: ids.setOverdue },
      ],
    },
    {
      id: ids.reminderEmail,
      type: "communicate",
      config: {
        recipient: "both",
        subject: "Reminder: admission fee still due — {{applicant_name}}",
        message: "Hi {{guardian_name}}, this is a reminder that {{fee_amount}} is still due. Pay via {{portal_link}}.",
      },
      next: [{ portId: "next", targetId: ids.delay2 }],
    },
    {
      id: ids.delay2,
      type: "delay",
      config: { amount: 8, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.loopBack }],
    },
    {
      id: ids.loopBack,
      type: "go_to_action",
      config: { maxIterations: 5 },
      next: [{ portId: "next", targetId: ids.feePaidBranch }],
    },
    {
      id: ids.setOverdue,
      type: "set_status",
      config: { field: "status", value: "Fee Overdue" },
      next: [{ portId: "next", targetId: ids.notifyStaff }],
    },
    {
      id: ids.notifyStaff,
      type: "communicate",
      config: {
        recipient: "staff",
        subject: "Escalation: fee overdue for {{applicant_name}}",
        message: "{{applicant_name}} ({{application_id}}) has missed 3 fee reminders. Please follow up manually.",
      },
      next: [{ portId: "next", targetId: ids.goalEscalated }],
    },
    {
      id: ids.goalEscalated,
      type: "goal",
      config: { label: "Escalated for manual follow-up" },
      next: [],
    },
  ];

  return steps;
}

// ---------------------------------------------------------------------------
// Workflow 3 — Application Review & Staff Assignment (design doc B.3), fully
// wired and published, to prove Assign to Staff / Create Task + the task_status
// condition actually work end-to-end (CLAUDE_CODE_PROMPT.md step 6). One addition
// not spelled out step-by-step in the doc's table: a second Goal step after the
// escalated-but-completed path (step 11), since every path through the graph
// needs a labelled terminal step — see README "Deviations".
// ---------------------------------------------------------------------------
function buildWorkflow3Steps(): Step[] {
  const ids = {
    trigger: "w3-1-trigger",
    setUnderReview: "w3-2-set-review",
    assignReviewer: "w3-3-assign",
    delay1: "w3-4-delay",
    slaBranch: "w3-5-branch",
    setReviewedOnTime: "w3-6-set-reviewed",
    goalOnTime: "w3-7-goal-on-time",
    escalate: "w3-8-assign-escalate",
    delay2: "w3-9-delay",
    secondBranch: "w3-10-branch",
    setReviewedLate: "w3-11-set-reviewed",
    goalAfterEscalation: "w3-13-goal-late",
    loopBack: "w3-12-goto",
  };

  const steps: Step[] = [
    {
      id: ids.trigger,
      type: "trigger",
      config: { event: "form_submitted" },
      next: [{ portId: "next", targetId: ids.setUnderReview }],
    },
    {
      id: ids.setUnderReview,
      type: "set_status",
      config: { field: "status", value: "Under Review" },
      next: [{ portId: "next", targetId: ids.assignReviewer }],
    },
    {
      id: ids.assignReviewer,
      type: "assign_task",
      config: { assignee: "Priya Shah (Reviewer)", title: "Review application", dueInDays: 5 },
      next: [{ portId: "next", targetId: ids.delay1 }],
    },
    {
      id: ids.delay1,
      type: "delay",
      config: { amount: 10, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.slaBranch }],
    },
    {
      id: ids.slaBranch,
      type: "branches",
      config: { conditionType: "task_status", conditionConfig: { taskStepId: ids.assignReviewer, status: "completed", withinSla: false } },
      next: [
        { portId: "yes", targetId: ids.setReviewedOnTime },
        { portId: "no", targetId: ids.escalate },
      ],
    },
    {
      id: ids.setReviewedOnTime,
      type: "set_status",
      config: { field: "status", value: "Reviewed" },
      next: [{ portId: "next", targetId: ids.goalOnTime }],
    },
    {
      id: ids.goalOnTime,
      type: "goal",
      config: { label: "Decision recorded on time" },
      next: [],
    },
    {
      id: ids.escalate,
      type: "assign_task",
      config: { assignee: "Admissions Head", title: "URGENT: overdue review", dueInDays: 2 },
      next: [{ portId: "next", targetId: ids.delay2 }],
    },
    {
      id: ids.delay2,
      type: "delay",
      config: { amount: 6, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.secondBranch }],
    },
    {
      id: ids.secondBranch,
      type: "branches",
      config: { conditionType: "task_status", conditionConfig: { taskStepId: ids.escalate, status: "completed", withinSla: false } },
      next: [
        { portId: "yes", targetId: ids.setReviewedLate },
        { portId: "no", targetId: ids.loopBack },
      ],
    },
    {
      id: ids.setReviewedLate,
      type: "set_status",
      config: { field: "status", value: "Reviewed" },
      next: [{ portId: "next", targetId: ids.goalAfterEscalation }],
    },
    {
      id: ids.goalAfterEscalation,
      type: "goal",
      config: { label: "Decision recorded after escalation" },
      next: [],
    },
    {
      id: ids.loopBack,
      type: "go_to_action",
      config: { maxIterations: 1 },
      next: [{ portId: "next", targetId: ids.escalate }],
    },
  ];

  return steps;
}

// ---------------------------------------------------------------------------
// Workflow 2 — Post-Offer → Enrolment (design doc B.2). Seeded as a draft only
// (arranged per the doc's table, structurally valid) to show Request Document
// in the builder — not published/executed end-to-end in this pass. See
// CLAUDE_CODE_PROMPT.md's ordering: "Only after 1–6 work: polish, add the
// remaining workflows." README documents this explicitly.
// ---------------------------------------------------------------------------
function buildWorkflow2Steps(): Step[] {
  const ids = {
    trigger: "w2-1-trigger",
    offerEmail: "w2-2-offer",
    delay1: "w2-3-delay",
    acceptedBranch: "w2-4-branch",
    reminderCountBranch: "w2-5-branch",
    reminderEmail: "w2-6-reminder",
    delay2: "w2-7-delay",
    loopBack1: "w2-8-goto",
    setExpired: "w2-9-set-expired",
    goalLapsed: "w2-10-goal-lapsed",
    setAccepted: "w2-11-set-accepted",
    requestDocs: "w2-12-request-docs",
    delay3: "w2-13-delay",
    docsBranch: "w2-14-branch",
    docsReminder: "w2-15-reminder",
    delay4: "w2-16-delay",
    loopBack2: "w2-17-goto",
    setEnrolled: "w2-18-set-enrolled",
    goalEnrolled: "w2-19-goal-enrolled",
  };

  return [
    { id: ids.trigger, type: "trigger", config: { event: "status_changed", targetStatus: "Offer Sent" }, next: [{ portId: "next", targetId: ids.offerEmail }] },
    { id: ids.offerEmail, type: "communicate", config: { recipient: "both", subject: "Your offer from {{programme}}", message: "Hi {{guardian_name}}, {{applicant_name}}'s offer is ready — accept via {{portal_link}}." }, next: [{ portId: "next", targetId: ids.delay1 }] },
    { id: ids.delay1, type: "delay", config: { amount: 5, unit: "days" }, next: [{ portId: "next", targetId: ids.acceptedBranch }] },
    { id: ids.acceptedBranch, type: "branches", config: { conditionType: "status_equals", conditionConfig: { field: "status", value: "Accepted" } }, next: [{ portId: "yes", targetId: ids.setAccepted }, { portId: "no", targetId: ids.reminderCountBranch }] },
    { id: ids.reminderCountBranch, type: "branches", config: { conditionType: "run_counter", conditionConfig: { counterStepId: ids.reminderEmail, comparator: "less_than", limit: 2 } }, next: [{ portId: "yes", targetId: ids.reminderEmail }, { portId: "no", targetId: ids.setExpired }] },
    { id: ids.reminderEmail, type: "communicate", config: { recipient: "both", subject: "Reminder: accept your offer", message: "Hi {{guardian_name}}, please accept {{applicant_name}}'s offer via {{portal_link}}." }, next: [{ portId: "next", targetId: ids.delay2 }] },
    { id: ids.delay2, type: "delay", config: { amount: 3, unit: "days" }, next: [{ portId: "next", targetId: ids.loopBack1 }] },
    { id: ids.loopBack1, type: "go_to_action", config: { maxIterations: 5 }, next: [{ portId: "next", targetId: ids.acceptedBranch }] },
    { id: ids.setExpired, type: "set_status", config: { field: "status", value: "Offer Expired" }, next: [{ portId: "next", targetId: ids.goalLapsed }] },
    { id: ids.goalLapsed, type: "goal", config: { label: "Offer lapsed" }, next: [] },
    { id: ids.setAccepted, type: "set_status", config: { field: "status", value: "Accepted" }, next: [{ portId: "next", targetId: ids.requestDocs }] },
    { id: ids.requestDocs, type: "request_document", config: { recipient: "guardian", requestedFiles: ["ID proof", "Previous school records", "Immunisation record"], dueInDays: 5 }, next: [{ portId: "next", targetId: ids.delay3 }] },
    { id: ids.delay3, type: "delay", config: { amount: 5, unit: "days" }, next: [{ portId: "next", targetId: ids.docsBranch }] },
    { id: ids.docsBranch, type: "branches", config: { conditionType: "document_status", conditionConfig: { requestStepId: ids.requestDocs, status: "submitted" } }, next: [{ portId: "yes", targetId: ids.setEnrolled }, { portId: "no", targetId: ids.docsReminder }] },
    { id: ids.docsReminder, type: "communicate", config: { recipient: "guardian", subject: "Please finish enrolment", message: "Hi {{guardian_name}}, we're still missing enrolment documents for {{applicant_name}}." }, next: [{ portId: "next", targetId: ids.delay4 }] },
    { id: ids.delay4, type: "delay", config: { amount: 3, unit: "days" }, next: [{ portId: "next", targetId: ids.loopBack2 }] },
    { id: ids.loopBack2, type: "go_to_action", config: { maxIterations: 5 }, next: [{ portId: "next", targetId: ids.docsBranch }] },
    { id: ids.setEnrolled, type: "set_status", config: { field: "status", value: "Enrolled" }, next: [{ portId: "next", targetId: ids.goalEnrolled }] },
    { id: ids.goalEnrolled, type: "goal", config: { label: "Enrolment complete" }, next: [] },
  ];
}

// ---------------------------------------------------------------------------
// Workflow 4 — Scholarship Application Review (not one of the design doc's Part B
// examples — added on request). Fully wired and published, exercising all nine
// step types in one flow: Request Document + a reminder loop to chase missing
// financial-aid paperwork, then Assign to Staff / Create Task + escalation to get
// a committee decision, mirroring the proven shapes from Workflow 2 (docs) and
// Workflow 3 (task SLA + escalation) rather than inventing a third pattern.
// Scoped to the Scholarship form specifically via the Trigger's `form` filter
// (backend/src/stepTypes/trigger.ts) — an application-form or enquiry-form
// submission does not start this flow.
// ---------------------------------------------------------------------------
function buildWorkflow4Steps(): Step[] {
  const ids = {
    trigger: "w4-1-trigger",
    setUnderReview: "w4-2-set-review",
    confirmReceipt: "w4-3-confirm",
    requestDocs: "w4-4-request-docs",
    delay1: "w4-5-delay",
    docsBranch: "w4-6-branch",
    reminderCountBranch: "w4-7-branch",
    docsReminder: "w4-8-reminder",
    delay2: "w4-9-delay",
    loopBack1: "w4-10-goto",
    setIncomplete: "w4-11-set-incomplete",
    goalIncomplete: "w4-12-goal-incomplete",
    assignCommittee: "w4-13-assign",
    delay3: "w4-14-delay",
    slaBranch: "w4-15-branch",
    setDecisionOnTime: "w4-16-set-decision",
    goalOnTime: "w4-17-goal-on-time",
    escalate: "w4-18-assign-escalate",
    delay4: "w4-19-delay",
    secondBranch: "w4-20-branch",
    setDecisionLate: "w4-21-set-decision",
    goalAfterEscalation: "w4-22-goal-late",
    loopBack2: "w4-23-goto",
  };

  const steps: Step[] = [
    {
      id: ids.trigger,
      type: "trigger",
      config: { event: "form_submitted", form: "scholarship" },
      next: [{ portId: "next", targetId: ids.setUnderReview }],
    },
    {
      id: ids.setUnderReview,
      type: "set_status",
      config: { field: "status", value: "Scholarship Under Review" },
      next: [{ portId: "next", targetId: ids.confirmReceipt }],
    },
    {
      id: ids.confirmReceipt,
      type: "communicate",
      config: {
        recipient: "both",
        subject: "We've received {{applicant_name}}'s scholarship application",
        message:
          "Hi {{guardian_name}},\n\nThanks for submitting {{applicant_name}}'s scholarship application for {{programme}}. " +
          "We still need a couple of documents before the committee can review it — details to follow shortly.",
      },
      next: [{ portId: "next", targetId: ids.requestDocs }],
    },
    {
      id: ids.requestDocs,
      type: "request_document",
      config: { recipient: "guardian", requestedFiles: ["Income proof", "Recommendation letter"], dueInDays: 5 },
      next: [{ portId: "next", targetId: ids.delay1 }],
    },
    {
      id: ids.delay1,
      type: "delay",
      config: { amount: 8, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.docsBranch }],
    },
    {
      id: ids.docsBranch,
      type: "branches",
      config: { conditionType: "document_status", conditionConfig: { requestStepId: ids.requestDocs, status: "submitted" } },
      next: [
        { portId: "yes", targetId: ids.assignCommittee },
        { portId: "no", targetId: ids.reminderCountBranch },
      ],
    },
    {
      id: ids.reminderCountBranch,
      type: "branches",
      config: {
        conditionType: "run_counter",
        conditionConfig: { counterStepId: ids.docsReminder, comparator: "less_than", limit: 2 },
      },
      next: [
        { portId: "yes", targetId: ids.docsReminder },
        { portId: "no", targetId: ids.setIncomplete },
      ],
    },
    {
      id: ids.docsReminder,
      type: "communicate",
      config: {
        recipient: "guardian",
        subject: "Still missing documents for {{applicant_name}}'s scholarship application",
        message: "Hi {{guardian_name}}, we're still waiting on income proof and a recommendation letter to review {{applicant_name}}'s scholarship application.",
      },
      next: [{ portId: "next", targetId: ids.delay2 }],
    },
    {
      id: ids.delay2,
      type: "delay",
      config: { amount: 8, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.loopBack1 }],
    },
    {
      id: ids.loopBack1,
      type: "go_to_action",
      config: { maxIterations: 5 },
      next: [{ portId: "next", targetId: ids.docsBranch }],
    },
    {
      id: ids.setIncomplete,
      type: "set_status",
      config: { field: "status", value: "Scholarship Application Incomplete" },
      next: [{ portId: "next", targetId: ids.goalIncomplete }],
    },
    {
      id: ids.goalIncomplete,
      type: "goal",
      config: { label: "Closed — required documents never submitted" },
      next: [],
    },
    {
      id: ids.assignCommittee,
      type: "assign_task",
      config: { assignee: "Scholarship Committee", title: "Review scholarship application", dueInDays: 5 },
      next: [{ portId: "next", targetId: ids.delay3 }],
    },
    {
      id: ids.delay3,
      type: "delay",
      config: { amount: 10, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.slaBranch }],
    },
    {
      id: ids.slaBranch,
      type: "branches",
      config: { conditionType: "task_status", conditionConfig: { taskStepId: ids.assignCommittee, status: "completed", withinSla: false } },
      next: [
        { portId: "yes", targetId: ids.setDecisionOnTime },
        { portId: "no", targetId: ids.escalate },
      ],
    },
    {
      id: ids.setDecisionOnTime,
      type: "set_status",
      config: { field: "status", value: "Scholarship Decision Ready" },
      next: [{ portId: "next", targetId: ids.goalOnTime }],
    },
    {
      id: ids.goalOnTime,
      type: "goal",
      config: { label: "Reviewed on time" },
      next: [],
    },
    {
      id: ids.escalate,
      type: "assign_task",
      config: { assignee: "Financial Aid Director", title: "URGENT: overdue scholarship review", dueInDays: 2 },
      next: [{ portId: "next", targetId: ids.delay4 }],
    },
    {
      id: ids.delay4,
      type: "delay",
      config: { amount: 6, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.secondBranch }],
    },
    {
      id: ids.secondBranch,
      type: "branches",
      config: { conditionType: "task_status", conditionConfig: { taskStepId: ids.escalate, status: "completed", withinSla: false } },
      next: [
        { portId: "yes", targetId: ids.setDecisionLate },
        { portId: "no", targetId: ids.loopBack2 },
      ],
    },
    {
      id: ids.setDecisionLate,
      type: "set_status",
      config: { field: "status", value: "Scholarship Decision Ready" },
      next: [{ portId: "next", targetId: ids.goalAfterEscalation }],
    },
    {
      id: ids.goalAfterEscalation,
      type: "goal",
      config: { label: "Reviewed after escalation" },
      next: [],
    },
    {
      id: ids.loopBack2,
      type: "go_to_action",
      config: { maxIterations: 1 },
      next: [{ portId: "next", targetId: ids.escalate }],
    },
  ];

  return steps;
}

// ---------------------------------------------------------------------------
// Workflow 5 — Applicant Interview Scheduling. Added to showcase the new
// Schedule Interview step type (category "scheduling") and the interview_status
// branch condition end-to-end. Fires when an application is marked "Reviewed":
// it books an interview, then chases/escalates if the interview isn't completed
// in time — mirroring the proven reminder-loop + escalation shape of the other
// workflows rather than inventing a new one. Delays are seconds so it demos live.
// ---------------------------------------------------------------------------
function buildWorkflow5Steps(): Step[] {
  const ids = {
    trigger: "w5-1-trigger",
    setScheduled: "w5-2-set-scheduled",
    invite: "w5-3-invite",
    schedule: "w5-4-schedule",
    delay1: "w5-5-delay",
    doneBranch: "w5-6-branch",
    setDone: "w5-7-set-done",
    goalDone: "w5-8-goal-done",
    reminderCountBranch: "w5-9-branch",
    reminder: "w5-10-reminder",
    delay2: "w5-11-delay",
    loopBack: "w5-12-goto",
    setNoShow: "w5-13-set-noshow",
    notifyStaff: "w5-14-notify-staff",
    goalNoShow: "w5-15-goal-noshow",
  };

  const steps: Step[] = [
    {
      id: ids.trigger,
      type: "trigger",
      config: { event: "status_changed", targetStatus: "Reviewed" },
      next: [{ portId: "next", targetId: ids.setScheduled }],
    },
    {
      id: ids.setScheduled,
      type: "set_status",
      config: { field: "status", value: "Interview Scheduled" },
      next: [{ portId: "next", targetId: ids.invite }],
    },
    {
      id: ids.invite,
      type: "communicate",
      config: {
        recipient: "both",
        subject: "Interview invitation — {{applicant_name}}",
        message:
          "Hi {{guardian_name}},\n\nWe'd like to invite {{applicant_name}} for an interview as part of the {{programme}} " +
          "admissions process. Details and a link to confirm your slot are on the portal: {{portal_link}}.",
      },
      next: [{ portId: "next", targetId: ids.schedule }],
    },
    {
      id: ids.schedule,
      type: "schedule_interview",
      config: { mode: "video", room: "", durationMins: 30 },
      next: [{ portId: "next", targetId: ids.delay1 }],
    },
    {
      id: ids.delay1,
      type: "delay",
      config: { amount: 10, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.doneBranch }],
    },
    {
      id: ids.doneBranch,
      type: "branches",
      config: { conditionType: "interview_status", conditionConfig: { interviewStepId: ids.schedule, status: "completed" } },
      next: [
        { portId: "yes", targetId: ids.setDone },
        { portId: "no", targetId: ids.reminderCountBranch },
      ],
    },
    {
      id: ids.setDone,
      type: "set_status",
      config: { field: "status", value: "Interview Complete" },
      next: [{ portId: "next", targetId: ids.goalDone }],
    },
    {
      id: ids.goalDone,
      type: "goal",
      config: { label: "Interview completed" },
      next: [],
    },
    {
      id: ids.reminderCountBranch,
      type: "branches",
      config: {
        conditionType: "run_counter",
        conditionConfig: { counterStepId: ids.reminder, comparator: "less_than", limit: 2 },
      },
      next: [
        { portId: "yes", targetId: ids.reminder },
        { portId: "no", targetId: ids.setNoShow },
      ],
    },
    {
      id: ids.reminder,
      type: "communicate",
      config: {
        recipient: "both",
        subject: "Reminder: {{applicant_name}}'s interview is still open",
        message: "Hi {{guardian_name}}, please confirm and attend {{applicant_name}}'s interview via {{portal_link}}.",
      },
      next: [{ portId: "next", targetId: ids.delay2 }],
    },
    {
      id: ids.delay2,
      type: "delay",
      config: { amount: 8, unit: "seconds" },
      next: [{ portId: "next", targetId: ids.loopBack }],
    },
    {
      id: ids.loopBack,
      type: "go_to_action",
      config: { maxIterations: 5 },
      next: [{ portId: "next", targetId: ids.doneBranch }],
    },
    {
      id: ids.setNoShow,
      type: "set_status",
      config: { field: "status", value: "Interview No-Show" },
      next: [{ portId: "next", targetId: ids.notifyStaff }],
    },
    {
      id: ids.notifyStaff,
      type: "communicate",
      config: {
        recipient: "staff",
        subject: "Escalation: interview not attended — {{applicant_name}}",
        message: "{{applicant_name}} ({{application_id}}) has not completed their interview after 2 reminders. Please follow up.",
      },
      next: [{ portId: "next", targetId: ids.goalNoShow }],
    },
    {
      id: ids.goalNoShow,
      type: "goal",
      config: { label: "Escalated — interview not attended" },
      next: [],
    },
  ];

  return steps;
}

export async function seedIfEmpty(db: Database): Promise<void> {
  const count = (db.prepare(`SELECT COUNT(*) as n FROM workflows`).get() as { n: number }).n;
  if (count > 0) return;

  const now = nowIso();

  // Every insert below is synchronous (better-sqlite3), so it can — and should — run as
  // one atomic transaction: without this, a crash partway through (an unrelated bug, an
  // out-of-disk-space write, the process being killed) could commit some applications but
  // not the workflows that follow them, leaving count(workflows) === 0 on the next
  // restart — this function's only "have I already seeded?" guard — while
  // `applications` already has rows. The retry then re-runs every createApplication call
  // from scratch and hits "UNIQUE constraint failed: applications.id" on the very first
  // one that survived the previous crash, which is a genuinely confusing error to land on
  // for something that's supposed to be a from-scratch dev seed. Wrapping it means the
  // whole batch commits together or not at all, so the guard above can never lie.
  const seedCore = db.transaction(() => {
    createApplication(
      db,
      {
        id: "app-fee-demo",
        applicant_name: "Aiden Park",
        guardian_name: "Grace Park",
        programme: "Grade 9",
        status: "Applied",
        fee_status: "pending",
        fee_amount: "$500",
        assigned_reviewer: null,
      },
      now
    );

    createApplication(
      db,
      {
        id: "app-review-demo",
        applicant_name: "Maya Torres",
        guardian_name: "Elena Torres",
        programme: "Grade 6",
        status: "New",
        fee_status: "not_applicable",
        fee_amount: "",
        assigned_reviewer: null,
      },
      now
    );

    createApplication(
      db,
      {
        id: "app-enrolment-demo",
        applicant_name: "Noah Reyes",
        guardian_name: "Carla Reyes",
        programme: "Grade 3",
        status: "New",
        fee_status: "not_applicable",
        fee_amount: "",
        assigned_reviewer: null,
      },
      now
    );

    const wf1 = createWorkflow(
      db,
      { id: "wf-fee-reminder", name: "Admission Fee Payment Reminder", description: "Reminds an accepted applicant's family to pay the admission fee, escalating after 3 reminders.", steps: buildWorkflow1Steps() },
      now
    );
    publishWorkflow(db, wf1.id, now);

    const wf3 = createWorkflow(
      db,
      { id: "wf-review-assignment", name: "Application Review & Staff Assignment", description: "Assigns every new application to a reviewer via a tracked task, escalating once if it's late.", steps: buildWorkflow3Steps() },
      now
    );
    publishWorkflow(db, wf3.id, now);

    const wf2 = createWorkflow(
      db,
      { id: "wf-enrolment", name: "Post-Offer → Enrolment", description: "Carries an applicant from offer through acceptance and document collection to enrolment.", steps: buildWorkflow2Steps() },
      now
    );
    void wf2; // left as a draft on purpose — see comment above buildWorkflow2Steps

    createApplication(
      db,
      {
        id: "app-scholarship-demo",
        applicant_name: "Zoe Bennett",
        guardian_name: "Marcus Bennett",
        programme: "Grade 11",
        status: "New",
        fee_status: "not_applicable",
        fee_amount: "",
        assigned_reviewer: null,
      },
      now
    );

    const wf4 = createWorkflow(
      db,
      {
        id: "wf-scholarship-review",
        name: "Scholarship Application Review",
        description: "Chases missing financial-aid documents, then gets a committee decision on a scholarship application, escalating once if the review runs late.",
        steps: buildWorkflow4Steps(),
      },
      now
    );
    publishWorkflow(db, wf4.id, now);

    createApplication(
      db,
      {
        id: "app-interview-demo",
        applicant_name: "Liam Walsh",
        guardian_name: "Sinead Walsh",
        programme: "Grade 10",
        status: "New",
        fee_status: "not_applicable",
        fee_amount: "",
        assigned_reviewer: null,
      },
      now
    );

    const wf5 = createWorkflow(
      db,
      {
        id: "wf-interview-scheduling",
        name: "Applicant Interview Scheduling",
        description: "Books an interview once an application is reviewed, then reminds and escalates if the interview isn't completed in time.",
        steps: buildWorkflow5Steps(),
      },
      now
    );
    publishWorkflow(db, wf5.id, now);
  });
  seedCore();

  // Kicking off runs is deliberately outside the transaction above: dispatchApplicationEvent
  // (and the executor beneath it) awaits a Delay's scheduler, which better-sqlite3's
  // synchronous transaction() wrapper can't contain. That's fine — every application and
  // workflow row is already committed by this point, so even if a run's dispatch throws
  // partway through, a restart's count(workflows) > 0 guard correctly sees seeding as done
  // and skips straight past this whole function instead of re-attempting any insert.

  // Kick off one live run of each published demo workflow immediately, so the
  // run-history view has something to show as soon as the server starts.
  await dispatchApplicationEvent(db, { type: "status_changed", applicationId: "app-fee-demo", newStatus: "Offer Accepted" });
  await dispatchApplicationEvent(db, { type: "form_submitted", applicationId: "app-review-demo" });
  // Also matches wf-review-assignment's trigger (form_submitted, no form filter — it
  // means "any" submission), so this seeds a second, independent run there too, on top
  // of the Scholarship Application Review run — a real submission of any form is
  // exactly the situation that trigger is meant to catch.
  await dispatchApplicationEvent(db, { type: "form_submitted", applicationId: "app-scholarship-demo", form: "scholarship" });
  // Marks the interview-demo application "Reviewed", which is exactly the status_changed
  // event that starts the Applicant Interview Scheduling workflow (wf-interview-scheduling).
  await dispatchApplicationEvent(db, { type: "status_changed", applicationId: "app-interview-demo", newStatus: "Reviewed" });
}
