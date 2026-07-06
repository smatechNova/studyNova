import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { DashboardIntroCard } from "@/components/DashboardIntroCard";
import { ProgressBar } from "@/components/ProgressBar";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import {
  createAccountDeletionRequest,
  getStudyProofImageUrl,
  getLatestStudyPlan,
  getParentFamily,
  getStudyPlanHistory,
  getStudyPlanProgress,
  getWeeklyStudyDigest,
  redeemParentInviteCode
} from "@/lib/api";
import {
  DEMO_PARENT_ID,
  createDemoParentFamilyAccount,
  createDemoProgress,
  createDemoSavedStudyPlan,
  createDemoWeeklyDigest,
  isDemoParam
} from "@/lib/demoData";
import { dismissDashboardIntro, hasDismissedDashboardIntro } from "@/lib/dashboardIntro";
import { brandAssets } from "@/lib/brandAssets";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/session";
import type { ParentFamilyAccount, PlanSession, SavedStudyPlan, StudyPlanProgress, WeeklyStudyDigest } from "@/types";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type AttentionItem = {
  session: PlanSession;
  status: "overdue" | "today";
  studyDate: string;
};

type RecoverySummary = {
  dailyExtraMinutes: number;
  overdueMinutes: number;
  overdueSessions: number;
  recoveryDays: number;
  targetDailyMinutes: number;
};

