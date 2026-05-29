import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { Screen } from "@/components/Screen";
import { getAccountRecoveryRequests } from "@/lib/api";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type { AccountRecoveryRequestRecord } from "@/types";

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [adminCode, setAdminCode] = useState("");
  const [requests, setRequests] = useState<AccountRecoveryRequestRecord[]>([]);
  const [message, setMessage] = useState("Enter the admin code to review account help requests.");
  const [isLoading, setIsLoading] = useState(false);
  const openRequests = requests.length;
  const matchedRequests = requests.filter((request) => request.matched_account).length;

  async function loadRequests() {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const nextRequests = await getAccountRecoveryRequests(adminCode.trim());
      setRequests(nextRequests);
      setMessage(
        nextRequests.length
          ? "Latest account help requests loaded."
          : "No account help requests have been submitted yet."
      );
    } catch {
      setRequests([]);
      setMessage("Could not load requests. Check the admin code and API connection.");
    } finally {
      setIsLoading(false);
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
            <MaterialCommunityIcons name="lifebuoy" size={32} color={colors.brand} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>Admin support</Text>
            <Text style={styles.title}>Account help requests</Text>
            <Text style={styles.helper}>
              Review sign-in help requests from students and parents without exposing this view to normal accounts.
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Admin access</Text>
          <Text style={styles.helper}>
            Use the backend admin code from the deployment environment. The default development code should be changed
            before public launch.
          </Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={(value) => {
              setMessage("");
              setAdminCode(value);
            }}
            placeholder="Admin code"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
            value={adminCode}
          />
          <Pressable
            accessibilityRole="button"
            disabled={isLoading}
            onPress={() => void loadRequests()}
            style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Load requests</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="inbox-outline" size={24} color={colors.brand} />
            <Text style={styles.metric}>{openRequests}</Text>
            <Text style={styles.helper}>Requests</Text>
          </View>
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons name="account-check-outline" size={24} color={colors.success} />
            <Text style={styles.metric}>{matchedRequests}</Text>
            <Text style={styles.helper}>Likely matches</Text>
          </View>
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.list}>
          {requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View>
                  <Text style={styles.kicker}>{request.role}</Text>
                  <Text style={styles.requestTitle}>{request.login_id}</Text>
                </View>
                <View style={[styles.statusPill, request.matched_account ? styles.statusMatched : styles.statusUnknown]}>
                  <Text style={styles.statusText}>{request.matched_account ? "Match" : "Check"}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={colors.muted} />
                <Text style={styles.detailText}>{request.contact}</Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={colors.muted} />
                <Text style={styles.detailText}>{formatTimestamp(request.created_at)}</Text>
              </View>
              {request.note ? <Text style={styles.note}>{request.note}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    content: {
      gap: spacing.lg,
      paddingBottom: spacing.xxl
    },
    detailRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs
    },
    detailText: {
      color: colors.muted,
      flex: 1,
      fontSize: 14
    },
    disabledButton: {
      opacity: 0.55
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
    list: {
      gap: spacing.md
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
    metric: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900"
    },
    note: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      padding: spacing.md
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
      alignSelf: "flex-start",
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
    requestCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md
    },
    requestHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between"
    },
    requestTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900"
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900"
    },
    statusMatched: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success
    },
    statusPill: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    statusText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900"
    },
    statusUnknown: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder
    },
    summaryCard: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      minWidth: 150,
      padding: spacing.md
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900"
    }
  });
}
