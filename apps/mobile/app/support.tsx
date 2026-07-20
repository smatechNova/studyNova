import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { IllustrationPanel } from "@/components/IllustrationPanel";
import { Screen } from "@/components/Screen";
import {
  createStorageBackup,
  getAccountDeletionRequests,
  getAccountRecoveryRequests,
  getDeploymentReadiness,
  getFirebaseAuthReadiness,
  getLaunchChecklistItems,
  getStorageBackupDownloadUrl,
  getStorageBackups,
  getStorageHealth,
  getTesterFeedbackRequests,
  reviewAccountDeletionRequest,
  reviewAccountRecoveryRequest,
  reviewTesterFeedbackRequest,
  updateLaunchChecklistItem
} from "@/lib/api";
import { brandAssets } from "@/lib/brandAssets";
import { isFirebasePasswordResetConfigured } from "@/lib/firebaseAuth";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import type {
  AccountDeletionRequestRecord,
  AccountRecoveryRequestRecord,
  DeploymentReadiness,
  FirebaseAuthReadiness,
  LaunchChecklistItemRecord,
  StorageBackupReceipt,
  StorageHealth,
  TesterFeedbackRecord
} from "@/types";

type LaunchGateStatus = "pending" | "ready" | "review" | "blocked";

type LaunchGateItem = {
  detail: string;
  itemKey?: string;
  status: LaunchGateStatus;
  title: string;
};

