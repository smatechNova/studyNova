export type TopicInput = {
  name: string;
  pages: number;
  priority: number;
};

export type SubjectInput = {
  name: string;
  topics: TopicInput[];
};

export type StudyPlanRequest = {
  student_name: string;
  exam_date: string;
  available_daily_minutes: number;
  minutes_per_page: number;
  session_minutes: number;
  break_minutes: number;
  subjects: SubjectInput[];
};

export type PlanMetadata = {
  student_name: string;
  exam_date: string;
  days_until_exam: number;
  total_study_minutes: number;
  required_daily_minutes: number;
  available_daily_minutes: number;
  daily_gap_minutes: number;
  status: "on_track" | "tight" | "behind";
  recommendation: string;
};

export type SubjectDistribution = {
  subject: string;
  estimated_minutes: number;
  percentage: number;
};

export type PlanSession = {
  kind: "study" | "revision";
  subject: string;
  topic: string;
  minutes: number;
  break_after_minutes: number;
};

export type DailyPlan = {
  study_date: string;
  total_minutes: number;
  sessions: PlanSession[];
};

export type StudyPlanResponse = {
  metadata: PlanMetadata;
  subject_distribution: SubjectDistribution[];
  schedule: DailyPlan[];
};

