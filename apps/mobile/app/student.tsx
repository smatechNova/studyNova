import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { generateStudyPlan } from "@/lib/api";
import { demoStudyPlanRequest } from "@/lib/demoData";
import type { StudyPlanResponse } from "@/types";
import { colors, spacing } from "@/theme";

export default function StudentScreen() {
  const [plan, setPlan] = useState<StudyPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    generateStudyPlan(demoStudyPlanRequest)
      .then((response) => {
        if (isMounted) {
          setPlan(response);
          setError("");
        }
      })
      .catch(() => {
        if (isMounted) {
          setPlan(null);
          setError("Start the API server to load a live generated plan.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const todayPlan = useMemo(() => plan?.schedule[0], [plan]);
  const completion = todayPlan ? Math.min(100, Math.round((todayPlan.total_minutes / 180) * 100)) : 0;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Today</Text>
            <Text style={styles.title}>Student plan</Text>
          </View>
          <Pressable style={styles.iconButton} accessibilityRole="button">
            <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.helper}>Generating smart timetable...</Text>
          </View>
        ) : null}

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
              {todayPlan?.sessions.map((session, index) => (
                <View key={`${session.subject}-${session.topic}-${index}`} style={styles.sessionRow}>
                  <View style={styles.sessionIcon}>
                    <MaterialCommunityIcons
                      name={session.kind === "revision" ? "repeat-variant" : "book-open-page-variant-outline"}
                      size={22}
                      color={colors.brand}
                    />
                  </View>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionTitle}>{session.topic}</Text>
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

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
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
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  loadingPanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 24,
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

