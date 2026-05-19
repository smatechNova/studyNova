import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps
} from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import {
  completeStudySession,
  generateStudyPlan,
  getLatestFamilyAccount,
  getLatestStudyPlan,
  getStudyPlanProgress,
  saveStudyPlan
} from "@/lib/api";
import type { PlanSession, SavedStudyPlan, StudyPlanProgress, StudyPlanRequest, StudyPlanResponse } from "@/types";
import { colors, spacing } from "@/theme";

const RESOURCE_OPTIONS = ["Textbook", "Class notes", "Notebook", "Online notes", "Past questions"];
const STEPS = ["Profile", "Exam", "Pace", "Subjects", "Review"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type StepName = (typeof STEPS)[number];
type DateFieldName = "examStartDate" | "examEndDate";

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

export default function StudentScreen() {
  const [form, setForm] = useState<PlanForm>(() => createDefaultForm());
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedStudyPlan | null>(null);
  const [latestPlan, setLatestPlan] = useState<SavedStudyPlan | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [latestMessage, setLatestMessage] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [activeCalendar, setActiveCalendar] = useState<DateFieldName | null>(null);
  const [isPlanVisible, setIsPlanVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const currentStep = STEPS[stepIndex];
  const topicCount = form.subjects.reduce((total, subject) => total + subject.topics.length, 0);
  const pageCount = form.subjects.reduce(
    (total, subject) => total + subject.topics.reduce((sum, topic) => sum + toNumber(topic.pages), 0),
    0
  );
  const estimatedReadingMinutes = pageCount * clamp(toNumber(form.minutesPerPage), 1, 30);

  useEffect(() => {
    let isMounted = true;

    async function loadAccountAndPlan() {
      try {
        const latestFamily = await getLatestFamilyAccount();
        if (isMounted && latestFamily.student && latestFamily.parent) {
          setForm((current) => ({
            ...current,
            studentName: current.studentName || latestFamily.student?.name || "",
            classLevel: current.classLevel || latestFamily.student?.class_level || "",
            age: current.age || `${latestFamily.student?.age ?? ""}`,
            parentName: current.parentName || latestFamily.parent?.name || "",
            parentContact: current.parentContact || latestFamily.parent?.contact || ""
          }));
        }
      } catch {
        // Account setup is optional during early development.
      }

      try {
        const saved = await getLatestStudyPlan();
        if (isMounted) {
          setLatestPlan(saved);
          setLatestMessage("");
        }
      } catch {
        if (isMounted) {
          setLatestMessage("No saved plan yet.");
        }
      }
    }

    void loadAccountAndPlan();

    return () => {
      isMounted = false;
    };
  }, []);

  async function submitPlan(nextForm = form) {
    const request = buildRequest(nextForm);
    if (!request) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await generateStudyPlan(request);
      setPlan(response);
      setSavedPlan(null);
      setSaveMessage("Saving generated plan...");
      try {
        const saved = await saveStudyPlan(response);
        setSavedPlan(saved);
        setLatestPlan(saved);
        setSaveMessage("Plan saved. You can continue from here later.");
      } catch {
        setSaveMessage("Generated, but saving is unavailable right now.");
      }
      setIsPlanVisible(true);
      setStepIndex(STEPS.length - 1);
    } catch {
      setError("Could not generate the plan. Check the API connection and exam dates.");
    } finally {
      setIsLoading(false);
    }
  }

  function continueLatestPlan() {
    if (!latestPlan) {
      return;
    }

    setPlan(latestPlan.plan);
    setSavedPlan(latestPlan);
    setSaveMessage("Loaded latest saved plan.");
    setIsPlanVisible(true);
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
    setError("");
    setForm((current) => ({
      ...current,
      subjects: [...current.subjects, createSubject("", [createTopic("", "", "Textbook")])]
    }));
  }

  function removeSubject(subjectId: string) {
    setForm((current) => ({
      ...current,
      subjects:
        current.subjects.length > 1
          ? current.subjects.filter((subject) => subject.id !== subjectId)
          : current.subjects
    }));
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

  if (isPlanVisible && plan) {
    return (
      <GeneratedPlanView
        onBack={() => setIsPlanVisible(false)}
        onEdit={() => {
          setIsPlanVisible(false);
          setStepIndex(STEPS.length - 1);
        }}
        plan={plan}
        savedPlan={savedPlan}
        saveMessage={saveMessage}
      />
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Guided setup</Text>
            <Text style={styles.title}>Student plan</Text>
          </View>
          <Pressable style={styles.iconButton} accessibilityRole="button">
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
          </Pressable>
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

        <WizardProgress currentStep={stepIndex} />

        <View style={styles.panel}>
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
            <View style={styles.subjectList}>
              <View style={styles.sectionRow}>
                <Text style={styles.helper}>
                  {form.subjects.length} subjects, {topicCount} topics, {pageCount} pages
                </Text>
                <Pressable accessibilityRole="button" onPress={addSubject} style={styles.secondaryButton}>
                  <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
                  <Text style={styles.secondaryButtonText}>Subject</Text>
                </Pressable>
              </View>

              {form.subjects.map((subject, subjectIndex) => (
                <View key={subject.id} style={styles.subjectCard}>
                  <View style={styles.subjectHeader}>
                    <View style={styles.subjectNameField}>
                      <FormField
                        label={`Subject ${subjectIndex + 1}`}
                        placeholder="Mathematics"
                        value={subject.name}
                        onChangeText={(value) => updateSubject(subject.id, value)}
                      />
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => removeSubject(subject.id)}
                      style={styles.removeButton}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.warning} />
                    </Pressable>
                  </View>

                  {subject.topics.map((topic, topicIndex) => (
                    <View key={topic.id} style={styles.topicCard}>
                      <View style={styles.topicHeader}>
                        <Text style={styles.topicTitle}>Topic {topicIndex + 1}</Text>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => removeTopic(subject.id, topic.id)}
                          style={styles.smallIconButton}
                        >
                          <MaterialCommunityIcons name="minus-circle-outline" size={20} color={colors.muted} />
                        </Pressable>
                      </View>
                      <FormField
                        label="Topic name"
                        placeholder="Algebra"
                        value={topic.name}
                        onChangeText={(value) => updateTopic(subject.id, topic.id, "name", value)}
                      />
                      <FormField
                        keyboardType="number-pad"
                        label="Pages in this topic"
                        placeholder="25"
                        value={topic.pages}
                        onChangeText={(value) => updateTopic(subject.id, topic.id, "pages", value)}
                      />
                      <ResourcePicker
                        selected={topic.resourceType}
                        onSelect={(value) => updateTopic(subject.id, topic.id, "resourceType", value)}
                      />
                    </View>
                  ))}

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => addTopic(subject.id)}
                    style={styles.addTopicButton}
                  >
                    <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.brand} />
                    <Text style={styles.secondaryButtonText}>Add topic</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {currentStep === "Review" ? (
            <View style={styles.reviewGrid}>
              <ReviewItem label="Student" value={`${form.studentName} - ${form.classLevel}`} />
              <ReviewItem label="Exam window" value={`${formatReadableDate(form.examStartDate)} to ${formatReadableDate(form.examEndDate)}`} />
              <ReviewItem label="Daily study time" value={`${form.availableDailyMinutes} minutes`} />
              <ReviewItem label="Reading pace" value={`${form.minutesPerPage} minutes per page`} />
              <ReviewItem label="Subjects" value={`${form.subjects.length}`} />
              <ReviewItem label="Topics" value={`${topicCount}`} />
              <ReviewItem label="Total pages" value={`${pageCount}`} />
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
  onBack: () => void;
  onEdit: () => void;
};

function GeneratedPlanView({ plan, savedPlan, saveMessage, onBack, onEdit }: GeneratedPlanViewProps) {
  const todayPlan = plan.schedule[0];
  const planId = savedPlan?.id;
  const [progress, setProgress] = useState<StudyPlanProgress | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
  const [activeCompletionKey, setActiveCompletionKey] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [completionConfidence, setCompletionConfidence] = useState(3);
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const [isSavingCompletion, setIsSavingCompletion] = useState(false);
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
  const todayProgress = progress?.daily.find((day) => day.study_date === todayPlan?.study_date);
  const completion = todayProgress?.completion_rate ?? 0;
  const completedTodayMinutes = todayProgress?.completed_minutes ?? 0;
  const plannedTodayMinutes = todayProgress?.planned_minutes ?? todayPlan?.total_minutes ?? 0;

  useEffect(() => {
    if (!planId) {
      setProgress(null);
      return;
    }

    void refreshProgress(planId);
  }, [planId]);

  async function refreshProgress(nextPlanId = planId) {
    if (!nextPlanId) {
      return;
    }

    setIsProgressLoading(true);
    try {
      const nextProgress = await getStudyPlanProgress(nextPlanId);
      setProgress(nextProgress);
      setProgressMessage("");
    } catch {
      setProgressMessage("Progress tracking is unavailable until the API is running.");
    } finally {
      setIsProgressLoading(false);
    }
  }

  function openCompletion(sessionKeyValue: string) {
    setActiveCompletionKey(sessionKeyValue);
    setCompletionNote("");
    setCompletionConfidence(3);
    setProgressMessage("Write a quick recall note before marking the session done.");
  }

  async function markSessionDone(studyDate: string, session: PlanSession, sessionKeyValue: string) {
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
      setActiveCompletionKey("");
      setCompletionNote("");
      setProgressMessage("Session saved with a recall note.");
      await refreshProgress(planId);
    } catch {
      setProgressMessage("Could not save this session. Check that the API is running.");
    } finally {
      setIsSavingCompletion(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
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

        <View style={styles.generatedHero}>
          <Text style={styles.kicker}>Generated plan</Text>
          <Text style={styles.title}>{plan.metadata.student_name}</Text>
          <Text style={styles.helper}>{plan.metadata.recommendation}</Text>
          {saveMessage ? <Text style={styles.saveStatus}>{saveMessage}</Text> : null}
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
                            <View style={[styles.sessionActionButton, styles.sessionDoneButton]}>
                              <Text style={[styles.sessionActionText, styles.sessionDoneText]}>Done</Text>
                            </View>
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

                      {isDone && savedCompletion ? (
                        <View style={[styles.completionPanel, styles.completionPanelDone]}>
                          <Text style={styles.sessionTitle}>Study proof saved</Text>
                          <Text style={styles.helper}>{savedCompletion.recall_note}</Text>
                          <Text style={styles.sessionMeta}>Confidence: {savedCompletion.confidence}/5</Text>
                        </View>
                      ) : null}

                      {isActive && !isDone ? (
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
                            onPress={() => void markSessionDone(day.study_date, session, currentSessionKey)}
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

function ResourcePicker({ selected, onSelect }: ResourcePickerProps) {
  return (
    <View style={styles.resourceBlock}>
      <Text style={styles.fieldLabel}>Study resource</Text>
      <View style={styles.resourceGrid}>
        {RESOURCE_OPTIONS.map((resource) => {
          const isSelected = resource === selected;
          return (
            <Pressable
              accessibilityRole="button"
              key={resource}
              onPress={() => onSelect(resource)}
              style={[styles.resourceChip, isSelected ? styles.resourceChipActive : null]}
            >
              <Text style={[styles.resourceChipText, isSelected ? styles.resourceChipTextActive : null]}>
                {resource}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type ReviewItemProps = {
  label: string;
  value: string;
};

function ReviewItem({ label, value }: ReviewItemProps) {
  return (
    <View style={styles.reviewItem}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

type WizardProgressProps = {
  currentStep: number;
};

function WizardProgress({ currentStep }: WizardProgressProps) {
  return (
    <View style={styles.progressPanel}>
      {STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isDone = index < currentStep;
        return (
          <View key={step} style={styles.progressStep}>
            <View style={[styles.progressDot, isActive || isDone ? styles.progressDotActive : null]}>
              {isDone ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : null}
            </View>
            <Text style={[styles.progressText, isActive ? styles.progressTextActive : null]} numberOfLines={1}>
              {step}
            </Text>
          </View>
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

        if (!subject.topics.length) {
          return `Add at least one topic under subject ${subjectIndex + 1}.`;
        }

        for (let topicIndex = 0; topicIndex < subject.topics.length; topicIndex += 1) {
          const topic = subject.topics[topicIndex];

          if (!isValidShortText(topic.name)) {
            return `Enter topic ${topicIndex + 1} under subject ${subjectIndex + 1}.`;
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

const styles = StyleSheet.create({
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
  disabledButton: {
    opacity: 0.55
  },
  distributionItem: {
    gap: spacing.sm
  },
  distributionList: {
    gap: spacing.md
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
  generatedHero: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
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
    height: 22,
    justifyContent: "center",
    width: 22
  },
  progressDotActive: {
    backgroundColor: colors.brand
  },
  progressPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
    gap: spacing.xs,
    minWidth: 0
  },
  progressText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700"
  },
  progressTextActive: {
    color: colors.brand
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
  reviewItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
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
  subjectCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md
  },
  subjectHeader: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: spacing.sm
  },
  subjectList: {
    gap: spacing.md
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
    color: colors.warning,
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
