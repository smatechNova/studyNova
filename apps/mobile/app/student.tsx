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
import { generateStudyPlan } from "@/lib/api";
import type { PlanSession, StudyPlanRequest, StudyPlanResponse } from "@/types";
import { colors, spacing } from "@/theme";

const RESOURCE_OPTIONS = ["Textbook", "Class notes", "Notebook", "Online notes", "Past questions"];

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

export default function StudentScreen() {
  const [form, setForm] = useState<PlanForm>(() => createDefaultForm());
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void submitPlan(form);
    // Generate one starter plan from the default values when the screen opens.
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
      setError("Could not generate the plan. Check the API connection and exam dates.");
    } finally {
      setIsLoading(false);
    }
  }

  function buildRequest(nextForm: PlanForm): StudyPlanRequest | null {
    const age = toNumber(nextForm.age);
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
      setError("Enter a future exam start date in YYYY-MM-DD format.");
      return null;
    }

    if (!isValidDate(nextForm.examEndDate) || !isDateOnOrAfter(nextForm.examEndDate, nextForm.examStartDate)) {
      setError("Enter an exam end date that is on or after the start date.");
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
      available_daily_minutes: clamp(toNumber(nextForm.availableDailyMinutes), 30, 720),
      minutes_per_page: clamp(toNumber(nextForm.minutesPerPage), 1, 30),
      session_minutes: clamp(toNumber(nextForm.sessionMinutes), 20, 90),
      break_minutes: clamp(toNumber(nextForm.breakMinutes), 5, 30),
      study_strength_note: nextForm.studyStrengthNote.trim(),
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
      subjects: [...current.subjects, createSubject("New subject", [createTopic("New topic", "10", "Textbook")])]
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
          ? { ...subject, topics: [...subject.topics, createTopic("New topic", "10", "Textbook")] }
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
            <Text style={styles.sectionTitle}>Student profile</Text>
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

          <View style={styles.formStack}>
            <FormField
              label="Student name"
              value={form.studentName}
              onChangeText={(value) => updateField("studentName", value)}
            />
            <FormField
              label="Class"
              value={form.classLevel}
              onChangeText={(value) => updateField("classLevel", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Age"
              value={form.age}
              onChangeText={(value) => updateField("age", value)}
            />
            <FormField
              label="Parent or guardian"
              value={form.parentName}
              onChangeText={(value) => updateField("parentName", value)}
            />
            <FormField
              keyboardType="phone-pad"
              label="Parent contact"
              value={form.parentContact}
              onChangeText={(value) => updateField("parentContact", value)}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Study plan data</Text>
          <View style={styles.formStack}>
            <FormField
              label="Exam start date"
              value={form.examStartDate}
              onChangeText={(value) => updateField("examStartDate", value)}
              placeholder="YYYY-MM-DD"
            />
            <FormField
              label="Exam end date"
              value={form.examEndDate}
              onChangeText={(value) => updateField("examEndDate", value)}
              placeholder="YYYY-MM-DD"
            />
            <FormField
              keyboardType="number-pad"
              label="Daily study minutes"
              value={form.availableDailyMinutes}
              onChangeText={(value) => updateField("availableDailyMinutes", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Minutes to read one page"
              value={form.minutesPerPage}
              onChangeText={(value) => updateField("minutesPerPage", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Study session minutes"
              value={form.sessionMinutes}
              onChangeText={(value) => updateField("sessionMinutes", value)}
            />
            <FormField
              keyboardType="number-pad"
              label="Break minutes"
              value={form.breakMinutes}
              onChangeText={(value) => updateField("breakMinutes", value)}
            />
            <FormField
              label="Study strength note"
              multiline
              value={form.studyStrengthNote}
              onChangeText={(value) => updateField("studyStrengthNote", value)}
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
                <View style={styles.subjectNameField}>
                  <FormField
                    label={`Subject ${subjectIndex + 1}`}
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
                    value={topic.name}
                    onChangeText={(value) => updateTopic(subject.id, topic.id, "name", value)}
                  />
                  <FormField
                    keyboardType="number-pad"
                    label="Pages in this topic"
                    value={topic.pages}
                    onChangeText={(value) => updateTopic(subject.id, topic.id, "pages", value)}
                  />
                  <ResourcePicker
                    selected={topic.resourceType}
                    onSelect={(value) => updateTopic(subject.id, topic.id, "resourceType", value)}
                  />
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
                      {session.subject} - {session.resource_type} - {session.minutes} minutes
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
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === "default" ? "words" : "none"}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline ? styles.textArea : null]}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
      />
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

function createDefaultForm(): PlanForm {
  return {
    studentName: "Alliyah",
    classLevel: "SS2",
    age: "15",
    parentName: "Mrs Adewale",
    parentContact: "08000000000",
    examStartDate: futureDate(30),
    examEndDate: futureDate(35),
    availableDailyMinutes: "180",
    minutesPerPage: "5",
    sessionMinutes: "45",
    breakMinutes: "10",
    studyStrengthNote: "I read faster in the morning and understand better after writing short notes.",
    subjects: [
      createSubject("Mathematics", [
        createTopic("Algebra", "25", "Textbook"),
        createTopic("Geometry", "18", "Class notes")
      ]),
      createSubject("English", [
        createTopic("Comprehension", "15", "Class notes"),
        createTopic("Essay Writing", "10", "Notebook")
      ]),
      createSubject("Biology", [
        createTopic("Cell Structure", "20", "Textbook"),
        createTopic("Nutrition", "12", "Online notes")
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
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isValidDate(value: string) {
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function isFutureDate(value: string) {
  if (!isValidDate(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed > today;
}

function isDateOnOrAfter(value: string, comparison: string) {
  if (!isValidDate(value) || !isValidDate(comparison)) {
    return false;
  }

  return new Date(`${value}T00:00:00`) >= new Date(`${comparison}T00:00:00`);
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
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
  },
  disabledButton: {
    opacity: 0.7
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
  }
});
