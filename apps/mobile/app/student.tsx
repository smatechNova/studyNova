import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { generateStudyPlan } from "@/lib/api";
import type { PlanSession, StudyPlanRequest, StudyPlanResponse } from "@/types";
import { colors, spacing } from "@/theme";

type TopicForm = {
  id: string;
  name: string;
  pages: string;
  priority: string;
};

type SubjectForm = {
  id: string;
  name: string;
  topics: TopicForm[];
};

type PlanForm = {
  studentName: string;
  examDate: string;
  availableDailyMinutes: string;
  minutesPerPage: string;
  sessionMinutes: string;
  breakMinutes: string;
  subjects: SubjectForm[];
};

export default function StudentScreen() {
  const [form, setForm] = useState<PlanForm>(() => createDefaultForm());
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void submitPlan(form);
    // The initial demo values should generate a plan once when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayPlan = useMemo(() => plan?.schedule[0], [plan]);
  const completion = todayPlan
    ? Math.min(100, Math.round((todayPlan.total_minutes / plan.metadata.available_daily_minutes) * 100))
    : 0;

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
    } catch {
      setError("Could not generate the plan. Check that the API is running and the exam date is valid.");
    } finally {
      setIsLoading(false);
    }
  }

  function buildRequest(nextForm: PlanForm): StudyPlanRequest | null {
    const subjects = nextForm.subjects
      .map((subject) => ({
        name: subject.name.trim(),
        topics: subject.topics
          .map((topic) => ({
            name: topic.name.trim(),
            pages: toNumber(topic.pages),
            priority: toNumber(topic.priority)
          }))
          .filter((topic) => topic.name && topic.pages > 0)
      }))
      .filter((subject) => subject.name && subject.topics.length > 0);

    if (!nextForm.studentName.trim()) {
      setError("Enter the student name.");
      return null;
    }

    if (!isFutureDate(nextForm.examDate)) {
      setError("Enter a future exam date in YYYY-MM-DD format.");
      return null;
    }

    if (!subjects.length) {
      setError("Add at least one subject with one topic.");
      return null;
    }

    return {
      student_name: nextForm.studentName.trim(),
      exam_date: nextForm.examDate,
      available_daily_minutes: clamp(toNumber(nextForm.availableDailyMinutes), 30, 720),
      minutes_per_page: clamp(toNumber(nextForm.minutesPerPage), 1, 30),
      session_minutes: clamp(toNumber(nextForm.sessionMinutes), 20, 90),
      break_minutes: clamp(toNumber(nextForm.breakMinutes), 5, 30),
      subjects
    };
  }

  function updateField(field: keyof Omit<PlanForm, "subjects">, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateSubject(subjectId: string, name: string) {
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId ? { ...subject, name } : subject
      )
    }));
  }

  function addSubject() {
    setForm((current) => ({
      ...current,
      subjects: [...current.subjects, createSubject("New subject", [createTopic("New topic", "10", "3")])]
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
    setForm((current) => ({
      ...current,
      subjects: current.subjects.map((subject) =>
        subject.id === subjectId
          ? { ...subject, topics: [...subject.topics, createTopic("New topic", "10", "3")] }
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Today</Text>
            <Text style={styles.title}>Student plan</Text>
          </View>
          <Pressable style={styles.iconButton} accessibilityRole="button">
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Plan setup</Text>
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
          </View>

          <View style={styles.formGrid}>
            <FormField
              label="Student name"
              value={form.studentName}
              onChangeText={(value) => updateField("studentName", value)}
            />
            <FormField
              label="Exam date"
              value={form.examDate}
              onChangeText={(value) => updateField("examDate", value)}
              placeholder="YYYY-MM-DD"
            />
            <FormField
              keyboardType="number-pad"
              label="Daily minutes"
              value={form.availableDailyMinutes}
              onChangeText={(value) => updateField("availableDailyMinutes", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Minutes per page"
              value={form.minutesPerPage}
              onChangeText={(value) => updateField("minutesPerPage", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Session minutes"
              value={form.sessionMinutes}
              onChangeText={(value) => updateField("sessionMinutes", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Break minutes"
              value={form.breakMinutes}
              onChangeText={(value) => updateField("breakMinutes", value)}
            />
          </View>
        </View>

        <View style={styles.subjectList}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Subjects and topics</Text>
            <Pressable accessibilityRole="button" onPress={addSubject} style={styles.secondaryButton}>
              <MaterialCommunityIcons name="plus" size={18} color={colors.brand} />
              <Text style={styles.secondaryButtonText}>Subject</Text>
            </Pressable>
          </View>

          {form.subjects.map((subject, subjectIndex) => (
            <View key={subject.id} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <FormField
                  label={`Subject ${subjectIndex + 1}`}
                  value={subject.name}
                  onChangeText={(value) => updateSubject(subject.id, value)}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => removeSubject(subject.id)}
                  style={styles.removeButton}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.warning} />
                </Pressable>
              </View>

              {subject.topics.map((topic, topicIndex) => (
                <View key={topic.id} style={styles.topicRow}>
                  <View style={styles.topicName}>
                    <FormField
                      label={`Topic ${topicIndex + 1}`}
                      value={topic.name}
                      onChangeText={(value) => updateTopic(subject.id, topic.id, "name", value)}
                    />
                  </View>
                  <View style={styles.smallInput}>
                    <FormField
                      keyboardType="number-pad"
                      label="Pages"
                      value={topic.pages}
                      onChangeText={(value) => updateTopic(subject.id, topic.id, "pages", value)}
                    />
                  </View>
                  <View style={styles.smallInput}>
                    <FormField
                      keyboardType="number-pad"
                      label="Priority"
                      value={topic.priority}
                      onChangeText={(value) => updateTopic(subject.id, topic.id, "priority", value)}
                    />
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => removeTopic(subject.id, topic.id)}
                    style={styles.removeButton}
                  >
                    <MaterialCommunityIcons name="minus-circle-outline" size={20} color={colors.muted} />
                  </Pressable>
                </View>
              ))}

              <Pressable accessibilityRole="button" onPress={() => addTopic(subject.id)} style={styles.addTopicButton}>
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.brand} />
                <Text style={styles.secondaryButtonText}>Add topic</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {error ? (
          <View style={styles.warningPanel}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} />
            <Text style={styles.warningText}>{error}</Text>
          </View>
        ) : null}

        {plan ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                label="Required daily"
                value={`${plan.metadata.required_daily_minutes}m`}
                icon="clock-outline"
              />
              <StatCard label="Status" value={plan.metadata.status.replace("_", " ")} icon="target" />
              <StatCard label="Exam countdown" value={`${plan.metadata.days_until_exam}d`} icon="calendar-star" />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.sectionTitle}>Today&apos;s timetable</Text>
                <Text style={styles.metric}>{completion}%</Text>
              </View>
              <ProgressBar value={completion} />
              <Text style={styles.helper}>{plan.metadata.recommendation}</Text>
            </View>

            <View style={styles.sessionList}>
              {todayPlan?.sessions.map((session, index, sessions) => (
                <View key={`${session.subject}-${session.topic}-${index}`} style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <MaterialCommunityIcons
                      name={session.kind === "revision" ? "repeat-variant" : "book-open-page-variant-outline"}
                      size={22}
                      color={colors.brand}
                    />
                  </View>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionTitle}>{sessionTitle(session, index, sessions)}</Text>
                    <Text style={styles.sessionMeta}>
                      {session.subject} - {session.minutes} minutes
                    </Text>
                  </View>
                  <Text style={styles.sessionKind}>{session.kind}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "number-pad";
  placeholder?: string;
};

function FormField({ label, value, onChangeText, keyboardType = "default", placeholder }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="words"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function createDefaultForm(): PlanForm {
  return {
    studentName: "Alliyah",
    examDate: futureDate(30),
    availableDailyMinutes: "180",
    minutesPerPage: "5",
    sessionMinutes: "45",
    breakMinutes: "10",
    subjects: [
      createSubject("Mathematics", [
        createTopic("Algebra", "25", "5"),
        createTopic("Geometry", "18", "4")
      ]),
      createSubject("English", [
        createTopic("Comprehension", "15", "3"),
        createTopic("Essay Writing", "10", "4")
      ]),
      createSubject("Biology", [
        createTopic("Cell Structure", "20", "4"),
        createTopic("Nutrition", "12", "3")
      ])
    ]
  };
}

function createSubject(name: string, topics: TopicForm[]): SubjectForm {
  return {
    id: createId("subject"),
    name,
    topics
  };
}

function createTopic(name: string, pages: string, priority: string): TopicForm {
  return {
    id: createId("topic"),
    name,
    pages,
    priority
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function futureDate(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isFutureDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed > today;
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
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
  },
  disabledButton: {
    opacity: 0.7
  },
  field: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 132
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
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
    paddingVertical: spacing.sm
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
  removeButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    marginTop: 22,
    width: 44
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
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
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
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  sessionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  smallInput: {
    flexBasis: 90,
    flexGrow: 1
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
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
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm
  },
  subjectList: {
    gap: spacing.md
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  topicName: {
    flexBasis: 180,
    flexGrow: 2
  },
  topicRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
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
  }
});
