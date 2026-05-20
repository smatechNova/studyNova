import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "@/components/Screen";
import { signInAccount } from "@/lib/api";
import { colors, spacing } from "@/theme";
import type { AuthRole } from "@/types";

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
  const params = useLocalSearchParams<{ role?: string }>();
  const [role, setRole] = useState<AuthRole>(() => normalizeRole(params.role));
  const [loginId, setLoginId] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setRole(normalizeRole(params.role));
  }, [params.role]);

  async function signIn() {
    if (!isValidLoginId(loginId)) {
      setMessage("Enter the login ID used when the account was created.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const session = await signInAccount({ role, login_id: loginId.trim() });
      if (role === "student" && session.student) {
        router.replace(`/student?studentId=${encodeURIComponent(session.student.id)}`);
        return;
      }

      if (role === "parent" && session.parent) {
        router.replace(`/parent?parentId=${encodeURIComponent(session.parent.id)}`);
        return;
      }

      setMessage("This account exists, but it is not linked to the selected role.");
    } catch {
      setMessage("No account matched that role and login ID. Create the account first, then sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  function openGmailSignup() {
    void Linking.openURL("https://accounts.google.com/signup");
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        <View style={styles.roleGrid}>
          {ROLE_OPTIONS.map((option) => {
            const isSelected = role === option.role;
            return (
              <Pressable
                accessibilityRole="button"
                key={option.role}
                onPress={() => {
                  setRole(option.role);
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

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{role === "student" ? "Student login ID" : "Parent login ID"}</Text>
          <Text style={styles.helper}>
            {role === "student"
              ? "Use the student's Gmail or phone number saved on the student account."
              : "Use the parent phone number or email saved on the parent account."}
          </Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) => {
              setMessage("");
              setLoginId(value);
            }}
            placeholder={role === "student" ? "student@gmail.com" : "08012345678"}
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={loginId}
          />

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
