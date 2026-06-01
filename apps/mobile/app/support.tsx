import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { Screen } from "@/components/Screen";
import {
  createStorageBackup,
  getAccountDeletionRequests,
  getAccountRecoveryRequests,
  getDeploymentReadiness,
  getFirebaseAuthReadiness,
  getStorageBackupDownloadUrl,
  getStorageBackups,
  getStorageHealth,
  reviewAccountDeletionRequest,
  reviewAccountRecoveryRequest
} from "@/lib/api";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type {
  AccountDeletionRequestRecord,
  AccountRecoveryRequestRecord,
  DeploymentReadiness,
  FirebaseAuthReadiness,
  StorageBackupReceipt,
  StorageHealth
} from "@/types";

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [adminCode, setAdminCode] = useState("");
  const [requests, setRequests] = useState<AccountRecoveryRequestRecord[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequestRecord[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [firebaseReadiness, setFirebaseReadiness] = useState<FirebaseAuthReadiness | null>(null);
  const [deploymentReadiness, setDeploymentReadiness] = useState<DeploymentReadiness | null>(null);
  const [latestBackup, setLatestBackup] = useState<StorageBackupReceipt | null>(null);
  const [backups, setBackups] = useState<StorageBackupReceipt[]>([]);
  const [message, setMessage] = useState("Enter the admin code to review account help requests.");
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState("");
  const [activeDeletionReviewId, setActiveDeletionReviewId] = useState("");
  const openRequests = requests.filter((request) => request.status === "open").length;
  const pendingDeletionRequests = deletionRequests.filter((request) => request.status !== "completed").length;
  const matchedRequests = requests.filter((request) => request.matched_account).length;

  async function loadAdminData() {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const [
        nextRequests,
        nextDeletionRequests,
        nextStorageHealth,
        nextFirebaseReadiness,
        nextDeploymentReadiness,
        nextBackups
      ] = await Promise.all([
        getAccountRecoveryRequests(adminCode.trim()),
        getAccountDeletionRequests(adminCode.trim()),
        getStorageHealth(adminCode.trim()),
        getFirebaseAuthReadiness(adminCode.trim()),
        getDeploymentReadiness(adminCode.trim()),
        getStorageBackups(adminCode.trim())
      ]);
      setRequests(nextRequests);
      setDeletionRequests(nextDeletionRequests);
      setStorageHealth(nextStorageHealth);
      setFirebaseReadiness(nextFirebaseReadiness);
      setDeploymentReadiness(nextDeploymentReadiness);
      setBackups(nextBackups);
      setMessage(
        nextRequests.length || nextDeletionRequests.length
          ? "Latest support and deployment status loaded."
          : "Deployment status loaded. No account help requests have been submitted yet."
      );
    } catch {
      setRequests([]);
      setDeletionRequests([]);
      setStorageHealth(null);
      setFirebaseReadiness(null);
      setDeploymentReadiness(null);
      setBackups([]);
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
      const [nextStorageHealth, nextBackups] = await Promise.all([
        getStorageHealth(adminCode.trim()),
        getStorageBackups(adminCode.trim())
      ]);
      setLatestBackup(backup);
      setStorageHealth(nextStorageHealth);
      setBackups(nextBackups);
      setMessage(`Backup created: ${backup.filename}`);
    } catch {
      setMessage("Could not create a backup. Check the admin code and API connection.");
    } finally {
      setIsBackingUp(false);
    }
  }

  async function markRecoveryReviewed(requestId: string) {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setActiveReviewId(requestId);
    setMessage("");

    try {
      const reviewedRequest = await reviewAccountRecoveryRequest(adminCode.trim(), requestId, {
        admin_note: "Reviewed from StudyNova support admin."
      });
      setRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === reviewedRequest.id ? reviewedRequest : request))
      );
      setMessage("Recovery request marked as reviewed.");
    } catch {
      setMessage("Could not update the recovery request. Check the admin code and API connection.");
    } finally {
      setActiveReviewId("");
    }
  }

  async function markDeletionRequest(requestId: string, status: "reviewed" | "completed") {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setActiveDeletionReviewId(`${requestId}:${status}`);
    setMessage("");

    try {
      const reviewedRequest = await reviewAccountDeletionRequest(adminCode.trim(), requestId, {
        status,
        admin_note:
          status === "completed"
            ? "Completed after support confirmed deletion requirements."
            : "Reviewed from StudyNova support admin."
      });
      setDeletionRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === reviewedRequest.id ? reviewedRequest : request))
      );
      setMessage(status === "completed" ? "Deletion request marked completed." : "Deletion request marked reviewed.");
    } catch {
      setMessage("Could not update the deletion request. Check the admin code and API connection.");
    } finally {
      setActiveDeletionReviewId("");
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
            <MaterialCommunityIcons name="account-remove-outline" size={24} color={colors.warning} />
            <Text style={styles.metric}>{pendingDeletionRequests}</Text>
            <Text style={styles.helper}>Deletion requests</Text>
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
          <View style={styles.summaryCard}>
            <MaterialCommunityIcons
              name={deploymentReadiness?.ready ? "rocket-launch-outline" : "rocket-launch"}
              size={24}
              color={deploymentReadiness?.ready ? colors.success : colors.warning}
            />
            <Text style={styles.metric}>{deploymentReadiness ? (deploymentReadiness.ready ? "Ready" : "Review") : "--"}</Text>
            <Text style={styles.helper}>Deployment</Text>
          </View>
        </View>

        {message ? (
          <View style={styles.messagePanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        {deploymentReadiness ? (
          <View style={styles.panel}>
            <View style={styles.requestHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.kicker}>Deployment</Text>
                <Text style={styles.sectionTitle}>
                  {deploymentReadiness.ready ? "Backend is closed-test ready" : "Backend needs review"}
                </Text>
                <Text style={styles.helper}>
                  Use this before creating a Play Store build. The mobile app should point to the same HTTPS API URL.
                </Text>
              </View>
              <View style={[styles.statusPill, deploymentReadiness.ready ? styles.statusMatched : styles.statusUnknown]}>
                <Text style={styles.statusText}>{deploymentReadiness.ready ? "Ready" : "Review"}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="earth" size={18} color={colors.muted} />
              <Text style={styles.detailText}>{deploymentReadiness.public_api_base_url || "No public API URL set"}</Text>
            </View>
            <View style={styles.readinessGrid}>
              {deploymentReadiness.checks.map((check) => (
                <View
                  key={check.name}
                  style={[styles.deploymentCheck, check.status === "pass" ? styles.statusMatched : styles.statusUnknown]}
                >
                  <Text style={styles.statusText}>{check.name}: {check.status}</Text>
                  <Text style={styles.helper}>{check.message}</Text>
                </View>
              ))}
            </View>
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
            {backups.length ? (
              <View style={styles.backupList}>
                <Text style={styles.kicker}>Backup inventory</Text>
                {backups.slice(0, 5).map((backup) => (
                  <View key={backup.filename} style={styles.backupItem}>
                    <View style={styles.heroCopy}>
                      <Text style={styles.requestTitle}>{backup.filename}</Text>
                      <Text style={styles.helper}>
                        {formatBytes(backup.size_bytes)} - {formatTimestamp(backup.created_at)}
                      </Text>
                      <Text style={styles.codeText}>
                        {getStorageBackupDownloadUrl(backup.filename)}
                      </Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>Export</Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.helper}>
                  Download backups with the URL above and the X-Admin-Code header. Keep exported files private.
                </Text>
              </View>
            ) : (
              <Text style={styles.helper}>No database backups have been created yet.</Text>
            )}
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

        {deletionRequests.length ? (
          <View style={styles.panel}>
            <View style={styles.requestHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.kicker}>Privacy requests</Text>
                <Text style={styles.sectionTitle}>Account deletion queue</Text>
                <Text style={styles.helper}>
                  Review requests before completing them so linked parent and student data is handled carefully.
                </Text>
              </View>
              <View style={[styles.statusPill, pendingDeletionRequests ? styles.statusUnknown : styles.statusMatched]}>
                <Text style={styles.statusText}>{pendingDeletionRequests ? "Open" : "Clear"}</Text>
              </View>
            </View>
            <View style={styles.list}>
              {deletionRequests.map((request) => (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View>
                      <Text style={styles.kicker}>{request.role}</Text>
                      <Text style={styles.requestTitle}>{request.account_label}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        request.status === "completed" ? styles.statusMatched : styles.statusUnknown
                      ]}
                    >
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="login-variant" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>{request.login_id}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>{request.contact}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>{formatTimestamp(request.created_at)}</Text>
                  </View>
                  {request.reason ? <Text style={styles.note}>{request.reason}</Text> : null}
                  {request.admin_note ? <Text style={styles.note}>Admin note: {request.admin_note}</Text> : null}
                  {request.reviewed_at ? (
                    <Text style={styles.helper}>Reviewed {formatTimestamp(request.reviewed_at)}</Text>
                  ) : null}
                  {request.completed_at ? (
                    <Text style={styles.helper}>Completed {formatTimestamp(request.completed_at)}</Text>
                  ) : null}
                  {request.status !== "completed" ? (
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={activeDeletionReviewId === `${request.id}:reviewed`}
                        onPress={() => void markDeletionRequest(request.id, "reviewed")}
                        style={[
                          styles.secondaryButton,
                          activeDeletionReviewId === `${request.id}:reviewed` ? styles.disabledButton : null
                        ]}
                      >
                        {activeDeletionReviewId === `${request.id}:reviewed` ? (
                          <ActivityIndicator color={colors.brand} />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="file-check-outline" size={18} color={colors.brand} />
                            <Text style={styles.secondaryButtonText}>Mark reviewed</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={activeDeletionReviewId === `${request.id}:completed`}
                        onPress={() => void markDeletionRequest(request.id, "completed")}
                        style={[
                          styles.warningButton,
                          activeDeletionReviewId === `${request.id}:completed` ? styles.disabledButton : null
                        ]}
                      >
                        {activeDeletionReviewId === `${request.id}:completed` ? (
                          <ActivityIndicator color={colors.warningDark} />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-decagram-outline" size={18} color={colors.warningDark} />
                            <Text style={styles.warningButtonText}>Mark completed</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
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
                <View style={[styles.statusPill, request.status === "reviewed" ? styles.statusMatched : styles.statusUnknown]}>
                  <Text style={styles.statusText}>{request.status === "reviewed" ? "Reviewed" : "Open"}</Text>
                </View>
              </View>
              <View style={[styles.statusPill, request.matched_account ? styles.statusMatched : styles.statusUnknown]}>
                <Text style={styles.statusText}>{request.matched_account ? "Account match found" : "No exact account match"}</Text>
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
              {request.admin_note ? <Text style={styles.note}>Admin note: {request.admin_note}</Text> : null}
              {request.reviewed_at ? (
                <Text style={styles.helper}>Reviewed {formatTimestamp(request.reviewed_at)}</Text>
              ) : null}
              {request.status === "open" ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={activeReviewId === request.id}
                  onPress={() => void markRecoveryReviewed(request.id)}
                  style={[styles.secondaryButton, activeReviewId === request.id ? styles.disabledButton : null]}
                >
                  {activeReviewId === request.id ? (
                    <ActivityIndicator color={colors.brand} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check-decagram-outline" size={18} color={colors.brand} />
                      <Text style={styles.secondaryButtonText}>Mark reviewed</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
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
    backupItem: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md
    },
    backupList: {
      gap: spacing.sm
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm
    },
    codeText: {
      color: colors.text,
      fontFamily: "monospace",
      fontSize: 12,
      lineHeight: 18
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
    deploymentCheck: {
      borderRadius: 8,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      minWidth: 220,
      padding: spacing.md
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
    },
    warningButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.warningSoft,
      borderColor: colors.warningBorder,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing.md
    },
    warningButtonText: {
      color: colors.warningDark,
      fontSize: 14,
      fontWeight: "800"
    }
  });
}
