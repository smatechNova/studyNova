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

export type SavedStudyPlan = {
  id: string;
  student_name: string;
  student_id?: string | null;
  created_at: string;
  plan: StudyPlanResponse;
  setup_payload?: StudyPlanRequest | null;
};

export type StudentAccountInput = {
  login_id: string;
  access_code: string;
  name: string;
  class_level: string;
  age: number;
  school_name: string;
};

export type StudentAccount = Omit<StudentAccountInput, "access_code"> & {
  id: string;
  auth_uid?: string | null;
  created_at: string;
};

export type ParentAccountInput = {
  name: string;
  contact: string;
  access_code: string;
  relationship: string;
};

export type ParentAccount = Omit<ParentAccountInput, "access_code"> & {
  id: string;
  auth_uid?: string | null;
  email_verified?: boolean;
  email_verified_at?: string | null;
  created_at: string;
};

export type ParentEmailVerificationReceipt = {
  parent_id: string;
  email: string;
  status: "sent";
  message: string;
  expires_at: string;
  dev_code?: string | null;
};

export type ParentEmailVerificationConfirmReceipt = {
  parent: ParentAccount;
  verified: boolean;
  message: string;
};

export type ParentStudentLink = {
  id: string;
  parent_id: string;
  student_id: string;
  created_at: string;
};

export type ParentInviteCode = {
  code: string;
  student_id: string;
  created_at: string;
  expires_at: string;
};

export type FamilyAccount = {
  parent: ParentAccount | null;
  student: StudentAccount | null;
  link: ParentStudentLink | null;
};

export type ParentFamilyAccount = {
  parent: ParentAccount | null;
  students: StudentAccount[];
  links: ParentStudentLink[];
};

export type AuthRole = "student" | "parent";

export type AccountSignInInput = {
  role: AuthRole;
  login_id: string;
  access_code: string;
};

export type AccountRecoveryRequestInput = {
  role: AuthRole;
  login_id: string;
  contact: string;
  note: string;
};

export type AccountRecoveryRequestReceipt = {
  id: string;
  status: "received";
  message: string;
  created_at: string;
};

export type AccountRecoveryRequestRecord = {
  id: string;
  role: AuthRole;
  login_id: string;
  contact: string;
  note: string;
  matched_account: boolean;
  status: "open" | "reviewed";
  reviewed_at?: string | null;
  admin_note: string;
  created_at: string;
};

export type AccountRecoveryReviewInput = {
  admin_note: string;
};

export type AccountDeletionRequestInput = {
  contact: string;
  reason: string;
  confirmation: "DELETE";
};

export type PublicAccountDeletionRequestInput = AccountDeletionRequestInput & {
  role: AuthRole;
  login_id: string;
  account_label: string;
};

export type AccountDeletionRequestReceipt = {
  id: string;
  status: "pending";
  message: string;
  created_at: string;
};

export type AccountDeletionRequestRecord = {
  id: string;
  role: AuthRole;
  account_id: string;
  account_label: string;
  login_id: string;
  contact: string;
  reason: string;
  request_source: "signed_in" | "public";
  verification_required: boolean;
  matched_account: boolean;
  status: "pending" | "reviewed" | "completed";
  reviewed_at?: string | null;
  completed_at?: string | null;
  admin_note: string;
  created_at: string;
};

export type AccountDeletionReviewInput = {
  status: "reviewed" | "completed";
  admin_note: string;
};

export type TesterFeedbackInput = {
  tester_name: string;
  contact: string;
  role: "student" | "parent" | "school" | "general";
  device_model: string;
  android_version: string;
  category: "setup" | "student" | "parent" | "reminders" | "ui" | "bug" | "other";
  rating: number;
  what_worked: string;
  what_failed: string;
  improvement: string;
  recommend: boolean | null;
  message: string;
};

export type TesterFeedbackReceipt = {
  id: string;
  status: "received";
  message: string;
  created_at: string;
};

export type TesterFeedbackReviewInput = {
  status: "open" | "reviewed";
  admin_note: string;
};

export type TesterFeedbackRecord = TesterFeedbackInput & {
  id: string;
  status: "open" | "reviewed";
  reviewed_at?: string | null;
  admin_note: string;
  created_at: string;
};

