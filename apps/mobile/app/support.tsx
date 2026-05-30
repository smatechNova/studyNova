import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { Screen } from "@/components/Screen";
import { createStorageBackup, getAccountRecoveryRequests, getFirebaseAuthReadiness, getStorageHealth } from "@/lib/api";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type {
  AccountRecoveryRequestRecord,
  FirebaseAuthReadiness,
  StorageBackupReceipt,
  StorageHealth
} from "@/types";

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [adminCode, setAdminCode] = useState("");
  const [requests, setRequests] = useState<AccountRecoveryRequestRecord[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [firebaseReadiness, setFirebaseReadiness] = useState<FirebaseAuthReadiness | null>(null);
  const [latestBackup, setLatestBackup] = useState<StorageBackupReceipt | null>(null);
  const [message, setMessage] = useState("Enter the admin code to review account help requests.");
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const openRequests = requests.length;
  const matchedRequests = requests.filter((request) => request.matched_account).length;

  async function loadAdminData() {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const [nextRequests, nextStorageHealth, nextFirebaseReadiness] = await Promise.all([
        getAccountRecoveryRequests(adminCode.trim()),
        getStorageHealth(adminCode.trim()),
        getFirebaseAuthReadiness(adminCode.trim())
      ]);
      setRequests(nextRequests);
      setStorageHealth(nextStorageHealth);
      setFirebaseReadiness(nextFirebaseReadiness);
      setMessage(
        nextRequests.length
          ? "Latest support and storage status loaded."
          : "Storage status loaded. No account help requests have been submitted yet."
      );
    } catch {
      setRequests([]);
      setStorageHealth(null);
      setFirebaseReadiness(null);
      setMessage("Could not load admin data. Check the admin code and API connection.");
    } finally {
      setIsLoading(false);
    }
  }

  async function backUpStorage() {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setIsBackingUp(true);
    setMessage("");

    try {
      const backup = await createStorageBackup(adminCode.trim());
      const nextStorageHealth = await getStorageHealth(adminCode.trim());
      setLatestBackup(backup);
      setStorageHealth(nextStorageHealth);
      setMessage(`Backup created: ${backup.filename}`);
    } catch {
      setMessage("Could not create a backup. Check the admin code and API connection.");
    } finally {
      setIsBackingUp(false);
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
            onPress={() => void loadAdminData()}
            style={[styles.primaryButton, isLoading ? styles.disabledButton : null]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Load admin view</Text>
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
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons
              name={storageHealth?.production_ready ? "database-check-outline" : "database-alert-outline"}
              size={24}
              color={storageHealth?.production_ready ? colors.success : colors.warning}
            />
            <Text style={styles.metric}>{storageHealth ? formatBytes(storageHealth.database_size_bytes) : "--"}</Text>
            <Text style={styles.helper}>Database size</Text>
          </View>
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons
              name={firebaseReadiness?.server_verification_ready ? "google" : "cloud-alert-outline"}
              size={24}
              color={firebaseReadiness?.server_verification_ready ? colors.success : colors.warning}
            />
            <Text style={styles.metric}>{firebaseReadiness?.server_verification_ready ? "Ready" : "--"}</Text>
            <Text style={styles.helper}>Google sign-in</Text>
          </View>
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {storageHealth ? (
          <View style={styles.panel}>
            <View style={styles.requestHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.kicker}>Persistence</Text>
                <Text style={styles.sectionTitle}>
                  {storageHealth.production_ready ? "Storage looks ready" : "Storage needs attention"}
                </Text>
                <Text style={styles.helper}>
                  SQLite database is active. Use a persistent disk path before public production.
                </Text>
              </View>
              <View style={[styles.statusPill, storageHealth.production_ready ? styles.statusMatched : styles.statusUnknown]}>
                <Text style={styles.statusText}>{storageHealth.production_ready ? "Ready" : "Review"}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="database-outline" size={18} color={colors.muted} />
              <Text style={styles.detailText}>{storageHealth.database_path}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="archive-outline" size={18} color={colors.muted} />
              <Text style={styles.detailText}>{storageHealth.backup_directory}</Text>
            </View>
            {storageHealth.warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>{warning}</Text>
            ))}
            {latestBackup ? (
              <Text style={styles.note}>
                Latest backup: {latestBackup.filename} ({formatBytes(latestBackup.size_bytes)})
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isBackingUp}
              onPress={() => void backUpStorage()}
              style={[styles.secondaryButton, isBackingUp ? styles.disabledButton : null]}
            >
              {isBackingUp ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <>
                  <MaterialCommunityIcons name="database-export-outline" size={18} color={colors.brand} />
                  <Text style={styles.secondaryButtonText}>Create database backup</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {firebaseReadiness ? (
          <View style={styles.panel}>
            <View style={styles.requestHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.kicker}>Authentication</Text>
                <Text style={styles.sectionTitle}>
                  {firebaseReadiness.server_verification_ready ? "Firebase verification ready" : "Firebase setup needed"}
                </Text>
                <Text style={styles.helper}>
                  The API must verify Firebase ID tokens before Google sign-in can be trusted on real devices.
                </Text>
              </View>
              <View style={[styles.statusPill, firebaseReadiness.server_verification_ready ? styles.statusMatched : styles.statusUnknown]}>
                <Text style={styles.statusText}>{firebaseReadiness.server_verification_ready ? "Ready" : "Review"}</Text>
              </View>
            </View>
            <View style={styles.readinessGrid}>
              <ReadinessPill label="Admin SDK" ready={firebaseReadiness.admin_sdk_installed} />
              <ReadinessPill label="Service account" ready={firebaseReadiness.service_account_configured} />
              <ReadinessPill label="Project ID" ready={firebaseReadiness.project_id_configured} />
            </View>
            {firebaseReadiness.warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>{warning}</Text>
            ))}
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

function ReadinessPill({ label, ready }: { label: string; ready: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.statusPill, ready ? styles.statusMatched : styles.statusUnknown]}>
      <Text style={styles.statusText}>{label}: {ready ? "Yes" : "No"}</Text>
    </View>
  );
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
    secondaryButton: {
      alignItems: "center",
      alignSelf: "flex-start",
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
    readinessGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
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
    },
    warningText: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
      borderRadius: 8,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20,
      padding: spacing.md
    }
  });
}
