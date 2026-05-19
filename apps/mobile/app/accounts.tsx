import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
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

import { Screen } from "@/components/Screen";
import {
  createParentAccount,
  createStudentAccount,
  getLatestParentFamily,
  getParentFamily,
  linkParentStudent
} from "@/lib/api";
import type { ParentFamilyAccount } from "@/types";
import { colors, spacing } from "@/theme";

type AccountForm = {
  studentName: string;
  classLevel: string;
  age: string;
  schoolName: string;
  parentName: string;
  parentContact: string;
  relationship: string;
};

export default function AccountsScreen() {
  const [form, setForm] = useState<AccountForm>(() => createDefaultAccountForm());
  const [parentFamily, setParentFamily] = useState<ParentFamilyAccount | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const primaryActionLabel =
    parentFamily?.parent && form.parentContact.trim() === parentFamily.parent.contact
      ? "Link student to parent"
      : "Create and link profiles";

  useEffect(() => {
    void loadLatestFamily();
  }, []);

  async function loadLatestFamily() {
    try {
      const latest = await getLatestParentFamily();
      setParentFamily(latest);
    } catch {
      setParentFamily(null);
    }
  }

  async function saveAccounts() {
    const validation = getAccountValidationError(form);
    if (validation) {
      setMessage(validation);
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const student = await createStudentAccount({
        name: form.studentName.trim(),
        class_level: form.classLevel.trim(),
        age: Number.parseInt(form.age.trim(), 10),
        school_name: form.schoolName.trim()
      });
      const parent = await createParentAccount({
        name: form.parentName.trim(),
        contact: form.parentContact.trim(),
        relationship: form.relationship.trim()
      });
      const link = await linkParentStudent(parent.id, student.id);
      const updatedFamily = await getParentFamily(parent.id);
      setParentFamily(updatedFamily);
      setMessage("Profiles are linked. Existing records are reused when the details match.");
    } catch {
      setMessage("Could not save the account setup. Check that the API is running.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateField(field: keyof AccountForm, value: string) {
    setMessage("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function prepareAdditionalStudent() {
    if (!parentFamily?.parent) {
      return;
    }

    setForm((current) => ({
      ...current,
      studentName: "",
      classLevel: "",
      age: "",
      schoolName: "",
      parentName: parentFamily.parent?.name ?? current.parentName,
      parentContact: parentFamily.parent?.contact ?? current.parentContact,
      relationship: parentFamily.parent?.relationship ?? current.relationship
    }));
    setMessage("Parent details are ready. Enter the next student's details and link profiles.");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={32} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Account foundation</Text>
            <Text style={styles.title}>Link student and parent</Text>
            <Text style={styles.helper}>
              Create the basic profiles now. Use the same parent contact to add another child under one parent account.
            </Text>
          </View>
        </View>

        {parentFamily?.parent ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="link-variant" size={22} color={colors.success} />
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>{parentFamily.parent.name}</Text>
              <Text style={styles.helper}>
                {parentFamily.students.length} linked {parentFamily.students.length === 1 ? "student" : "students"}
              </Text>
              {parentFamily.students.length ? (
                <View style={styles.studentList}>
                  {parentFamily.students.map((student) => (
                    <View key={student.id} style={styles.studentPill}>
                      <Text style={styles.studentPillText}>{student.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Pressable accessibilityRole="button" onPress={prepareAdditionalStudent} style={styles.inlineAction}>
                <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.success} />
                <Text style={styles.inlineActionText}>Add another student</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Student profile</Text>
          <FormField
            label="Student name"
            onChangeText={(value) => updateField("studentName", value)}
            placeholder="Alliyah Olaniyan"
            value={form.studentName}
          />
          <FormField
            label="Class"
            onChangeText={(value) => updateField("classLevel", value)}
            placeholder="SS2 Science"
            value={form.classLevel}
          />
          <FormField
            keyboardType="number-pad"
            label="Age"
            onChangeText={(value) => updateField("age", value)}
            placeholder="15"
            value={form.age}
          />
          <FormField
            label="School name"
            onChangeText={(value) => updateField("schoolName", value)}
            placeholder="Optional"
            value={form.schoolName}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Parent profile</Text>
          <FormField
            label="Parent name"
            onChangeText={(value) => updateField("parentName", value)}
            placeholder="Mrs Olaniyan"
            value={form.parentName}
          />
          <FormField
            keyboardType="email-address"
            label="Phone or email"
            onChangeText={(value) => updateField("parentContact", value)}
            placeholder="08012345678"
            value={form.parentContact}
          />
          <FormField
            label="Relationship"
            onChangeText={(value) => updateField("relationship", value)}
            placeholder="Mother"
            value={form.relationship}
          />
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void saveAccounts()}
            style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
              </>
            )}
          </Pressable>

          <Link href="/student" asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Continue to student plan</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brand} />
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: TextInputProps["keyboardType"];
  placeholder: string;
};

function FormField({ label, value, onChangeText, keyboardType = "default", placeholder }: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={keyboardType === "default" ? "words" : "none"}
        keyboardType={keyboardType}
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder={isFocused ? "" : placeholder}
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function createDefaultAccountForm(): AccountForm {
  return {
    studentName: "",
    classLevel: "",
    age: "",
    schoolName: "",
    parentName: "",
    parentContact: "",
    relationship: ""
  };
}

function getAccountValidationError(form: AccountForm) {
  if (!isValidPersonName(form.studentName)) {
    return "Enter the student's full name.";
  }

  if (!isValidShortText(form.classLevel)) {
    return "Enter the student's class.";
  }

  if (!isIntegerInRange(form.age, 3, 30)) {
    return "Enter a valid student age between 3 and 30.";
  }

  if (!isValidPersonName(form.parentName)) {
    return "Enter the parent or guardian's full name.";
  }

  if (!isValidParentContact(form.parentContact)) {
    return "Enter a valid parent phone number or email address.";
  }

  if (!isValidShortText(form.relationship)) {
    return "Enter the parent's relationship to the student.";
  }

  return "";
}

function isWholeNumber(value: string) {
  return /^\d+$/.test(value.trim());
}

function isIntegerInRange(value: string, min: number, max: number) {
  if (!isWholeNumber(value)) {
    return false;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return parsed >= min && parsed <= max;
}

function isValidShortText(value: string) {
  const normalized = value.trim();
  return normalized.length >= 2 && /[a-zA-Z0-9]/.test(normalized);
}

function isValidPersonName(value: string) {
  const normalized = value.trim();
  return normalized.length >= 2 && /[a-zA-Z]/.test(normalized) && /^[a-zA-Z\s'.-]+$/.test(normalized);
}

function isValidParentContact(value: string) {
  const normalized = value.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(normalized)) {
    return true;
  }

  if (!/^[+\d\s()-]+$/.test(normalized)) {
    return false;
  }

  const digits = normalized.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm
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
    fontWeight: "700",
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
  infoCopy: {
    flex: 1,
    gap: spacing.xs
  },
  infoPanel: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  infoTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  inlineAction: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  inlineActionText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800"
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
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
    fontWeight: "800"
  },
  studentList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  studentPill: {
    backgroundColor: colors.panel,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  studentPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  }
});
