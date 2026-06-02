import type {
  DailyPlan,
  DailyProgress,
  FamilyAccount,
  ParentAccount,
  ParentFamilyAccount,
  ParentStudentLink,
  PlanSession,
  SavedStudyPlan,
  StudentAccount,
  StudyPlanProgress,
  StudyPlanRequest,
  StudyPlanResponse,
  StudyReminderSettings,
  StudySessionCompletion,
  WeeklyStudyDigest
} from "@/types";

export const DEMO_STUDENT_ID = "demo-student-alliyah";
export const DEMO_PARENT_ID = "demo-parent-adewale";
export const DEMO_LINK_ID = "demo-link-adewale-alliyah";
export const DEMO_PLAN_ID = "demo-plan-alliyah-001";
export const DEMO_STUDENT_NAME = "Alliyah Olaniyan";
export const DEMO_PARENT_NAME = "Mrs Adewale";

const DAY_MS = 24 * 60 * 60 * 1000;

function demoNow() {
  return new Date();
}

function dateOffset(days: number) {
  const date = demoNow();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoOffset(days: number, hour = 17) {
  const date = demoNow();
  date.setHours(hour, 15, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function session(
  kind: PlanSession["kind"],
  subject: string,
  topic: string,
  resourceType: string,
  minutes: number,
  breakAfterMinutes = 10
): PlanSession {
  return {
    kind,
    subject,
    topic,
    resource_type: resourceType,
    minutes,
    break_after_minutes: breakAfterMinutes
  };
}

function day(offset: number, sessions: PlanSession[]): DailyPlan {
  return {
    study_date: dateOffset(offset),
    total_minutes: sessions.reduce((total, item) => total + item.minutes, 0),
    sessions
  };
}

function sessionKey(studyDate: string, sessionIndex: number) {
  return `${studyDate}:${sessionIndex}`;
}

export function isDemoParam(value?: string | string[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true" || rawValue === "student" || rawValue === "parent";
}

export const demoStudyPlanRequest: StudyPlanRequest = {
  student_profile: {
    name: DEMO_STUDENT_NAME,
    class_level: "SS2",
    age: 15,
    parent_name: DEMO_PARENT_NAME,
    parent_contact: "08000000000"
  },
  exam_start_date: dateOffset(14),
  exam_end_date: dateOffset(18),
  available_daily_minutes: 150,
  minutes_per_page: 6,
  session_minutes: 40,
  break_minutes: 10,
  study_strength_note: "I understand faster in the morning and remember more when I write short recall notes.",
  subjects: [
    {
      name: "Mathematics",
      topics: [
        { name: "Algebra", pages: 25, priority: 5, resource_type: "Textbook" },
        { name: "Geometry", pages: 18, priority: 4, resource_type: "Class notes" },
        { name: "Word Problems", pages: 12, priority: 4, resource_type: "Past questions" }
      ]
    },
    {
      name: "English",
      topics: [
        { name: "Comprehension", pages: 15, priority: 3, resource_type: "Class notes" },
        { name: "Essay Writing", pages: 10, priority: 4, resource_type: "Notebook" }
      ]
    },
    {
      name: "Biology",
      topics: [
        { name: "Cell Structure", pages: 20, priority: 4, resource_type: "Textbook" },
        { name: "Nutrition", pages: 12, priority: 3, resource_type: "Online notes" }
      ]
    }
  ]
};

export function createDemoStudentAccount(): StudentAccount {
  return {
    id: DEMO_STUDENT_ID,
    login_id: "alliyah.olaniyan@example.com",
    name: DEMO_STUDENT_NAME,
    class_level: "SS2",
    age: 15,
    school_name: "StudyNova Demo School",
    auth_uid: "demo-auth-student",
    created_at: isoOffset(-16, 9)
  };
}

export function createDemoParentAccount(): ParentAccount {
  return {
    id: DEMO_PARENT_ID,
    name: DEMO_PARENT_NAME,
    contact: "08000000000",
    relationship: "Guardian",
    auth_uid: "demo-auth-parent",
    created_at: isoOffset(-15, 10)
  };
}

export function createDemoParentStudentLink(): ParentStudentLink {
  return {
    id: DEMO_LINK_ID,
    parent_id: DEMO_PARENT_ID,
    student_id: DEMO_STUDENT_ID,
    created_at: isoOffset(-15, 10)
  };
}

export function createDemoFamilyAccount(): FamilyAccount {
  return {
    student: createDemoStudentAccount(),
    parent: createDemoParentAccount(),
    link: createDemoParentStudentLink()
  };
}

export function createDemoParentFamilyAccount(): ParentFamilyAccount {
  return {
    parent: createDemoParentAccount(),
    students: [createDemoStudentAccount()],
    links: [createDemoParentStudentLink()]
  };
}

function createDemoSchedule(): DailyPlan[] {
  return [
    day(-2, [
      session("study", "Mathematics", "Algebra", "Textbook", 35),
      session("revision", "Biology", "Cell Structure", "Textbook", 35)
    ]),
    day(-1, [
      session("study", "Mathematics", "Geometry", "Class notes", 35),
      session("practice", "English", "Comprehension", "Past questions", 30),
      session("practice", "Mathematics", "Word Problems", "Past questions", 30)
    ]),
    day(0, [
      session("study", "English", "Essay Writing", "Notebook", 30),
      session("study", "Biology", "Nutrition", "Online notes", 30),
      session("revision", "Mathematics", "Algebra", "Class notes", 30)
    ]),
    day(1, [
      session("study", "Mathematics", "Geometry", "Textbook", 40),
      session("practice", "English", "Comprehension", "Past questions", 30)
    ]),
    day(2, [
      session("study", "Biology", "Cell Structure", "Textbook", 35),
      session("revision", "English", "Essay Writing", "Notebook", 30),
      session("practice", "Mathematics", "Algebra", "Past questions", 25)
    ]),
    day(3, [
      session("practice", "Mathematics", "Word Problems", "Past questions", 35),
      session("revision", "Biology", "Nutrition", "Class notes", 25)
    ]),
    day(4, [
      session("revision", "Mathematics", "Geometry", "Class notes", 30),
      session("practice", "English", "Essay Writing", "Past questions", 30)
    ])
  ];
}

export function createDemoStudyPlan(): StudyPlanResponse {
  const schedule = createDemoSchedule();
  const totalStudyMinutes = schedule.reduce((total, planDay) => total + planDay.total_minutes, 0);
  const daysUntilExam = 14;
  const averageDailyMinutes = Math.ceil(totalStudyMinutes / daysUntilExam);

  return {
    metadata: {
      student_name: DEMO_STUDENT_NAME,
      class_level: "SS2",
      exam_date: dateOffset(daysUntilExam),
      exam_start_date: dateOffset(daysUntilExam),
      exam_end_date: dateOffset(18),
      days_until_exam: daysUntilExam,
      total_study_minutes: totalStudyMinutes,
      average_daily_minutes: averageDailyMinutes,
      required_daily_minutes: averageDailyMinutes,
      available_daily_minutes: demoStudyPlanRequest.available_daily_minutes,
      daily_gap_minutes: demoStudyPlanRequest.available_daily_minutes - averageDailyMinutes,
      status: "on_track",
      recommendation:
        "Study about 38 minutes daily, protect the morning sessions, and use recall notes to prove each topic was understood.",
      resources_used: ["Textbook", "Class notes", "Past questions", "Notebook", "Online notes"],
      study_strength_note: demoStudyPlanRequest.study_strength_note
    },
    subject_distribution: [
      { subject: "Mathematics", estimated_minutes: 225, percentage: 43 },
      { subject: "Biology", estimated_minutes: 125, percentage: 24 },
      { subject: "English", estimated_minutes: 175, percentage: 33 }
    ],
    schedule
  };
}

export function createDemoSavedStudyPlan(): SavedStudyPlan {
  return {
    id: DEMO_PLAN_ID,
    student_id: DEMO_STUDENT_ID,
    student_name: DEMO_STUDENT_NAME,
    created_at: isoOffset(-1, 8),
    plan: createDemoStudyPlan(),
    setup_payload: demoStudyPlanRequest
  };
}

function createDemoCompletion(
  planId: string,
  planDay: DailyPlan,
  sessionIndex: number,
  completedAtOffset: number,
  note: string,
  confidence: number
): StudySessionCompletion {
  const planSession = planDay.sessions[sessionIndex];

  return {
    id: `demo-completion-${planDay.study_date}-${sessionIndex}`,
    plan_id: planId,
    session_key: sessionKey(planDay.study_date, sessionIndex),
    study_date: planDay.study_date,
    kind: planSession.kind,
    subject: planSession.subject,
    topic: planSession.topic,
    resource_type: planSession.resource_type,
    minutes_planned: planSession.minutes,
    minutes_completed: planSession.minutes,
    recall_note: note,
    confidence,
    completed_at: isoOffset(completedAtOffset, 18)
  };
}

export function createDemoProgress(plan: StudyPlanResponse = createDemoStudyPlan()): StudyPlanProgress {
  const completions = [
    createDemoCompletion(
      DEMO_PLAN_ID,
      plan.schedule[0],
      0,
      -2,
      "Algebra expressions became clearer after solving five examples without checking the textbook.",
      5
    ),
    createDemoCompletion(
      DEMO_PLAN_ID,
      plan.schedule[0],
      1,
      -2,
      "I remembered that cell organelles work together like a system, especially the nucleus and mitochondria.",
      4
    ),
    createDemoCompletion(
      DEMO_PLAN_ID,
      plan.schedule[1],
      0,
      -1,
      "Geometry angle rules are easier when I draw the diagram before calculating.",
      4
    ),
    createDemoCompletion(
      DEMO_PLAN_ID,
      plan.schedule[2],
      0,
      0,
      "Essay introductions should answer the question directly, then preview two strong points.",
      5
    )
  ];
  const completedSessionKeys = completions.map((item) => item.session_key);
  const completedKeySet = new Set(completedSessionKeys);
  const today = dateOffset(0);
  const plannedSessions = plan.schedule.reduce((total, planDay) => total + planDay.sessions.length, 0);
  const plannedMinutes = plan.schedule.reduce((total, planDay) => total + planDay.total_minutes, 0);
  const completedMinutes = completions.reduce((total, item) => total + item.minutes_completed, 0);

  const missedSessions = plan.schedule.flatMap((planDay) =>
    planDay.sessions
      .map((planSession, sessionIndex) => ({ planSession, sessionIndex }))
      .filter(({ sessionIndex }) => planDay.study_date < today && !completedKeySet.has(sessionKey(planDay.study_date, sessionIndex)))
      .map(({ planSession, sessionIndex }) => ({
        session_key: sessionKey(planDay.study_date, sessionIndex),
        study_date: planDay.study_date,
        kind: planSession.kind,
        subject: planSession.subject,
        topic: planSession.topic,
        resource_type: planSession.resource_type,
        minutes: planSession.minutes,
        days_overdue: Math.max(
          1,
          Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${planDay.study_date}T12:00:00`).getTime()) / DAY_MS)
        )
      }))
  );

  const daily = plan.schedule.map((planDay) => {
    const dayCompletions = completions.filter((item) => item.study_date === planDay.study_date);
    const completedSessions = dayCompletions.length;
    const completedDayMinutes = dayCompletions.reduce((total, item) => total + item.minutes_completed, 0);
    const missedCount =
      planDay.study_date < today ? planDay.sessions.length - completedSessions : 0;
    const completionRate =
      planDay.sessions.length > 0 ? Math.round((completedSessions / planDay.sessions.length) * 100) : 100;
    const status: DailyProgress["status"] =
      planDay.sessions.length === 0
        ? "rest"
        : planDay.study_date === today
          ? "today"
          : planDay.study_date < today && missedCount > 0
            ? "missed"
            : planDay.study_date < today
              ? "complete"
              : "upcoming";

    return {
      study_date: planDay.study_date,
      planned_minutes: planDay.total_minutes,
      completed_minutes: completedDayMinutes,
      planned_sessions: planDay.sessions.length,
      completed_sessions: completedSessions,
      missed_sessions: missedCount,
      completion_rate: completionRate,
      status
    };
  });

  return {
    plan_id: DEMO_PLAN_ID,
    planned_minutes: plannedMinutes,
    completed_minutes: completedMinutes,
    planned_sessions: plannedSessions,
    completed_sessions: completions.length,
    missed_sessions_count: missedSessions.length,
    missed_minutes: missedSessions.reduce((total, item) => total + item.minutes, 0),
    completion_rate: Math.round((completions.length / plannedSessions) * 100),
    completed_session_keys: completedSessionKeys,
    daily,
    completions,
    missed_sessions: missedSessions
  };
}

export function createDemoWeeklyDigest(plan: StudyPlanResponse = createDemoStudyPlan()): WeeklyStudyDigest {
  const progress = createDemoProgress(plan);
  const days = progress.daily.slice(0, 7);
  const plannedMinutes = days.reduce((total, item) => total + item.planned_minutes, 0);
  const completedMinutes = days.reduce((total, item) => total + item.completed_minutes, 0);
  const missedMinutes = days
    .filter((item) => item.status === "missed")
    .reduce((total, item) => total + Math.max(0, item.planned_minutes - item.completed_minutes), 0);
  const plannedSessions = days.reduce((total, item) => total + item.planned_sessions, 0);
  const completedSessions = days.reduce((total, item) => total + item.completed_sessions, 0);
  const missedSessions = days.reduce((total, item) => total + item.missed_sessions, 0);

  return {
    plan_id: DEMO_PLAN_ID,
    student_name: DEMO_STUDENT_NAME,
    week_start: days[0]?.study_date ?? dateOffset(0),
    week_end: days[days.length - 1]?.study_date ?? dateOffset(6),
    planned_minutes: plannedMinutes,
    completed_minutes: completedMinutes,
    missed_minutes: missedMinutes,
    planned_sessions: plannedSessions,
    completed_sessions: completedSessions,
    missed_sessions: missedSessions,
    completion_rate: plannedSessions > 0 ? Math.round((completedSessions / plannedSessions) * 100) : 0,
    active_days: days.filter((item) => item.planned_sessions > 0).length,
    streak_days: 2,
    strongest_day: days[0]?.study_date ?? null,
    headline: "Steady progress with one catch-up window",
    insight:
      "Alliyah is completing recall notes with strong confidence, but one past-question block still needs attention.",
    next_action: "Use the catch-up plan to finish the missed practice before the next revision day.",
    days
  };
}

export function createDemoReminderSettings(): StudyReminderSettings {
  return {
    plan_id: DEMO_PLAN_ID,
    reminders_enabled: true,
    reminder_time: "17:00",
    reminder_minutes_before: 15,
    missed_session_alerts_enabled: true,
    missed_session_followup_time: "19:30",
    parent_alerts_enabled: true,
    updated_at: isoOffset(0, 9)
  };
}
