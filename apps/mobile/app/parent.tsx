import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { getLatestStudyPlan, getParentFamily, getStudyPlanProgress } from "@/lib/api";
import { getStoredAuthSession } from "@/lib/session";
import type { ParentFamilyAccount, SavedStudyPlan, StudyPlanProgress } from "@/types";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

export default function ParentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ parentId?: string }>();
  const signedInParentId = getParamValue(params.parentId);
  const [storedParentId, setStoredParentId] = useState<string | undefined>();
  const [parentFamily, setParentFamily] = useState<ParentFamilyAccount | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [savedPlan, setSavedPlan] = useState<SavedStudyPlan | null>(null);
  const [progress, setProgress] = useState<StudyPlanProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const activeParentId = signedInParentId ?? storedParentId;

  const latestCompletion = progress?.completions.at(-1);
  const recentDays = useMemo(() => {
    const days = progress?.daily ?? [];
    const today = toDateValue(new Date());
    const elapsedDays = days.filter((day) => day.study_date <= today);
    return (elapsedDays.length ? elapsedDays : days).slice(-7);
  }, [progress?.daily]);
  const weeklyRate = useMemo(() => {
    if (!recentDays.length) {
      return 0;
    }

    const total = recentDays.reduce((sum, day) => sum + day.completion_rate, 0);
    return Math.round(total / recentDays.length);
  }, [recentDays]);
  const streakDays = useMemo(() => calculateStreak(progress), [progress]);
  const selectedStudent =
    parentFamily?.students.find((student) => student.id === selectedStudentId) ?? parentFamily?.students[0];

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSession() {
      if (signedInParentId) {
        return;
      }

      const session = await getStoredAuthSession();
      if (isMounted && session?.role === "parent" && session.parent) {
        setStoredParentId(session.parent.id);
      }
    }

    void loadStoredSession();

    return () => {
      isMounted = false;
    };
  }, [signedInParentId]);

  useEffect(() => {
    void loadParentView();
  }, [activeParentId]);

  async function loadParentView(nextStudentId = selectedStudentId) {
    if (!activeParentId) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const latestFamily = await getParentFamily(activeParentId);
      setParentFamily(latestFamily);

      if (!latestFamily.parent || !latestFamily.students.length) {
        setSavedPlan(null);
        setProgress(null);
        setMessage("Create and link student and parent profiles first.");
        return;
      }

      const activeStudent =
        latestFamily.students.find((student) => student.id === nextStudentId) ?? latestFamily.students[0];
      setSelectedStudentId(activeStudent.id);

      try {
        const latest = await getLatestStudyPlan({ studentId: activeStudent.id });
        const latestProgress = await getStudyPlanProgress(latest.id);
        setSavedPlan(latest);
        setProgress(latestProgress);
      } catch {
        setSavedPlan(null);
        setProgress(null);
        setMessage(`Generate and save a study plan for ${activeStudent.name}.`);
      }
    } catch {
      setParentFamily(null);
      setSavedPlan(null);
      setProgress(null);
      setMessage("Create linked profiles, then generate and save a student plan.");
    } finally {
      setIsLoading(false);
    }
  }

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    void loadParentView(studentId);
  }

  if (!activeParentId) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <MaterialCommunityIcons name="lock-outline" size={28} color={colors.brand} />
            <Text style={styles.sectionTitle}>Parent sign in required</Text>
            <Text style={styles.helper}>
              Sign in as a parent or guardian to monitor linked student accounts.
            </Text>
            <Link href="/auth?role=parent" asChild>
              <Pressable accessibilityRole="button" style={styles.linkButton}>
                <MaterialCommunityIcons name="login" size={18} color={colors.brand} />
                <Text style={styles.linkButtonText}>Sign in as parent</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Selected student</Text>
            <Text style={styles.title}>{selectedStudent?.name ?? savedPlan?.student_name ?? "No student yet"}</Text>
            {selectedStudent ? (
              <Text style={styles.helper}>
                {selectedStudent.class_level}
                {parentFamily?.parent ? ` - linked to ${parentFamily.parent.name}` : ""}
              </Text>
            ) : savedPlan ? (
              <Text style={styles.helper}>{savedPlan.plan.metadata.class_level || "Class not set"}</Text>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" onPress={() => void loadParentView()} style={styles.badge}>
            {isLoading ? (
              <ActivityIndicator color={colors.success} />
            ) : (
              <MaterialCommunityIcons name="refresh" size={18} color={colors.success} />
            )}
            <Text style={styles.badgeText}>Refresh</Text>
          </Pressable>
        </View>

        {message ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.infoText}>{message}</Text>
          </View>
        ) : null}

        {parentFamily?.students.length ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.sectionTitle}>Students</Text>
              <Link href={`/accounts?parentId=${encodeURIComponent(activeParentId)}`} asChild>
                <Pressable accessibilityRole="button" style={styles.linkButton}>
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.brand} />
                  <Text style={styles.linkButtonText}>Link student</Text>
                </Pressable>
              </Link>
            </View>
            <Text style={styles.helper}>
              This parent can monitor multiple student accounts. Select one child to view their progress.
            </Text>
            <View style={styles.studentPicker}>
              {parentFamily.students.map((student) => {
                const isSelected = student.id === selectedStudent?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={student.id}
                    onPress={() => selectStudent(student.id)}
                    style={[styles.studentChip, isSelected ? styles.studentChipSelected : null]}
                  >
                    <Text style={[styles.studentChipText, isSelected ? styles.studentChipTextSelected : null]}>
                      {student.name}
                    </Text>
                    <Text style={[styles.studentChipMeta, isSelected ? styles.studentChipTextSelected : null]}>
                      {student.class_level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Weekly consistency</Text>
            <Text style={styles.metric}>{weeklyRate}%</Text>
          </View>
          <ProgressBar value={weeklyRate} />
          <Text style={styles.helper}>{parentSummaryCopy(weeklyRate, streakDays)}</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Study streak" value={`${streakDays} days`} icon="fire" />
          <StatCard
            label="Completed"
            value={`${progress?.completed_sessions ?? 0}/${progress?.planned_sessions ?? 0}`}
            icon="checkbox-marked-circle-outline"
          />
          <StatCard label="Minutes" value={`${progress?.completed_minutes ?? 0}`} icon="timer-outline" />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Latest study proof</Text>
            {latestCompletion ? <Text style={styles.confidence}>Confidence {latestCompletion.confidence}/5</Text> : null}
          </View>
          {latestCompletion ? (
            <View style={styles.updateRow}>
              <MaterialCommunityIcons name="book-check-outline" size={24} color={colors.brand} />
              <View style={styles.updateText}>
                <Text style={styles.updateTitle}>
                  {latestCompletion.topic} {latestCompletion.kind === "practice" ? "practice" : "completed"}
                </Text>
                <Text style={styles.helper}>{latestCompletion.recall_note}</Text>
                <Text style={styles.sessionMeta}>
                  {latestCompletion.subject} - {formatReadableDate(latestCompletion.study_date)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.helper}>
              No completed session yet. Once the student marks a session done, their recall note will appear here.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recent study days</Text>
          <View style={styles.dayList}>
            {recentDays.map((day) => (
              <View key={day.study_date} style={styles.dayRow}>
                <View style={styles.dayCopy}>
                  <Text style={styles.updateTitle}>{formatReadableDate(day.study_date)}</Text>
                  <Text style={styles.sessionMeta}>
                    {day.completed_sessions}/{day.planned_sessions} sessions - {day.completed_minutes} minutes
                  </Text>
                </View>
                <Text style={styles.dayRate}>{Math.round(day.completion_rate)}%</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function parentSummaryCopy(weeklyRate: number, streakDays: number) {
  if (weeklyRate >= 80) {
    return `Strong week. The student has a ${streakDays}-day active streak and is keeping up well.`;
  }

  if (weeklyRate >= 50) {
    return "Progress is moving, but a gentle reminder may help keep sessions consistent.";
  }

  return "This week needs attention. Encourage one focused session today and review the latest recall note.";
}

function calculateStreak(progress: StudyPlanProgress | null) {
  if (!progress) {
    return 0;
  }

  const activeDates = new Set(
    progress.daily.filter((day) => day.completed_sessions > 0).map((day) => day.study_date)
  );
  let date = new Date();
  let streak = 0;

  while (activeDates.has(toDateValue(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function formatReadableDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700"
  },
  confidence: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800"
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
  },
  dayCopy: {
    flex: 1,
    gap: spacing.xs
  },
  dayList: {
    gap: spacing.sm
  },
  dayRate: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "800"
  },
  dayRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
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
  linkButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  linkButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800"
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
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: 13
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
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  updateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  updateText: {
    flex: 1,
    gap: spacing.xs
  },
  updateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  }
});
}
