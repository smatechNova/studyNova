import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { IllustrationPanel } from "@/components/IllustrationPanel";
import { Screen } from "@/components/Screen";
import { brandAssets } from "@/lib/brandAssets";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type TermsSection = {
  title: string;
  body?: string;
  bullets?: string[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "Overview",
    body: "StudyNova is an academic planning app for students, parents, guardians, and schools. By using StudyNova, you agree to use the app for lawful, educational, and supportive study-planning purposes."
  },
  {
    title: "Accounts",
    bullets: [
      "Students and parents or guardians have separate accounts.",
      "Students should use their own student account and should not access another student's dashboard.",
      "Parents or guardians can only monitor students who have been linked through the app's linking or invite-code flow.",
      "Users are responsible for keeping login IDs and access codes private."
    ]
  },
  {
    title: "Age And Parent Approval",
    body: "Student accounts in this release are intended for students aged 13 or older. A parent or guardian must approve student sign-up and verify a parent email. Users must provide accurate account information and must not create an account for an ineligible person."
  },
  {
    title: "Parent And School Supervision",
    body: "StudyNova may be used by students. Parents, guardians, and schools should supervise student account creation, parent-student linking, and study-plan use where appropriate."
  },
  {
    title: "Study Plans",
    body: "StudyNova generates study plans from the information provided by the student or guardian, including subjects, topics, pages, reading pace, available study time, and exam dates. Study plans are guidance tools, not guarantees of exam performance."
  },
  {
    title: "Study Proof And Progress",
    body: "Students may record study proof, recall notes, confidence scores, and completed sessions. These records should be honest and respectful. Parent dashboards are intended to encourage support, not pressure or punishment."
  },
  {
    title: "Acceptable Use",
    bullets: [
      "Do not submit false, harmful, abusive, or unlawful content.",
      "Do not attempt to access another user's account or data.",
      "Do not misuse account recovery, account deletion, tester feedback, or support forms.",
      "Do not interfere with the app, backend, or testing process."
    ]
  },
  {
    title: "Privacy And Deletion",
    body: "StudyNova's privacy practices are described in the Privacy Policy. Users can request account deletion in-app or through the public /delete-account page when they cannot sign in."
  },
  {
    title: "Service Availability",
    body: "StudyNova may update, improve, suspend, or discontinue features when necessary for maintenance, safety, legal compliance, or product development. We will make reasonable efforts to protect saved study data and communicate material service changes."
  },
  {
    title: "Changes To These Terms",
    body: "StudyNova may update these terms as the app grows. Continued use of the app after updates means you accept the updated terms."
  },
  {
    title: "Contact",
    body: "For support or questions about these terms, contact StudyNova Support at support@studynova.app."
  }
];

export default function TermsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.brand} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="file-document-outline" size={34} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Public terms</Text>
            <Text style={styles.title}>StudyNova Terms of Use</Text>
            <Text style={styles.helper}>Last updated: July 19, 2026</Text>
          </View>
        </View>

        <IllustrationPanel
          body="Clear terms help schools, parents, and students understand how StudyNova should be used."
          imageSource={brandAssets.privacySecurity}
          kicker="Shared expectations"
          title="Simple rules for a focused study app"
        />

        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.brand} />
          <Text style={styles.noticeText}>
            By creating or using an account, users and approving parents or guardians agree to these terms.
          </Text>
        </View>

        {TERMS_SECTIONS.map((section) => (
          <View key={section.title} style={styles.panel}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
            {section.bullets ? (
              <View style={styles.bulletList}>
                {section.bullets.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>-</Text>
                    <Text style={styles.body}>{item}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    backButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.md,
      paddingVertical: spacing.xs
    },
    backButtonText: {
      color: colors.brand,
      fontSize: 16,
      fontWeight: "800"
    },
    body: {
      color: colors.muted,
      flex: 1,
      fontSize: 15,
      lineHeight: 23
    },
    bulletDot: {
      color: colors.brand,
      fontSize: 17,
      fontWeight: "900",
      lineHeight: 23
    },
    bulletList: {
      gap: spacing.sm
    },
    bulletRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm
    },
    content: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl
    },
    helper: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22
    },
    hero: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md
    },
    heroCopy: {
      flex: 1,
      gap: spacing.xs
    },
    kicker: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "900",
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
    notice: {
      alignItems: "flex-start",
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md
    },
    noticeText: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      lineHeight: 22
    },
    panel: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900"
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      lineHeight: 36
    }
  });
}
