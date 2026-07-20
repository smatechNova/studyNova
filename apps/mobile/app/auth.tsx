import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { IllustrationPanel } from "@/components/IllustrationPanel";
import { Screen } from "@/components/Screen";
import { confirmAccessCodeRecovery, firebaseSignInAccount, requestAccessCodeRecovery, signInAccount } from "@/lib/api";
import { brandAssets } from "@/lib/brandAssets";
import {
  exchangeGoogleIdTokenForFirebaseIdToken,
  getFirebaseClientReadiness,
  getFirebaseClientConfig,
  isFirebaseClientConfigured,
  isFirebasePasswordResetConfigured,
  sendFirebasePasswordResetEmail
} from "@/lib/firebaseAuth";
import { saveAuthSession } from "@/lib/session";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type { AuthRole, AuthSession } from "@/types";

WebBrowser.maybeCompleteAuthSession();

const ROLE_OPTIONS: Array<{
  role: AuthRole;
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}> = [
  {
    role: "student",
    title: "Student",
    description: "Open only this student's plan, timetable, and study progress.",
    icon: "notebook-edit-outline"
  },
  {
    role: "parent",
    title: "Parent/guardian",
    description: "Monitor linked students from the parent dashboard.",
    icon: "shield-account-outline"
  }
];

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<AuthRole>(() => normalizeRole(params.role));
  const [loginId, setLoginId] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [recoveryContact, setRecoveryContact] = useState("");
  const [recoveryId, setRecoveryId] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");
  const [confirmAccessCode, setConfirmAccessCode] = useState("");
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const firebaseConfig = getFirebaseClientConfig();
  const firebaseReadiness = getFirebaseClientReadiness();
  const firebaseReady = isFirebaseClientConfigured();
  const [googleRequest, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    androidClientId: firebaseConfig.googleAndroidClientId,
    iosClientId: firebaseConfig.googleIosClientId,
    selectAccount: true,
    webClientId: firebaseConfig.googleWebClientId
  });

  useEffect(() => {
    setRole(normalizeRole(params.role));
  }, [params.role]);

  useEffect(() => {
    if (googleResponse?.type === "success" && googleResponse.params.id_token) {
      void completeFirebaseSignIn(googleResponse.params.id_token);
    } else if (googleResponse?.type === "error") {
      setMessage("Google sign-in could not be completed. Please try again or use the login ID.");
    }
  }, [googleResponse]);

  async function signIn() {
    if (!isValidLoginId(loginId)) {
      setMessage("Enter the login ID used when the account was created.");
      return;
    }

    if (!isValidAccessCode(accessCode)) {
      setMessage("Enter the 4 to 6 digit access code for this account.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const session = await signInAccount({ role, login_id: loginId.trim(), access_code: accessCode.trim() });
      await routeSession(session);
    } catch {
      setMessage("No account matched that role, login ID, and access code. Check the details or create the account.");
      setIsHelpOpen(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!firebaseReady) {
      setMessage(
        firebaseReadiness.missingKeys.length
          ? `Google sign-in needs: ${firebaseReadiness.missingKeys.join(", ")}.`
          : "Google sign-in needs Firebase keys in the app environment first."
      );
      return;
    }

    setMessage("");
    await promptGoogleSignIn();
  }

  async function completeFirebaseSignIn(googleIdToken: string) {
    setIsLoading(true);
    setMessage("");

    try {
      const firebaseIdToken = await exchangeGoogleIdTokenForFirebaseIdToken(googleIdToken);
      const session = await firebaseSignInAccount({ role, id_token: firebaseIdToken });
      await routeSession(session);
    } catch {
      setMessage(
        "Google sign-in worked, but no StudyNova account is linked to that Gmail yet. Create or link the account first."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function routeSession(session: AuthSession) {
    if (session.role === "student" && role === "student" && session.student) {
      await saveAuthSession(session);
      router.replace(`/student?studentId=${encodeURIComponent(session.student.id)}`);
      return;
    }

    if (session.role === "parent" && role === "parent" && session.parent) {
      await saveAuthSession(session);
      router.replace(`/parent?parentId=${encodeURIComponent(session.parent.id)}`);
      return;
    }

    setMessage("This account exists, but it is not linked to the selected role.");
  }

  function openGmailSignup() {
    void Linking.openURL("https://accounts.google.com/signup");
  }

  function openForgotPassword() {
    setIsHelpOpen(true);
    setMessage("");
    if (!recoveryContact && isValidEmail(loginId)) {
      setRecoveryContact(loginId.trim());
    }
  }

  async function submitAccountHelpRequest() {
    if (!isValidEmail(recoveryContact)) {
      setMessage("Enter the email address linked to this StudyNova account.");
      return;
    }

    setIsRecoveryLoading(true);
    setMessage("");

    try {
      const recoveryEmail = recoveryContact.trim().toLowerCase();
      const recoveryLoginId = loginId.trim() || recoveryEmail;
      const canSendFirebaseReset = isFirebasePasswordResetConfigured();
      let firebaseResetSent = false;

      if (canSendFirebaseReset) {
        try {
          await sendFirebasePasswordResetEmail(recoveryEmail);
          firebaseResetSent = true;
        } catch {
          firebaseResetSent = false;
        }
      }

      const receipt = await requestAccessCodeRecovery({
        role,
        login_id: recoveryLoginId,
        email: recoveryEmail
      });
      setRecoveryId(receipt.recovery_id);
      setRecoveryCode(receipt.dev_code ?? "");
      setMessage(
        firebaseResetSent
          ? "Check your email for a StudyNova reset code or Firebase password-reset link."
          : receipt.message
      );
    } catch {
      setMessage("Could not send the account help request. Check the API connection and try again.");
    } finally {
      setIsRecoveryLoading(false);
    }
  }

  async function completeAccessCodeReset() {
    if (!/^\d{6}$/.test(recoveryCode)) {
      setMessage("Enter the six-digit reset code sent by email.");
      return;
    }
    if (!isValidAccessCode(newAccessCode)) {
      setMessage("Choose a new 4 to 6 digit access code.");
      return;
    }
    if (newAccessCode !== confirmAccessCode) {
      setMessage("The new access codes do not match.");
      return;
    }
    setIsRecoveryLoading(true);
    setMessage("");
    try {
      const result = await confirmAccessCodeRecovery({
        recovery_id: recoveryId,
        code: recoveryCode,
        new_access_code: newAccessCode
      });
      setMessage(result.message);
      setAccessCode(newAccessCode);
      setRecoveryId("");
      setRecoveryCode("");
      setNewAccessCode("");
      setConfirmAccessCode("");
      setIsHelpOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The reset code is invalid or expired.");
    } finally {
      setIsRecoveryLoading(false);
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
            <MaterialCommunityIcons name="login-variant" size={34} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Sign in</Text>
            <Text style={styles.title}>Choose your account type</Text>
            <Text style={styles.helper}>
              Students open only their own dashboard. Parents open the monitoring dashboard for linked students.
            </Text>
          </View>
        </View>

        <IllustrationPanel
          body="Choose the right role before signing in so each student and parent opens only the dashboard meant for them."
          imageSource={role === "student" ? brandAssets.studentEntryCard : brandAssets.parentEntryCard}
          kicker="Secure role access"
          title={role === "student" ? "Student study access" : "Parent monitoring access"}
        />

        <View style={styles.roleGrid}>
          {ROLE_OPTIONS.map((option) => {
            const isSelected = role === option.role;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.role}
                onPress={() => {
                  setRole(option.role);
                  setAccessCode("");
                  setMessage("");
                }}
                style={[styles.roleCard, isSelected ? styles.roleCardSelected : null]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={28}
                  color={isSelected ? colors.brand : colors.muted}
                />
                <View style={styles.roleCopy}>
                  <Text style={styles.roleTitle}>{option.title}</Text>
                  <Text style={styles.helper}>{option.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!firebaseReady || !googleRequest || isLoading}
          onPress={() => void signInWithGoogle()}
          style={[
            styles.googleButton,
            !firebaseReady || !googleRequest || isLoading ? styles.disabledButton : null
          ]}
        >
          <MaterialCommunityIcons name="google" size={20} color={colors.text} />
          <Text style={styles.googleButtonText}>
            Continue with Google as {role === "student" ? "student" : "parent"}
          </Text>
        </Pressable>
        {!firebaseReady ? (
          <Text style={styles.helper}>
            Google sign-in will activate after Firebase and Google client IDs are added. The login ID option below
            still works now.
          </Text>
        ) : null}
        {firebaseReady && firebaseReadiness.warnings.length ? (
          <Text style={styles.helper}>{firebaseReadiness.warnings[0]}</Text>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{role === "student" ? "Student login ID" : "Parent login ID"}</Text>
          <Text style={styles.helper}>
            {role === "student"
              ? "Use the student's Gmail or phone number, plus their private access code."
              : "Use the parent email, plus the parent access code."}
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => {
              setMessage("");
              setLoginId(value);
            }}
            placeholder={role === "student" ? "student@gmail.com" : "parent@gmail.com"}
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={loginId}
          />
          <TextInput
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => {
              setMessage("");
              setAccessCode(value.replace(/\D/g, ""));
            }}
            placeholder="4-6 digit access code"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={accessCode}
          />

          <Pressable accessibilityRole="button" onPress={openForgotPassword} style={styles.forgotButton}>
            <MaterialCommunityIcons name="lock-question" size={18} color={colors.brand} />
            <Text style={styles.forgotButtonText}>Forgot password? Recover by email</Text>
          </Pressable>

          {role === "student" ? (
            <Pressable accessibilityRole="link" onPress={openGmailSignup} style={styles.gmailLink}>
              <MaterialCommunityIcons name="email-plus-outline" size={18} color={colors.brand} />
              <Text style={styles.gmailLinkText}>Create Gmail for student</Text>
            </Pressable>
          ) : null}
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.helpPanel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIsHelpOpen((current) => !current);
              setMessage("");
            }}
            style={styles.helpHeader}
          >
            <View style={styles.helpIcon}>
              <MaterialCommunityIcons name="lock-reset" size={20} color={colors.brand} />
            </View>
            <View style={styles.roleCopy}>
              <Text style={styles.sectionTitle}>Email recovery</Text>
              <Text style={styles.helper}>
                Receive a secure reset code by email, then choose a new access code. Student codes go to the linked
                verified parent or guardian email.
              </Text>
            </View>
            <MaterialCommunityIcons
              name={isHelpOpen ? "chevron-up" : "chevron-down"}
              size={22}
              color={colors.muted}
            />
          </Pressable>

          {isHelpOpen ? (
            <View style={styles.helpBody}>
              {!recoveryId ? (
                <>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={(value) => {
                  setMessage("");
                  setRecoveryContact(value);
                }}
                placeholder="account@email.com"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={recoveryContact}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isRecoveryLoading}
                onPress={() => void submitAccountHelpRequest()}
                style={[styles.secondaryButton, isRecoveryLoading ? styles.disabledButton : null]}
              >
                {isRecoveryLoading ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send-outline" size={18} color={colors.brand} />
                    <Text style={styles.secondaryButtonText}>Email reset code</Text>
                  </>
                )}
              </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.helper}>Enter the code from your email and choose a new private access code.</Text>
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setRecoveryCode(value.replace(/\D/g, ""))}
                    placeholder="6-digit email code"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    value={recoveryCode}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setNewAccessCode(value.replace(/\D/g, ""))}
                    placeholder="New 4-6 digit access code"
                    placeholderTextColor={colors.muted}
                    secureTextEntry
                    style={styles.input}
                    value={newAccessCode}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => setConfirmAccessCode(value.replace(/\D/g, ""))}
                    placeholder="Confirm new access code"
                    placeholderTextColor={colors.muted}
                    secureTextEntry
                    style={styles.input}
                    value={confirmAccessCode}
                  />
                  <Pressable
                    accessibilityRole="button"
                    disabled={isRecoveryLoading}
                    onPress={() => void completeAccessCodeReset()}
                    style={[styles.secondaryButton, isRecoveryLoading ? styles.disabledButton : null]}
                  >
                    {isRecoveryLoading ? <ActivityIndicator color={colors.brand} /> : (
                      <>
                        <MaterialCommunityIcons name="lock-check-outline" size={18} color={colors.brand} />
                        <Text style={styles.secondaryButtonText}>Set new access code</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setRecoveryId("");
                      setRecoveryCode("");
                      setMessage("");
                    }}
                    style={styles.forgotButton}
                  >
                    <Text style={styles.forgotButtonText}>Send another code</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void signIn()}
            style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  Sign in as {role === "student" ? "student" : "parent"}
                </Text>
              </>
            )}
          </Pressable>

          <Link href="/accounts" asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Create or link account</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.brand} />
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </Screen>
  );
}

function normalizeRole(value?: string): AuthRole {
  return value === "parent" ? "parent" : "student";
}

function isValidLoginId(value: string) {
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidAccessCode(value: string) {
  return /^\d{4,6}$/.test(value.trim());
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
  googleButton: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  forgotButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.xs
  },
  forgotButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "900"
  },
  helpBody: {
    gap: spacing.sm,
    paddingTop: spacing.sm
  },
  helpHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  helpIcon: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  helpPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md
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
  noteInput: {
    minHeight: 88,
    textAlignVertical: "top"
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
  roleCard: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  roleCardSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  roleCopy: {
    flex: 1,
    gap: spacing.xs
  },
  roleGrid: {
    gap: spacing.sm
  },
  roleTitle: {
    color: colors.text,
    fontSize: 17,
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  }
});
}