export default function SupportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [adminCode, setAdminCode] = useState("");
  const [requests, setRequests] = useState<AccountRecoveryRequestRecord[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequestRecord[]>([]);
  const [feedbackRequests, setFeedbackRequests] = useState<TesterFeedbackRecord[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [firebaseReadiness, setFirebaseReadiness] = useState<FirebaseAuthReadiness | null>(null);
  const [deploymentReadiness, setDeploymentReadiness] = useState<DeploymentReadiness | null>(null);
  const [launchChecklistItems, setLaunchChecklistItems] = useState<LaunchChecklistItemRecord[]>([]);
  const [launchChecklistNotes, setLaunchChecklistNotes] = useState<Record<string, string>>({});
  const [latestBackup, setLatestBackup] = useState<StorageBackupReceipt | null>(null);
  const [backups, setBackups] = useState<StorageBackupReceipt[]>([]);
  const [message, setMessage] = useState("Enter the admin code to review account help requests.");
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState("");
  const [activeDeletionReviewId, setActiveDeletionReviewId] = useState("");
  const [activeFeedbackReviewId, setActiveFeedbackReviewId] = useState("");
  const [activeLaunchChecklistItem, setActiveLaunchChecklistItem] = useState("");
  const openRequests = requests.filter((request) => request.status === "open").length;
  const pendingDeletionRequests = deletionRequests.filter((request) => request.status !== "completed").length;
  const openFeedbackRequests = feedbackRequests.filter((request) => request.status === "open").length;
  const matchedRequests = requests.filter((request) => request.matched_account).length;
  const hasAdminData = deploymentReadiness !== null || storageHealth !== null || firebaseReadiness !== null;
  const openSupportItems = openRequests + pendingDeletionRequests + openFeedbackRequests;
  const firebasePasswordResetReady = isFirebasePasswordResetConfigured();
  const launchChecklistByKey = useMemo(
    () => new Map(launchChecklistItems.map((item) => [item.item_key, item])),
    [launchChecklistItems]
  );
  const launchGateItems = useMemo(
    () =>
      buildLaunchGateItems({
        backups,
        deploymentReadiness,
        firebasePasswordResetReady,
        firebaseReadiness,
        openSupportItems,
        storageHealth
      }),
    [backups, deploymentReadiness, firebasePasswordResetReady, firebaseReadiness, openSupportItems, storageHealth]
  );
  const launchGateReadyCount = launchGateItems.filter((item) => item.status === "ready").length;
  const launchGateBlockers = launchGateItems.filter((item) => item.status === "blocked").length;
  const launchGateReviewItems = launchGateItems.filter((item) => item.status === "review").length;
  const launchGateProgress = Math.round((launchGateReadyCount / launchGateItems.length) * 100);
  const playStoreChecklistItems = useMemo(
    () =>
      buildPlayStoreChecklistItems({
        backups,
        deploymentReadiness,
        firebasePasswordResetReady,
        firebaseReadiness,
        launchChecklistByKey,
        openSupportItems,
        storageHealth
      }),
    [
      backups,
      deploymentReadiness,
      firebasePasswordResetReady,
      firebaseReadiness,
      launchChecklistByKey,
      openSupportItems,
      storageHealth
    ]
  );
  const playStoreChecklistReadyCount = playStoreChecklistItems.filter((item) => item.status === "ready").length;
  const playStoreChecklistBlockers = playStoreChecklistItems.filter((item) => item.status === "blocked").length;

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
        nextFeedbackRequests,
        nextStorageHealth,
        nextFirebaseReadiness,
        nextDeploymentReadiness,
        nextBackups,
        nextLaunchChecklistItems
      ] = await Promise.all([
        getAccountRecoveryRequests(adminCode.trim()),
        getAccountDeletionRequests(adminCode.trim()),
        getTesterFeedbackRequests(adminCode.trim()),
        getStorageHealth(adminCode.trim()),
        getFirebaseAuthReadiness(adminCode.trim()),
        getDeploymentReadiness(adminCode.trim()),
        getStorageBackups(adminCode.trim()),
        getLaunchChecklistItems(adminCode.trim())
      ]);
      setRequests(nextRequests);
      setDeletionRequests(nextDeletionRequests);
      setFeedbackRequests(nextFeedbackRequests);
      setStorageHealth(nextStorageHealth);
      setFirebaseReadiness(nextFirebaseReadiness);
      setDeploymentReadiness(nextDeploymentReadiness);
      setBackups(nextBackups);
      setLaunchChecklistItems(nextLaunchChecklistItems);
      setLaunchChecklistNotes(
        Object.fromEntries(nextLaunchChecklistItems.map((item) => [item.item_key, item.admin_note]))
      );
      setMessage(
        nextRequests.length || nextDeletionRequests.length || nextFeedbackRequests.length
          ? "Latest support and deployment status loaded."
          : "Deployment status loaded. No account help requests have been submitted yet."
      );
    } catch {
      setRequests([]);
      setDeletionRequests([]);
      setFeedbackRequests([]);
      setStorageHealth(null);
      setFirebaseReadiness(null);
      setDeploymentReadiness(null);
      setBackups([]);
      setLaunchChecklistItems([]);
      setLaunchChecklistNotes({});
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

  async function markFeedbackReviewed(feedbackId: string) {
    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setActiveFeedbackReviewId(feedbackId);
    setMessage("");

    try {
      const reviewedFeedback = await reviewTesterFeedbackRequest(adminCode.trim(), feedbackId, {
        status: "reviewed",
        admin_note: "Reviewed from StudyNova support admin."
      });
      setFeedbackRequests((currentRequests) =>
        currentRequests.map((request) => (request.id === reviewedFeedback.id ? reviewedFeedback : request))
      );
      setMessage("Tester feedback marked as reviewed.");
    } catch {
      setMessage("Could not update tester feedback. Check the admin code and API connection.");
    } finally {
      setActiveFeedbackReviewId("");
    }
  }

  async function saveLaunchChecklistItem(item: LaunchGateItem, confirmed: boolean) {
    if (!item.itemKey) {
      return;
    }

    if (!adminCode.trim()) {
      setMessage("Enter the admin code first.");
      return;
    }

    setActiveLaunchChecklistItem(item.itemKey);
    setMessage("");

    try {
      const note = launchChecklistNotes[item.itemKey] ?? launchChecklistByKey.get(item.itemKey)?.admin_note ?? "";
      const updatedItem = await updateLaunchChecklistItem(adminCode.trim(), item.itemKey, {
        confirmed,
        admin_note: note
      });
      setLaunchChecklistItems((currentItems) => {
        const withoutItem = currentItems.filter((currentItem) => currentItem.item_key !== updatedItem.item_key);
        return [...withoutItem, updatedItem].sort((left, right) => left.item_key.localeCompare(right.item_key));
      });
      setLaunchChecklistNotes((currentNotes) => ({
        ...currentNotes,
        [updatedItem.item_key]: updatedItem.admin_note
      }));
      setMessage(confirmed ? `${item.title} confirmed.` : `${item.title} confirmation removed.`);
    } catch {
      setMessage("Could not update the launch checklist. Check the admin code and API connection.");
    } finally {
      setActiveLaunchChecklistItem("");
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

        <IllustrationPanel
          body="Use one secure workspace for account recovery, tester feedback, backups, and launch readiness checks."
          imageSource={brandAssets.supportAdmin}
          kicker="Admin command center"
          title="Support with clear release control"
        />

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

        <IllustrationPanel
          body="Confirm backend health, authentication, storage, backups, policies, screenshots, and tester readiness before each release."
          imageSource={brandAssets.launchChecklist}
          kicker="Launch gate"
          title="Play Store readiness at a glance"
        />

        <View style={styles.launchGatePanel}>
          <View style={styles.requestHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Production launch gate</Text>
              <Text style={styles.title}>
                {!hasAdminData
                  ? "Load readiness checks"
                  : launchGateBlockers
                    ? `${launchGateBlockers} blocker${launchGateBlockers === 1 ? "" : "s"} found`
                    : launchGateReviewItems
                      ? `${launchGateReviewItems} review item${launchGateReviewItems === 1 ? "" : "s"} left`
                      : "Ready for closed testing"}
              </Text>
              <Text style={styles.helper}>
                {hasAdminData
                  ? "This combines backend readiness, support queues, backups, and Play Store preparation into one release view."
                  : "Enter the admin code and load the admin view to calculate the launch gate."}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                hasAdminData && !launchGateBlockers ? styles.statusMatched : styles.statusUnknown
              ]}
            >
              <Text style={styles.statusText}>{hasAdminData ? `${launchGateProgress}%` : "Pending"}</Text>
            </View>
          </View>
          <View style={styles.launchProgressTrack}>
            <View style={[styles.launchProgressFill, { width: `${hasAdminData ? launchGateProgress : 0}%` }]} />
          </View>
          <View style={styles.launchGateList}>
            {launchGateItems.map((item) => (
              <View key={item.title} style={styles.launchGateItem}>
                <View
                  style={[
                    styles.launchGateIcon,
                    item.status === "ready"
                      ? styles.statusMatched
                      : item.status === "blocked"
                        ? styles.statusBlocked
                        : styles.statusUnknown
                  ]}
                >
                  <MaterialCommunityIcons
                    name={getLaunchGateIcon(item.status)}
                    size={20}
                    color={item.status === "ready" ? colors.success : colors.warningDark}
                  />
                </View>
                <View style={styles.heroCopy}>
                  <View style={styles.requestHeader}>
                    <Text style={styles.requestTitle}>{item.title}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        item.status === "ready"
                          ? styles.statusMatched
                          : item.status === "blocked"
                            ? styles.statusBlocked
                            : styles.statusUnknown
                      ]}
                    >
                      <Text style={styles.statusText}>{formatLaunchGateStatus(item.status)}</Text>
                    </View>
                  </View>
                  <Text style={styles.helper}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.requestHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.kicker}>Play Store readiness checklist</Text>
              <Text style={styles.sectionTitle}>
                {hasAdminData
                  ? `${playStoreChecklistReadyCount}/${playStoreChecklistItems.length} ready`
                  : "Load admin view to begin"}
              </Text>
              <Text style={styles.helper}>
                Use this list before building or uploading the closed-test app bundle. Manual items should be confirmed
                in Play Console or EAS.
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                hasAdminData && playStoreChecklistBlockers === 0 ? styles.statusMatched : styles.statusUnknown
              ]}
            >
              <Text style={styles.statusText}>
                {hasAdminData
                  ? playStoreChecklistBlockers
                    ? `${playStoreChecklistBlockers} blocked`
                    : "Usable"
                  : "Pending"}
              </Text>
            </View>
          </View>
          <View style={styles.launchGateList}>
            {playStoreChecklistItems.map((item) => {
              const storedItem = item.itemKey ? launchChecklistByKey.get(item.itemKey) : undefined;
              const noteValue = item.itemKey
                ? launchChecklistNotes[item.itemKey] ?? storedItem?.admin_note ?? ""
                : "";
              const isSaving = item.itemKey ? activeLaunchChecklistItem === item.itemKey : false;
              const canConfirmManualItem = item.status !== "blocked" && item.status !== "pending";

              return (
                <View key={item.title} style={styles.checklistRow}>
                  <View
                    style={[
                      styles.launchGateIcon,
                      item.status === "ready"
                        ? styles.statusMatched
                        : item.status === "blocked"
                          ? styles.statusBlocked
                          : styles.statusUnknown
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getLaunchGateIcon(item.status)}
                      size={18}
                      color={item.status === "ready" ? colors.success : colors.warningDark}
                    />
                  </View>
                  <View style={styles.heroCopy}>
                    <View style={styles.requestHeader}>
                      <Text style={styles.requestTitle}>{item.title}</Text>
                      <View
                        style={[
                          styles.statusPill,
                          item.status === "ready"
                            ? styles.statusMatched
                            : item.status === "blocked"
                              ? styles.statusBlocked
                              : styles.statusUnknown
                        ]}
                      >
                        <Text style={styles.statusText}>{formatLaunchGateStatus(item.status)}</Text>
                      </View>
                    </View>
                    <Text style={styles.helper}>{item.detail}</Text>
                    {storedItem?.confirmed_at ? (
                      <Text style={styles.helper}>Confirmed {formatTimestamp(storedItem.confirmed_at)}</Text>
                    ) : null}
                    {item.itemKey && hasAdminData ? (
                      <View style={styles.manualChecklistControls}>
                        <TextInput
                          multiline
                          onChangeText={(value) =>
                            setLaunchChecklistNotes((currentNotes) => ({
                              ...currentNotes,
                              [item.itemKey as string]: value
                            }))
                          }
                          placeholder="Optional admin note"
                          placeholderTextColor={colors.muted}
                          style={[styles.input, styles.noteInput]}
                          value={noteValue}
                        />
                        <View style={styles.actionRow}>
                          <Pressable
                            accessibilityRole="button"
                            disabled={isSaving || !canConfirmManualItem}
                            onPress={() => void saveLaunchChecklistItem(item, !storedItem?.confirmed)}
                            style={[
                              storedItem?.confirmed ? styles.warningButton : styles.secondaryButton,
                              isSaving || !canConfirmManualItem ? styles.disabledButton : null
                            ]}
                          >
                            {isSaving ? (
                              <ActivityIndicator color={storedItem?.confirmed ? colors.warningDark : colors.brand} />
                            ) : (
                              <>
                                <MaterialCommunityIcons
                                  name={storedItem?.confirmed ? "undo-variant" : "check-decagram-outline"}
                                  size={18}
                                  color={storedItem?.confirmed ? colors.warningDark : colors.brand}
                                />
                                <Text
                                  style={
                                    storedItem?.confirmed ? styles.warningButtonText : styles.secondaryButtonText
                                  }
                                >
                                  {!canConfirmManualItem
                                    ? "Resolve blocker first"
                                    : storedItem?.confirmed
                                      ? "Undo confirmation"
                                      : "Confirm item"}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
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
            <MaterialCommunityIcons name="message-alert-outline" size={24} color={colors.brand} />
            <Text style={styles.metric}>{openFeedbackRequests}</Text>
            <Text style={styles.helper}>Tester feedback</Text>
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

        {feedbackRequests.length ? (
          <View style={styles.panel}>
            <View style={styles.requestHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.kicker}>Closed-test feedback</Text>
                <Text style={styles.sectionTitle}>Tester feedback queue</Text>
                <Text style={styles.helper}>
                  Review tester notes from the in-app feedback form before the next Play Store build.
                </Text>
              </View>
              <View style={[styles.statusPill, openFeedbackRequests ? styles.statusUnknown : styles.statusMatched]}>
                <Text style={styles.statusText}>{openFeedbackRequests ? "Open" : "Clear"}</Text>
              </View>
            </View>
            <View style={styles.list}>
              {feedbackRequests.map((feedback) => (
                <View key={feedback.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View>
                      <Text style={styles.kicker}>{feedback.category}</Text>
                      <Text style={styles.requestTitle}>{feedback.tester_name || "Unnamed tester"}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusPill,
                        feedback.status === "reviewed" ? styles.statusMatched : styles.statusUnknown
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {feedback.status === "reviewed" ? "Reviewed" : `${feedback.rating}/5`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>{feedback.role}</Text>
                  </View>
                  {feedback.contact ? (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="phone-outline" size={18} color={colors.muted} />
                      <Text style={styles.detailText}>{feedback.contact}</Text>
                    </View>
                  ) : null}
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="cellphone" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>
                      {[feedback.device_model, feedback.android_version].filter(Boolean).join(" - ") || "Device not set"}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={colors.muted} />
                    <Text style={styles.detailText}>{formatTimestamp(feedback.created_at)}</Text>
                  </View>
                  {feedback.what_worked ? <Text style={styles.note}>Worked: {feedback.what_worked}</Text> : null}
                  {feedback.what_failed ? <Text style={styles.note}>Failed: {feedback.what_failed}</Text> : null}
                  {feedback.improvement ? <Text style={styles.note}>Improve: {feedback.improvement}</Text> : null}
                  {feedback.message ? <Text style={styles.note}>{feedback.message}</Text> : null}
                  <Text style={styles.helper}>
                    Recommendation: {feedback.recommend === null ? "Not answered" : feedback.recommend ? "Yes" : "No"}
                  </Text>
                  {feedback.admin_note ? <Text style={styles.note}>Admin note: {feedback.admin_note}</Text> : null}
                  {feedback.reviewed_at ? (
                    <Text style={styles.helper}>Reviewed {formatTimestamp(feedback.reviewed_at)}</Text>
                  ) : null}
                  {feedback.status === "open" ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={activeFeedbackReviewId === feedback.id}
                      onPress={() => void markFeedbackReviewed(feedback.id)}
                      style={[styles.secondaryButton, activeFeedbackReviewId === feedback.id ? styles.disabledButton : null]}
                    >
                      {activeFeedbackReviewId === feedback.id ? (
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
                  <View style={styles.pillRow}>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>
                        {request.request_source === "public" ? "Public form" : "Signed in"}
                      </Text>
                    </View>
                    <View style={[styles.statusPill, request.matched_account ? styles.statusMatched : styles.statusUnknown]}>
                      <Text style={styles.statusText}>
                        {request.matched_account ? "Account match found" : "Needs account match"}
                      </Text>
                    </View>
                    {request.verification_required ? (
                      <View style={[styles.statusPill, styles.statusUnknown]}>
                        <Text style={styles.statusText}>Verify identity</Text>
                      </View>
                    ) : null}
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

function buildLaunchGateItems({
  backups,
  deploymentReadiness,
  firebasePasswordResetReady,
  firebaseReadiness,
  openSupportItems,
  storageHealth
}: {
  backups: StorageBackupReceipt[];
  deploymentReadiness: DeploymentReadiness | null;
  firebasePasswordResetReady: boolean;
  firebaseReadiness: FirebaseAuthReadiness | null;
  openSupportItems: number;
  storageHealth: StorageHealth | null;
}): LaunchGateItem[] {
  const publicApiCheck = deploymentReadiness?.checks.find((check) => check.name === "Public API URL");
  const firebaseCheck = deploymentReadiness?.checks.find((check) => check.name === "Firebase verification");
  const emailCheck = deploymentReadiness?.checks.find((check) => check.name === "Transactional email");
  const failedDeploymentChecks = deploymentReadiness?.checks.filter((check) => check.status === "fail").length ?? 0;
  const warningDeploymentChecks = deploymentReadiness?.checks.filter((check) => check.status === "warning").length ?? 0;

  return [
    {
      title: "Backend deployment",
      status: deploymentReadiness
        ? deploymentReadiness.ready
          ? "ready"
          : failedDeploymentChecks
            ? "blocked"
            : "review"
        : "pending",
      detail: deploymentReadiness
        ? deploymentReadiness.ready
          ? "Production deployment readiness is clean."
          : `${failedDeploymentChecks} failing and ${warningDeploymentChecks} warning check${
              warningDeploymentChecks === 1 ? "" : "s"
            } need attention.`
        : "Load admin view to check production backend readiness."
    },
    {
      title: "Public API URL",
      status: publicApiCheck
        ? publicApiCheck.status === "pass"
          ? "ready"
          : "blocked"
        : deploymentReadiness
          ? "blocked"
          : "pending",
      detail: deploymentReadiness?.public_api_base_url
        ? `Mobile closed-test builds should use ${deploymentReadiness.public_api_base_url}.`
        : "Set PUBLIC_API_BASE_URL to the hosted HTTPS API."
    },
    {
      title: "Persistent storage",
      status: storageHealth ? (storageHealth.production_ready ? "ready" : "blocked") : "pending",
      detail: storageHealth
        ? storageHealth.production_ready
          ? "Database and backup paths look production-ready."
          : storageHealth.warnings[0] || "Move the database and backup directory to a persistent disk."
        : "Load admin view to inspect database and backup paths."
    },
    {
      title: "Google verification",
      status: firebaseReadiness
        ? firebaseReadiness.server_verification_ready
          ? "ready"
          : firebaseCheck?.status === "warning"
            ? "review"
            : "blocked"
        : "pending",
      detail: firebaseReadiness
        ? firebaseReadiness.server_verification_ready
          ? "Firebase ID token verification is configured."
          : "Configure Firebase server credentials before relying on Google sign-in in production."
        : "Load admin view to inspect Firebase server verification."
    },
    {
      title: "Password reset email",
      status: firebasePasswordResetReady ? "ready" : "blocked",
      detail: firebasePasswordResetReady
        ? "This mobile build includes the Firebase API key required for password-reset email."
        : "Set EXPO_PUBLIC_FIREBASE_API_KEY in the EAS production environment."
    },
    {
      title: "Parent verification email",
      status: emailCheck
        ? emailCheck.status === "pass"
          ? "ready"
          : "blocked"
        : deploymentReadiness
          ? "blocked"
          : "pending",
      detail: emailCheck?.message ?? "Load admin view to inspect Resend verification email delivery."
    },
    {
      title: "Support queues",
      status: deploymentReadiness ? (openSupportItems === 0 ? "ready" : "review") : "pending",
      detail:
        openSupportItems === 0
          ? "No open recovery, deletion, or tester feedback items are waiting."
          : `${openSupportItems} support item${openSupportItems === 1 ? "" : "s"} should be reviewed before the next release.`
    },
    {
      title: "Database backup",
      status: storageHealth ? (backups.length ? "ready" : "review") : "pending",
      detail: backups.length
        ? `${backups.length} backup${backups.length === 1 ? "" : "s"} available. Download one before release.`
        : "Create and export at least one backup before closed testing."
    },
    {
      title: "Policy hosting",
      status: deploymentReadiness ? "review" : "pending",
      detail: "Confirm public Privacy, Terms, and Delete account URLs are entered in Play Console."
    }
  ];
}

function buildPlayStoreChecklistItems({
  backups,
  deploymentReadiness,
  firebasePasswordResetReady,
  firebaseReadiness,
  launchChecklistByKey,
  openSupportItems,
  storageHealth
}: {
  backups: StorageBackupReceipt[];
  deploymentReadiness: DeploymentReadiness | null;
  firebasePasswordResetReady: boolean;
  firebaseReadiness: FirebaseAuthReadiness | null;
  launchChecklistByKey: Map<string, LaunchChecklistItemRecord>;
  openSupportItems: number;
  storageHealth: StorageHealth | null;
}): LaunchGateItem[] {
  const backendReady = Boolean(deploymentReadiness?.ready);
  const publicApiUrl = deploymentReadiness?.public_api_base_url || "";
  const apiUrlReady = publicApiUrl.startsWith("https://");
  const storageReady = Boolean(storageHealth?.production_ready);
  const firebaseReady = Boolean(firebaseReadiness?.server_verification_ready);
  const emailCheck = deploymentReadiness?.checks.find((check) => check.name === "Transactional email");
  const backupReady = backups.length > 0;
  const supportClear = openSupportItems === 0;
  const hasAdminData = deploymentReadiness !== null || storageHealth !== null || firebaseReadiness !== null;
  const manualStatus = (itemKey: string, fallbackStatus: LaunchGateStatus): LaunchGateStatus =>
    launchChecklistByKey.get(itemKey)?.confirmed ? "ready" : fallbackStatus;

  return [
    {
      title: "Hosted API preflight",
      status: deploymentReadiness ? (backendReady ? "ready" : "blocked") : "pending",
      detail: backendReady
        ? "Backend readiness is clean. Run npm run closed-test:preflight before the EAS build."
        : "Deploy the backend and clear every failing deployment readiness check."
    },
    {
      title: "EAS EXPO_PUBLIC_API_URL",
      itemKey: "eas_api_url",
      status: deploymentReadiness ? (apiUrlReady ? manualStatus("eas_api_url", "review") : "blocked") : "pending",
      detail: apiUrlReady
        ? `Confirm EAS production EXPO_PUBLIC_API_URL is set to ${publicApiUrl}.`
        : "Set PUBLIC_API_BASE_URL first, then mirror it into the EAS production environment."
    },
    {
      title: "Persistent database",
      status: storageHealth ? (storageReady ? "ready" : "blocked") : "pending",
      detail: storageReady
        ? "Database and backup paths are on production-ready storage."
        : "Move SQLite and backups to a persistent disk before closed testing."
    },
    {
      title: "Backup export",
      itemKey: "backup_export",
      status: storageHealth ? (backupReady ? manualStatus("backup_export", "review") : "blocked") : "pending",
      detail: backupReady
        ? "A backup exists. Download a copy before uploading a test release."
        : "Create and export at least one database backup."
    },
    {
      title: "Google sign-in verification",
      status: firebaseReadiness ? (firebaseReady ? "ready" : "review") : "pending",
      detail: firebaseReady
        ? "Firebase token verification is configured for real-device sign-in."
        : "Closed testing can continue with manual accounts, but Google sign-in needs Firebase server credentials."
    },
    {
      title: "Firebase password reset",
      status: firebasePasswordResetReady ? "ready" : "blocked",
      detail: firebasePasswordResetReady
        ? "The app has the Firebase API key needed to request reset links. Test the email on a real Android build."
        : "Add EXPO_PUBLIC_FIREBASE_API_KEY to the EAS production environment before building."
    },
    {
      title: "Parent email verification",
      status: emailCheck ? (emailCheck.status === "pass" ? "ready" : "blocked") : "pending",
      detail: emailCheck?.message ?? "Configure Resend before parent sign-up is tested on real devices."
    },
    {
      title: "Support queues",
      status: hasAdminData ? (supportClear ? "ready" : "review") : "pending",
      detail: supportClear
        ? "Recovery, deletion, and tester feedback queues are clear."
        : `${openSupportItems} open support item${openSupportItems === 1 ? "" : "s"} should be reviewed before release.`
    },
    {
      title: "Policy URLs",
      itemKey: "policy_urls",
      status: hasAdminData ? manualStatus("policy_urls", "review") : "pending",
      detail: "Confirm public Privacy, Terms, and Delete account URLs are hosted and entered in Play Console."
    },
    {
      title: "Store listing assets",
      itemKey: "store_listing_assets",
      status: hasAdminData ? manualStatus("store_listing_assets", "review") : "pending",
      detail: "Confirm screenshots, feature graphic, app icon, description, and release notes are final for closed testing."
    },
    {
      title: "Tester access",
      itemKey: "tester_access",
      status: hasAdminData ? manualStatus("tester_access", "review") : "pending",
      detail: "Confirm Play Console tester emails or Google Group are added before publishing the test release."
    },
    {
      title: "Closed-test app bundle",
      itemKey: "closed_test_bundle",
      status:
        backendReady && apiUrlReady
          ? manualStatus("closed_test_bundle", "review")
          : deploymentReadiness
            ? "blocked"
            : "pending",
      detail: "Build the Android App Bundle with npm run mobile:build:closed-test, then upload or submit it."
    }
  ];
}

function getLaunchGateIcon(status: LaunchGateStatus): keyof typeof MaterialCommunityIcons.glyphMap {
  if (status === "ready") {
    return "check-circle-outline";
  }

  if (status === "blocked") {
    return "close-circle-outline";
  }

  if (status === "review") {
    return "alert-circle-outline";
  }

  return "clock-outline";
}

function formatLaunchGateStatus(status: LaunchGateStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  if (status === "review") {
    return "Review";
  }

  return "Pending";
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
    checklistRow: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      padding: spacing.md
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
    launchGateIcon: {
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44
    },
    launchGateItem: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md
    },
    launchGateList: {
      gap: spacing.sm
    },
    launchGatePanel: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    launchProgressFill: {
      backgroundColor: colors.brand,
      borderRadius: 999,
      height: "100%"
    },
    launchProgressTrack: {
      backgroundColor: colors.brandSoft,
      borderRadius: 999,
      height: 8,
      overflow: "hidden"
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
    manualChecklistControls: {
      gap: spacing.sm
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
    noteInput: {
      minHeight: 72,
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
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs
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
    statusBlocked: {
      backgroundColor: colors.warningSoft,
      borderColor: colors.warning
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
