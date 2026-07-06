import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type DashboardIntroRole = "student" | "parent";

type DashboardIntroCardProps = {
  onDismiss: () => void;
  role: DashboardIntroRole;
};

const INTRO_COPY = {
  student: {
    eyebrow: "Welcome to your study space",
    title: "Your study command centre",
    body: "StudyNova turns your subjects, pages, reading pace, and exam dates into a realistic day-by-day plan.",
    points: [
      "Set up subjects and topics once.",
      "Follow today's sessions and attach recall proof.",
      "Rebalance when life happens so the plan stays honest."
    ]
  },
  parent: {
    eyebrow: "Welcome to parent monitoring",
    title: "Support without guessing",
    body: "StudyNova gives parents a calm view of linked student progress, study proof, and missed sessions.",
    points: [
      "Link each student with their invite code.",
      "Review completed sessions and recall notes.",
      "Encourage catch-up when the plan falls behind."
    ]
  }
} as const;

export function DashboardIntroCard({ onDismiss, role }: DashboardIntroCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = INTRO_COPY[role];

  return (
    <View style={styles.card}>
      <View style={styles.iconShell}>
        <MaterialCommunityIcons
          name={role === "student" ? "creation-outline" : "head-heart-outline"}
          size={28}
          color={colors.brand}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
        <View style={styles.pointGrid}>
          {copy.points.map((point, index) => (
            <View key={point} style={styles.point}>
              <View style={styles.pointNumber}>
                <Text style={styles.pointNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissButton}>
        <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.dismissText}>Got it</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    body: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21
    },
    card: {
      alignItems: "flex-start",
      backgroundColor: colors.panel,
      borderColor: colors.brand,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      padding: spacing.lg
    },
    copy: {
      flex: 1,
      gap: spacing.sm,
      minWidth: 220
    },
    dismissButton: {
      alignItems: "center",
      backgroundColor: colors.brand,
      borderRadius: 8,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 42,
      paddingHorizontal: spacing.md
    },
    dismissText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800"
    },
    eyebrow: {
      color: colors.secondary,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase"
    },
    iconShell: {
      alignItems: "center",
      backgroundColor: colors.brandSoft,
      borderRadius: 8,
      height: 56,
      justifyContent: "center",
      width: 56
    },
    point: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    pointGrid: {
      gap: spacing.sm
    },
    pointNumber: {
      alignItems: "center",
      backgroundColor: colors.secondarySoft,
      borderRadius: 8,
      height: 26,
      justifyContent: "center",
      width: 26
    },
    pointNumberText: {
      color: colors.secondaryDark,
      fontSize: 12,
      fontWeight: "900"
    },
    pointText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900"
    }
  });
}
