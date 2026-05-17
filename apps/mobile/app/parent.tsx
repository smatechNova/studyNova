import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { colors, spacing } from "@/theme";

const completionRate = 78;

export default function ParentScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Linked student</Text>
            <Text style={styles.title}>Alliyah Adewale</Text>
          </View>
          <View style={styles.badge}>
            <MaterialCommunityIcons name="check-decagram-outline" size={18} color={colors.success} />
            <Text style={styles.badgeText}>Active</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Weekly consistency</Text>
            <Text style={styles.metric}>{completionRate}%</Text>
          </View>
          <ProgressBar value={completionRate} />
          <Text style={styles.helper}>
            Mathematics and English are on track. Biology needs one extra revision session this week.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Study streak" value="5 days" icon="fire" />
          <StatCard label="Completed" value="11/14" icon="checkbox-marked-circle-outline" />
          <StatCard label="Minutes" value="520" icon="timer-outline" />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Latest update</Text>
          <View style={styles.updateRow}>
            <MaterialCommunityIcons name="book-check-outline" size={24} color={colors.brand} />
            <View style={styles.updateText}>
              <Text style={styles.updateTitle}>Essay Writing completed</Text>
              <Text style={styles.helper}>Next revision is scheduled in 3 days.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700"
  },
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
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
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

