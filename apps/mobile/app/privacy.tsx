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

type PolicySection = {
  title: string;
  body?: string;
  bullets?: string[];
};

const POLICY_SECTIONS: PolicySection[] = [
  {
    title: "Overview",
    body: "StudyNova helps students create study plans and helps parents or guardians monitor linked student progress. The app is designed for school and family academic support."
  },
  {
    title: "Information We Collect",
    bullets: [
      "Student name, class, age, school name, login ID, subjects, topics, study resources, exam dates, reading pace, study notes, study progress, recall notes, and confidence scores.",
      "Parent or guardian name, contact information, relationship to the student, linked student accounts, and progress-monitoring activity.",
      "Account recovery help requests, including login ID, contact information, and optional support notes.",
      "Closed-test feedback, including optional tester name/contact, device details, rating, recommendation answer, and notes about what worked or failed.",
      "Notification permission status checked locally by the app, and scheduled study reminder preferences that may be stored with the study plan."
    ]
  },
  {
    title: "How We Use Information",
    bullets: [
      "Generate student study plans and timetables.",
      "Track study progress and missed sessions.",
      "Show parent or guardian progress dashboards for linked students.",
      "Send local study reminders when enabled.",
      "Help recover account access when users request support.",
      "Review closed-test feedback and prioritize fixes before public release.",
      "Improve the app during testing."
    ]
  },
  {
    title: "Parent And Student Linking",
    body: "Students and parents have separate accounts. A parent can only monitor a student after the student account is linked through the app's parent-linking flow or invite code."
  },
  {
    title: "Data Sharing",
    body: "StudyNova does not sell user data. During testing, app administrators may review account and study progress data to support users, fix issues, and improve the product. StudyNova may use service providers such as backend hosting and Firebase/Google sign-in to operate the app."
  },
  {
    title: "Data Storage",
    body: "In development and testing, data may be stored in the StudyNova backend database. Before public launch, StudyNova should use production-grade hosting, access controls, backups, and retention rules. StudyNova does not currently collect location, payment data, device contacts, calendar events, photos, videos, audio recordings, user-uploaded files, health data, fitness data, SMS/MMS, or browsing history."
  },
  {
    title: "Notifications",
    body: "StudyNova may ask for notification permission to send local study reminders and missed-session prompts. Users can disable reminders in the app or device settings."
  },
  {
    title: "Children's Privacy",
    body: "StudyNova may be used by students. Schools, parents, or guardians should supervise student account creation and app use. The production policy should be reviewed for local child privacy requirements before public launch."
  },
  {
    title: "User Choices",
    body: "Users may request help with account access through the sign-in help form. Signed-in students and parents can submit an account deletion request from their dashboard privacy section. Users who cannot access the app can submit the public deletion form at the hosted /delete-account page."
  },
  {
    title: "Account Deletion",
    body: "Account deletion requests are reviewed before completion so StudyNova can verify the request, protect linked parent-student records, and handle school or guardian support needs carefully. When support marks a reviewed request as completed, StudyNova removes the scoped account data from the backend while keeping the deletion request record for support tracking."
  },
  {
    title: "Contact",
    body: "For privacy or account support, contact StudyNova Support at support@example.com. Replace this email with the final support contact before Play Store submission."
  }
];

export default function PrivacyScreen() {
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
            <MaterialCommunityIcons name="shield-lock-outline" size={34} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Public policy</Text>
            <Text style={styles.title}>StudyNova Privacy Policy</Text>
            <Text style={styles.helper}>Last updated: June 3, 2026</Text>
          </View>
        </View>

        <IllustrationPanel
          body="StudyNova keeps student and parent roles separate, links progress carefully, and keeps launch policies visible."
          imageSource={brandAssets.privacySecurity}
          kicker="Trust and safety"
          title="Built around careful student data handling"
        />

        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.brand} />
          <Text style={styles.noticeText}>
            This policy is prepared for the StudyNova closed-test build and should be reviewed with final support
            contact details before public launch.
          </Text>
        </View>

        {POLICY_SECTIONS.map((section) => (
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
