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
import { IllustrationPanel } from "@/components/IllustrationPanel";
import { Screen } from "@/components/Screen";
import {
  confirmParentEmailVerification,
  createParentAccount,
  createStudentAccount,
  getLatestParentFamily,
  getParentFamily,
  linkParentStudent,
  requestParentEmailVerification,
  signInAccount
} from "@/lib/api";
import { brandAssets } from "@/lib/brandAssets";
import { saveAuthSession } from "@/lib/session";
import type { ParentEmailVerificationReceipt, ParentFamilyAccount } from "@/types";
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
  studentId?: string;
  parentId: string;
};

type SetupMode = "studentParent" | "parentOnly";

type AccountAction = "save" | "verify" | "student" | "parent";

export default function AccountsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ parentId?: string }>();
  const parentId = getParamValue(params.parentId);
  const [form, setForm] = useState<AccountForm>(() => createDefaultAccountForm());
  const [setupMode, setSetupMode] = useState<SetupMode>("studentParent");
  const [parentFamily, setParentFamily] = useState<ParentFamilyAccount | null>(null);
  const [message, setMessage] = useState("");
  const [activeAction, setActiveAction] = useState<AccountAction | null>(null);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationReceipt, setVerificationReceipt] = useState<ParentEmailVerificationReceipt | null>(null);
  const [verificationClock, setVerificationClock] = useState(() => Date.now());
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const isLoading = activeAction !== null;
  const currentParent = parentFamily?.parent ?? null;
  const isParentVerified = Boolean(currentParent?.email_verified);
  const resendSecondsRemaining = verificationReceipt
    ? Math.max(0, Math.ceil((new Date(verificationReceipt.resend_available_at).getTime() - verificationClock) / 1000))
    : 0;
  const primaryActionLabel =
    setupMode === "parentOnly"
      ? "Sign up parent account"
      : parentFamily?.parent && form.parentContact.trim() === parentFamily.parent.contact
      ? "Link this student to parent"
      : "Sign up student and link parent";

  useEffect(() => {
    void loadLatestFamily();
  }, [parentId]);

  useEffect(() => {
    if (!verificationReceipt || resendSecondsRemaining <= 0) {
      return;
    }

    const timer = setInterval(() => setVerificationClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [verificationReceipt, resendSecondsRemaining]);

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

  async function beginParentEmailVerification(parentId: string) {
    const receipt = await requestParentEmailVerification(parentId);
    setVerificationReceipt(receipt);
    setVerificationCode(receipt.dev_code ?? "");
    setVerificationClock(Date.now());
    return receipt;
  }

  async function saveAccounts() {
    const validation = getAccountValidationError(form, setupMode);
    if (validation) {
      setMessage(validation);
      return;
    }

    if (!acceptedTerms) {
      setMessage("Confirm the parent or guardian agreement before creating the accounts.");
      return;
    }

    setActiveAction("save");
    setMessage("");

    try {
      if (setupMode === "parentOnly") {
        const parent = await createParentAccount({
          name: form.parentName.trim(),
          contact: form.parentContact.trim(),
          access_code: form.parentAccessCode.trim(),
          relationship: form.relationship.trim()
        });
        setParentFamily((current) => ({
          parent,
          students: current?.parent?.id === parent.id ? current.students : [],
          links: current?.parent?.id === parent.id ? current.links : []
        }));
        setSetupResult({ parentId: parent.id });
        if (!parent.email_verified) {
          const receipt = await beginParentEmailVerification(parent.id);
          setMessage(`Verify ${receipt.email} before opening dashboards. Enter the code sent to the parent email.`);
          return;
        }
        setMessage("Parent monitoring account is ready. Open the parent dashboard and link students with invite codes.");
        return;
      }

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
      if (!parent.email_verified) {
        const receipt = await beginParentEmailVerification(parent.id);
        setMessage(`Verify ${receipt.email} before opening dashboards. Enter the code sent to the parent email.`);
        return;
      }
      setMessage("Profiles are linked. Choose which dashboard to open next.");
    } catch (error) {
      setMessage(accountSetupErrorMessage(error));
    } finally {
      setActiveAction(null);
    }
  }

  function updateField(field: keyof AccountForm, value: string) {
    setMessage("");
    setSetupResult(null);
    setVerificationReceipt(null);
    setVerificationCode("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  function prepareAdditionalStudent() {
    if (!parentFamily?.parent) {
      return;
    }

    setSetupMode("studentParent");
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
    setVerificationReceipt(null);
    setVerificationCode("");
    setMessage("Parent monitoring details are ready. Enter one student's details and link that student.");
  }

  function openGmailSignup() {
    void Linking.openURL("https://accounts.google.com/signup");
  }

  function chooseSetupMode(nextMode: SetupMode) {
    setSetupMode(nextMode);
    setMessage("");
    setSetupResult(null);
    setVerificationReceipt(null);
    setVerificationCode("");
  }

  async function verifyParentEmail() {
    if (!setupResult?.parentId) {
      setMessage("Create or link the parent account first, then verify the parent email.");
      return;
    }

    if (!/^\d{6}$/.test(verificationCode.trim())) {
      setMessage("Enter the 6 digit code sent to the parent email.");
      return;
    }

    setActiveAction("verify");
    setMessage("");

    try {
      const receipt = await confirmParentEmailVerification(setupResult.parentId, verificationCode.trim());
      setParentFamily((current) => ({
        parent: receipt.parent,
        students: current?.students ?? [],
        links: current?.links ?? []
      }));
      setVerificationReceipt(null);
      setVerificationCode("");
      setMessage(receipt.message);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      setMessage(detail || "The verification code could not be confirmed. Check the code and try again.");
    } finally {
      setActiveAction(null);
    }
  }

  async function resendParentVerificationCode() {
    if (!setupResult?.parentId) {
      setMessage("Create or link the parent account first, then request a verification code.");
      return;
    }

    setActiveAction("verify");
    setMessage("");

    try {
      const receipt = await beginParentEmailVerification(setupResult.parentId);
      setMessage(`A fresh verification code was sent to ${receipt.email}.`);
    } catch (error) {
      setMessage(accountSetupErrorMessage(error));
    } finally {
      setActiveAction(null);
    }
  }

  async function continueToDashboard(role: "student" | "parent") {
    const login_id = role === "student" ? form.studentLoginId.trim() : form.parentContact.trim();
    const access_code = role === "student" ? form.studentAccessCode.trim() : form.parentAccessCode.trim();

    if (!setupResult) {
      setMessage("Create or link the profiles first, then open the correct dashboard.");
      return;
    }

    if (role === "student" && !setupResult.studentId) {
      setMessage("This setup only created a parent account. Create or link a student before opening a student dashboard.");
      return;
    }

    if (!isParentVerified) {
      setMessage("Verify the parent email before opening either dashboard.");
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
            <Text style={styles.kicker}>Sign up</Text>
            <Text style={styles.title}>Student account plus parent monitoring</Text>
            <Text style={styles.helper}>
              Each student owns one student account. A parent account can link more than one student for monitoring.
            </Text>
          </View>
        </View>

        <IllustrationPanel
          body="Create separate student and parent identities, then connect them only through the approved parent link."
          imageSource={brandAssets.accountSetup}
          kicker="Safe linking"
          title="One student account, many parent insights"
        />

        <View style={styles.modeGrid}>
          <Pressable
            accessibilityRole="button"
            onPress={() => chooseSetupMode("studentParent")}
            style={[styles.modeCard, setupMode === "studentParent" ? styles.modeCardSelected : null]}
          >
            <MaterialCommunityIcons
              name="account-multiple-plus-outline"
              size={24}
              color={setupMode === "studentParent" ? colors.brand : colors.muted}
            />
            <View style={styles.modeCopy}>
              <Text style={styles.modeTitle}>Student plus parent</Text>
              <Text style={styles.helper}>Create one learner account and link it to parent monitoring.</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => chooseSetupMode("parentOnly")}
            style={[styles.modeCard, setupMode === "parentOnly" ? styles.modeCardSelected : null]}
          >
            <MaterialCommunityIcons
              name="shield-account-outline"
              size={24}
              color={setupMode === "parentOnly" ? colors.brand : colors.muted}
            />
            <View style={styles.modeCopy}>
              <Text style={styles.modeTitle}>Parent only</Text>
              <Text style={styles.helper}>Create a parent account now, then add students later by invite code.</Text>
            </View>
          </Pressable>
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

        {setupMode === "studentParent" ? (
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
            <Text style={styles.helper}>
              If the student has no Gmail yet, a phone number can be used for now. Parent email below is still required
              for verification and recovery.
            </Text>
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
              placeholder="13 or older"
              value={form.age}
            />
            <FormField
              label="School name"
              onChangeText={(value) => updateField("schoolName", value)}
              placeholder="Optional"
              value={form.schoolName}
            />
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>Parent monitoring account</Text>
            <Text style={styles.helper}>
              Parent email is required for verification, recovery, and future Google sign-in, even when the student has
              no email account.
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
            label="Parent email"
            onChangeText={(value) => updateField("parentContact", value)}
            placeholder="parent@gmail.com"
            value={form.parentContact}
          />
          <Text style={styles.helper}>
            Use the same Gmail the parent will select on this phone. One parent email can monitor multiple students.
          </Text>
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

        {setupResult && !isParentVerified ? (
          <View style={styles.verifyPanel}>
            <View style={styles.readyIcon}>
              <MaterialCommunityIcons name="email-check-outline" size={24} color={colors.brand} />
            </View>
            <View style={styles.readyCopy}>
              <Text style={styles.sectionTitle}>Verify parent email</Text>
              <Text style={styles.helper}>
                Enter the 6 digit code sent to {verificationReceipt?.email || form.parentContact.trim()}. This keeps
                student accounts linked to a confirmed parent or guardian.
              </Text>
              {verificationReceipt?.dev_code ? (
                <View style={styles.devCodePanel}>
                  <Text style={styles.kicker}>Development code</Text>
                  <Text style={styles.devCodeText}>{verificationReceipt.dev_code}</Text>
                </View>
              ) : null}
              <FormField
                keyboardType="number-pad"
                label="Verification code"
                maxLength={6}
                onChangeText={(value) => {
                  setMessage("");
                  setVerificationCode(value.replace(/\D/g, ""));
                }}
                placeholder="6 digits"
                value={verificationCode}
              />
              <View style={styles.readyActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={() => void verifyParentEmail()}
                  style={[styles.primaryButton, styles.readyButton, isLoading ? styles.disabledButton : null]}
                >
                  {activeAction === "verify" ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="shield-check-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryButtonText}>Verify and continue</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading || resendSecondsRemaining > 0}
                  onPress={() => void resendParentVerificationCode()}
                  style={[
                    styles.secondaryButton,
                    styles.readyButton,
                    isLoading || resendSecondsRemaining > 0 ? styles.disabledButton : null
                  ]}
                >
                  <MaterialCommunityIcons name="email-sync-outline" size={18} color={colors.brand} />
                  <Text style={styles.secondaryButtonText}>
                    {resendSecondsRemaining > 0 ? `Send again in ${resendSecondsRemaining}s` : "Send new code"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {setupResult && isParentVerified ? (
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
                {setupResult.studentId ? (
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
                ) : null}
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

        <View style={styles.consentPanel}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            onPress={() => {
              setAcceptedTerms((current) => !current);
              setMessage("");
            }}
            style={styles.consentRow}
          >
            <MaterialCommunityIcons
              name={acceptedTerms ? "checkbox-marked" : "checkbox-blank-outline"}
              size={24}
              color={acceptedTerms ? colors.brand : colors.muted}
            />
            <Text style={styles.consentText}>
              I am the parent or guardian, I approve this student account, and I agree to StudyNova's Terms of Use and Privacy Policy.
            </Text>
          </Pressable>
          <View style={styles.consentLinks}>
            <Link href="/terms" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.consentLinkText}>Read Terms of Use</Text>
              </Pressable>
            </Link>
            <Link href="/privacy" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.consentLinkText}>Read Privacy Policy</Text>
              </Pressable>
            </Link>
          </View>
        </View>

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

          <Link href={setupMode === "parentOnly" ? "/auth?role=parent" : "/auth?role=student"} asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                Sign in to {setupMode === "parentOnly" ? "parent" : "student"} dashboard
              </Text>
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

function getAccountValidationError(form: AccountForm, setupMode: SetupMode) {
  if (setupMode === "studentParent") {
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

    if (!isIntegerInRange(form.age, 13, 30)) {
      return "StudyNova accounts are currently available to students aged 13 to 30.";
    }
  }

  if (!isValidPersonName(form.parentName)) {
    return "Enter the parent or guardian's full name.";
  }

  if (!isValidEmail(form.parentContact)) {
    return "Enter a valid parent email address. Parent email is required for account verification and recovery.";
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
  if (isValidEmail(normalized)) {
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidAccessCode(value: string) {
  return /^\d{4,6}$/.test(value.trim());
}

function accountSetupErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : "";

  if (/Failed to fetch|Network request failed|NetworkError|Load failed/i.test(detail)) {
    return "Could not reach the StudyNova API. Start the API server and confirm the app is using the correct API URL.";
  }

  if (detail.includes("Student account already exists with a different access code.")) {
    return "This student login ID already exists with another access code. Use the original student code, choose a different login ID, or use account recovery.";
  }

  if (detail.includes("Parent account already exists with a different access code.")) {
    return "This parent email already exists with another access code. Use the original parent code, choose a different parent email, or use account recovery.";
  }

  if (detail.includes("Parent or student account was not found.")) {
    return "The profile was saved, but the parent-student link could not be completed. Open sign up again and link the student to the parent.";
  }

  if (detail) {
    return detail;
  }

  return "Could not finish sign up. Check the API and confirm any existing account access code.";
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
  consentLinkText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800"
  },
  consentLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingLeft: 32
  },
  consentPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
  },
  consentRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm
  },
  consentText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 21
  },
  disabledButton: {
    opacity: 0.55
  },
  devCodePanel: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md
  },
  devCodeText: {
    color: colors.brandDark,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0
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
  modeCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minWidth: 240,
    padding: spacing.md
  },
  modeCardSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  modeCopy: {
    flex: 1,
    gap: spacing.xs
  },
  modeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  modeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900"
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
  verifyPanel: {
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