export default function ParentScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ parentId?: string; demo?: string }>();
  const routeParentId = getParamValue(params.parentId);
  const isDemoMode = isDemoParam(params.demo);
  const [sessionParentId, setSessionParentId] = useState<string | undefined>();
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [parentFamily, setParentFamily] = useState<ParentFamilyAccount | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | undefined>();
  const [savedPlan, setSavedPlan] = useState<SavedStudyPlan | null>(null);
  const [planHistory, setPlanHistory] = useState<SavedStudyPlan[]>([]);
  const [progress, setProgress] = useState<StudyPlanProgress | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyStudyDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviteRedeeming, setIsInviteRedeeming] = useState(false);
  const [isDeletionOpen, setIsDeletionOpen] = useState(false);
  const [deletionContact, setDeletionContact] = useState("");
  const [deletionReason, setDeletionReason] = useState("");
  const [deletionConfirmation, setDeletionConfirmation] = useState("");
  const [deletionMessage, setDeletionMessage] = useState("");
  const [isDeletionLoading, setIsDeletionLoading] = useState(false);
  const activeParentId = isDemoMode ? DEMO_PARENT_ID : sessionParentId;

  const latestCompletion = progress?.completions.at(-1);
  const latestProofImageUrl = latestCompletion ? getStudyProofImageUrl(latestCompletion) : null;
  const recentDays = useMemo(() => {
    if (weeklyDigest?.days.length) {
      return weeklyDigest.days;
    }

    const days = progress?.daily ?? [];
    const today = toDateValue(new Date());
    const elapsedDays = days.filter((day) => day.study_date <= today);
    return (elapsedDays.length ? elapsedDays : days).slice(-7);
  }, [progress?.daily, weeklyDigest]);
  const weeklyRate = useMemo(() => {
    if (weeklyDigest) {
      return Math.round(weeklyDigest.completion_rate);
    }

    if (!recentDays.length) {
      return 0;
    }

    const total = recentDays.reduce((sum, day) => sum + day.completion_rate, 0);
    return Math.round(total / recentDays.length);
  }, [recentDays, weeklyDigest]);
  const streakDays = useMemo(() => weeklyDigest?.streak_days ?? calculateStreak(progress), [progress, weeklyDigest]);
  const selectedStudent =
    parentFamily?.students.find((student) => student.id === selectedStudentId) ?? parentFamily?.students[0];
  const attentionItems = useMemo(
    () => (savedPlan ? getAttentionItems(savedPlan, progress) : []),
    [savedPlan, progress]
  );
  const overdueAttentionCount = attentionItems.filter((item) => item.status === "overdue").length;
  const recoverySummary = useMemo(
    () => (savedPlan ? getRecoverySummary(savedPlan, progress) : null),
    [savedPlan, progress]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadStoredSession() {
      if (isDemoMode) {
        setSessionParentId(DEMO_PARENT_ID);
        setAuthMessage("");
        setIsSessionLoading(false);
        return;
      }

      setIsSessionLoading(true);
      const session = await getStoredAuthSession();
      if (!isMounted) {
        return;
      }

      if (session?.role === "parent" && session.parent) {
        if (routeParentId && routeParentId !== session.parent.id) {
          setSessionParentId(undefined);
          setAuthMessage("This parent link belongs to another parent account. Sign in with the correct parent.");
        } else {
          setSessionParentId(session.parent.id);
          setAuthMessage("");
        }
      } else if (session?.role === "student") {
        setSessionParentId(undefined);
        setAuthMessage("Student accounts cannot open the parent dashboard. Sign in with a parent account.");
      } else {
        setSessionParentId(undefined);
        setAuthMessage("Sign in as a parent or guardian to monitor linked students.");
      }

      setIsSessionLoading(false);
    }

    void loadStoredSession();

    return () => {
      isMounted = false;
    };
  }, [isDemoMode, routeParentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadIntroState() {
      if (!activeParentId) {
        setIsIntroVisible(false);
        return;
      }

      const isDismissed = await hasDismissedDashboardIntro("parent", activeParentId);
      if (isMounted) {
        setIsIntroVisible(!isDismissed);
      }
    }

    void loadIntroState();

    return () => {
      isMounted = false;
    };
  }, [activeParentId]);

  useEffect(() => {
    void loadParentView();
  }, [activeParentId, isDemoMode]);

  async function loadParentView(nextStudentId = selectedStudentId) {
    if (!activeParentId) {
      return;
    }

    setIsLoading(true);
    setMessage("");
    setIsHistoryLoading(false);

    if (isDemoMode) {
      const family = createDemoParentFamilyAccount();
      const demoPlan = createDemoSavedStudyPlan();
      const selectedStudent = family.students.find((student) => student.id === nextStudentId) ?? family.students[0];

      setParentFamily(family);
      setDeletionContact((current) => current || family.parent?.contact || "");
      setSelectedStudentId(selectedStudent?.id);
      setPlanHistory([demoPlan]);
      setSavedPlan(demoPlan);
      setProgress(createDemoProgress(demoPlan.plan));
      setWeeklyDigest(createDemoWeeklyDigest(demoPlan.plan));
      setMessage("Screenshot demo uses safe sample data. No real parent or student account is shown.");
      setIsHistoryLoading(false);
      setIsLoading(false);
      return;
    }

    try {
      const latestFamily = await getParentFamily(activeParentId);
      setParentFamily(latestFamily);
      setDeletionContact((current) => current || latestFamily.parent?.contact || "");

      if (!latestFamily.parent || !latestFamily.students.length) {
        setSavedPlan(null);
        setPlanHistory([]);
        setProgress(null);
        setWeeklyDigest(null);
        setMessage("Ask the student to generate a parent invite code, then enter it below.");
        return;
      }

      const activeStudent =
        latestFamily.students.find((student) => student.id === nextStudentId) ?? latestFamily.students[0];
      setSelectedStudentId(activeStudent.id);

      try {
        setIsHistoryLoading(true);
        const history = await getStudyPlanHistory({ studentId: activeStudent.id, limit: 6 });
        const currentPlan = history[0] ?? (await getLatestStudyPlan({ studentId: activeStudent.id }));
        const [currentProgress, currentDigest] = await Promise.all([
          getStudyPlanProgress(currentPlan.id),
          getWeeklyStudyDigest(currentPlan.id)
        ]);
        setPlanHistory(history.length ? history : [currentPlan]);
        setSavedPlan(currentPlan);
        setProgress(currentProgress);
        setWeeklyDigest(currentDigest);
      } catch (error) {
        if (isSessionExpiredError(error)) {
          setSessionParentId(undefined);
          setAuthMessage("Your sign-in session expired. Please sign in again.");
          return;
        }
        setSavedPlan(null);
        setPlanHistory([]);
        setProgress(null);
        setWeeklyDigest(null);
        setMessage(`Generate and save a study plan for ${activeStudent.name}.`);
      } finally {
        setIsHistoryLoading(false);
      }
    } catch (error) {
      if (isSessionExpiredError(error)) {
        setSessionParentId(undefined);
        setAuthMessage("Your sign-in session expired. Please sign in again.");
        return;
      }
      setParentFamily(null);
      setSavedPlan(null);
      setPlanHistory([]);
      setProgress(null);
      setWeeklyDigest(null);
      setIsHistoryLoading(false);
      setMessage("Sign in as a parent, then link a student with their invite code.");
    } finally {
      setIsLoading(false);
    }
  }

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    void loadParentView(studentId);
  }

  async function redeemStudentInvite() {
    if (isDemoMode) {
      setInviteMessage("Demo mode does not link real student accounts.");
      return;
    }

    if (!activeParentId || !inviteCode.trim()) {
      setInviteMessage("Enter the code from the student account.");
      return;
    }

    setIsInviteRedeeming(true);
    setInviteMessage("");

    try {
      const family = await redeemParentInviteCode(activeParentId, inviteCode.trim());
      setParentFamily(family);
      const linkedStudent = family.students.at(-1) ?? family.students[0];
      setInviteCode("");
      setInviteMessage(linkedStudent ? `${linkedStudent.name} is now linked.` : "Student account linked.");
      if (linkedStudent) {
        setSelectedStudentId(linkedStudent.id);
        void loadParentView(linkedStudent.id);
      }
    } catch (error) {
      if (isSessionExpiredError(error)) {
        setSessionParentId(undefined);
        setAuthMessage("Your sign-in session expired. Please sign in again.");
      } else {
        setInviteMessage("That code is invalid, expired, or already used.");
      }
    } finally {
      setIsInviteRedeeming(false);
    }
  }

  async function openPlanVersion(planVersion: SavedStudyPlan) {
    setSavedPlan(planVersion);
    setIsLoading(true);
    setMessage("");

    if (isDemoMode) {
      setProgress(createDemoProgress(planVersion.plan));
      setWeeklyDigest(createDemoWeeklyDigest(planVersion.plan));
      setMessage("Screenshot demo uses safe sample data. No backend request was made.");
      setIsLoading(false);
      return;
    }

    try {
      const [selectedProgress, selectedDigest] = await Promise.all([
        getStudyPlanProgress(planVersion.id),
        getWeeklyStudyDigest(planVersion.id)
      ]);
      setProgress(selectedProgress);
      setWeeklyDigest(selectedDigest);
    } catch {
      setProgress(null);
      setWeeklyDigest(null);
      setMessage("Progress tracking is unavailable for that saved plan.");
    } finally {
      setIsLoading(false);
    }
  }

  async function switchAccount() {
    if (isDemoMode) {
      router.replace("/");
      return;
    }

    await clearStoredAuthSession();
    router.replace("/auth?role=parent");
  }

  function dismissIntro() {
    if (!activeParentId) {
      return;
    }

    setIsIntroVisible(false);
    void dismissDashboardIntro("parent", activeParentId);
  }

  async function submitDeletionRequest() {
    if (isDemoMode) {
      setDeletionMessage("Demo mode uses safe sample data, so no account deletion request is created.");
      return;
    }

    if (!deletionContact.trim()) {
      setDeletionMessage("Enter an email or phone number support can use for this request.");
      return;
    }

    if (deletionConfirmation.trim() !== "DELETE") {
      setDeletionMessage("Type DELETE to confirm the deletion request.");
      return;
    }

    setIsDeletionLoading(true);
    setDeletionMessage("");

    try {
      const receipt = await createAccountDeletionRequest({
        contact: deletionContact.trim(),
        reason: deletionReason.trim(),
        confirmation: "DELETE"
      });
      setDeletionReason("");
      setDeletionConfirmation("");
      setDeletionMessage(receipt.message);
    } catch (requestError) {
      if (isSessionExpiredError(requestError)) {
        setSessionParentId(undefined);
        setAuthMessage("Your sign-in session expired. Please sign in again.");
        return;
      }
      setDeletionMessage("Could not send the deletion request. Check the API connection and try again.");
    } finally {
      setIsDeletionLoading(false);
    }
  }

  if (isSessionLoading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.sectionTitle}>Checking parent access</Text>
            <Text style={styles.helper}>Opening the monitoring dashboard for the signed-in parent account.</Text>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (!activeParentId) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.panel}>
            <MaterialCommunityIcons name="lock-outline" size={28} color={colors.brand} />
            <Text style={styles.sectionTitle}>Parent sign in required</Text>
            <Text style={styles.helper}>
              {authMessage || "Sign in as a parent or guardian to monitor linked student accounts."}
            </Text>
            <Link href="/auth?role=parent" asChild>
              <Pressable accessibilityRole="button" style={styles.linkButton}>
                <MaterialCommunityIcons name="login" size={18} color={colors.brand} />
                <Text style={styles.linkButtonText}>Sign in as parent</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Image accessibilityIgnoresInvertColors source={brandAssets.parentDashboardHero} style={styles.headerArtwork} />
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Selected student</Text>
            <Text style={styles.title}>{selectedStudent?.name ?? savedPlan?.student_name ?? "No student yet"}</Text>
            {selectedStudent ? (
              <Text style={styles.helper}>
                {selectedStudent.class_level}
                {parentFamily?.parent ? ` - linked to ${parentFamily.parent.name}` : ""}
              </Text>
            ) : savedPlan ? (
              <Text style={styles.helper}>{savedPlan.plan.metadata.class_level || "Class not set"}</Text>
            ) : null}
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" onPress={() => void loadParentView()} style={styles.badge}>
              {isLoading ? (
                <ActivityIndicator color={colors.success} />
              ) : (
                <MaterialCommunityIcons name="refresh" size={18} color={colors.success} />
              )}
              <Text style={styles.badgeText}>Refresh</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void switchAccount()} style={styles.accountButton}>
              <MaterialCommunityIcons name="account-switch-outline" size={18} color={colors.brand} />
              <Text style={styles.accountButtonText}>Switch</Text>
            </Pressable>
          </View>
        </View>

        {isIntroVisible ? <DashboardIntroCard role="parent" onDismiss={dismissIntro} /> : null}

        {message ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="information-outline" size={22} color={colors.brand} />
            <Text style={styles.infoText}>{message}</Text>
          </View>
        ) : null}

        {isRebalancedPlan(savedPlan) ? (
          <View style={styles.infoPanel}>
            <MaterialCommunityIcons name="calendar-sync-outline" size={22} color={colors.brand} />
            <Text style={styles.infoText}>Plan rebalanced after missed sessions.</Text>
          </View>
        ) : null}

        {progress?.missed_sessions_count ? (
          <View style={[styles.infoPanel, styles.warningPanel]}>
            <MaterialCommunityIcons name="bell-alert-outline" size={22} color={colors.warning} />
            <Text style={styles.infoText}>
              {selectedStudent?.name ?? "This student"} has {progress.missed_sessions_count} missed study{" "}
              {progress.missed_sessions_count === 1 ? "session" : "sessions"} to recover.
            </Text>
          </View>
        ) : null}

        {parentFamily?.parent ? (
          <View style={styles.linkInvitePanel}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Link a student</Text>
                <Text style={styles.sectionTitle}>Enter student invite code</Text>
                <Text style={styles.helper}>
                  Ask the student to tap Parent link on their dashboard and share the one-time code shown there.
                </Text>
              </View>
              {isInviteRedeeming ? <ActivityIndicator color={colors.brand} /> : null}
            </View>
            <View style={styles.inviteInputRow}>
              <TextInput
                autoCapitalize="characters"
                onChangeText={(value) => {
                  setInviteMessage("");
                  setInviteCode(value.toUpperCase());
                }}
                placeholder="SN-123456"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={inviteCode}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isInviteRedeeming}
                onPress={() => void redeemStudentInvite()}
                style={[styles.linkButton, isInviteRedeeming ? styles.disabledButton : null]}
              >
                <MaterialCommunityIcons name="link-variant-plus" size={18} color={colors.brand} />
                <Text style={styles.linkButtonText}>Link</Text>
              </Pressable>
            </View>
            {inviteMessage ? <Text style={styles.infoText}>{inviteMessage}</Text> : null}
          </View>
        ) : null}

        {parentFamily?.parent ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Privacy</Text>
                <Text style={styles.sectionTitle}>Account deletion</Text>
                <Text style={styles.helper}>
                  Request deletion of this parent account. Linked student accounts remain separate and are reviewed
                  before support completes the request.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setIsDeletionOpen((current) => !current);
                  setDeletionMessage("");
                }}
                style={styles.linkButton}
              >
                <MaterialCommunityIcons
                  name={isDeletionOpen ? "chevron-up" : "trash-can-outline"}
                  size={18}
                  color={colors.brand}
                />
                <Text style={styles.linkButtonText}>{isDeletionOpen ? "Close" : "Request"}</Text>
              </Pressable>
            </View>
            {isDeletionOpen ? (
              <View style={styles.deletionForm}>
                <TextInput
                  autoCapitalize="none"
                  onChangeText={(value) => {
                    setDeletionMessage("");
                    setDeletionContact(value);
                  }}
                  placeholder="Contact email or phone"
                  placeholderTextColor={colors.muted}
                  style={styles.fullInput}
                  value={deletionContact}
                />
                <TextInput
                  multiline
                  onChangeText={(value) => {
                    setDeletionMessage("");
                    setDeletionReason(value);
                  }}
                  placeholder="Optional reason"
                  placeholderTextColor={colors.muted}
                  style={[styles.fullInput, styles.noteInput]}
                  value={deletionReason}
                />
                <TextInput
                  autoCapitalize="characters"
                  onChangeText={(value) => {
                    setDeletionMessage("");
                    setDeletionConfirmation(value);
                  }}
                  placeholder="Type DELETE to confirm"
                  placeholderTextColor={colors.muted}
                  style={styles.fullInput}
                  value={deletionConfirmation}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isDeletionLoading}
                  onPress={() => void submitDeletionRequest()}
                  style={[styles.dangerButton, isDeletionLoading ? styles.disabledButton : null]}
                >
                  {isDeletionLoading ? (
                    <ActivityIndicator color={colors.warningDark} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="shield-alert-outline" size={18} color={colors.warningDark} />
                      <Text style={styles.dangerButtonText}>Send deletion request</Text>
                    </>
                  )}
                </Pressable>
                {deletionMessage ? <Text style={styles.helper}>{deletionMessage}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {parentFamily?.students.length ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.sectionTitle}>Students</Text>
              {isDemoMode ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setInviteMessage("Demo mode keeps linking disabled for screenshot safety.")}
                  style={styles.linkButton}
                >
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.brand} />
                  <Text style={styles.linkButtonText}>Demo link</Text>
                </Pressable>
              ) : (
                <Link href={`/accounts?parentId=${encodeURIComponent(activeParentId)}`} asChild>
                  <Pressable accessibilityRole="button" style={styles.linkButton}>
                    <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.brand} />
                    <Text style={styles.linkButtonText}>Link student</Text>
                  </Pressable>
                </Link>
              )}
            </View>
            <Text style={styles.helper}>
              This parent can monitor multiple student accounts. Select one child to view their progress.
            </Text>
            <View style={styles.studentPicker}>
              {parentFamily.students.map((student) => {
                const isSelected = student.id === selectedStudent?.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={student.id}
                    onPress={() => selectStudent(student.id)}
                    style={[styles.studentChip, isSelected ? styles.studentChipSelected : null]}
                  >
                    <Text style={[styles.studentChipText, isSelected ? styles.studentChipTextSelected : null]}>
                      {student.name}
                    </Text>
                    <Text style={[styles.studentChipMeta, isSelected ? styles.studentChipTextSelected : null]}>
                      {student.class_level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {planHistory.length || isHistoryLoading ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.headerCopy}>
                <Text style={styles.kicker}>Plan history</Text>
                <Text style={styles.sectionTitle}>Saved versions</Text>
              </View>
              {isHistoryLoading ? <ActivityIndicator color={colors.brand} /> : null}
            </View>
            <Text style={styles.helper}>
              Review the current plan or open an earlier saved timetable for this student.
            </Text>
            <View style={styles.historyList}>
              {planHistory.map((planVersion) => {
                const isActive = savedPlan?.id === planVersion.id;
                return (
                  <View key={planVersion.id} style={[styles.historyCard, isActive ? styles.historyCardActive : null]}>
                    <View style={styles.historyCopy}>
                      <Text style={styles.updateTitle}>{formatReadableDate(planVersion.created_at.slice(0, 10))}</Text>
                      <Text style={styles.sessionMeta}>
                        {formatHours(planVersion.plan.metadata.average_daily_minutes)} per day - Exam{" "}
                        {formatReadableDate(planVersion.plan.metadata.exam_start_date)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={isActive}
                      onPress={() => void openPlanVersion(planVersion)}
                      style={[styles.linkButton, isActive ? styles.disabledButton : null]}
                    >
                      <MaterialCommunityIcons
                        name={isActive ? "check-circle-outline" : "folder-open-outline"}
                        size={18}
                        color={colors.brand}
                      />
                      <Text style={styles.linkButtonText}>{isActive ? "Current" : "Open"}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>Weekly review</Text>
              <Text style={styles.sectionTitle}>{weeklyDigest?.headline ?? "Weekly consistency"}</Text>
            </View>
            <Text style={styles.metric}>{weeklyRate}%</Text>
          </View>
          <ProgressBar value={weeklyRate} />
          <Text style={styles.helper}>{weeklyDigest?.insight ?? parentSummaryCopy(weeklyRate, streakDays)}</Text>
          {weeklyDigest ? (
            <>
              <View style={styles.recoveryGrid}>
                <View style={styles.recoveryItem}>
                  <Text style={styles.kicker}>Completed</Text>
                  <Text style={styles.updateTitle}>
                    {weeklyDigest.completed_sessions}/{weeklyDigest.planned_sessions}
                  </Text>
                </View>
                <View style={styles.recoveryItem}>
                  <Text style={styles.kicker}>Active days</Text>
                  <Text style={styles.updateTitle}>{weeklyDigest.active_days}</Text>
                </View>
                <View style={styles.recoveryItem}>
                  <Text style={styles.kicker}>Missed</Text>
                  <Text style={styles.updateTitle}>{weeklyDigest.missed_sessions}</Text>
                </View>
              </View>
              <View style={styles.infoPanel}>
                <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.brand} />
                <Text style={styles.infoText}>{weeklyDigest.next_action}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Needs attention</Text>
            <Text style={[styles.confidence, overdueAttentionCount ? styles.overdueText : null]}>
              {overdueAttentionCount ? `${overdueAttentionCount} missed` : "Clear"}
            </Text>
          </View>
          {attentionItems.length ? (
            <View style={styles.attentionList}>
              {attentionItems.slice(0, 5).map((item, index) => (
                <View
                  key={`${item.studyDate}-${item.session.subject}-${item.session.topic}-${index}`}
                  style={[styles.attentionRow, item.status === "overdue" ? styles.attentionRowOverdue : null]}
                >
                  <MaterialCommunityIcons
                    name={item.status === "overdue" ? "alert-circle-outline" : "calendar-check-outline"}
                    size={22}
                    color={item.status === "overdue" ? colors.warning : colors.brand}
                  />
                  <View style={styles.updateText}>
                    <Text style={styles.updateTitle}>{item.session.topic}</Text>
                    <Text style={styles.sessionMeta}>
                      {item.session.subject} - {formatReadableDate(item.studyDate)} - {item.session.minutes} minutes
                    </Text>
                  </View>
                  <Text style={[styles.sessionMeta, item.status === "overdue" ? styles.overdueText : null]}>
                    {attentionStatusLabel(item.status)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.helper}>
              No overdue sessions right now. The student is clear up to today on this saved plan.
            </Text>
          )}
        </View>

        {recoverySummary ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.sectionTitle}>Catch-up view</Text>
              <Text style={[styles.metric, recoverySummary.overdueMinutes ? styles.overdueText : null]}>
                {recoverySummary.overdueMinutes ? formatHours(recoverySummary.overdueMinutes) : "On pace"}
              </Text>
            </View>
            <Text style={styles.helper}>
              {parentRecoveryCopy(recoverySummary, savedPlan?.plan.metadata.available_daily_minutes ?? 0)}
            </Text>
            <View style={styles.recoveryGrid}>
              <View style={styles.recoveryItem}>
                <Text style={styles.kicker}>Missed</Text>
                <Text style={styles.updateTitle}>{recoverySummary.overdueSessions}</Text>
              </View>
              <View style={styles.recoveryItem}>
                <Text style={styles.kicker}>Extra daily</Text>
                <Text style={styles.updateTitle}>{formatHours(recoverySummary.dailyExtraMinutes)}</Text>
              </View>
              <View style={styles.recoveryItem}>
                <Text style={styles.kicker}>Target</Text>
                <Text style={styles.updateTitle}>{formatHours(recoverySummary.targetDailyMinutes)}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard label="Study streak" value={`${streakDays} days`} icon="fire" />
          <StatCard
            label="Completed"
            value={`${progress?.completed_sessions ?? 0}/${progress?.planned_sessions ?? 0}`}
            icon="checkbox-marked-circle-outline"
          />
          <StatCard label="Minutes" value={`${progress?.completed_minutes ?? 0}`} icon="timer-outline" />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Latest study proof</Text>
            {latestCompletion ? <Text style={styles.confidence}>Confidence {latestCompletion.confidence}/5</Text> : null}
          </View>
          {latestCompletion ? (
            <View style={styles.updateRow}>
              <MaterialCommunityIcons name="book-check-outline" size={24} color={colors.brand} />
              <View style={styles.updateText}>
                <Text style={styles.updateTitle}>
                  {latestCompletion.topic} {latestCompletion.kind === "practice" ? "practice" : "completed"}
                </Text>
                <Text style={styles.helper}>{latestCompletion.recall_note}</Text>
                <Text style={styles.sessionMeta}>
                  {latestCompletion.subject} - {formatReadableDate(latestCompletion.study_date)}
                </Text>
                {latestProofImageUrl ? (
                  <Image
                    accessibilityIgnoresInvertColors
                    source={{ uri: latestProofImageUrl }}
                    style={styles.proofPreviewImage}
                  />
                ) : null}
              </View>
            </View>
          ) : (
            <Text style={styles.helper}>
              No completed session yet. Once the student marks a session done, their recall note will appear here.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Recent study days</Text>
          <View style={styles.dayList}>
            {recentDays.map((day) => (
              <View key={day.study_date} style={styles.dayRow}>
                <View style={styles.dayCopy}>
                  <Text style={styles.updateTitle}>{formatReadableDate(day.study_date)}</Text>
                  <Text style={styles.sessionMeta}>
                    {day.completed_sessions}/{day.planned_sessions} sessions - {day.completed_minutes} minutes
                  </Text>
                </View>
                <Text style={styles.dayRate}>{Math.round(day.completion_rate)}%</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function getParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isSessionExpiredError(error: unknown) {
  return error instanceof Error && error.message.includes("sign-in session expired");
}

function isRebalancedPlan(savedPlan: SavedStudyPlan | null) {
  return savedPlan?.plan.metadata.recommendation.startsWith("Plan rebalanced after missed sessions.") ?? false;
}

function getAttentionItems(savedPlan: SavedStudyPlan, progress: StudyPlanProgress | null): AttentionItem[] {
  if (progress?.missed_sessions.length) {
    return progress.missed_sessions.map((session) => ({
      session: {
        kind: session.kind,
        subject: session.subject,
        topic: session.topic,
        resource_type: session.resource_type,
        minutes: session.minutes,
        break_after_minutes: 0
      },
      studyDate: session.study_date,
      status: "overdue"
    }));
  }

  const today = toDateValue(new Date());
  const completedKeys = new Set(progress?.completed_session_keys ?? []);
  const items: AttentionItem[] = [];

  savedPlan.plan.schedule.forEach((day) => {
    if (day.study_date > today) {
      return;
    }

    day.sessions.forEach((session, index) => {
      const key = `${day.study_date}:${index}`;
      if (completedKeys.has(key)) {
        return;
      }

      items.push({
        session,
        studyDate: day.study_date,
        status: day.study_date < today ? "overdue" : "today"
      });
    });
  });

  return items;
}

function attentionStatusLabel(status: AttentionItem["status"]) {
  return status === "overdue" ? "Missed" : "Today";
}

function getRecoverySummary(savedPlan: SavedStudyPlan, progress: StudyPlanProgress | null): RecoverySummary {
  const today = toDateValue(new Date());
  const completedKeys = new Set(progress?.completed_session_keys ?? []);
  const averageDailyMinutes =
    savedPlan.plan.metadata.average_daily_minutes ??
    Math.ceil(savedPlan.plan.metadata.total_study_minutes / Math.max(savedPlan.plan.metadata.days_until_exam, 1));
  let overdueMinutes = progress?.missed_minutes ?? 0;
  let overdueSessions = progress?.missed_sessions_count ?? 0;

  if (!progress) {
    savedPlan.plan.schedule.forEach((day) => {
      if (day.study_date >= today) {
        return;
      }

      day.sessions.forEach((session, index) => {
        if (completedKeys.has(`${day.study_date}:${index}`)) {
          return;
        }

        overdueMinutes += session.minutes;
        overdueSessions += 1;
      });
    });
  }

  const recoveryDays = Math.max(1, savedPlan.plan.schedule.filter((day) => day.study_date >= today).length);
  const dailyExtraMinutes = overdueMinutes ? Math.ceil(overdueMinutes / recoveryDays) : 0;

  return {
    dailyExtraMinutes,
    overdueMinutes,
    overdueSessions,
    recoveryDays,
    targetDailyMinutes: averageDailyMinutes + dailyExtraMinutes
  };
}

function parentRecoveryCopy(summary: RecoverySummary, availableDailyMinutes: number) {
  if (!summary.overdueMinutes) {
    return "No catch-up pressure right now. Encourage the student to keep today's queue clear.";
  }

  if (summary.targetDailyMinutes > availableDailyMinutes) {
    return `The student needs about ${formatHours(summary.dailyExtraMinutes)} extra daily, which is above the current available study time. A short parent check-in may help.`;
  }

  return `The student can recover by adding about ${formatHours(summary.dailyExtraMinutes)} daily for ${summary.recoveryDays} days.`;
}

function parentSummaryCopy(weeklyRate: number, streakDays: number) {
  if (weeklyRate >= 80) {
    return `Strong week. The student has a ${streakDays}-day active streak and is keeping up well.`;
  }

  if (weeklyRate >= 50) {
    return "Progress is moving, but a gentle reminder may help keep sessions consistent.";
  }

  return "This week needs attention. Encourage one focused session today and review the latest recall note.";
}

function calculateStreak(progress: StudyPlanProgress | null) {
  if (!progress) {
    return 0;
  }

  const activeDates = new Set(
    progress.daily.filter((day) => day.completed_sessions > 0).map((day) => day.study_date)
  );
  let date = new Date();
  let streak = 0;

  while (activeDates.has(toDateValue(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

function formatReadableDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  const formatted = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${formatted}h`;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  attentionList: {
    gap: spacing.sm
  },
  attentionRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  attentionRowOverdue: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder
  },
  accountButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  accountButtonText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "900"
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.successSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700"
  },
  confidence: {
    color: colors.success,
    fontSize: 13,
    fontWeight: "800"
  },
  proofPreviewImage: {
    borderRadius: 8,
    height: 160,
    width: 160
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xxl
  },
  dayCopy: {
    flex: 1,
    gap: spacing.xs
  },
  dayList: {
    gap: spacing.sm
  },
  dayRate: {
    color: colors.brand,
    fontSize: 16,
    fontWeight: "800"
  },
  dayRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  dangerButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm
  },
  dangerButtonText: {
    color: colors.warningDark,
    fontSize: 13,
    fontWeight: "900"
  },
  deletionForm: {
    gap: spacing.sm
  },
  disabledButton: {
    opacity: 0.55
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between"
  },
  headerArtwork: {
    borderRadius: 8,
    height: 104,
    width: 104
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end"
  },
  historyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md
  },
  historyCardActive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success
  },
  historyCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 180
  },
  historyList: {
    gap: spacing.sm
  },
  helper: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  infoPanel: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  infoText: {
    color: colors.brandDark,
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 44,
    minWidth: 180,
    paddingHorizontal: spacing.md
  },
  fullInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%"
  },
  inviteInputRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  linkButton: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.sm
  },
  linkButtonText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800"
  },
  linkInvitePanel: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  metric: {
    color: colors.brand,
    fontSize: 24,
    fontWeight: "800"
  },
  noteInput: {
    minHeight: 96,
    textAlignVertical: "top"
  },
  overdueText: {
    color: colors.warningDark
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between"
  },
  recoveryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  recoveryItem: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 92,
    padding: spacing.md
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  },
  sessionMeta: {
    color: colors.muted,
    fontSize: 13
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  studentChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  studentChipMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  studentChipSelected: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand
  },
  studentChipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  studentChipTextSelected: {
    color: colors.brand
  },
  studentPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800"
  },
  updateRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md
  },
  updateText: {
    flex: 1,
    gap: spacing.xs
  },
  updateTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700"
  },
  warningPanel: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningBorder
  }
});
}
