import { MaterialCommunityIcons } from "@expo/vector-Icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatePressable as pressable } from "@/components/AnimatedPressable";
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
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";
import {
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

type launchGateItem = {
    detail: string;
    itemKey?: string;
    status: LaunchGateStatus;
    title: string;
};

export default function SupportScreen () {
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [adminCode, setAdminCode] = useState("");
    const [requests, setRequests] = useState<AccountRecoveryRequestRecord[]>([]);
    const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequestRecord[]>([]);
    const [feedbackRequests, setFeedbackRequests] = useState<TesterFeedbackRecord[]>([]);
    const [StorageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
    const [firebaseReadiness, setFirebaseReadiness] = useState<FirebaseAuthReadiness | null>(null);
    const [deploymentReadiness, setDeploymentReadiness] = useState<DeploymentReadiness | null>(null);
    const [launchChecklistItems, setLaunchChecklistItems] = useState<LaunchChecklistItemRecord[]>([]);
    const [lunchChecklistNotes, setLaunchChecklistNotes] = useState<Record<string, string>>([]);
    const [latestBackup, setLatestBackup] = useState<StorageBackupReceipt | null>(null);
    const [backups, setBackups] = useState<StorageBackupReceipt[]>([]);
    const [message, setMessage] = useState("Enter the admin code to review account help requests.");
    const [isLoading, setIsLoading] = useState(false);
    const [isBackingUp, setIsBackups] = useState(false);
    const [activeReviewId, setActiveReviewId] = useState("");
    const [activeDeletionReviewId, setActiveDeletionReviewId] = useState("");
    const [activeFeedbackReviewId, setActiveFeedbackReviewId] = useState("");
    const [activeLaunchChecklistItem, setActiveLaunchChecklistItem] = useState("");
    const openRequests = requests.filter((request) => request.status === "open").length;
    const pendingDeletionRequests = deletionRequests.filter((request) => request.status !== "completed").length;
    const openFeedbackRequests = feedbackRequests.filter((request) => request.status === "open").length;
    const matchedRequests = requests.filter((request) => request.matched_account).length;
    const hasAdminData = deploymentReadiness !== null || StorageHealth !== null|| firebaseReadiness !== null;
    const openSupportItems = openRequests + pendingDeletionRequests + openFeedbackRequests;
    const launchChecklistByKey = useMemo(
        () => new Map(launchChecklistItems.map((item) => [item.item_key, item])),
        [launchChecklistItems]
    );
    const launchGateItems = useMemo(
        () => 
            buildLaunchGateItems({
                backups,
                deploymentReadiness,
                firebaseReadiness,
                openSupportItems,
                storageHealth
            }),
    [backups, deploymentReadiness, firebaseReadiness, openSupportItems, storageHealth]
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
                firebaseReadiness,
                launchChecklistByKey,
                openSupportItems,
                storageHealth
            }),
            [backups, deploymentReadiness, firebaseReadiness, launchChecklistByKey, openSupportItems, storageHealth]
    );
    const playStoreChecklistReadyCount = playStoreChecklistItems.filter((item) => item.status === "ready").length;
    const playStoreChecklistBlockers = playStoreChecklistItems.filter((item) => item.status === "blocked").length;

    async function loadAdminData() {
        if (!adminCode.trim()){
            setMessage("Enter the admin code first");
            return;
        }

        setIsLoading(true);
        setMessage("");

        try{
            const [
                nextRequests,
                nextDeletionRequest,
                nextFeedbackRequest,
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
            setDeletionRequests(nextDeletionRequest);
            setFeedbackRequests(nextFeedbackRequest);
            setStorageHealth(nextStorageHealth);
            setFirebaseReadiness(nextFirebaseReadiness);
            setDeploymentReadiness(nextDeploymentReadiness);
            setBackups(nextBackups);
            setLaunchChecklistItems(nextLaunchChecklistItems);
            setLaunchChecklistNotes(
                Object.fromEntries(nextLaunchChecklistItems.map((item) => [item.item_key, item.admin_note]))
            );
            setMessage(
                nextRequests.length || nextDeletionRequest.length || nextFeedbackRequest.length
                ? "Latest support and deployment status loaded."
                : "Deployment status loaded. No account help requests have been submitted yet."
            );
        } catch {
            setRequests([]);
            setDeletionRequests([]);
            setFeedbackRequests([]);
            setStorageHealth([]);
            setFirebaseReadiness([]);
            setDeploymentReadiness([]);
            setBackups([]);
            setLaunchChecklistItems([]);
            setLaunchChecklistNotes({});
            setMessage("Could not Load admin data. Check the admin code and API connection.");
        }finally {
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
            setMessage('Backup created: ${backup.filename}');
        } catch {
            setMessage("Could not create a backup. Check the admin code and API connection.");
        } finally {
            setIsBackingUp(false);
        }
    }

    async function marketRecoveryReview(requestId: string) {
        if (!adminCode.trim()) {
            setMessage("Enter the admin code first");
            return;
        }

        setActiveReviewId(requestId);
        setMessage("");

        try{
            const reviewedRequest = await reviewAccountRecoveryRequest(adminCode.trim(), requestId, {
                admin_note: "Reviewed from StudyNova support admin."
            });
            setRequests((currentRequest) => 
            currentRequests.map((request) => (request.id === reviewedRequest.id ? reviewedRequest : request)));
            setMessage("Recovery request marked as reviewed.");
        } catch {
            setMessage("Could not update the recovery request. Check the admin code and API connection.");
        } finally {
            setActiveReviewId("");
        }
    }

    async function markDeletionRequest (requestId: string, status: "reviewed | completed") {
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
            currentRequests.map ((request) => (request.id === reviewedRequest.id ? reviewedRequest : request))
        );
            setMessage(status === "completed" ? "Deletion request marked completed." : "Deletion request marked reviewed.");
        } catch {
            setMessage("could not update the deletio request. Check the admin code and API connection.");
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

    async function saveLaunchChecklistItem(item: launchGateItem, confirmed: boolean) {
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
            setLaunchChecklistNotes((currentItems) => {
                const withoutItem = currentItems.filter((currentItem) => currentItem.item_key !== updatedItem.item_key);
                return [...withoutItem, updatedItem].sort((left, right) => left.item_key.localeCompare(right.item_key));
            });
            setLaunchChecklistNotes((currentNotes) => ({
                ...currentNotes,
                [updatedItem.item_key]: updatedItem.admin_note
            }));
            setMessage(confirmed ? `${item.title} confirmed.` : `${item.title} confirmation removed.`);
        } catch {
            setMessage("Could not update the launch checklist. check the admin code and API connection.");
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

                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>Admin access</Text>
                    <Text style={styles.helper}>
                        Use the backend admin code from the development environment. The default development code should be changed 
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
                    <View style={[styles.launchProgressFill, { width: `${hasAdminData ? launchGateProgress : 0}%`}]} />
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

                <View style={styles.panel}>
                    <View style={styles.requestHeader}>
                        <Viewstyle={styles.heroCopy}>
                            <Text style={styles.kicker}>Play Store readiness checklist</Text>
                            <Text style={styles.sectionTitle}>
                                {hasAdminData
                                  ? `${playStoreChecklistReadyCount}/${playStoreChecklistItems.length} ready`
                                  : "Load admin view to begin"}
                            </Text>
                            <Text  style={styles.helper}>
                                Use this list before building or uploading the closed-test app bundle. Manual items should be confirmed
                                in Play Console or EAS.
                            </Text>
                        </View>
                        <View 
                         style={[
                            styles.statusPill,
                            has hasAdminData && playStoreChecklistBlockers === 0 ? styles.statusMatched : styles.statusUnknown
                          ]}
                        >
                            <Text style={styles.statusText}>
                                {hasAdminData
                                  ?playStoreChecklistBlockers
                                    ? `${playStoreChecklistBlockers} blocked`
                                    :"Usable"
                                   : "Pending"}
                            </Text>
                    </View>
                </View>
                <View style={styles.launchGateList}>
                    {playStoreChecklistItems.map((item) => {
                        const storedItem = item.itemKey? launchChecklistByKey.get(item.itemKey) : undefined;
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
                                              disable={isSaving || !canConfirmManualItem}
                                              onPress={() => void saveLaunchChecklistItem(item, !storedItem.confirmed)}
                                              style={[
                                                storedItem?.confirmed ? styles.warningButton : styles.secondaryButton,
                                                isSaving || !canConfirmManualItem ? styles.disabledButton : null
                                               ]}
                                            >
                                                {isSaving ? (
                                                    <ActivityIndicator color={storedItem?.confirmed ? colors.warningDark : colors.brand}/>
                                                ) : (
                                                <>
                                                    <MaterialCommunityIcons 
                                                    name={storedItem.confirmed ? "undo-variant" : "check-decagram-outline"}
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
                        
                        )
                   })}
               </View>
            </ScrollView>
        </Screen>
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
                <MaterialCommunityIcons>
                    name={storageHealth?.production_ready ? "database-check-outline" : "database-alert-outside"}
                    size={24}
                    color={storageHealth?.production_ready ? colors.success : colors.warning}
                />
                <Text style={styles.metric}>{storageHealth ? formatBytes(storageHealth.database_size_bytes) : "--"}</Text>
                <Text style={styles.helper}>Database size</Text>
            </View>
            <View style={styles.summaryCard}>
                <MaterialCommunityIcons
                  name={firebaseReadiness?.server_verification_ready ? "google" : "could-alert-outline"}
                  size={24}
                  color={firebaseReadiness?.server_verification_ready ? colors.success : colors.warning}
                  />
                  <Text style={styles.metric}>{firebaseReadiness?.server_verification_ready ? "Ready" : "--"}</Text>
                  <Text style={styles.helper}>Google sign-in</Text>
            </View>
            <View style={styles.summaryCard}>
                <MaterialCommunityIcons 
                  name={deplovmentReadiness?.ready ? "rocket-launch-outline" : "rocket-launch"}
                  size={24}
                  color={deploymentReadiness?.ready ? colors.success : colors.warning}
                />
                <Text style={styles.metric}>{deploymentReadiness ? (deploymentReadiness.ready ? "Ready" : "Review") : "--"}</Text>
                <Text style={styles.helper}>Deployment</Text>
            </View>
        </View>

        {message ? (
            <View style={styles.messagePanel}>
                <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand}/>
                <Text style={styles.messageText}>{message</Text>
            </View>
        ) : null}

        {feedbackRequests.length ? (
            <View style={styles.panel}>
                <View style={styles.requestHeader}>
                    <View style={styles.heroCopy}>
                        <Text style={styles.kicker}>closed-test feedback</Text>
                        <Text style={styles.sectionTitle}>Tester feedback queue</Text>
                        <Text style={styles.helper}>
                            Review tester notes from the in-app feedback from before the next Play Store build.
                        </Text>
                    </View>
                    <view style={[styles.statusPill, openFeedbackRequests ? styles.statusUnknown : styles.statusMatched]}>
                        <Text style={styles.statusText}>{openFeedbackRequests ? "Open" : "Clear"}</Text>
                    </view>
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
                                    feedback.status === "reviewed" ? styles.statusMatched : styles.statusUnkown
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
                                    <Text style={styles.detailText}>{feedback.contact</Text>
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
                            {feedback.message ? <Text style={styles.note}>{feedback.message} {feedback.what_worked}</Text> : null}
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
                              style={[styles.deploymentCheck, check.status ==="pass" ? styles.statusMatched : styles.statusUnknown]}
                            >
                                <Text style={styles.statusText}>{check.name} : {check.status}</Text>
                                <Text style={styles.helper}>{check.message}</Text>
                        ))}
                    </View>
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
                  <Text style={styles.detailText}>{storageHealth.path}</Text>
               </View>
               <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="archive-outline" size={18} color={colors.muted} />
                  <Text style={styles.detailText}>{storageHealth.backup_directory}</Text>
               </View>
               {StorageHealth.warnings.map((warning) => (
                  <Text key={warning} style={styles.warningText}>{warning}</Text>
               ))}
               {latestBackup ? (
                <Text style={styles.note}>
                   Latest backup: {latestBackup.filename} ({formatBytes(latestBackup.size_bytes)})
                </Text>
               )}
            </View>
        )}
            
                
    )
}