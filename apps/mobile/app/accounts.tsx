import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps
} from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { Screen } from "@/components/Screen";
import {
  createParentAccount,
  createStudentAccount,
  getLatestParentFamily,
  getParentFamily,
  linkParentStudent,
  signInAccount
} from "@/lib/api";
import { saveAuthSession } from "@/lib/session";
import type { ParentFamilyAccount } from "@/types";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type AccountForm = {
  studentLoginId: string;
  studentAccessCode: string;
  studentName: string;
  classLevel: string;
  age: string;
  schoolName: string;
  parentName: string;
  parentContact: string;
  parentAccessCode: string;
  relationship: string;
};

type SetupResult = {
  studentId: string;
  parentId: string;
};

type AccountAction = "save" | "student" | "parent";

export default function AccountsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ parentId?: string }>();
  const parentId = getParamValue(params.parentId);
  const [form, setForm] = useState<AccountForm>(() => createDefaultAccountForm());
  const [parentFamily, setParentFamily] = useState<ParentFamilyAccount | null>(null);
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<AccountAction | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const isLoading = activeAction !== null;
  const primaryActionLabel =
    parentFamily?.parent && form.parentContact.trim() === parentFamily.parent.contact
      ? "Link this student to parent"
      : "Create student and parent link";

  useEffect(() => {
    void loadLatestFamily();
  }, [parentId]);

  async function loadLatestFamily() {
    try {
      const latest = parentId ? await getParentFamily(parentId) : await getLatestParentFamily();
      setParentFamily(latest);
      if (latest.parent) {
        setForm((current) => ({
          ...current,
          parentName: current.parentName || latest.parent?.name || "",
          parentContact: current.parentContact || latest.parent?.contact || "",
          relationship: current.relationship || latest.parent?.relationship || ""
        }));
      }
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

    setActiveAction("save");
    setMessage("");

    try {
      const student = await createStudentAccount({
        login_id: form.studentLoginId.trim(),
        access_code: form.studentAccessCode.trim(),
        name: form.studentName.trim(),
        class_level: form.classLevel.trim(),
        age: Number.parseInt(form.age.trim(), 10),
        school_name: form.schoolName.trim()
      });
      const parent = await createParentAccount({
        name: form.parentName.trim(),
        contact: form.parentContact.trim(),
        access_code: form.parentAccessCode.trim(),
        relationship: form.relationship.trim()
      });
      const link = await linkParentStudent(parent.id, student.id);
      setParentFamily((current) => ({
        parent,
        students: current?.parent?.id === parent.id ? upsertById(current.students, student) : [student],
        links: current?.parent?.id === parent.id ? upsertById(current.links, link) : [link]
      }));
      setSetupResult({ studentId: student.id, parentId: parent.id });
      setMessage("Profiles are linked. Choose which dashboard to open next.");
    } catch {
      setMessage("Could not save the account setup. Check the API and confirm any existing account access code.");
    } finally {
      setActiveAction(null);
    }
  }

  function updateField(field: keyof AccountForm, value: string) {
    setMessage("");
    setSetupResult(null);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function prepareAdditionalStudent() {
    if (!parentFamily?.parent) {
      return;
    }

    setForm((current) => ({
      ...current,
      studentLoginId: "",
      studentAccessCode: "",
      studentName: "",
      classLevel: "",
      age: "",
      schoolName: "",
      parentName: parentFamily.parent?.name ?? current.parentName,
      parentContact: parentFamily.parent?.contact ?? current.parentContact,
      relationship: parentFamily.parent?.relationship ?? current.relationship
    }));
    setSetupResult(null);
    setMessage("Parent monitoring details are ready. Enter one student's details and link that student.");
  }

  function openGmailSignup() {
    void Linking.openURL("https://accounts.google.com/signup");
  }

  async function continueToDashboard(role: "student" | "parent") {
    const login_id = role === "student" ? form.studentLoginId.trim() : form.parentContact.trim();
    const access_code = role === "student" ? form.studentAccessCode.trim() : form.parentAccessCode.trim();

    if (!setupResult) {
      setMessage("Create or link the profiles first, then open the correct dashboard.");
      return;
    }

    setActiveAction(role);
    setMessage("");

    try {
      const session = await signInAccount({ role, login_id, access_code });
      await saveAuthSession(session);

      if (role === "student" && session.student) {
        router.replace(`/student?studentId=${encodeURIComponent(session.student.id)}`);
        return;
      }

      if (role === "parent" && session.parent) {
        router.replace(`/parent?parentId=${encodeURIComponent(session.parent.id)}`);
        return;
      }

      setMessage("The account was found, but it does not match the dashboard selected.");
    } catch {
      setMessage("The profiles were linked, but automatic sign-in failed. Use the sign-in screen with the same details.");
    } finally {
      setActiveAction(null);
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
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={32} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Account model</Text>
            <Text style={styles.title}>Student account plus parent monitoring</Text>
            <Text style={styles.helper}>
              Each student owns one student account. A parent account can link more than one student for monitoring.
            </Text>
          </View>
        </View>

        {parentFamily?.parent ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="link-variant" size={22} color={colors.success} />
            <View style={styles.infoCopy}>
              <Text style={styles.kicker}>Parent monitoring account</Text>
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
                <Text style={styles.inlineActionText}>Link another student</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Student account</Text>
            <Text style={styles.helper}>This profile belongs to one learner and feeds that learner's dashboard.</Text>
          </View>
          <FormField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Student login ID"
            onChangeText={(value) => updateField("studentLoginId", value)}
            placeholder="student@gmail.com or phone number"
            value={form.studentLoginId}
          />
          <FormField
            keyboardType="number-pad"
            label="Student access code"
            maxLength={6}
            onChangeText={(value) => updateField("studentAccessCode", value.replace(/\D/g, ""))}
            placeholder="4-6 digits"
            secureTextEntry
            value={form.studentAccessCode}
          />
          <Pressable accessibilityRole="link" onPress={openGmailSignup} style={styles.gmailLink}>
            <MaterialCommunityIcons name="email-plus-outline" size={18} color={colors.brand} />
            <Text style={styles.gmailLinkText}>Create Gmail for student</Text>
          </Pressable>
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
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Parent monitoring account</Text>
            <Text style={styles.helper}>
              Reuse the same parent contact when linking another student to this parent.
            </Text>
          </View>
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
            keyboardType="number-pad"
            label="Parent access code"
            maxLength={6}
            onChangeText={(value) => updateField("parentAccessCode", value.replace(/\D/g, ""))}
            placeholder="4-6 digits"
            secureTextEntry
            value={form.parentAccessCode}
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

        {setupResult ? (
          <View style={styles.readyPanel}>
            <View style={styles.readyIcon}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.success} />
            </View>
            <View style={styles.readyCopy}>
              <Text style={styles.sectionTitle}>Accounts are ready</Text>
              <Text style={styles.helper}>
                Student and parent dashboards stay separate. Open the dashboard for the person using this device now.
              </Text>
              <View style={styles.readyActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={() => void continueToDashboard("student")}
                  style={[styles.primaryButton, styles.readyButton, isLoading ? styles.disabledButton : null]}
                >
                  {activeAction === "student" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="notebook-edit-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Open student dashboard</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={() => void continueToDashboard("parent")}
                  style={[styles.secondaryButton, styles.readyButton, isLoading ? styles.disabledButton : null]}
                >
                  {activeAction === "parent" ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="shield-account-outline" size={18} color={colors.brand} />
                      <Text style={styles.secondaryButtonText}>Open parent dashboard</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void saveAccounts()}
            style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
          >
            {activeAction === "save" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
              </>
            )}
          </Pressable>

          <Link href="/auth?role=student" asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Sign in to student dashboard</Text>
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
  autoCapitalize?: TextInputProps["autoCapitalize"];
  keyboardType?: TextInputProps["keyboardType"];
  maxLength?: TextInputProps["maxLength"];
  placeholder: string;
  secureTextEntry?: TextInputProps["secureTextEntry"];
};

function FormField({
  label,
  value,
  onChangeText,
  autoCapitalize,
  keyboardType = "default",
  maxLength,
  placeholder,
  secureTextEntry = false
}: FormFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize ?? (keyboardType === "default" ? "words" : "none")}
        keyboardType={keyboardType}
        maxLength={maxLength}
        onBlur={() => setIsFocused(false)}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        placeholder={isFocused ? "" : placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function createDefaultAccountForm(): AccountForm {
  return {
    studentLoginId: "",
    studentAccessCode: "",
    studentName: "",
    classLevel: "",
    age: "",
    schoolName: "",
    parentName: "",
    parentContact: "",
    parentAccessCode: "",
    relationship: ""
  };
}

function getAccountValidationError(form: AccountForm) {
  if (!isValidLoginId(form.studentLoginId)) {
    return "Enter a valid student login ID, such as Gmail or phone number.";
  }

  if (!isValidAccessCode(form.studentAccessCode)) {
    return "Create a 4 to 6 digit access code for the student account.";
  }

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

  if (!isValidAccessCode(form.parentAccessCode)) {
    return "Create a 4 to 6 digit access code for the parent account.";
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

function isValidLoginId(value: string) {
  return isValidParentContact(value);
}

function isValidAccessCode(value: string) {
  return /^\d{4,6}$/.test(value.trim());
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const existingIndex = items.findIndex((current) => current.id === item.id);
  if (existingIndex === -1) {
    return [...items, item];
  }

  return items.map((current) => (current.id === item.id ? item : current));
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
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
  gmailLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.xs
  },
  gmailLinkText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800"
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
  readyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  readyButton: {
    flexGrow: 1
  },
  readyCopy: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 220
  },
  readyIcon: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  readyPanel: {
    alignItems: "flex-start",
    backgroundColor: colors.panel,
    borderColor: colors.success,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    padding: spacing.lg
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
  sectionCopy: {
    gap: spacing.xs
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
}
