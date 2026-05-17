export type TopicInput = {
  name: string;
  pages: number;
  priority: number;
  resource_type: string;
};

export type SubjectInput = {
  name: string;
  topics: TopicInput[];
};

export type StudentProfileInput = {
  name: string;
  class_level: string;
  age?: number | null;
  parent_name: string;
  parent_contact: string;
};

export type StudyPlanRequest = {
  student_profile: StudentProfileInput;
  student_name?: string;
  exam_date?: string;
  exam_start_date: string;
  exam_end_date: string;
  available_daily_minutes: number;
  minutes_per_page: number;
  session_minutes: number;
  break_minutes: number;
  study_strength_note: string;
  subjects: SubjectInput[];
};

export type PlanMetadata = {
  student_name: string;
  class_level: string;
  exam_date: string;
  exam_start_date: string;
  exam_end_date: string | null;
  days_until_exam: number;
  total_study_minutes: number;
  average_daily_minutes: number;
  required_daily_minutes: number;
  available_daily_minutes: number;
  daily_gap_minutes: number;
  status: "on_track" | "tight" | "behind";
  recommendation: string;
  resources_used: string[];
  study_strength_note: string;
};

export type SubjectDistribution = {
  subject: string;
  estimated_minutes: number;
  percentage: number;
};

export type PlanSession = {
  kind: "study" | "revision" | "practice";
  subject: string;
  topic: string;
  resource_type: string;
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
