import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { RoleCard } from "@/components/RoleCard";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { colors, spacing } from "@/theme";

export default function HomeScreen() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="school-outline" size={34} color={colors.brand} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.kicker}>For students, parents, and schools</Text>
            <Text style={styles.title}>StudyNova</Text>
            <Text style={styles.subtitle}>
              A focused study planner that turns subjects, topics, reading pace, and exam dates into a daily academic plan.
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Smart planning" value="Daily" icon="calendar-clock" />
          <StatCard label="Study proof" value="Recall" icon="book-check-outline" />
          <StatCard label="Parent view" value="Live" icon="account-supervisor-outline" />
        </View>

        <View style={styles.roleGrid}>
          <Link href="/student" asChild>
            <RoleCard
              title="Student"
              description="Generate a timetable, track sessions, and keep revision on schedule."
              icon="notebook-edit-outline"
            />
          </Link>
          <Link href="/parent" asChild>
            <RoleCard
              title="Parent"
              description="Monitor study consistency and encourage progress without guessing."
              icon="shield-account-outline"
            />
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl
  },
  hero: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg
  },
  heroText: {
    flex: 1,
    gap: spacing.xs
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 64,
    justifyContent: "center",
    width: 64
  },
  roleGrid: {
    gap: spacing.md
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800"
  }
});
