import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { Screen } from "@/components/Screen";
import { createTesterFeedback } from "@/lib/api";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type { TesterFeedbackInput } from "@/types";

const ROLE_OPTIONS: TesterFeedbackInput["role"][] = ["student", "parent", "school", "general"];
const CATEGORY_OPTIONS: TesterFeedbackInput["category"][] = ["setup", "student", "parent", "reminders", "ui", "bug", "other"];

export default function FeedbackScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState<TesterFeedbackInput>(() => ({
    tester_name: "",
    contact: "",
    role: "general",
    device_model: "",
    android_version: Platform.OS === "android" ? `Android ${Platform.Version}` : `${Platform.OS} ${Platform.Version}`,
    category: "other",
    rating: 5,
    what_worked: "",
    what_failed: "",
    improvement: "",
    recommend: null,
    message: ""
  }));
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<FieldName extends keyof TesterFeedbackInput>(field: FieldName, value: TesterFeedbackInput[FieldName]) {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitFeedback() {
    if (!form.what_worked.trim() && !form.what_failed.trim() && !form.improvement.trim() && !form.message.trim()) {
      setMessage("Tell us at least one thing that worked, failed, confused you, or should improve.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const receipt = await createTesterFeedback({
        ...form,
        tester_name: form.tester_name.trim(),
        contact: form.contact.trim(),
        device_model: form.device_model.trim(),
        android_version: form.android_version.trim(),
        what_worked: form.what_worked.trim(),
        what_failed: form.what_failed.trim(),
        improvement: form.improvement.trim(),
        message: form.message.trim()
      });
      setMessage(receipt.message);
      setForm((current) => ({
        ...current,
        what_worked: "",
        what_failed: "",
        improvement: "",
        message: ""
      }));
    } catch {
      setMessage("Could not submit feedback. Check the API connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="message-text-outline" size={32} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Closed-test feedback</Text>
            <Text style={styles.title}>Help improve StudyNova</Text>
            <Text style={styles.helper}>
              Send one clear note about what worked, what failed, or what should feel better before Play Store launch.
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Tester details</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={(value) => updateField("tester_name", value)}
            placeholder="Your name, optional"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.tester_name}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => updateField("contact", value)}
            placeholder="Phone or email, optional"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.contact}
          />
          <TextInput
            onChangeText={(value) => updateField("device_model", value)}
            placeholder="Device model, e.g. Redmi Note 12"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.device_model}
          />
          <TextInput
            onChangeText={(value) => updateField("android_version", value)}
            placeholder="Android version"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={form.android_version}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>What were you testing?</Text>
          <View style={styles.chipGrid}>
            {ROLE_OPTIONS.map((role) => (
              <Pressable
                accessibilityRole="button"
                key={role}
                onPress={() => updateField("role", role)}
                style={[styles.chip, form.role === role ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, form.role === role ? styles.chipTextActive : null]}>{role}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.chipGrid}>
            {CATEGORY_OPTIONS.map((category) => (
              <Pressable
                accessibilityRole="button"
                key={category}
                onPress={() => updateField("category", category)}
                style={[styles.chip, form.category === category ? styles.chipActive : null]}
              >
                <Text style={[styles.chipText, form.category === category ? styles.chipTextActive : null]}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Rating</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <Pressable
                accessibilityRole="button"
                key={rating}
                onPress={() => updateField("rating", rating)}
                style={[styles.ratingButton, form.rating === rating ? styles.ratingButtonActive : null]}
              >
                <Text style={[styles.ratingText, form.rating === rating ? styles.ratingTextActive : null]}>{rating}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>1 means very difficult to use. 5 means clear and ready for more testers.</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Feedback</Text>
          <FeedbackInput
            label="What worked well?"
            value={form.what_worked}
            onChangeText={(value) => updateField("what_worked", value)}
            colors={colors}
            styles={styles}
          />
          <FeedbackInput
            label="What failed or confused you?"
            value={form.what_failed}
            onChangeText={(value) => updateField("what_failed", value)}
            colors={colors}
            styles={styles}
          />
          <FeedbackInput
            label="What should improve before launch?"
            value={form.improvement}
            onChangeText={(value) => updateField("improvement", value)}
            colors={colors}
            styles={styles}
          />
          <FeedbackInput
            label="Anything else?"
            value={form.message}
            onChangeText={(value) => updateField("message", value)}
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Would you recommend it?</Text>
          <View style={styles.chipGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateField("recommend", true)}
              style={[styles.chip, form.recommend === true ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, form.recommend === true ? styles.chipTextActive : null]}>Yes</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateField("recommend", false)}
              style={[styles.chip, form.recommend === false ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, form.recommend === false ? styles.chipTextActive : null]}>Not yet</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => updateField("recommend", null)}
              style={[styles.chip, form.recommend === null ? styles.chipActive : null]}
            >
              <Text style={[styles.chipText, form.recommend === null ? styles.chipTextActive : null]}>No answer</Text>
            </Pressable>
          </View>
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.brand} />
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submitFeedback()}
            style={[styles.primaryButton, isSubmitting ? styles.disabledButton : null]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Submit feedback</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function FeedbackInput({
  label,
  value,
  onChangeText,
  colors,
  styles
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder="Write a short note"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.textArea]}
        value={value}
      />
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      justifyContent: "space-between"
    },
    chip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      minHeight: 38,
      paddingHorizontal: spacing.md,
      justifyContent: "center"
    },
    chipActive: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand
    },
    chipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    chipText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "capitalize"
    },
    chipTextActive: {
      color: colors.brand
    },
    content: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl
    },
    disabledButton: {
      opacity: 0.55
    },
    field: {
      gap: spacing.xs
    },
    fieldLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase"
    },
    helper: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20
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
    heroCopy: {
      flex: 1,
      gap: spacing.xs
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
      fontWeight: "800",
      textTransform: "uppercase"
    },
    logo: {
      alignItems: "center",
      backgroundColor: colors.brandSoft,
      borderRadius: 8,
      height: 58,
      justifyContent: "center",
      width: 58
    },
    messagePanel: {
      alignItems: "center",
      backgroundColor: colors.brandSoft,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md
    },
    messageText: {
      color: colors.brandDark,
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20
    },
    panel: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.brand,
      borderRadius: 8,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing.md
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800"
    },
    ratingButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 46
    },
    ratingButtonActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand
    },
    ratingRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    ratingText: {
      color: colors.muted,
      fontSize: 16,
      fontWeight: "900"
    },
    ratingTextActive: {
      color: "#FFFFFF"
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.brandSoft,
      borderRadius: 8,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing.md
    },
    secondaryButtonText: {
      color: colors.brand,
      fontSize: 14,
      fontWeight: "800"
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900"
    },
    textArea: {
      minHeight: 92,
      textAlignVertical: "top"
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900"
    }
  });
}
