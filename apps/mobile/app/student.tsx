import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps
} from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import {
  completeStudySession,
  createAccountDeletionRequest,
  createParentInviteCode,
  generateStudyPlan,
  getLatestStudyPlan,
  getStudyReminderSettings,
  getStudyPlanHistory,
  getStudentFamily,
  getStudyPlanProgress,
  getWeeklyStudyDigest,
  rebalanceStudyPlan,
  saveStudyPlan,
  updateStudyReminderSettings
} from "@/lib/api";
import { brandAssets } from "@/lib/brandAssets";
import {
  getStudyReminderReadiness,
  scheduleStudyReminders,
  sendTestStudyNotification,
  type NotificationReadiness
} from "@/lib/reminders";
import {
  DEMO_STUDENT_ID,
  createDemoFamilyAccount,
  createDemoProgress,
  createDemoReminderSettings,
  createDemoSavedStudyPlan,
  createDemoWeeklyDigest,
  demoStudyPlanRequest,
  isDemoParam
} from "@/lib/demoData";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/session";
import type {
  ParentInviteCode,
  PlanSession,
  SavedStudyPlan,
  StudyReminderSettings,
  StudyPlanProgress,
  StudyPlanRequest,
  StudyPlanResponse,
  StudySessionCompletion,
  WeeklyStudyDigest
} from "@/types";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

