import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { IllustrationPanel } from "@/components/IllustrationPanel";
import { Screen } from "@/components/Screen";
import { createPublicAccountDeletionRequest } from "@/lib/api";
import { brandAssets } from "@/lib/brandAssets";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type { AuthRole, PublicAccountDeletionRequestInput } from "@/types";

const INITIAL_FORM: PublicAccountDeletionRequestInput = {
  role: "student",
  login_id: "",
  account_label: "",
  contact: "",
  reason: "",
  confirmation: "DELETE"
};

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState<PublicAccountDeletionRequestInput>(INITIAL_FORM);
  const [confirmationText, setConfirmationText] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<FieldName extends keyof PublicAccountDeletionRequestInput>(
    field: FieldName,
    value: PublicAccountDeletionRequestInput[FieldName]
  ) {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitRequest() {
    const loginId = form.login_id.trim();
    const contact = form.contact.trim();
    const confirmation = confirmationText.trim().toUpperCase();

    if (loginId.length < 5) {
      setMessage("Enter the student or parent login ID used for the account.");
      return;
    }

    if (contact.length < 5) {
      setMessage("Enter a phone number or email where support can reach you.");
      return;
    }

    if (confirmation !== "DELETE") {
      setMessage("Type DELETE to confirm this request.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const receipt = await createPublicAccountDeletionRequest({
        ...form,
        login_id: loginId,
        account_label: form.account_label.trim(),
        contact,
        reason: form.reason.trim(),
        confirmation: "DELETE"
      });
      setMessage(receipt.message);
      setConfirmationText("");
      setForm(INITIAL_FORM);
    } catch {
      setMessage("Could not submit the deletion request. Check the API connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.brand} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="account-remove-outline" size={34} color={colors.warningDark} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Privacy request</Text>
            <Text style={styles.title}>Delete a StudyNova account</Text>
            <Text style={styles.helper}>
              Use this form if you cannot sign in. Support will verify the account before deleting any student or
              parent data.
            </Text>
          </View>
        </View>

        <IllustrationPanel
          body="Deletion requests are reviewed before completion so parent-student links and account ownership stay protected."
          imageSource={brandAssets.privacySecurity}
          kicker="Careful cleanup"
          title="A safer path for deleting accounts"
        />

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.brand} />
          <Text style={styles.noticeText}>
            Submitting this request does not immediately delete data. It creates a support ticket for account ownership
            checks and careful cleanup.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Account type</Text>
          <View style={styles.roleRow}>
            <RoleButton role="student" selectedRole={form.role} onPress={() => updateField("role", "student")} styles={styles} />
            <RoleButton role="parent" selectedRole={form.role} onPress={() => updateField("role", "parent")} styles={styles} />
          </View>

          <Field
            label="Login ID"
            value={form.login_id}
            onChangeText={(value) => updateField("login_id", value)}
            placeholder="Phone number or email used to sign in"
            styles={styles}
            colors={colors}
          />
          <Field
            label="Account name"
            value={form.account_label}
            onChangeText={(value) => updateField("account_label", value)}
            placeholder="Student or parent name, optional"
            styles={styles}
            colors={colors}
          />
          <Field
            label="Contact for support"
            value={form.contact}
            onChangeText={(value) => updateField("contact", value)}
            placeholder="Phone number or email"
            styles={styles}
            colors={colors}
          />
          <Field
            label="Reason"
            value={form.reason}
            onChangeText={(value) => updateField("reason", value)}
            placeholder="Optional note for support"
            multiline
            styles={styles}
            colors={colors}
          />
          <Field
            label="Confirmation"
            value={confirmationText}
            onChangeText={setConfirmationText}
            placeholder="Type DELETE"
            autoCapitalize="characters"
            styles={styles}
            colors={colors}
          />

          {message ? <Text style={message.includes("received") ? styles.successMessage : styles.errorMessage}>{message}</Text> : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void submitRequest()}
            style={[styles.dangerButton, isSubmitting ? styles.disabledButton : null]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.warningDark} />
            ) : (
              <>
                <MaterialCommunityIcons name="send-outline" size={20} color={colors.warningDark} />
                <Text style={styles.dangerButtonText}>Submit deletion request</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function RoleButton({
  role,
  selectedRole,
  onPress,
  styles
}: {
  role: AuthRole;
  selectedRole: AuthRole;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const selected = role === selectedRole;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.roleButton, selected ? styles.roleButtonActive : null]}>
      <Text style={[styles.roleButtonText, selected ? styles.roleButtonTextActive : null]}>
        {role === "student" ? "Student" : "Parent or guardian"}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize = "sentences",
  styles,
  colors
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  styles: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
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
    content: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl
    },
    dangerButton: {
      alignItems: "center",
      backgroundColor: colors.warningSoft,
      borderRadius: 8,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 56,
      padding: spacing.md
    },
    dangerButtonText: {
      color: colors.warningDark,
      fontSize: 16,
      fontWeight: "900"
    },
    disabledButton: {
      opacity: 0.7
    },
    errorMessage: {
      color: colors.warningDark,
      fontSize: 15,
      fontWeight: "700"
    },
    field: {
      gap: spacing.xs
    },
    helper: {
      color: colors.muted,
      fontSize: 16,
      lineHeight: 24
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
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      minHeight: 56,
      paddingHorizontal: spacing.md
    },
    kicker: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    label: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    logo: {
      alignItems: "center",
      backgroundColor: colors.warningSoft,
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
      gap: spacing.md,
      padding: spacing.lg
    },
    roleButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: spacing.md
    },
    roleButtonActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand
    },
    roleButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800"
    },
    roleButtonTextActive: {
      color: "#FFFFFF"
    },
    roleRow: {
      flexDirection: "row",
      gap: spacing.sm
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900"
    },
    successMessage: {
      color: colors.success,
      fontSize: 15,
      fontWeight: "800"
    },
    textArea: {
      minHeight: 112,
      paddingTop: spacing.md
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      lineHeight: 36
    }
  });
}