export type StorageHealth = {
  provider: "sqlite";
  database_path: string;
  database_exists: boolean;
  database_size_bytes: number;
  backup_directory: string;
  backup_directory_exists: boolean;
  production_ready: boolean;
  warnings: string[];
};

export type StorageBackupReceipt = {
  provider: "sqlite";
  filename: string;
  backup_path: string;
  size_bytes: number;
  created_at: string;
};

export type FirebaseAuthReadiness = {
  provider: "firebase";
  admin_sdk_installed: boolean;
  service_account_configured: boolean;
  google_application_credentials_configured: boolean;
  project_id_configured: boolean;
  server_verification_ready: boolean;
  warnings: string[];
};

export type DeploymentCheck = {
  name: string;
  status: "pass" | "warning" | "fail";
  message: string;
};

export type DeploymentReadiness = {
  environment: string;
  production: boolean;
  public_api_base_url: string;
  ready: boolean;
  checks: DeploymentCheck[];
};

export type LaunchChecklistItemRecord = {
  item_key: string;
  confirmed: boolean;
  confirmed_at: string | null;
  admin_note: string;
  updated_at: string;
};

export type LaunchChecklistItemUpdate = {
  confirmed: boolean;
  admin_note: string;
};

export type FirebaseSignInInput = {
  role: AuthRole;
  id_token: string;
};

export type AuthSession = {
  role: AuthRole;
  student: StudentAccount | null;
  parent: ParentAccount | null;
  students: StudentAccount[];
  session_token: string;
  session_expires_at?: string | null;
};

export type StudySessionCompletionRequest = {
  session_key: string;
  study_date: string;
  kind: PlanSession["kind"];
  subject: string;
  topic: string;
  resource_type: string;
  minutes_planned: number;
  minutes_completed: number;
  recall_note: string;
  confidence: number;
};

export type StudyProofImageUploadRequest = {
  session_key: string;
  file_name: string;
  content_type: string;
  image_base64: string;
};

export type StudySessionCompletion = StudySessionCompletionRequest & {
  id: string;
  plan_id: string;
  completed_at: string;
  proof_image_url?: string | null;
  proof_image_storage_backend?: string | null;
  proof_image_storage_path?: string | null;
  proof_image_content_type?: string | null;
  proof_image_uploaded_at?: string | null;
  proof_image_token?: string | null;
};

export type MissedStudySession = {
  session_key: string;
  study_date: string;
  kind: PlanSession["kind"];
  subject: string;
  topic: string;
  resource_type: string;
  minutes: number;
  days_overdue: number;
};

export type DailyProgress = {
  study_date: string;
  planned_minutes: number;
  completed_minutes: number;
  planned_sessions: number;
  completed_sessions: number;
  missed_sessions: number;
  completion_rate: number;
  status: "complete" | "missed" | "today" | "upcoming" | "rest";
};

export type StudyPlanProgress = {
  plan_id: string;
  planned_minutes: number;
  completed_minutes: number;
  planned_sessions: number;
  completed_sessions: number;
  missed_sessions_count: number;
  missed_minutes: number;
  completion_rate: number;
  completed_session_keys: string[];
  daily: DailyProgress[];
  completions: StudySessionCompletion[];
  missed_sessions: MissedStudySession[];
};

export type WeeklyDigestDay = {
  study_date: string;
  planned_minutes: number;
  completed_minutes: number;
  planned_sessions: number;
  completed_sessions: number;
  missed_sessions: number;
  completion_rate: number;
  status: DailyProgress["status"];
};

export type WeeklyStudyDigest = {
  plan_id: string;
  student_name: string;
  week_start: string;
  week_end: string;
  planned_minutes: number;
  completed_minutes: number;
  missed_minutes: number;
  planned_sessions: number;
  completed_sessions: number;
  missed_sessions: number;
  completion_rate: number;
  active_days: number;
  streak_days: number;
  strongest_day: string | null;
  headline: string;
  insight: string;
  next_action: string;
  days: WeeklyDigestDay[];
};

export type StudyReminderSettingsUpdate = {
  reminders_enabled: boolean;
  reminder_time: string;
  reminder_minutes_before: number;
  missed_session_alerts_enabled: boolean;
  missed_session_followup_time: string;
  parent_alerts_enabled: boolean;
};

export type StudyReminderSettings = StudyReminderSettingsUpdate & {
  plan_id: string;
  updated_at: string;
};