const RESOURCE_OPTIONS = ["Textbook", "Class notes", "Notebook", "Online notes", "Past questions"];
const STEPS = ["Profile", "Exam", "Pace", "Subjects", "Review"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REMINDER_TIME_OPTIONS = [
  { label: "Morning", value: "07:00" },
  { label: "After school", value: "16:30" },
  { label: "Evening", value: "18:00" },
  { label: "Night", value: "20:00" }
];
const PLAN_FORM_DRAFT_KEY_PREFIX = "studynova.student-plan-form.v1";
const BLOCKED_STUDY_CONTENT_PHRASES = [
  "could not generate the plan",
  "api connection and exam dates",
  "study plan request failed"
];

type StepName = (typeof STEPS)[number];
type DateFieldName = "examStartDate" | "examEndDate";
type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const STEP_DETAILS: Record<StepName, { icon: MaterialIconName; eyebrow: string }> = {
  Profile: { icon: "account-school-outline", eyebrow: "Identity" },
  Exam: { icon: "calendar-month-outline", eyebrow: "Timeline" },
  Pace: { icon: "speedometer-slow", eyebrow: "Rhythm" },
  Subjects: { icon: "bookshelf", eyebrow: "Syllabus" },
  Review: { icon: "clipboard-check-outline", eyebrow: "Ready" }
};

const STEP_IMAGES: Record<StepName, number> = {
  Exam: brandAssets.examStep,
  Pace: brandAssets.paceStep,
  Profile: brandAssets.profileStep,
  Review: brandAssets.reviewStep,
  Subjects: brandAssets.subjectsStep
};

type TopicForm = {
  id: string;
  name: string;
  pages: string;
  priority: string;
  resourceType: string;
};

type SubjectForm = {
  id: string;
  name: string;
  topics: TopicForm[];
};

type PlanForm = {
  studentName: string;
  classLevel: string;
  age: string;
  parentName: string;
  parentContact: string;
  examStartDate: string;
  examEndDate: string;
  availableDailyMinutes: string;
  minutesPerPage: string;
  sessionMinutes: string;
  breakMinutes: string;
  studyStrengthNote: string;
  subjects: SubjectForm[];
};

type ValidationResult = {
  message: string;
  stepIndex: number;
};

const memoryPlanDrafts = new Map<string, PlanForm>();

function useStudentStyles() {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

export default function StudentScreen() {
  const { colors } = useTheme();
  const styles = useStudentStyles();
  const params = useLocalSearchParams<{ studentId?: string; demo?: string }>();
  const routeStudentId = getParamValue(params.studentId);
  const isDemoMode = isDemoParam(params.demo);
  const [sessionStudentId, setSessionStudentId] = useState<string | undefined>();
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [form, setForm] = useState<PlanForm>(() => createDefaultForm());
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedStudyPlan | null>(null);
  const [latestPlan, setLatestPlan] = useState<SavedStudyPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<SavedStudyPlan[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [latestMessage, setLatestMessage] = useState("");
  const [linkedStudentId, setLinkedStudentId] = useState<string | undefined>();
  const [parentInvite, setParentInvite] = useState<ParentInviteCode | null>(null);
  const [parentInviteMessage, setParentInviteMessage] = useState("");
  const [isParentInviteLoading, setIsParentInviteLoading] = useState(false);
  const [isDeletionOpen, setIsDeletionOpen] = useState(false);
  const [deletionContact, setDeletionContact] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [isDeletionLoading, setIsDeletionLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [activeCalendar, setActiveCalendar] = useState<DateFieldName | null>(null);
  const [isPlanVisible, setIsPlanVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const setupScrollRef = useRef<ScrollView>(null);
  const setupPanelOffsetY = useRef(0);
  const subjectListOffsetY = useRef(0);
  const subjectEditorOffsetY = useRef(0);
  const [newSubjectId, setNewSubjectId] = useState<string | undefined>();
  const [activeSubjectId, setActiveSubjectId] = useState<string | undefined>();
  const [bulkTopicText, setBulkTopicText] = useState("");
  const [isDraftReady, setIsDraftReady] = useState(false);
  const activeStudentId = isDemoMode ? DEMO_STUDENT_ID : sessionStudentId;
  const demoProgress = useMemo(
    () => (isDemoMode && savedPlan ? createDemoProgress(savedPlan.plan) : null),
    [isDemoMode, savedPlan]
  );
  const demoWeeklyDigest = useMemo(
    () => (isDemoMode && savedPlan ? createDemoWeeklyDigest(savedPlan.plan) : null),
    [isDemoMode, savedPlan]
  );
  const demoReminderSettings = useMemo(() => (isDemoMode ? createDemoReminderSettings() : null), [isDemoMode]);

  const currentStep = STEPS[stepIndex];
  const completedStepCount = getCompletedStepCount(form);
  const activeSubject = form.subjects.find((subject) => subject.id === activeSubjectId) ?? form.subjects[0] ?? null;
  const activeSubjectIndex = activeSubject
    ? form.subjects.findIndex((subject) => subject.id === activeSubject.id)
    : -1;
  const topicCount = form.subjects.reduce((total, subject) => total + subject.topics.length, 0);
  const pageCount = form.subjects.reduce(
    (total, subject) => total + subject.topics.reduce((sum, topic) => sum + toNumber(topic.pages), 0),
    0
  );
  const estimatedReadingMinutes = pageCount * clamp(toNumber(form.minutesPerPage), 1, 30);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSession() {
      if (isDemoMode) {
        setSessionStudentId(DEMO_STUDENT_ID);
        setAuthMessage("");
        setIsSessionLoading(false);
        return;
      }

      setIsSessionLoading(true);
      const session = await getStoredAuthSession();
      if (!isMounted) {
        return;
      }

      if (session?.role === "student" && session.student) {
        if (routeStudentId && routeStudentId !== session.student.id) {
          setSessionStudentId(undefined);
          setAuthMessage("This student link belongs to another student account. Sign in with the correct student.");
        } else {
          setSessionStudentId(session.student.id);
          setAuthMessage("");
        }
      } else if (session?.role === "parent") {
        setSessionStudentId(undefined);
        setAuthMessage("Parent accounts cannot open a student dashboard. Sign in with the student's account.");
      } else {
        setSessionStudentId(undefined);
        setAuthMessage("Sign in as a student to open this dashboard.");
      }

      setIsSessionLoading(false);
    }

    void loadStoredSession();

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, routeStudentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadStoredDraft() {
      if (isDemoMode) {
        setForm(createFormFromRequest(demoStudyPlanRequest));
        setIsDraftReady(true);
        return;
      }

      if (!activeStudentId) {
        setIsDraftReady(false);
        return;
      }

      setIsDraftReady(false);
      const draft = await getStoredPlanFormDraft(activeStudentId);
      if (!isMounted) {
        return;
      }

      if (draft) {
        setForm(draft);
      }
      setIsDraftReady(true);
    }

    void loadStoredDraft();

    return () => {
      isMounted = false;
    };
  }, [activeStudentId, isDemoMode]);

  useEffect(() => {
    if (isDemoMode || !activeStudentId || !isDraftReady) {
      return;
    }

    void savePlanFormDraft(activeStudentId, form);
  }, [activeStudentId, form, isDraftReady, isDemoMode]);

  useEffect(() => {
    let isMounted = true;

    async function loadAccountAndPlan() {
      if (!activeStudentId) {
        return;
      }

      if (isDemoMode) {
        const family = createDemoFamilyAccount();
        const demoSavedPlan = createDemoSavedStudyPlan();

        if (isMounted) {
          setLinkedStudentId(DEMO_STUDENT_ID);
          setForm(createFormFromRequest(demoStudyPlanRequest));
          setDeletionContact(family.parent?.contact ?? "");
          setLatestPlan(demoSavedPlan);
          setSavedPlan(demoSavedPlan);
          setPlan(demoSavedPlan.plan);
          setPlanHistory([demoSavedPlan]);
          setLatestMessage("");
          setSaveMessage("Screenshot demo uses safe sample data.");
          setIsPlanVisible(true);
          setIsHistoryLoading(false);
        }
        return;
      }

      try {
        const studentFamily = await getStudentFamily(activeStudentId);
        if (isMounted && studentFamily.student) {
          setLinkedStudentId(studentFamily.student.id);
          setForm((current) => ({
            ...current,
            studentName: current.studentName || studentFamily.student?.name || "",
            classLevel: current.classLevel || studentFamily.student?.class_level || "",
            age: current.age || `${studentFamily.student?.age ?? ""}`,
            parentName: current.parentName || studentFamily.parent?.name || "",
            parentContact: current.parentContact || studentFamily.parent?.contact || ""
          }));
          setDeletionContact((current) => current || studentFamily.parent?.contact || studentFamily.student?.login_id || "");
        }
      } catch (error) {
        if (isMounted) {
          if (isSessionExpiredError(error)) {
            setSessionStudentId(undefined);
            setAuthMessage("Your sign-in session expired. Please sign in again.");
            return;
          }
          setLatestMessage("Sign in with a valid student account.");
        }
      }

      try {
        const saved = await getLatestStudyPlan({ studentId: activeStudentId });
        if (isMounted) {
          if (isStudyPlanUsable(saved.plan)) {
            setLatestPlan(saved);
            setLatestMessage("");
          } else {
            setLatestPlan(null);
            setLatestMessage("Your latest saved plan contains an old app message. Please generate a fresh plan.");
          }
        }
      } catch (error) {
        if (isMounted) {
          if (isSessionExpiredError(error)) {
            setSessionStudentId(undefined);
            setAuthMessage("Your sign-in session expired. Please sign in again.");
            return;
          }
          setLatestMessage("No saved plan yet.");
        }
      }

      try {
        setIsHistoryLoading(true);
        const history = await getStudyPlanHistory({ studentId: activeStudentId, limit: 6 });
        if (isMounted) {
          setPlanHistory(history.filter((saved) => isStudyPlanUsable(saved.plan)));
        }
      } catch (error) {
        if (isMounted) {
          if (isSessionExpiredError(error)) {
            setSessionStudentId(undefined);
            setAuthMessage("Your sign-in session expired. Please sign in again.");
            return;
          }
          setPlanHistory([]);
        }
      } finally {
        if (isMounted) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadAccountAndPlan();

    return () => {
      isMounted = false;
    };
  }, [activeStudentId, isDemoMode]);

  async function submitPlan(nextForm = form) {
    const request = buildRequest(nextForm);
    if (!request) {
      return;
    }

    if (isDemoMode) {
      const demoSavedPlan = createDemoSavedStudyPlan();
      setPlan(demoSavedPlan.plan);
      setSavedPlan(demoSavedPlan);
      setLatestPlan(demoSavedPlan);
      setPlanHistory([demoSavedPlan]);
      setSaveMessage("Screenshot demo refreshed with safe sample data.");
      setIsPlanVisible(true);
      setStepIndex(STEPS.length - 1);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await generateStudyPlan(request);
      if (!isStudyPlanUsable(response)) {
        setStepIndex(STEPS.indexOf("Subjects"));
        setError("One of the study topics looks like an app message. Replace it with the real topic name.");
        return;
      }

      setPlan(response);
      setSavedPlan(null);
      setSaveMessage("Saving generated plan...");
      try {
        const saved = await saveStudyPlan(response, linkedStudentId ?? activeStudentId, request);
        setSavedPlan(saved);
        setLatestPlan(saved);
        setPlanHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 6));
        setSaveMessage("New plan version saved. You can continue from here later.");
      } catch {
        setSaveMessage("Generated, but saving is unavailable right now.");
      }
      setIsPlanVisible(true);
      setStepIndex(STEPS.length - 1);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setError(detail || "Could not generate the plan. Check the API connection and exam dates.");
    } finally {
      setIsLoading(false);
    }
  }

  function continueLatestPlan() {
    if (!latestPlan) {
      return;
    }

    openSavedPlan(latestPlan, "Loaded latest saved plan.");
  }

  function openSavedPlan(nextPlan: SavedStudyPlan, message: string) {
    if (!isStudyPlanUsable(nextPlan.plan)) {
      if (nextPlan.id === latestPlan?.id) {
        setLatestPlan(null);
      }
      setLatestMessage("That saved plan contains an old app message. Please generate a fresh plan.");
      return;
    }

    setPlan(nextPlan.plan);
    setSavedPlan(nextPlan);
    if (nextPlan.setup_payload) {
      setForm(createFormFromRequest(nextPlan.setup_payload));
      setActiveSubjectId(undefined);
    }
    setSaveMessage(message);
    setIsPlanVisible(true);
  }

  function handlePlanRebalanced(rebalancedPlan: SavedStudyPlan) {
    setPlan(rebalancedPlan.plan);
    setSavedPlan(rebalancedPlan);
    setLatestPlan(rebalancedPlan);
    setPlanHistory((current) =>
      [rebalancedPlan, ...current.filter((item) => item.id !== rebalancedPlan.id)].slice(0, 6)
    );
    setSaveMessage("Plan rebalanced after missed sessions.");
    setIsPlanVisible(true);
  }

  async function generateParentInvite() {
    if (isDemoMode) {
      setParentInviteMessage("Demo mode does not create real parent invite codes.");
      return;
    }

    if (!activeStudentId) {
      return;
    }

    setIsParentInviteLoading(true);
    setParentInviteMessage("");

    try {
      const invite = await createParentInviteCode(activeStudentId);
      setParentInvite(invite);
      setParentInviteMessage("Share this code with the parent or guardian. It can only be used once.");
    } catch (error) {
      if (isSessionExpiredError(error)) {
        setSessionStudentId(undefined);
        setAuthMessage("Your sign-in session expired. Please sign in again.");
      } else {
        setParentInviteMessage("Could not create a parent invite code. Confirm the student is signed in.");
      }
    } finally {
      setIsParentInviteLoading(false);
    }
  }

  function buildRequest(nextForm: PlanForm): StudyPlanRequest | null {
    const validation = getFirstValidationError(nextForm);
    if (validation) {
      setStepIndex(validation.stepIndex);
      setError(validation.message);
      return null;
    }

    const age = toNumber(nextForm.age);
    const availableDailyMinutes = toNumber(nextForm.availableDailyMinutes);
    const minutesPerPage = toNumber(nextForm.minutesPerPage);
    const sessionMinutes = toNumber(nextForm.sessionMinutes);
    const breakMinutes = toNumber(nextForm.breakMinutes);
    const subjects = nextForm.subjects
      .map((subject) => ({
        name: subject.name.trim(),
        topics: subject.topics
          .map((topic) => ({
            name: topic.name.trim(),
            pages: toNumber(topic.pages),
            priority: clamp(toNumber(topic.priority), 1, 5),
            resource_type: topic.resourceType
          }))
          .filter((topic) => topic.name && topic.pages > 0)
      }))
      .filter((subject) => subject.name && subject.topics.length > 0);

    if (!nextForm.studentName.trim()) {
      setError("Enter the student name.");
      return null;
    }

    if (!nextForm.classLevel.trim()) {
      setError("Enter the student's class.");
      return null;
    }

    if (age <= 0) {
      setError("Enter the student's age.");
      return null;
    }

    if (!nextForm.parentName.trim() || !nextForm.parentContact.trim()) {
      setError("Enter parent or guardian details.");
      return null;
    }

    if (!isFutureDate(nextForm.examStartDate)) {
      setError("Choose a future exam start date.");
      return null;
    }

    if (!isValidDate(nextForm.examEndDate) || !isDateOnOrAfter(nextForm.examEndDate, nextForm.examStartDate)) {
      setError("Choose an exam end date that is on or after the start date.");
      return null;
    }

    if (availableDailyMinutes <= 0) {
      setError("Enter the daily study minutes.");
      return null;
    }

    if (minutesPerPage <= 0) {
      setError("Enter the minutes needed to read one page.");
      return null;
    }

    if (sessionMinutes <= 0) {
      setError("Enter the study session length.");
      return null;
    }

    if (breakMinutes <= 0) {
      setError("Enter the break length.");
      return null;
    }

    if (!subjects.length) {
      setError("Add at least one subject with one topic.");
      return null;
    }

    return {
      student_profile: {
        name: nextForm.studentName.trim(),
        class_level: nextForm.classLevel.trim(),
        age,
        parent_name: nextForm.parentName.trim(),
        parent_contact: nextForm.parentContact.trim()
      },
      exam_start_date: nextForm.examStartDate,
      exam_end_date: nextForm.examEndDate,
      available_daily_minutes: clamp(availableDailyMinutes, 30, 720),
      minutes_per_page: clamp(minutesPerPage, 1, 30),
      session_minutes: clamp(sessionMinutes, 20, 90),
      break_minutes: clamp(breakMinutes, 5, 30),
      study_strength_note: nextForm.studyStrengthNote.trim(),
      subjects
    };
  }

  function goNext() {
    const validationMessage = getStepValidationError(currentStep, form);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    setActiveCalendar(null);
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goToStep(index: number) {
    setError("");
    setActiveCalendar(null);
    setStepIndex(index);

    setTimeout(() => {
      setupScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 50);
  }

  function goBack() {
    setError("");
    setActiveCalendar(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  function updateField(field: keyof Omit<PlanForm, "subjects">, value: string) {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateDateField(field: DateFieldName, value: string) {
    setError("");
    setForm((current) => {
      if (field === "examStartDate" && !isDateOnOrAfter(current.examEndDate, value)) {
        return { ...current, examStartDate: value, examEndDate: value };
      }

      return { ...current, [field]: value };
    });
    setActiveCalendar(null);
  }

  function updateSubject(subjectId: string, name: string) {
    setError("");
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId ? { ...subject, name } : subject
      )
    }));
  }

  function addSubject() {
    const nextSubject = createSubject("", [createTopic("", "", "Textbook")]);

    setError("");
    setNewSubjectId(nextSubject.id);
    setActiveSubjectId(nextSubject.id);
    setBulkTopicText("");
    setForm((current) => ({
      ...current,
      subjects: [...current.subjects, nextSubject]
    }));

    setTimeout(() => {
      scrollToSubjectEditor();
    }, 120);

    setTimeout(() => {
      scrollToSubjectEditor();
    }, 320);

    setTimeout(() => {
      setNewSubjectId((current) => (current === nextSubject.id ? undefined : current));
    }, 1800);
  }

  function selectSubject(subjectId: string) {
    setError("");
    setActiveSubjectId(subjectId);
    setBulkTopicText("");

    setTimeout(() => {
      scrollToSubjectEditor();
    }, 80);
  }

  function scrollToSubjectEditor() {
    const targetY = setupPanelOffsetY.current + subjectListOffsetY.current + subjectEditorOffsetY.current - spacing.md;
    setupScrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
  }

  function removeSubject(subjectId: string) {
    setForm((current) => ({
      ...current,
      subjects:
        current.subjects.length > 1
          ? current.subjects.filter((subject) => subject.id !== subjectId)
          : current.subjects
    }));
    setActiveSubjectId((currentActive) => {
      if (currentActive !== subjectId) {
        return currentActive;
      }

      const nextSubject = form.subjects.find((subject) => subject.id !== subjectId);
      return nextSubject?.id;
    });
  }

  function updateTopic(subjectId: string, topicId: string, field: keyof Omit<TopicForm, "id">, value: string) {
    setError("");
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) => {
        if (subject.id !== subjectId) {
          return subject;
        }

        return {
          ...subject,
          topics: subject.topics.map((topic) =>
            topic.id === topicId ? { ...topic, [field]: value } : topic
          )
        };
      })
    }));
  }

  function addTopic(subjectId: string) {
    setError("");
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId
          ? { ...subject, topics: [...subject.topics, createTopic("", "", "Textbook")] }
          : subject
      )
    }));
  }

  function importBulkTopics(subjectId: string) {
    const topics = parseBulkTopics(bulkTopicText);
    if (!topics.length) {
      setError("Paste one topic per line, such as Algebra, 18, Textbook.");
      return;
    }

    setError("");
    setBulkTopicText("");
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              topics: shouldReplaceStarterTopic(subject.topics) ? topics : [...subject.topics, ...topics]
            }
          : subject
      )
    }));
  }

  function removeTopic(subjectId: string, topicId: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) => {
        if (subject.id !== subjectId || subject.topics.length <= 1) {
          return subject;
        }

        return {
          ...subject,
          topics: subject.topics.filter((topic) => topic.id !== topicId)
        };
      })
    }));
  }

  async function switchAccount() {
    if (isDemoMode) {
      router.replace("/");
      return;
    }

    await clearStoredAuthSession();
    router.replace("/auth?role=student");
  }

  async function submitDeletionRequest() {
    if (isDemoMode) {
      setDeletionMessage("Demo mode uses safe sample data, so no account deletion request is created.");
      return;
    }

    if (!deletionContact.trim()) {
      setDeletionMessage("Enter an email or phone number support can use for this request.");
      return;
    }

    if (deletionConfirmation.trim() !== "DELETE") {
      setDeletionMessage("Type DELETE to confirm the deletion request.");
      return;
    }

    setIsDeletionLoading(true);
    setDeletionMessage("");

    try {
      const receipt = await createAccountDeletionRequest({
        contact: deletionContact.trim(),
        reason: deletionReason.trim(),
        confirmation: "DELETE"
      });
      setDeletionReason("");
      setDeletionConfirmation("");
      setDeletionMessage(receipt.message);
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        setSessionStudentId(undefined);
        setAuthMessage("Your sign-in session expired. Please sign in again.");
        return;
      }
      setDeletionMessage("Could not send the deletion request. Check the API connection and try again.");
    } finally {
      setIsDeletionLoading(false);
    }
  }

  if (isSessionLoading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.sectionTitle}>Checking student access</Text>
            <Text style={styles.helper}>Opening the dashboard for the signed-in student account.</Text>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (!activeStudentId) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <MaterialCommunityIcons name="lock-outline" size={28} color={colors.brand} />
            <Text style={styles.sectionTitle}>Student sign in required</Text>
            <Text style={styles.helper}>
              {authMessage || "Sign in as a student to open only that student's dashboard and study plan."}
            </Text>
            <Link href="/auth?role=student" asChild>
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <MaterialCommunityIcons name="login" size={18} color={colors.brand} />
                <Text style={styles.secondaryButtonText}>Sign in as student</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (isPlanVisible && plan) {
    return (
      <GeneratedPlanView
        onBack={() => {
          setIsPlanVisible(false);
          setStepIndex(STEPS.length - 1);
        }}
        onEdit={() => {
          setIsPlanVisible(false);
          setStepIndex(STEPS.length - 1);
        }}
        onPlanRebalanced={handlePlanRebalanced}
        plan={plan}
        savedPlan={savedPlan}
        saveMessage={saveMessage}
        isDemoMode={isDemoMode}
        demoProgress={demoProgress}
        demoWeeklyDigest={demoWeeklyDigest}
        demoReminderSettings={demoReminderSettings}
      />
    );
  }

  return (
    <Screen>
      <ScrollView
        ref={setupScrollRef}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Guided setup</Text>
            <Text style={styles.title}>Student plan</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} accessibilityRole="button">
              <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void switchAccount()} style={styles.accountButton}>
              <MaterialCommunityIcons name="account-switch-outline" size={18} color={colors.brand} />
              <Text style={styles.accountButtonText}>Switch</Text>
            </Pressable>
          </View>
        </View>

        {latestPlan ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.latestCopy}>
                <Text style={styles.kicker}>Latest saved plan</Text>
                <Text style={styles.sectionTitle}>{latestPlan.student_name}</Text>
                <Text style={styles.helper}>
                  Saved {formatReadableDate(latestPlan.created_at.slice(0, 10))} -{" "}
                  {formatHours(latestPlan.plan.metadata.average_daily_minutes)} per day
                </Text>
              </View>
              <Pressable accessibilityRole="button" onPress={continueLatestPlan} style={styles.primaryButton}>
                <MaterialCommunityIcons name="play-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        ) : latestMessage ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.brand} />
            <Text style={styles.infoText}>{latestMessage}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.latestCopy}>
              <Text style={styles.kicker}>Parent link</Text>
              <Text style={styles.sectionTitle}>Invite parent or guardian</Text>
              <Text style={styles.helper}>
                Generate a one-time code for a signed-in parent to connect their monitoring dashboard.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={isParentInviteLoading}
              onPress={() => void generateParentInvite()}
              style={[styles.primaryButton, isParentInviteLoading ? styles.disabledButton : null]}
            >
              {isParentInviteLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-link-variant-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{parentInvite ? "New code" : "Generate"}</Text>
                </>
              )}
            </Pressable>
          </View>
          {parentInvite ? (
            <View style={styles.inviteCodeCard}>
              <Text style={styles.kicker}>Parent invite code</Text>
              <Text style={styles.inviteCode}>{parentInvite.code}</Text>
              <Text style={styles.helper}>Expires {formatInviteExpiry(parentInvite.expires_at)}</Text>
            </View>
          ) : null}
          {parentInviteMessage ? <Text style={styles.saveStatus}>{parentInviteMessage}</Text> : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.latestCopy}>
              <Text style={styles.kicker}>Privacy</Text>
              <Text style={styles.sectionTitle}>Account deletion</Text>
              <Text style={styles.helper}>
                Request deletion of this student account and linked study data. Support reviews parent links before
                completing it.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIsDeletionOpen((current) => !current);
                setDeletionMessage("");
              }}
              style={styles.secondaryButton}
            >
              <MaterialCommunityIcons
                name={isDeletionOpen ? "chevron-up" : "trash-can-outline"}
                size={18}
                color={colors.brand}
              />
              <Text style={styles.secondaryButtonText}>{isDeletionOpen ? "Close" : "Request"}</Text>
            </Pressable>
          </View>
          {isDeletionOpen ? (
            <View style={styles.formStack}>
              <TextInput
                autoCapitalize="none"
                onChangeText={(value) => {
                  setDeletionMessage("");
                  setDeletionContact(value);
                }}
                placeholder="Contact email or phone"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={deletionContact}
              />
              <TextInput
                multiline
                onChangeText={(value) => {
                  setDeletionMessage("");
                  setDeletionReason(value);
                }}
                placeholder="Optional reason"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.noteInput]}
                value={deletionReason}
              />
              <TextInput
                autoCapitalize="characters"
                onChangeText={(value) => {
                  setDeletionMessage("");
                  setDeletionConfirmation(value);
                }}
                placeholder="Type DELETE to confirm"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={deletionConfirmation}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isDeletionLoading}
                onPress={() => void submitDeletionRequest()}
                style={[styles.dangerButton, isDeletionLoading ? styles.disabledButton : null]}
              >
                {isDeletionLoading ? (
                  <ActivityIndicator color={colors.warningDark} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="shield-alert-outline" size={18} color={colors.warningDark} />
                    <Text style={styles.dangerButtonText}>Send deletion request</Text>
                  </>
                )}
              </Pressable>
              {deletionMessage ? <Text style={styles.helper}>{deletionMessage}</Text> : null}
            </View>
          ) : null}
        </View>

        <PlanHistoryPanel
          activePlanId={savedPlan?.id}
          isLoading={isHistoryLoading}
          onOpen={(planVersion) => openSavedPlan(planVersion, "Loaded selected plan version.")}
          plans={planHistory}
        />

        <SetupHero
          completedStepCount={completedStepCount}
          estimatedReadingMinutes={estimatedReadingMinutes}
          form={form}
          pageCount={pageCount}
          topicCount={topicCount}
        />

        <WizardProgress currentStep={stepIndex} form={form} onSelectStep={goToStep} />

        <View
          onLayout={(event) => {
            setupPanelOffsetY.current = event.nativeEvent.layout.y;
          }}
          style={styles.panel}
        >
          <Image accessibilityIgnoresInvertColors source={STEP_IMAGES[currentStep]} style={styles.stepArtwork} />
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {stepIndex + 1}/{STEPS.length}
              </Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={styles.sectionTitle}>{currentStep}</Text>
              <Text style={styles.helper}>{stepSubtitle(currentStep)}</Text>
            </View>
          </View>

          {currentStep === "Profile" ? (
            <View style={styles.formStack}>
              <FormField
                label="Student name"
                placeholder="Alliyah Olaniyan"
                value={form.studentName}
                onChangeText={(value) => updateField("studentName", value)}
              />
              <FormField
                label="Class"
                placeholder="SS2 Science"
                value={form.classLevel}
                onChangeText={(value) => updateField("classLevel", value)}
              />
              <FormField
                keyboardType="number-pad"
                label="Age"
                placeholder="15"
                value={form.age}
                onChangeText={(value) => updateField("age", value)}
              />
              <FormField
                label="Parent or guardian"
                placeholder="Mrs Olaniyan"
                value={form.parentName}
                onChangeText={(value) => updateField("parentName", value)}
              />
              <FormField
                keyboardType="phone-pad"
                label="Parent contact"
                placeholder="08012345678"
                value={form.parentContact}
                onChangeText={(value) => updateField("parentContact", value)}
              />
            </View>
          ) : null}

          {currentStep === "Exam" ? (
            <View style={styles.formStack}>
              <CalendarField
                isOpen={activeCalendar === "examStartDate"}
                label="Exam start date"
                minDate={futureDate(1)}
                onSelect={(value) => updateDateField("examStartDate", value)}
                onToggle={() =>
                  setActiveCalendar((current) => (current === "examStartDate" ? null : "examStartDate"))
                }
                value={form.examStartDate}
              />
              <CalendarField
                isOpen={activeCalendar === "examEndDate"}
                label="Exam end date"
                minDate={form.examStartDate}
                onSelect={(value) => updateDateField("examEndDate", value)}
                onToggle={() =>
                  setActiveCalendar((current) => (current === "examEndDate" ? null : "examEndDate"))
                }
                value={form.examEndDate}
              />
              <FormField
                keyboardType="number-pad"
                label="Daily study minutes"
                placeholder="180"
                value={form.availableDailyMinutes}
                onChangeText={(value) => updateField("availableDailyMinutes", value)}
              />
            </View>
          ) : null}

          {currentStep === "Pace" ? (
            <View style={styles.formStack}>
              <FormField
                keyboardType="number-pad"
                label="Minutes to read one page"
                placeholder="5"
                value={form.minutesPerPage}
                onChangeText={(value) => updateField("minutesPerPage", value)}
              />
              <FormField
                keyboardType="number-pad"
                label="Study session minutes"
                placeholder="45"
                value={form.sessionMinutes}
                onChangeText={(value) => updateField("sessionMinutes", value)}
              />
              <FormField
                keyboardType="number-pad"
                label="Break minutes"
                placeholder="10"
                value={form.breakMinutes}
                onChangeText={(value) => updateField("breakMinutes", value)}
              />
              <FormField
                label="Study strength note"
                multiline
                placeholder="I understand faster when I summarize each page."
                value={form.studyStrengthNote}
                onChangeText={(value) => updateField("studyStrengthNote", value)}
              />
            </View>
          ) : null}

          {currentStep === "Subjects" ? (
            <View
              onLayout={(event) => {
                subjectListOffsetY.current = event.nativeEvent.layout.y;
              }}
              style={styles.subjectList}
            >
              <View style={styles.subjectLibraryHeader}>
                <View style={styles.subjectLibraryCopy}>
                  <Text style={styles.sectionTitle}>Subject library</Text>
                  <Text style={styles.helper}>
                    {form.subjects.length} subjects, {topicCount} topics, {pageCount} pages
                  </Text>
                </View>
                <Pressable accessibilityRole="button" onPress={addSubject} style={styles.primaryButton}>
                  <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Add subject</Text>
                </Pressable>
              </View>

              {activeSubject ? (
                <View
                  onLayout={(event) => {
                    subjectEditorOffsetY.current = event.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.subjectEditor,
                    activeSubject.id === newSubjectId ? styles.subjectCardActive : null
                  ]}
                >
                  <View style={styles.subjectEditorHeader}>
                    <View style={styles.subjectLibraryCopy}>
                      <Text style={styles.kicker}>Editing subject {activeSubjectIndex + 1}</Text>
                      <Text style={styles.sectionTitle}>{activeSubject.name.trim() || "New subject"}</Text>
                      <Text style={styles.helper}>
                        {activeSubject.topics.length} topics, {getSubjectPageCount(activeSubject)} pages
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => removeSubject(activeSubject.id)}
                      style={styles.removeButton}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.warning} />
                    </Pressable>
                  </View>

                  <FormField
                    label="Subject name"
                    placeholder="Mathematics"
                    value={activeSubject.name}
                    onChangeText={(value) => updateSubject(activeSubject.id, value)}
                  />

                  <View style={styles.bulkTopicPanel}>
                    <View style={styles.sectionRow}>
                      <View style={styles.subjectLibraryCopy}>
                        <Text style={styles.fieldLabel}>Paste topics</Text>
                        <Text style={styles.helper}>One line per topic: Algebra, 18, Textbook</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => importBulkTopics(activeSubject.id)}
                        style={styles.secondaryButton}
                      >
                        <MaterialCommunityIcons name="tray-arrow-down" size={18} color={colors.brand} />
                        <Text style={styles.secondaryButtonText}>Import</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      multiline
                      onChangeText={setBulkTopicText}
                      placeholder={"Algebra, 18, Textbook\nGeometry, 20, Class notes"}
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.textArea]}
                      textAlignVertical="top"
                      value={bulkTopicText}
                    />
                  </View>

                  <View style={styles.topicTable}>
                    <View style={styles.topicTableHeader}>
                      <Text style={styles.fieldLabel}>Topics</Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => addTopic(activeSubject.id)}
                        style={styles.secondaryButton}
                      >
                        <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.brand} />
                        <Text style={styles.secondaryButtonText}>Add topic</Text>
                      </Pressable>
                    </View>

                    {activeSubject.topics.map((topic, topicIndex) => (
                      <View key={topic.id} style={styles.topicCompactRow}>
                        <View style={styles.topicCompactHeader}>
                          <Text style={styles.topicIndex}>{topicIndex + 1}</Text>
                          <View style={styles.topicNameInput}>
                            <TextInput
                              onChangeText={(value) => updateTopic(activeSubject.id, topic.id, "name", value)}
                              placeholder="Topic name"
                              placeholderTextColor={colors.muted}
                              style={styles.compactInput}
                              value={topic.name}
                            />
                          </View>
                          <View style={styles.topicPagesInput}>
                            <TextInput
                              keyboardType="number-pad"
                              onChangeText={(value) => updateTopic(activeSubject.id, topic.id, "pages", value)}
                              placeholder="Pages"
                              placeholderTextColor={colors.muted}
                              style={styles.compactInput}
                              value={topic.pages}
                            />
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => removeTopic(activeSubject.id, topic.id)}
                            style={styles.smallIconButton}
                          >
                            <MaterialCommunityIcons name="minus-circle-outline" size={20} color={colors.muted} />
                          </Pressable>
                        </View>
                        <MiniResourcePicker
                          selected={topic.resourceType}
                          onSelect={(value) => updateTopic(activeSubject.id, topic.id, "resourceType", value)}
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.subjectCardGrid}>
                {form.subjects.map((subject, subjectIndex) => {
                  const subjectPages = getSubjectPageCount(subject);
                  const subjectMinutes = subjectPages * Math.max(toNumber(form.minutesPerPage), 0);
                  const isActive = subject.id === activeSubject?.id;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={subject.id}
                      onPress={() => selectSubject(subject.id)}
                      style={[
                        styles.subjectSummaryCard,
                        isActive ? styles.subjectSummaryCardActive : null,
                        subject.id === newSubjectId ? styles.subjectCardActive : null
                      ]}
                    >
                      <View style={styles.subjectSummaryTop}>
                        <View style={styles.subjectSummaryIcon}>
                          <MaterialCommunityIcons name="book-open-page-variant-outline" size={20} color={colors.brand} />
                        </View>
                        <View style={styles.subjectLibraryCopy}>
                          <Text style={styles.subjectSummaryTitle}>
                            {subject.name.trim() || `Subject ${subjectIndex + 1}`}
                          </Text>
                          <Text style={styles.helper}>
                            {subject.topics.length} topics, {subjectPages} pages
                          </Text>
                        </View>
                      </View>
                      <View style={styles.subjectSummaryFooter}>
                        <Text style={styles.sessionMeta}>{subjectMinutes ? formatHours(subjectMinutes) : "Pace pending"}</Text>
                        <View style={styles.subjectStatusPill}>
                          <Text style={styles.subjectStatusText}>{isActive ? "Editing" : "Edit"}</Text>
                          <MaterialCommunityIcons name="chevron-right" size={14} color={colors.brand} />
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {currentStep === "Review" ? (
            <View style={styles.reviewGrid}>
              <ReviewItem
                label="Student"
                onEdit={() => goToStep(STEPS.indexOf("Profile"))}
                value={`${form.studentName} - ${form.classLevel}`}
              />
              <ReviewItem
                label="Exam window"
                onEdit={() => goToStep(STEPS.indexOf("Exam"))}
                value={`${formatReadableDate(form.examStartDate)} to ${formatReadableDate(form.examEndDate)}`}
              />
              <ReviewItem
                label="Daily study time"
                onEdit={() => goToStep(STEPS.indexOf("Exam"))}
                value={`${form.availableDailyMinutes} minutes`}
              />
              <ReviewItem
                label="Reading pace"
                onEdit={() => goToStep(STEPS.indexOf("Pace"))}
                value={`${form.minutesPerPage} minutes per page`}
              />
              <ReviewItem
                label="Subjects"
                onEdit={() => goToStep(STEPS.indexOf("Subjects"))}
                value={`${form.subjects.length}`}
              />
              <ReviewItem
                label="Topics"
                onEdit={() => goToStep(STEPS.indexOf("Subjects"))}
                value={`${topicCount}`}
              />
              <ReviewItem
                label="Total pages"
                onEdit={() => goToStep(STEPS.indexOf("Subjects"))}
                value={`${pageCount}`}
              />
              <ReviewItem label="Estimated reading time" value={formatHours(estimatedReadingMinutes)} />
            </View>
          ) : null}

          {error ? (
            <View style={styles.warningPanel}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} />
              <Text style={styles.warningText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.wizardActions}>
            <Pressable
              accessibilityRole="button"
              disabled={stepIndex === 0}
              onPress={goBack}
              style={[styles.secondaryButton, stepIndex === 0 ? styles.disabledButton : null]}
            >
              <MaterialCommunityIcons name="chevron-left" size={18} color={colors.brand} />
              <Text style={styles.secondaryButtonText}>Back</Text>
            </Pressable>

            {currentStep === "Review" ? (
              <Pressable
                accessibilityRole="button"
                disabled={isLoading}
                onPress={() => void submitPlan()}
                style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="calendar-refresh-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Generate</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={goNext} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Next</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

type GeneratedPlanViewProps = {
  plan: StudyPlanResponse;
  savedPlan: SavedStudyPlan | null;
  saveMessage: string;
  isDemoMode?: boolean;
  demoProgress?: StudyPlanProgress | null;
  demoWeeklyDigest?: WeeklyStudyDigest | null;
  demoReminderSettings?: StudyReminderSettings | null;
  onBack: () => void;
  onEdit: () => void;
  onPlanRebalanced: (plan: SavedStudyPlan) => void;
};

type FocusSessionItem = {
  studyDate: string;
  session: PlanSession;
  sessionIndex: number;
  sessionKeyValue: string;
  status: "overdue" | "today" | "next";
};

type RecoverySummary = {
  dailyExtraMinutes: number;
  overdueMinutes: number;
  overdueSessions: number;
  recoveryDays: number;
  targetDailyMinutes: number;
};

function GeneratedPlanView({
  plan,
  savedPlan,
  saveMessage,
  isDemoMode = false,
  demoProgress,
  demoWeeklyDigest,
  demoReminderSettings,
  onBack,
  onEdit,
  onPlanRebalanced
}: GeneratedPlanViewProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();
  const todayPlan = plan.schedule[0];
  const planId = savedPlan?.id;
  const [progress, setProgress] = useState<StudyPlanProgress | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyStudyDigest | null>(null);
  const [reminderSettings, setReminderSettings] = useState<StudyReminderSettings | null>(null);
  const [notificationReadiness, setNotificationReadiness] = useState<NotificationReadiness | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [activeCompletionKey, setActiveCompletionKey] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [completionConfidence, setCompletionConfidence] = useState(3);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [isReminderSaving, setIsReminderSaving] = useState(false);
  const [isNotificationTesting, setIsNotificationTesting] = useState(false);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const averageDailyMinutes =
    plan.metadata.average_daily_minutes ??
    Math.ceil(plan.metadata.total_study_minutes / Math.max(plan.metadata.days_until_exam, 1));
  const completedSessionKeys = useMemo(
    () => new Set(progress?.completed_session_keys ?? []),
    [progress?.completed_session_keys]
  );
  const completionBySessionKey = useMemo(
    () => new Map((progress?.completions ?? []).map((completion) => [completion.session_key, completion])),
    [progress?.completions]
  );
  const focusSessions = useMemo(() => getFocusSessions(plan, completedSessionKeys), [plan, completedSessionKeys]);
  const focusSessionKeys = useMemo(
    () => new Set(focusSessions.map((session) => session.sessionKeyValue)),
    [focusSessions]
  );
  const overdueFocusCount = focusSessions.filter((session) => session.status === "overdue").length;
  const recoverySummary = useMemo(
    () => getRecoverySummary(plan, completedSessionKeys, averageDailyMinutes, progress),
    [averageDailyMinutes, completedSessionKeys, plan, progress]
  );
  const todayProgress = progress?.daily.find((day) => day.study_date === todayPlan?.study_date);
  const completion = todayProgress?.completion_rate ?? 0;
  const completedTodayMinutes = todayProgress?.completed_minutes ?? 0;
  const plannedTodayMinutes = todayProgress?.planned_minutes ?? todayPlan?.total_minutes ?? 0;

  useEffect(() => {
    if (isDemoMode) {
      setProgress(demoProgress ?? null);
      setWeeklyDigest(demoWeeklyDigest ?? null);
      setReminderSettings(demoReminderSettings ?? null);
      setNotificationReadiness({
        canAskAgain: false,
        channelReady: true,
        granted: true,
        permissionStatus: "demo",
        platform: Platform.OS,
        scheduledCount: 3,
        scheduledStudyReminderCount: 3
      });
      setProgressMessage("");
      setReminderMessage("Demo reminders use sample data and will not send real notifications.");
      return;
    }

    if (!planId) {
      setProgress(null);
      setWeeklyDigest(null);
      setReminderSettings(null);
      setNotificationReadiness(null);
      return;
    }

    void refreshProgress(planId);
    void refreshReminderSettings(planId);
    void refreshNotificationReadiness(planId);
  }, [demoProgress, demoReminderSettings, demoWeeklyDigest, isDemoMode, planId]);

  async function refreshProgress(nextPlanId = planId) {
    if (!nextPlanId) {
      return;
    }

    setIsProgressLoading(true);
    try {
      const [nextProgress, nextDigest] = await Promise.all([
        getStudyPlanProgress(nextPlanId),
        getWeeklyStudyDigest(nextPlanId)
      ]);
      setProgress(nextProgress);
      setWeeklyDigest(nextDigest);
      setProgressMessage("");
    } catch {
      setProgressMessage("Progress tracking is unavailable until the API is running.");
    } finally {
      setIsProgressLoading(false);
    }
  }

  async function refreshReminderSettings(nextPlanId = planId) {
    if (!nextPlanId) {
      return;
    }

    try {
      const settings = await getStudyReminderSettings(nextPlanId);
      setReminderSettings(settings);
      setReminderMessage("");
    } catch {
      setReminderMessage("Reminder settings are unavailable until the API is running.");
    }
  }

  async function refreshNotificationReadiness(nextPlanId = planId) {
    try {
      const readiness = await getStudyReminderReadiness(nextPlanId);
      setNotificationReadiness(readiness);
    } catch {
      setNotificationReadiness(null);
    }
  }

  async function saveReminderSettings(nextSettings: StudyReminderSettings) {
    if (isDemoMode) {
      setReminderSettings(nextSettings);
      setReminderMessage("Demo reminder settings updated for this screenshot only.");
      return;
    }

    if (!planId || !savedPlan) {
      setReminderMessage("Save the generated plan before setting reminders.");
      return;
    }

    setIsReminderSaving(true);
    try {
      const updatedSettings = await updateStudyReminderSettings(planId, {
        reminders_enabled: nextSettings.reminders_enabled,
        reminder_time: nextSettings.reminder_time,
        reminder_minutes_before: nextSettings.reminder_minutes_before,
        missed_session_alerts_enabled: nextSettings.missed_session_alerts_enabled,
        missed_session_followup_time: nextSettings.missed_session_followup_time,
        parent_alerts_enabled: nextSettings.parent_alerts_enabled
      });
      setReminderSettings(updatedSettings);
      const result = await scheduleStudyReminders(savedPlan, updatedSettings);
      setReminderMessage(result.message);
      await refreshNotificationReadiness(planId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setReminderMessage(detail || "Could not save reminder settings.");
    } finally {
      setIsReminderSaving(false);
    }
  }

  function updateReminderTime(reminderTime: string) {
    if (!reminderSettings) {
      return;
    }

    void saveReminderSettings({ ...reminderSettings, reminders_enabled: true, reminder_time: reminderTime });
  }

  function toggleMissedSessionAlerts() {
    if (!reminderSettings) {
      return;
    }

    void saveReminderSettings({
      ...reminderSettings,
      missed_session_alerts_enabled: !reminderSettings.missed_session_alerts_enabled
    });
  }

  async function sendReminderTest() {
    if (isDemoMode) {
      setReminderMessage("Demo mode does not send real phone notifications.");
      return;
    }

    setIsNotificationTesting(true);
    setReminderMessage("");

    try {
      const result = await sendTestStudyNotification(planId);
      setReminderMessage(result.message);
      await refreshNotificationReadiness(planId);
    } catch {
      setReminderMessage("Could not send the test notification on this device.");
    } finally {
      setIsNotificationTesting(false);
    }
  }

  function openCompletion(sessionKeyValue: string, savedCompletion?: StudySessionCompletion) {
    setActiveCompletionKey(sessionKeyValue);
    setCompletionNote(savedCompletion?.recall_note ?? "");
    setCompletionConfidence(savedCompletion?.confidence ?? 3);
    setProgressMessage(
      savedCompletion
        ? "Update the reflection for this completed session."
        : "Write a quick recall note before marking the session done."
    );
  }

  async function markSessionDone(studyDate: string, session: PlanSession, sessionKeyValue: string) {
    if (isDemoMode) {
      setProgressMessage("Demo study proof is fixed for screenshots. Use a real account to save changes.");
      return;
    }

    if (!planId) {
      setProgressMessage("Save the generated plan before tracking progress.");
      return;
    }

    if (completionNote.trim().length < 10) {
      setProgressMessage("Add a short recall note with at least 10 characters.");
      return;
    }

    setIsSavingCompletion(true);
    try {
      await completeStudySession(planId, {
        session_key: sessionKeyValue,
        study_date: studyDate,
        kind: session.kind,
        subject: session.subject,
        topic: session.topic,
        resource_type: session.resource_type,
        minutes_planned: session.minutes,
        minutes_completed: session.minutes,
        recall_note: completionNote.trim(),
        confidence: completionConfidence
      });
      const isUpdate = completedSessionKeys.has(sessionKeyValue);
      setActiveCompletionKey("");
      setCompletionNote("");
      setProgressMessage(isUpdate ? "Study reflection updated." : "Session saved with a study reflection.");
      await refreshProgress(planId);
    } catch {
      setProgressMessage("Could not save this session. Check that the API is running.");
    } finally {
      setIsSavingCompletion(false);
    }
  }

  async function rebalancePlan() {
    if (isDemoMode) {
      setProgressMessage("Demo mode already includes a sample catch-up plan.");
      return;
    }

    if (!planId) {
      setProgressMessage("Save the generated plan before rebalancing missed sessions.");
      return;
    }

    setIsRebalancing(true);
    try {
      const rebalancedPlan = await rebalanceStudyPlan(planId);
      setActiveCompletionKey("");
      setCompletionNote("");
      setProgress(null);
      setProgressMessage("Plan rebalanced after missed sessions.");
      onPlanRebalanced(rebalancedPlan);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setProgressMessage(detail || "Could not rebalance this plan. Check that missed sessions exist.");
    } finally {
      setIsRebalancing(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
            <Text style={styles.backButtonText}>Setup</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onEdit} style={styles.secondaryButton}>
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.brand} />
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
        </View>

        {isDemoMode ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="camera-outline" size={20} color={colors.brand} />
            <Text style={styles.infoText}>Screenshot demo uses safe sample data. No real student record is shown.</Text>
          </View>
        ) : null}

        <View style={styles.generatedHero}>
          <View style={styles.visualHeroCopy}>
            <Text style={styles.kicker}>Generated plan</Text>
            <Text style={styles.title}>{plan.metadata.student_name}</Text>
            <Text style={styles.helper}>{plan.metadata.recommendation}</Text>
            {saveMessage ? <Text style={styles.saveStatus}>{saveMessage}</Text> : null}
          </View>
          <Image accessibilityIgnoresInvertColors source={brandAssets.generatedPlanHero} style={styles.dashboardArtwork} />
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Total reading"
            value={formatHours(plan.metadata.total_study_minutes)}
            icon="book-open-page-variant-outline"
          />
          <StatCard
            label="Needed daily"
            value={formatHours(averageDailyMinutes)}
            icon="clock-outline"
          />
          <StatCard label="Countdown" value={`${plan.metadata.days_until_exam}d`} icon="calendar-star" />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Hours breakdown</Text>
            <Text style={styles.metric}>{formatHours(averageDailyMinutes)}/day</Text>
          </View>
          <Text style={styles.helper}>
            {formatHours(plan.metadata.total_study_minutes)} total reading time divided across{" "}
            {plan.metadata.days_until_exam} days before the exam starts.
          </Text>
          <View style={styles.reviewGrid}>
            <ReviewItem label="Exam starts" value={formatReadableDate(plan.metadata.exam_start_date)} />
            <ReviewItem label="Exam ends" value={formatReadableDate(plan.metadata.exam_end_date ?? plan.metadata.exam_start_date)} />
            <ReviewItem label="Available daily" value={formatHours(plan.metadata.available_daily_minutes)} />
            <ReviewItem label="Current status" value={plan.metadata.status.replace("_", " ")} />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Subject distribution</Text>
          <View style={styles.distributionList}>
            {plan.subject_distribution.map((subject) => (
              <View key={subject.subject} style={styles.distributionItem}>
                <View style={styles.panelHeader}>
                  <Text style={styles.sessionTitle}>{subject.subject}</Text>
                  <Text style={styles.sessionMeta}>{formatHours(subject.estimated_minutes)}</Text>
                </View>
                <ProgressBar value={subject.percentage} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Today's timetable</Text>
            <Text style={styles.metric}>{completion}%</Text>
          </View>
          <ProgressBar value={completion} />
          <Text style={styles.helper}>
            {formatHours(completedTodayMinutes)} completed from {formatHours(plannedTodayMinutes)} planned today.
          </Text>
          {isProgressLoading ? <Text style={styles.sessionMeta}>Loading saved progress...</Text> : null}
          {progressMessage ? <Text style={styles.saveStatus}>{progressMessage}</Text> : null}
        </View>

        {weeklyDigest ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Weekly review</Text>
                <Text style={styles.sectionTitle}>{weeklyDigest.headline}</Text>
              </View>
              <Text style={styles.metric}>{Math.round(weeklyDigest.completion_rate)}%</Text>
            </View>
            <ProgressBar value={weeklyDigest.completion_rate} />
            <Text style={styles.helper}>{weeklyDigest.insight}</Text>
            <View style={styles.reviewGrid}>
              <ReviewItem label="Completed" value={`${weeklyDigest.completed_sessions}/${weeklyDigest.planned_sessions}`} />
              <ReviewItem label="Active days" value={`${weeklyDigest.active_days}`} />
              <ReviewItem label="Missed" value={`${weeklyDigest.missed_sessions}`} />
              <ReviewItem label="Streak" value={`${weeklyDigest.streak_days}d`} />
            </View>
            <View style={styles.infoPanel}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.brand} />
              <Text style={styles.infoText}>{weeklyDigest.next_action}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.sectionTitle}>Study reminders</Text>
              <Text style={styles.helper}>Set a gentle daily nudge on the phone running this app.</Text>
            </View>
            {isReminderSaving ? <ActivityIndicator color={colors.brand} /> : null}
          </View>
          {reminderSettings ? (
            <>
              <View style={styles.reminderGrid}>
                {REMINDER_TIME_OPTIONS.map((option) => {
                  const isSelected = reminderSettings.reminder_time === option.value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={isReminderSaving}
                      key={option.value}
                      onPress={() => updateReminderTime(option.value)}
                      style={[styles.reminderChip, isSelected ? styles.reminderChipActive : null]}
                    >
                      <Text style={[styles.reminderChipText, isSelected ? styles.reminderChipTextActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.sessionMeta, isSelected ? styles.reminderChipTextActive : null]}>
                        {formatReminderTime(option.value)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isReminderSaving}
                onPress={toggleMissedSessionAlerts}
                style={styles.reminderToggle}
              >
                <MaterialCommunityIcons
                  name={reminderSettings.missed_session_alerts_enabled ? "bell-check-outline" : "bell-off-outline"}
                  size={20}
                  color={reminderSettings.missed_session_alerts_enabled ? colors.success : colors.muted}
                />
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionTitle}>Missed-session nudge</Text>
                  <Text style={styles.helper}>
                    {reminderSettings.missed_session_alerts_enabled
                      ? `On at ${formatReminderTime(reminderSettings.missed_session_followup_time)}`
                      : "Off for this saved plan"}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.notificationGrid}>
                <ReviewItem
                  label="Permission"
                  value={notificationReadiness?.granted ? "Allowed" : "Needs approval"}
                />
                <ReviewItem
                  label="Scheduled"
                  value={`${notificationReadiness?.scheduledStudyReminderCount ?? 0}`}
                />
                <ReviewItem
                  label="Channel"
                  value={notificationReadiness?.channelReady ? "Ready" : Platform.OS === "web" ? "Phone only" : "Checking"}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isReminderSaving || isNotificationTesting}
                onPress={() => void sendReminderTest()}
                style={[styles.secondaryButton, isNotificationTesting ? styles.disabledButton : null]}
              >
                {isNotificationTesting ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="bell-ring-outline" size={18} color={colors.brand} />
                    <Text style={styles.secondaryButtonText}>Send test notification</Text>
                  </>
                )}
              </Pressable>
              {!reminderMessage ? (
                <Text style={styles.helper}>
                  Tap a time to activate reminders on this phone. Test notifications are best checked in a development
                  or closed-test build.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.helper}>Save the plan and keep the API running to activate study reminders.</Text>
          )}
          {reminderMessage ? <Text style={styles.saveStatus}>{reminderMessage}</Text> : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Catch-up plan</Text>
            <Text style={[styles.metric, recoverySummary.overdueMinutes ? styles.overdueText : null]}>
              {recoverySummary.overdueMinutes ? formatHours(recoverySummary.overdueMinutes) : "On pace"}
            </Text>
          </View>
          <Text style={styles.helper}>{recoveryCopy(recoverySummary, plan.metadata.available_daily_minutes)}</Text>
          <View style={styles.reviewGrid}>
            <ReviewItem label="Missed sessions" value={`${recoverySummary.overdueSessions}`} />
            <ReviewItem label="Catch-up days" value={`${recoverySummary.recoveryDays}`} />
            <ReviewItem label="Extra daily" value={formatHours(recoverySummary.dailyExtraMinutes)} />
            <ReviewItem label="New target" value={formatHours(recoverySummary.targetDailyMinutes)} />
          </View>
          {recoverySummary.overdueSessions ? (
            <Pressable
              accessibilityRole="button"
              disabled={isRebalancing || !planId}
              onPress={() => void rebalancePlan()}
              style={[styles.primaryButton, isRebalancing || !planId ? styles.disabledButton : null]}
            >
              {isRebalancing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="calendar-sync-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Rebalance plan</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Study focus queue</Text>
            <Text style={[styles.sessionKind, overdueFocusCount ? styles.overdueText : null]}>
              {overdueFocusCount ? `${overdueFocusCount} overdue` : "ready"}
            </Text>
          </View>
          <Text style={styles.helper}>
            Start with missed work, then finish today's sessions before moving ahead.
          </Text>
          {focusSessions.length ? (
            <View style={styles.focusList}>
              {focusSessions.map(({ studyDate, session, sessionIndex, sessionKeyValue, status }) => {
                const isActive = activeCompletionKey === sessionKeyValue;
                const savedCompletion = completionBySessionKey.get(sessionKeyValue);

                return (
                  <View key={sessionKeyValue} style={styles.focusBlock}>
                    <View style={[styles.focusItem, status === "overdue" ? styles.focusItemOverdue : null]}>
                      <View style={styles.sessionIcon}>
                        <MaterialCommunityIcons
                          name={status === "overdue" ? "alert-circle-outline" : sessionIcon(session.kind)}
                          size={22}
                          color={status === "overdue" ? colors.warning : colors.brand}
                        />
                      </View>
                      <View style={styles.sessionCopy}>
                        <Text style={styles.sessionTitle}>{sessionTitle(session, sessionIndex, plan.schedule.find((day) => day.study_date === studyDate)?.sessions ?? [])}</Text>
                        <Text style={styles.sessionMeta}>
                          {formatReadableDate(studyDate)} - {session.subject} - {session.minutes} minutes
                        </Text>
                      </View>
                      <View style={styles.sessionActions}>
                        <Text style={[styles.sessionKind, status === "overdue" ? styles.overdueText : null]}>
                          {focusStatusLabel(status)}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSavingCompletion || !planId}
                          onPress={() => openCompletion(sessionKeyValue, savedCompletion)}
                          style={[styles.sessionActionButton, !planId ? styles.disabledButton : null]}
                        >
                          <Text style={styles.sessionActionText}>Study</Text>
                        </Pressable>
                      </View>
                    </View>

                    {isActive ? (
                      <View style={styles.completionPanel}>
                        <Text style={styles.sessionTitle}>Quick recall check</Text>
                        <Text style={styles.helper}>
                          Write one thing you remember from this session before it counts as complete.
                        </Text>
                        <TextInput
                          multiline
                          onChangeText={setCompletionNote}
                          placeholder="Example: I can solve simultaneous equations by substitution."
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.textArea]}
                          textAlignVertical="top"
                          value={completionNote}
                        />
                        <View style={styles.panelHeader}>
                          <Text style={styles.sessionTitle}>Confidence after studying</Text>
                          <Text style={styles.sessionMeta}>1 unsure - 5 confident</Text>
                        </View>
                        <View style={styles.confidenceRow}>
                          {[1, 2, 3, 4, 5].map((score) => {
                            const isSelected = completionConfidence === score;
                            return (
                              <Pressable
                                accessibilityRole="button"
                                key={score}
                                onPress={() => setCompletionConfidence(score)}
                                style={[styles.confidenceChip, isSelected ? styles.confidenceChipActive : null]}
                              >
                                <Text
                                  style={[
                                    styles.confidenceText,
                                    isSelected ? styles.confidenceTextActive : null
                                  ]}
                                >
                                  {score}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={isSavingCompletion}
                          onPress={() => void markSessionDone(studyDate, session, sessionKeyValue)}
                          style={[styles.primaryButton, isSavingCompletion ? styles.disabledButton : null]}
                        >
                          {isSavingCompletion ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                              <Text style={styles.primaryButtonText}>Mark session done</Text>
                            </>
                          )}
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.helper}>Everything due is clear. Use the next flex window for light revision.</Text>
          )}
        </View>

        <View style={styles.sessionList}>
          <Text style={styles.sectionTitle}>Full timetable</Text>
          {plan.schedule.map((day) => (
            <View key={day.study_date} style={styles.dayCard}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.sessionTitle}>{formatReadableDate(day.study_date)}</Text>
                  <Text style={styles.sessionMeta}>
                    {day.sessions.length ? `${formatHours(day.total_minutes)} planned` : "Flexible study window"}
                  </Text>
                </View>
                <Text style={styles.sessionKind}>{day.sessions.length ? `${day.sessions.length} sessions` : "flex day"}</Text>
              </View>

              {day.sessions.length ? (
                day.sessions.map((session, index, sessions) => {
                  const currentSessionKey = sessionKey(day.study_date, index);
                  const isDone = completedSessionKeys.has(currentSessionKey);
                  const isActive = activeCompletionKey === currentSessionKey;
                  const savedCompletion = completionBySessionKey.get(currentSessionKey);

                  return (
                    <View key={`${day.study_date}-${session.subject}-${session.topic}-${index}`} style={styles.sessionBlock}>
                      <View style={[styles.sessionRow, isDone ? styles.sessionRowDone : null]}>
                        <View style={[styles.sessionIcon, isDone ? styles.sessionIconDone : null]}>
                          <MaterialCommunityIcons
                            name={isDone ? "check-circle-outline" : sessionIcon(session.kind)}
                            size={22}
                            color={isDone ? colors.success : colors.brand}
                          />
                        </View>
                        <View style={styles.sessionCopy}>
                          <Text style={styles.sessionTitle}>{sessionTitle(session, index, sessions)}</Text>
                          <Text style={styles.sessionMeta}>
                            {session.subject} - {session.resource_type} - {session.minutes} minutes
                          </Text>
                        </View>
                        <View style={styles.sessionActions}>
                          <Text style={styles.sessionKind}>{sessionKindLabel(session.kind)}</Text>
                          {isDone ? (
                            <>
                              <View style={[styles.sessionActionButton, styles.sessionDoneButton]}>
                                <Text style={[styles.sessionActionText, styles.sessionDoneText]}>Done</Text>
                              </View>
                              <Pressable
                                accessibilityRole="button"
                                disabled={isSavingCompletion || !planId || !savedCompletion}
                                onPress={() => openCompletion(currentSessionKey, savedCompletion)}
                                style={[styles.sessionActionButton, !planId || !savedCompletion ? styles.disabledButton : null]}
                              >
                                <Text style={styles.sessionActionText}>Edit reflection</Text>
                              </Pressable>
                            </>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              disabled={isSavingCompletion || !planId}
                              onPress={() => openCompletion(currentSessionKey)}
                              style={[styles.sessionActionButton, !planId ? styles.disabledButton : null]}
                            >
                              <Text style={styles.sessionActionText}>Study</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {isDone && savedCompletion && !isActive ? (
                        <View style={[styles.completionPanel, styles.completionPanelDone]}>
                          <View style={styles.panelHeader}>
                            <Text style={styles.sessionTitle}>Study reflection saved</Text>
                            <Pressable
                              accessibilityRole="button"
                              disabled={isSavingCompletion}
                              onPress={() => openCompletion(currentSessionKey, savedCompletion)}
                              style={styles.secondaryButton}
                            >
                              <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.brand} />
                              <Text style={styles.secondaryButtonText}>Edit reflection</Text>
                            </Pressable>
                          </View>
                          <Text style={styles.helper}>{savedCompletion.recall_note}</Text>
                          <Text style={styles.sessionMeta}>Confidence: {savedCompletion.confidence}/5</Text>
                        </View>
                      ) : null}

                      {isActive && !focusSessionKeys.has(currentSessionKey) ? (
                        <View style={styles.completionPanel}>
                          <Text style={styles.sessionTitle}>{isDone ? "Edit reflection" : "Quick recall check"}</Text>
                          <Text style={styles.helper}>
                            {isDone
                              ? "Update what the student remembered from this session."
                              : "Write one thing you remember from this session before it counts as complete."}
                          </Text>
                          <TextInput
                            multiline
                            onChangeText={setCompletionNote}
                            placeholder="Example: I can solve simultaneous equations by substitution."
                            placeholderTextColor={colors.muted}
                            style={[styles.input, styles.textArea]}
                            textAlignVertical="top"
                            value={completionNote}
                          />
                          <View style={styles.panelHeader}>
                            <Text style={styles.sessionTitle}>Confidence after studying</Text>
                            <Text style={styles.sessionMeta}>1 unsure - 5 confident</Text>
                          </View>
                          <View style={styles.confidenceRow}>
                            {[1, 2, 3, 4, 5].map((score) => {
                              const isSelected = completionConfidence === score;
                              return (
                                <Pressable
                                  accessibilityRole="button"
                                  key={score}
                                  onPress={() => setCompletionConfidence(score)}
                                  style={[styles.confidenceChip, isSelected ? styles.confidenceChipActive : null]}
                                >
                                  <Text
                                    style={[
                                      styles.confidenceText,
                                      isSelected ? styles.confidenceTextActive : null
                                    ]}
                                  >
                                    {score}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                          <Pressable
                            accessibilityRole="button"
                            disabled={isSavingCompletion}
                            onPress={() => void markSessionDone(day.study_date, session, currentSessionKey)}
                            style={[styles.primaryButton, isSavingCompletion ? styles.disabledButton : null]}
                          >
                            {isSavingCompletion ? (
                              <ActivityIndicator color="#FFFFFF" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
                                <Text style={styles.primaryButtonText}>
                                  {isDone ? "Save reflection" : "Mark session done"}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.helper}>A calm catch-up day for light revision, missed pages, or rest.</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
  placeholder?: string;
  multiline?: boolean;
};

function FormField({
  label,
  value,
  onChangeText,
  keyboardType = "default",
  placeholder,
  multiline = false
}: FormFieldProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === "default" ? "words" : "none"}
        keyboardType={keyboardType}
        multiline={multiline}
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder={isFocused ? "" : placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline ? styles.textArea : null]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
    </View>
  );
}

type CalendarFieldProps = {
  label: string;
  value: string;
  minDate: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
};

function CalendarField({ label, value, minDate, isOpen, onToggle, onSelect }: CalendarFieldProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.calendarButton}>
        <View>
          <Text style={styles.calendarValue}>{formatReadableDate(value)}</Text>
          <Text style={styles.sessionMeta}>{value}</Text>
        </View>
        <MaterialCommunityIcons name={isOpen ? "chevron-up" : "calendar-outline"} size={22} color={colors.brand} />
      </Pressable>
      {isOpen ? <CalendarPicker minDate={minDate} onSelect={onSelect} selectedDate={value} /> : null}
    </View>
  );
}

type CalendarPickerProps = {
  selectedDate: string;
  minDate: string;
  onSelect: (value: string) => void;
};

function CalendarPicker({ selectedDate, minDate, onSelect }: CalendarPickerProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(toLocalDate(selectedDate) ?? new Date()));
  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth]);

  return (
    <View style={styles.calendarPanel}>
      <View style={styles.calendarHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleMonth((current) => addMonths(current, -1))}
          style={styles.smallIconButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.calendarMonth}>{monthLabel(visibleMonth)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setVisibleMonth((current) => addMonths(current, 1))}
          style={styles.smallIconButton}
        >
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.calendarGrid}>
        {WEEKDAYS.map((day) => (
          <Text key={day} style={styles.weekdayText}>
            {day}
          </Text>
        ))}
        {days.map((day, index) => {
          if (!day) {
            return <View key={`blank-${index}`} style={styles.calendarDayBlank} />;
          }

          const value = toDateValue(day);
          const isSelected = value === selectedDate;
          const isDisabled = isBeforeDate(value, minDate);
          return (
            <Pressable
              accessibilityRole="button"
              disabled={isDisabled}
              key={value}
              onPress={() => onSelect(value)}
              style={[
                styles.calendarDay,
                isSelected ? styles.calendarDaySelected : null,
                isDisabled ? styles.calendarDayDisabled : null
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isSelected ? styles.calendarDaySelectedText : null,
                  isDisabled ? styles.calendarDayDisabledText : null
                ]}
              >
                {day.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ResourcePickerProps = {
  selected: string;
  onSelect: (value: string) => void;
};

function MiniResourcePicker({ selected, onSelect }: ResourcePickerProps) {
  const styles = useStudentStyles();

  return (
    <View style={styles.miniResourceGrid}>
      {RESOURCE_OPTIONS.map((resource) => {
        const isSelected = resource === selected;
        return (
          <Pressable
            accessibilityRole="button"
            key={resource}
            onPress={() => onSelect(resource)}
            style={[styles.miniResourceChip, isSelected ? styles.resourceChipActive : null]}
          >
            <Text style={[styles.miniResourceText, isSelected ? styles.resourceChipTextActive : null]}>
              {resource}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type ReviewItemProps = {
  label: string;
  value: string;
  onEdit?: () => void;
};

type SetupHeroProps = {
  completedStepCount: number;
  estimatedReadingMinutes: number;
  form: PlanForm;
  pageCount: number;
  topicCount: number;
};

function SetupHero({ completedStepCount, estimatedReadingMinutes, form, pageCount, topicCount }: SetupHeroProps) {
  const styles = useStudentStyles();
  const progressValue = Math.round((completedStepCount / STEPS.length) * 100);
  const studentName = form.studentName.trim() || "New study plan";

  return (
    <View style={styles.setupHero}>
      <View style={styles.setupHeroHeader}>
        <View style={styles.setupHeroCopy}>
          <Text style={styles.kicker}>Study blueprint</Text>
          <Text style={styles.title}>{studentName}</Text>
          <Text style={styles.helper}>
            {completedStepCount}/{STEPS.length} sections ready
          </Text>
        </View>
        <View style={styles.setupScorePill}>
          <Text style={styles.setupScoreText}>{progressValue}%</Text>
        </View>
      </View>

      <ProgressBar value={progressValue} />

      <View style={styles.setupMetricRow}>
        <View style={styles.setupMetric}>
          <Text style={styles.fieldLabel}>Topics</Text>
          <Text style={styles.setupMetricValue}>{topicCount}</Text>
        </View>
        <View style={styles.setupMetric}>
          <Text style={styles.fieldLabel}>Pages</Text>
          <Text style={styles.setupMetricValue}>{pageCount}</Text>
        </View>
        <View style={styles.setupMetric}>
          <Text style={styles.fieldLabel}>Reading</Text>
          <Text style={styles.setupMetricValue}>{formatHours(estimatedReadingMinutes)}</Text>
        </View>
      </View>
    </View>
  );
}

type PlanHistoryPanelProps = {
  activePlanId?: string;
  isLoading: boolean;
  plans: SavedStudyPlan[];
  onOpen: (plan: SavedStudyPlan) => void;
};

function PlanHistoryPanel({ activePlanId, isLoading, plans, onOpen }: PlanHistoryPanelProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();

  if (!isLoading && !plans.length) {
    return null;
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.latestCopy}>
          <Text style={styles.kicker}>Plan history</Text>
          <Text style={styles.sectionTitle}>Saved versions</Text>
        </View>
        {isLoading ? <ActivityIndicator color={colors.brand} /> : null}
      </View>
      <Text style={styles.helper}>Open a previous timetable without losing the current setup draft.</Text>
      <View style={styles.historyList}>
        {plans.map((planVersion) => {
          const isActive = planVersion.id === activePlanId;
          return (
            <View key={planVersion.id} style={[styles.historyCard, isActive ? styles.historyCardActive : null]}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>{formatReadableDate(planVersion.created_at.slice(0, 10))}</Text>
                <Text style={styles.sessionMeta}>
                  {formatHours(planVersion.plan.metadata.average_daily_minutes)} per day - Exam{" "}
                  {formatReadableDate(planVersion.plan.metadata.exam_start_date)}
                </Text>
              </View>
              <View style={styles.historyActionGroup}>
                {isActive ? <Text style={styles.historyBadge}>Open</Text> : null}
                <Pressable accessibilityRole="button" onPress={() => onOpen(planVersion)} style={styles.secondaryButton}>
                  <MaterialCommunityIcons name="folder-open-outline" size={16} color={colors.brand} />
                  <Text style={styles.secondaryButtonText}>{isActive ? "View" : "Open"}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ReviewItem({ label, value, onEdit }: ReviewItemProps) {
  const styles = useStudentStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.reviewItem}>
      <View style={styles.reviewItemHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {onEdit ? (
          <Pressable accessibilityRole="button" onPress={onEdit} style={styles.reviewEditButton}>
            <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.brand} />
            <Text style={styles.reviewEditText}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

type WizardProgressProps = {
  currentStep: number;
  form: PlanForm;
  onSelectStep: (index: number) => void;
};

function WizardProgress({ currentStep, form, onSelectStep }: WizardProgressProps) {
  const { colors } = useTheme();
  const styles = useStudentStyles();
  const completedStepCount = getCompletedStepCount(form);

  return (
    <View style={styles.progressPanel}>
      <View style={styles.progressPanelHeader}>
        <View>
          <Text style={styles.kicker}>Setup map</Text>
          <Text style={styles.sectionTitle}>{completedStepCount}/{STEPS.length} sections complete</Text>
        </View>
        <Text style={styles.progressPanelMeta}>{STEPS[currentStep]}</Text>
      </View>
      {STEPS.map((step, index) => {
        const detail = STEP_DETAILS[step];
        const isActive = index === currentStep;
        const isComplete = !getStepValidationError(step, form);
        const isDone = isComplete && !isActive;
        const canSelect = isActive || isComplete || hasStepDraft(step, form);
        const status = isActive ? "Editing" : isComplete ? "Complete" : canSelect ? "Started" : "Locked";
        const statusIcon = isDone ? "check" : canSelect ? "chevron-right" : "lock-outline";

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ disabled: !canSelect, selected: isActive }}
            disabled={!canSelect}
            key={step}
            onPress={() => onSelectStep(index)}
            style={[
              styles.progressStep,
              isActive ? styles.progressStepActive : null,
              isDone ? styles.progressStepDone : null,
              !canSelect ? styles.progressStepDisabled : null
            ]}
          >
            <View
              style={[
                styles.progressDot,
                isActive || isDone ? styles.progressDotActive : null,
                !canSelect ? styles.progressDotLocked : null
              ]}
            >
              <MaterialCommunityIcons
                name={isDone ? "check" : detail.icon}
                size={isDone ? 14 : 18}
                color={isActive || isDone ? "#FFFFFF" : colors.muted}
              />
            </View>
            <View style={styles.progressCopy}>
              <Text style={styles.progressEyebrow}>{detail.eyebrow}</Text>
              <Text
                style={[
                  styles.progressText,
                  isActive ? styles.progressTextActive : null,
                  isDone ? styles.progressTextDone : null,
                  !canSelect ? styles.progressTextLocked : null
                ]}
                numberOfLines={1}
              >
                {step}
              </Text>
            </View>
            <View style={[styles.progressStatusPill, isDone ? styles.progressStatusPillDone : null]}>
              <Text style={[styles.progressStatusText, isDone ? styles.progressStatusTextDone : null]}>
                {status}
              </Text>
              <MaterialCommunityIcons
                name={statusIcon}
                size={14}
                color={isDone ? colors.success : canSelect ? colors.brand : colors.muted}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function stepSubtitle(step: StepName) {
  switch (step) {
    case "Profile":
      return "These details will later become the student's login profile.";
    case "Exam":
      return "Choose the exam dates and the daily time the student can commit.";
    case "Pace":
      return "Capture how fast the student reads and what helps them study well.";
    case "Subjects":
      return "Add subjects, topics, page counts, and the resources being used.";
    case "Review":
      return "Check the summary, then generate the full timetable.";
  }
}

function getFirstValidationError(nextForm: PlanForm): ValidationResult | null {
  const requiredSteps: StepName[] = ["Profile", "Exam", "Pace", "Subjects"];

  for (const step of requiredSteps) {
    const message = getStepValidationError(step, nextForm);
    if (message) {
      return {
        message,
        stepIndex: STEPS.indexOf(step)
      };
    }
  }

  return null;
}

function getCompletedStepCount(nextForm: PlanForm) {
  return STEPS.filter((step) => !getStepValidationError(step, nextForm)).length;
}

function getStepValidationError(step: StepName, nextForm: PlanForm): string {
  switch (step) {
    case "Profile":
      if (!isValidPersonName(nextForm.studentName)) {
        return "Enter the student's full name before continuing.";
      }

      if (!isValidShortText(nextForm.classLevel)) {
        return "Enter a valid class, such as SS2 Science.";
      }

      if (!isIntegerInRange(nextForm.age, 3, 30)) {
        return "Enter a valid age between 3 and 30.";
      }

      if (!isValidPersonName(nextForm.parentName)) {
        return "Enter the parent or guardian's full name before continuing.";
      }

      if (!isValidParentContact(nextForm.parentContact)) {
        return "Enter a valid parent phone number or email address.";
      }

      return "";

    case "Exam":
      if (!isFutureDate(nextForm.examStartDate)) {
        return "Choose a future exam start date before continuing.";
      }

      if (!isValidDate(nextForm.examEndDate) || !isDateOnOrAfter(nextForm.examEndDate, nextForm.examStartDate)) {
        return "Choose an exam end date that is on or after the start date.";
      }

      if (!isIntegerInRange(nextForm.availableDailyMinutes, 30, 720)) {
        return "Enter daily study minutes between 30 and 720.";
      }

      return "";

    case "Pace":
      if (!isIntegerInRange(nextForm.minutesPerPage, 1, 30)) {
        return "Enter minutes per page between 1 and 30.";
      }

      if (!isIntegerInRange(nextForm.sessionMinutes, 20, 90)) {
        return "Enter study session minutes between 20 and 90.";
      }

      if (!isIntegerInRange(nextForm.breakMinutes, 5, 30)) {
        return "Enter break minutes between 5 and 30.";
      }

      if (containsBlockedStudyContent(nextForm.studyStrengthNote)) {
        return "Replace the study strength note with how the student studies.";
      }

      return "";

    case "Subjects":
      if (!nextForm.subjects.length) {
        return "Add at least one subject before continuing.";
      }

      for (let subjectIndex = 0; subjectIndex < nextForm.subjects.length; subjectIndex += 1) {
        const subject = nextForm.subjects[subjectIndex];

        if (!isValidShortText(subject.name)) {
          return `Enter the name for subject ${subjectIndex + 1}.`;
        }

        if (containsBlockedStudyContent(subject.name)) {
          return `Replace subject ${subjectIndex + 1} with a real subject name.`;
        }

        if (!subject.topics.length) {
          return `Add at least one topic under subject ${subjectIndex + 1}.`;
        }

        for (let topicIndex = 0; topicIndex < subject.topics.length; topicIndex += 1) {
          const topic = subject.topics[topicIndex];

          if (!isValidShortText(topic.name)) {
            return `Enter topic ${topicIndex + 1} under subject ${subjectIndex + 1}.`;
          }

          if (containsBlockedStudyContent(topic.name)) {
            return `Replace topic ${topicIndex + 1} under subject ${subjectIndex + 1} with a real topic name.`;
          }

          if (!isIntegerInRange(topic.pages, 1, 500)) {
            return `Enter pages between 1 and 500 for topic ${topicIndex + 1} under subject ${subjectIndex + 1}.`;
          }
        }
      }

      return "";

    case "Review": {
      const validation = getFirstValidationError(nextForm);
      return validation?.message ?? "";
    }
  }
}

function hasStepDraft(step: StepName, nextForm: PlanForm): boolean {
  switch (step) {
    case "Profile":
      return Boolean(
        nextForm.studentName.trim() ||
          nextForm.classLevel.trim() ||
          nextForm.age.trim() ||
          nextForm.parentName.trim() ||
          nextForm.parentContact.trim()
      );

    case "Exam":
      return Boolean(nextForm.availableDailyMinutes.trim());

    case "Pace":
      return Boolean(
        nextForm.minutesPerPage.trim() ||
          nextForm.sessionMinutes.trim() ||
          nextForm.breakMinutes.trim() ||
          nextForm.studyStrengthNote.trim()
      );

    case "Subjects":
      return nextForm.subjects.some(
        (subject) =>
          subject.name.trim() ||
          subject.topics.some((topic) => topic.name.trim() || topic.pages.trim())
      );

    case "Review":
      return !getFirstValidationError(nextForm);
  }
}

function isStudyPlanUsable(plan: StudyPlanResponse) {
  if (containsBlockedStudyContent(plan.metadata.study_strength_note)) {
    return false;
  }

  return plan.schedule.every((day) =>
    day.sessions.every(
      (session) =>
        !containsBlockedStudyContent(session.subject) &&
        !containsBlockedStudyContent(session.topic) &&
        !containsBlockedStudyContent(session.resource_type)
    )
  );
}

function containsBlockedStudyContent(value: string) {
  const normalized = value.trim().toLowerCase();
  return BLOCKED_STUDY_CONTENT_PHRASES.some((phrase) => normalized.includes(phrase));
}

async function savePlanFormDraft(studentId: string, nextForm: PlanForm) {
  const key = getPlanFormDraftKey(studentId);
  const serialized = JSON.stringify(nextForm);
  memoryPlanDrafts.set(key, nextForm);

  if (canUsePlanFormWebStorage()) {
    window.localStorage.setItem(key, serialized);
    return;
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(key, serialized);
    }
  } catch {
    // Keep the in-memory copy when device storage is temporarily unavailable.
  }
}

async function getStoredPlanFormDraft(studentId: string) {
  const key = getPlanFormDraftKey(studentId);

  if (canUsePlanFormWebStorage()) {
    return parsePlanFormDraft(window.localStorage.getItem(key));
  }

  try {
    if (await SecureStore.isAvailableAsync()) {
      return parsePlanFormDraft(await SecureStore.getItemAsync(key));
    }
  } catch {
    return memoryPlanDrafts.get(key) ?? null;
  }

  return memoryPlanDrafts.get(key) ?? null;
}

function getPlanFormDraftKey(studentId: string) {
  return `${PLAN_FORM_DRAFT_KEY_PREFIX}.${studentId}`;
}

function canUsePlanFormWebStorage() {
  return Platform.OS === "web" && typeof window !== "undefined" && Boolean(window.localStorage);
}

function parsePlanFormDraft(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return normalizePlanFormDraft(JSON.parse(value));
  } catch {
    return null;
  }
}

function normalizePlanFormDraft(value: unknown): PlanForm | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const draft = value as Partial<PlanForm>;
  const base = createDefaultForm();
  const subjects = Array.isArray(draft.subjects)
    ? draft.subjects.map(normalizeSubjectDraft).filter((subject): subject is SubjectForm => Boolean(subject))
    : base.subjects;

  return {
    studentName: textDraftValue(draft.studentName),
    classLevel: textDraftValue(draft.classLevel),
    age: textDraftValue(draft.age),
    parentName: textDraftValue(draft.parentName),
    parentContact: textDraftValue(draft.parentContact),
    examStartDate: textDraftValue(draft.examStartDate, base.examStartDate),
    examEndDate: textDraftValue(draft.examEndDate, base.examEndDate),
    availableDailyMinutes: textDraftValue(draft.availableDailyMinutes),
    minutesPerPage: textDraftValue(draft.minutesPerPage),
    sessionMinutes: textDraftValue(draft.sessionMinutes),
    breakMinutes: textDraftValue(draft.breakMinutes),
    studyStrengthNote: textDraftValue(draft.studyStrengthNote),
    subjects: subjects.length ? subjects : base.subjects
  };
}

function normalizeSubjectDraft(value: unknown): SubjectForm | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const subject = value as Partial<SubjectForm>;
  const topics = Array.isArray(subject.topics)
    ? subject.topics.map(normalizeTopicDraft).filter((topic): topic is TopicForm => Boolean(topic))
    : [];

  return {
    id: textDraftValue(subject.id, createId("subject")),
    name: textDraftValue(subject.name),
    topics: topics.length ? topics : [createTopic("", "", "Textbook")]
  };
}

function normalizeTopicDraft(value: unknown): TopicForm | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const topic = value as Partial<TopicForm>;
  const resourceType = textDraftValue(topic.resourceType, "Textbook");

  return {
    id: textDraftValue(topic.id, createId("topic")),
    name: textDraftValue(topic.name),
    pages: textDraftValue(topic.pages),
    priority: textDraftValue(topic.priority, "3"),
    resourceType: RESOURCE_OPTIONS.includes(resourceType) ? resourceType : "Textbook"
  };
}

function textDraftValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function createDefaultForm(): PlanForm {
  return {
    studentName: "",
    classLevel: "",
    age: "",
    parentName: "",
    parentContact: "",
    examStartDate: futureDate(30),
    examEndDate: futureDate(35),
    availableDailyMinutes: "",
    minutesPerPage: "",
    sessionMinutes: "",
    breakMinutes: "",
    studyStrengthNote: "",
    subjects: [createSubject("", [createTopic("", "", "Textbook")])]
  };
}

function createFormFromRequest(payload: StudyPlanRequest): PlanForm {
  return {
    studentName: payload.student_profile?.name ?? payload.student_name ?? "",
    classLevel: payload.student_profile?.class_level ?? "",
    age: payload.student_profile?.age ? `${payload.student_profile.age}` : "",
    parentName: payload.student_profile?.parent_name ?? "",
    parentContact: payload.student_profile?.parent_contact ?? "",
    examStartDate: payload.exam_start_date || payload.exam_date || futureDate(30),
    examEndDate: payload.exam_end_date || payload.exam_start_date || payload.exam_date || futureDate(35),
    availableDailyMinutes: `${payload.available_daily_minutes}`,
    minutesPerPage: `${payload.minutes_per_page}`,
    sessionMinutes: `${payload.session_minutes}`,
    breakMinutes: `${payload.break_minutes}`,
    studyStrengthNote: payload.study_strength_note ?? "",
    subjects: payload.subjects.length
      ? payload.subjects.map((subject) =>
          createSubject(
            subject.name,
            subject.topics.map((topic) => ({
              id: createId("topic"),
              name: topic.name,
              pages: `${topic.pages}`,
              priority: `${topic.priority}`,
              resourceType: topic.resource_type || "Textbook"
            }))
          )
        )
      : [createSubject("", [createTopic("", "", "Textbook")])]
  };
}

function createSubject(name: string, topics: TopicForm[]): SubjectForm {
  return {
    id: createId("subject"),
    name,
    topics
  };
}

function createTopic(name: string, pages: string, resourceType: string): TopicForm {
  return {
    id: createId("topic"),
    name,
    pages,
    priority: "3",
    resourceType
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSubjectPageCount(subject: SubjectForm) {
  return subject.topics.reduce((total, topic) => total + toNumber(topic.pages), 0);
}

function shouldReplaceStarterTopic(topics: TopicForm[]) {
  return topics.length === 1 && !topics[0]?.name.trim() && !topics[0]?.pages.trim();
}

function parseBulkTopics(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/[,\t|;]/)
        .map((part) => part.trim())
        .filter(Boolean);
      const name = parts[0] ?? "";
      const pages = parts.find((part, index) => index > 0 && isWholeNumber(part)) ?? "";
      const resourceCandidate = parts.find(
        (part, index) => index > 0 && !isWholeNumber(part) && normalizeResourceType(part) !== "Textbook"
      );

      return createTopic(name, pages, normalizeResourceType(resourceCandidate ?? parts[2] ?? "Textbook"));
    })
    .filter((topic) => topic.name.trim());
}

function normalizeResourceType(value: string) {
  const normalized = value.trim().toLowerCase();
  return RESOURCE_OPTIONS.find((resource) => resource.toLowerCase() === normalized) ?? "Textbook";
}

function futureDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return toDateValue(date);
}

function toNumber(value: string) {
  if (!isWholeNumber(value)) {
    return 0;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWholeNumber(value: string) {
  return /^\d+$/.test(value.trim());
}

function isIntegerInRange(value: string, min: number, max: number) {
  if (!isWholeNumber(value)) {
    return false;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return parsed >= min && parsed <= max;
}

function isValidShortText(value: string) {
  const normalized = value.trim();
  return normalized.length >= 2 && /[a-zA-Z0-9]/.test(normalized);
}

function isValidPersonName(value: string) {
  const normalized = value.trim();
  return normalized.length >= 2 && /[a-zA-Z]/.test(normalized) && /^[a-zA-Z\s'.-]+$/.test(normalized);
}

function isValidParentContact(value: string) {
  const normalized = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(normalized)) {
    return true;
  }

  if (!/^[+\d\s()-]+$/.test(normalized)) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isValidDate(value: string) {
  return toLocalDate(value) !== null;
}

function isFutureDate(value: string) {
  const parsed = toLocalDate(value);
  if (!parsed) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed > today;
}

function isDateOnOrAfter(value: string, comparison: string) {
  const parsed = toLocalDate(value);
  const comparisonDate = toLocalDate(comparison);
  if (!parsed || !comparisonDate) {
    return false;
  }

  return parsed >= comparisonDate;
}

function isBeforeDate(value: string, comparison: string) {
  const parsed = toLocalDate(value);
  const comparisonDate = toLocalDate(comparison);
  if (!parsed || !comparisonDate) {
    return false;
  }

  return parsed < comparisonDate;
}

function toLocalDate(value: string) {
  const parts = value.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days: Array<Date | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatReadableDate(value: string) {
  const date = toLocalDate(value);
  if (!date) {
    return value;
  }

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatReminderTime(value: string) {
  const [hourValue, minuteValue] = value.split(":").map(Number);
  if (!Number.isFinite(hourValue) || !Number.isFinite(minuteValue)) {
    return value;
  }

  const date = new Date();
  date.setHours(hourValue, minuteValue, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatInviteExpiry(value: string) {
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) {
    return "soon";
  }

  return expiry.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function isSessionExpiredError(error: unknown) {
  return error instanceof Error && error.message.includes("sign-in session expired");
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  const formatted = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${formatted}h`;
}

function sessionIcon(kind: PlanSession["kind"]): keyof typeof MaterialCommunityIcons.glyphMap {
  if (kind === "revision") {
    return "repeat-variant";
  }

  if (kind === "practice") {
    return "clipboard-text-outline";
  }

  return "book-open-page-variant-outline";
}

function sessionKindLabel(kind: PlanSession["kind"]) {
  if (kind === "practice") {
    return "practice";
  }

  return kind;
}

function sessionKey(studyDate: string, index: number) {
  return `${studyDate}:${index}`;
}

function getFocusSessions(plan: StudyPlanResponse, completedSessionKeys: Set<string>): FocusSessionItem[] {
  const today = toDateValue(new Date());
  const dueSessions: FocusSessionItem[] = [];
  const upcomingSessions: FocusSessionItem[] = [];

  plan.schedule.forEach((day) => {
    day.sessions.forEach((session, index) => {
      const sessionKeyValue = sessionKey(day.study_date, index);
      if (completedSessionKeys.has(sessionKeyValue)) {
        return;
      }

      const item: FocusSessionItem = {
        studyDate: day.study_date,
        session,
        sessionIndex: index,
        sessionKeyValue,
        status: day.study_date < today ? "overdue" : day.study_date === today ? "today" : "next"
      };

      if (day.study_date <= today) {
        dueSessions.push(item);
      } else {
        upcomingSessions.push(item);
      }
    });
  });

  return [...dueSessions, ...upcomingSessions].slice(0, 3);
}

function getRecoverySummary(
  plan: StudyPlanResponse,
  completedSessionKeys: Set<string>,
  averageDailyMinutes: number,
  progress: StudyPlanProgress | null
): RecoverySummary {
  const today = toDateValue(new Date());
  let overdueMinutes = progress?.missed_minutes ?? 0;
  let overdueSessions = progress?.missed_sessions_count ?? 0;

  if (!progress) {
    plan.schedule.forEach((day) => {
      if (day.study_date >= today) {
        return;
      }

      day.sessions.forEach((session, index) => {
        if (completedSessionKeys.has(sessionKey(day.study_date, index))) {
          return;
        }

        overdueMinutes += session.minutes;
        overdueSessions += 1;
      });
    });
  }

  const recoveryDays = Math.max(1, plan.schedule.filter((day) => day.study_date >= today).length);
  const dailyExtraMinutes = overdueMinutes ? Math.ceil(overdueMinutes / recoveryDays) : 0;

  return {
    dailyExtraMinutes,
    overdueMinutes,
    overdueSessions,
    recoveryDays,
    targetDailyMinutes: averageDailyMinutes + dailyExtraMinutes
  };
}

function recoveryCopy(summary: RecoverySummary, availableDailyMinutes: number) {
  if (!summary.overdueMinutes) {
    return "No catch-up debt right now. Keep today's focus queue clear and protect the revision rhythm.";
  }

  if (summary.targetDailyMinutes > availableDailyMinutes) {
    return `Add about ${formatHours(summary.dailyExtraMinutes)} daily to recover missed work. This is above the current available time, so reduce distractions or extend study time temporarily.`;
  }

  return `Add about ${formatHours(summary.dailyExtraMinutes)} daily for ${summary.recoveryDays} days to recover missed work without rebuilding the whole plan.`;
}

function focusStatusLabel(status: FocusSessionItem["status"]) {
  if (status === "overdue") {
    return "missed";
  }

  if (status === "today") {
    return "today";
  }

  return "next";
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function sessionTitle(session: PlanSession, index: number, sessions: PlanSession[]) {
  const matchingSessions = sessions.filter(
    (entry) => entry.kind === session.kind && entry.subject === session.subject && entry.topic === session.topic
  );
  if (matchingSessions.length <= 1) {
    return session.topic;
  }

  const part = sessions
    .slice(0, index + 1)
    .filter(
      (entry) => entry.kind === session.kind && entry.subject === session.subject && entry.topic === session.topic
    ).length;

  return `${session.topic} - Part ${part}`;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  addTopicButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  backButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44
  },
  backButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  calendarButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  calendarDay: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: "14.285%"
  },
  calendarDayBlank: {
    height: 40,
    width: "14.285%"
  },
  calendarDayDisabled: {
    opacity: 0.35
  },
  calendarDayDisabledText: {
    color: colors.muted
  },
  calendarDaySelected: {
    backgroundColor: colors.brand
  },
  calendarDaySelectedText: {
    color: "#FFFFFF"
  },
  calendarDayText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: spacing.xs
  },
  calendarHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  calendarMonth: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  calendarPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  calendarValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
  },
  completionPanel: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  completionPanelDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  confidenceChip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 44
  },
  confidenceChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  confidenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  confidenceText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  confidenceTextActive: {
    color: "#FFFFFF"
  },
  dayCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  dangerButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md
  },
  dangerButtonText: {
    color: colors.warningDark,
    fontSize: 14,
    fontWeight: "900"
  },
  disabledButton: {
    opacity: 0.55
  },
  distributionItem: {
    gap: spacing.sm
  },
  distributionList: {
    gap: spacing.md
  },
  dashboardArtwork: {
    borderRadius: 8,
    height: 132,
    width: 132
  },
  field: {
    gap: spacing.xs,
    width: "100%"
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  formStack: {
    gap: spacing.md
  },
  focusBlock: {
    gap: spacing.sm
  },
  focusItem: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  focusItemOverdue: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder
  },
  focusList: {
    gap: spacing.sm
  },
  generatedHero: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    padding: spacing.lg
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  accountButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "900"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end"
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  historyActionGroup: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  historyBadge: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  historyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md
  },
  historyCardActive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  historyCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180
  },
  historyList: {
    gap: spacing.sm
  },
  historyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%"
  },
  infoPanel: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  infoText: {
    color: colors.brandDark,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  inviteCode: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0
  },
  inviteCodeCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  metric: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: "800"
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  overdueText: {
    color: colors.warningDark
  },
  latestCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  progressDot: {
    alignItems: "center",
    backgroundColor: colors.border,
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  progressDotActive: {
    backgroundColor: colors.brand
  },
  progressDotLocked: {
    backgroundColor: colors.surface
  },
  progressPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  progressPanelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  progressPanelMeta: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "900"
  },
  progressStep: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 74,
    padding: spacing.md
  },
  progressStepActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  progressStepDone: {
    borderColor: colors.success
  },
  progressStepDisabled: {
    opacity: 0.58
  },
  progressCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  progressEyebrow: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  progressText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  progressTextActive: {
    color: colors.brand
  },
  progressTextDone: {
    color: colors.text
  },
  progressTextLocked: {
    color: colors.muted
  },
  progressStatusPill: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 32,
    paddingHorizontal: spacing.sm
  },
  progressStatusPillDone: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  progressStatusText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  progressStatusTextDone: {
    color: colors.success
  },
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  reminderChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  reminderChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  reminderChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  reminderChipTextActive: {
    color: colors.brand
  },
  reminderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  notificationGrid: {
    gap: spacing.sm
  },
  reminderToggle: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  resourceBlock: {
    gap: spacing.xs
  },
  resourceChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  resourceChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  resourceChipText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700"
  },
  resourceChipTextActive: {
    color: colors.brand
  },
  resourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  reviewGrid: {
    gap: spacing.sm
  },
  reviewEditButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm
  },
  reviewEditText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "900"
  },
  reviewItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  reviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  reviewValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  saveStatus: {
    color: colors.success,
    fontSize: 14,
    fontWeight: "800"
  },
  setupHero: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  setupHeroCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 190
  },
  setupHeroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  setupMetric: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 92,
    padding: spacing.md
  },
  setupMetricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  setupMetricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  setupScorePill: {
    alignItems: "center",
    backgroundColor: colors.secondarySoft,
    borderColor: colors.secondary,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 46,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  setupScoreText: {
    color: colors.secondaryDark,
    fontSize: 16,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800"
  },
  sectionRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  sessionActionButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.sm
  },
  sessionActionText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "800"
  },
  sessionActions: {
    alignItems: "flex-end",
    gap: spacing.xs
  },
  sessionBlock: {
    gap: spacing.sm
  },
  sessionCopy: {
    flex: 1,
    gap: 2
  },
  sessionIcon: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  sessionIconDone: {
    backgroundColor: colors.successSoft
  },
  sessionKind: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  sessionList: {
    gap: spacing.sm
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: 13
  },
  sessionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  sessionRowDone: {
    borderColor: colors.success,
    backgroundColor: colors.successSoft
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  sessionDoneButton: {
    backgroundColor: colors.success
  },
  sessionDoneText: {
    color: "#FFFFFF"
  },
  smallIconButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  studentChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  studentChipMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  studentChipSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  studentChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  studentChipTextSelected: {
    color: colors.brand
  },
  studentPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 54
  },
  stepBadgeText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "900"
  },
  stepCopy: {
    flex: 1,
    gap: spacing.xs
  },
  stepHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  stepArtwork: {
    alignSelf: "center",
    borderRadius: 8,
    height: 180,
    maxWidth: 420,
    width: "100%"
  },
  subjectCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  subjectCardActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  subjectHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm
  },
  subjectList: {
    gap: spacing.md
  },
  subjectLibraryHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  subjectLibraryCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180
  },
  subjectEditor: {
    backgroundColor: colors.panel,
    borderColor: colors.brand,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  subjectEditorHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  bulkTopicPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  topicTable: {
    gap: spacing.sm
  },
  topicTableHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  topicCompactRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm
  },
  topicCompactHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  topicIndex: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
    width: 24
  },
  topicNameInput: {
    flex: 1,
    minWidth: 120
  },
  topicPagesInput: {
    width: 84
  },
  compactInput: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: spacing.sm
  },
  miniResourceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingLeft: 32
  },
  miniResourceChip: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    justifyContent: "center"
  },
  miniResourceText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  subjectCardGrid: {
    gap: spacing.sm
  },
  subjectSummaryCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  subjectSummaryCardActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  subjectSummaryTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  subjectSummaryIcon: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  subjectSummaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  subjectSummaryFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  subjectStatusPill: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 30,
    paddingHorizontal: spacing.sm
  },
  subjectStatusText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "900"
  },
  subjectNameField: {
    flex: 1
  },
  textArea: {
    minHeight: 92
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  visualHeroCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 220
  },
  topicCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  topicHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  topicTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  warningPanel: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  warningText: {
    color: colors.warningDark,
    flex: 1,
    fontSize: 14,
    lineHeight: 20
  },
  weekdayText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    width: "14.285%"
  },
  wizardActions: {
    flexDirection: "row",
    justifyContent: "space-between"
  }
});
}
