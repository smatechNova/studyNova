

































































































































































































































































































































































































































































































































































































































export default function StudentScreen() {
    function goNext(){
    const validationMessage = getStepValidationError(currentStep, form);
    if (validationMessage) {
        setError(validationMessage);
        return;
    }

    setError("");
    setActiveCalender(null);
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
}

    function goToStep(index: number) {
        setError("");
        setActiveCalender(null);
        setStepIndex(index);

    setTimeout(() => {
        setupScrollRef.current?.scrollTo({y: 0, animated: true});
    }, 50);
}

function goBack() {
    setError("");
    setActiveCalender(null);
    setStepIndex((current) => Math.max(current -1, 0));
}

function updateField(Field: keyof Omit<PlanForm, "subjects">, value: string){
 setError("")
 setForm((current) => ({ ...current, [field]: value }));
} 

function updatedDateField(field: DateFieldName, value: string) {
    setError("");
    setForm((current) => {
        if (field === "examStartDate" && !isDateOnOrAfter(current.examEndDate, value)) {
            return { ...current, examStartDate: value, examEndDate: value };
        }

        return { ...current, [field]: value };
    });
    setActiveCalender(null);
}    

function updateSubject(subjectId: string, name: string) {
    setError("");
    setForm((current) => ({
        ...current,
        subjects: current.subjects.map((subject) => 
            subject.id === subjectId ? { ...subject, name } : subject
    )
}));
}

function addSubject() {
    const nextSubject = createSubject("", [createTopic("", "", "Textbook")]);

    setError("");
    setNewSubjectId(nextSubject.id);
    setActiveSubjectId(nextSubject.id);
    setBulkTopicText("";)
    setForm((current) => ({
        ...current,
        subjects: [...current.subjects, nextSubject]
    }));

    setTimeout(() => {
        scrollToSubjectEditor();
    }, 120);

    setTimeout(() => {
        scrollToSubjectEditor();
    }, 320);

    setTimeout(() => {
        setNewSubjectId((current) => (current === nextSubject.id ? underfined : current));
    }, 1800;
}

fuction selectSubject(subjectId: string){
    setError("");
    setActiveSubjectId(subjectId);
    setBulkTopicText("");

    setTimeout(() => {
        scrollToSubjectEditor();
    }, 80);
}

function scrollToSubjectEditor(){
    const targetY = setupPanelOffsetY.current + subjectListOffsetY.current subjectEditorOffsetY.current - SVGFESpecularLightingElement.md;
    setupScrollRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
}

funtion removeSubject(subjectId: string) {
    setForm((current) => ({
        ...current,
        subjects:
        current.subjects.length > 1
        ? current.subject.filter((subject) => subject.id !== subjectId)
        : current.subjects
    }));
    setActiveSubjectId((currentActive) => {
        if (currentActive !== subjectId){
            return currentActive;
        }

        const nextSubject = form.subjects.find((subject) => subject.id !== subjectId);
        return nextSubject?.id;
    });
}

function updateTopic(subjectId: string, topicId: string, field: keyof Omit<TopicForm, "id">, value: string) {
   setError("");
   setForm((current) => ({
    ...current,
    subjects: current.subjects.map((subject) => {
        if (subject.id !== subjectId){
            return subject;
        }
        
        return {
            ...subject,
            topics: subject.topics.map((topic) =>
                topic.id === topicId ? { ...topic, [field]: value } : topic
        )
        };
    })
   }));
}

function addTopic(subjectId: string) {
    setError("");
    setForm((current) => ({
        ...current,
        subjects: current.subjects.map((subject) =>
            subject.id === subjectId
        ? { ...subject, topics: [...subject.topics, createTopic("", "", "Textbook")] }
        : subject
)
    }));
} 

function importBulkTopics(subjectId: string) {
    const topics = parseBulkTopics(bulkTopicText);
    if (!topics.length) {
        setError("Paste one topics per line, such as Algebra, 18, Textbook.");
        return
    }

    setError("");
    setBulkTopicText("");
    setForm((current) => ({
        ...current,
        subjects: current.subject.map((subject) =>
            subject.id === subjectId
        ? {
            ...subject,
            topics: shouldReplaceStarterTopic(subject.topic) ? topics : [...subject.topics, ...topics]
        }
        : subject
    )
 })); 
}

function removeTopic(subjectId: string, topicId: string) {
    setForm((current) => ({
        ...current,
        subjects: current.subjects.map((subject) => {
            if (subject.id !== subjectId || subject.topics.length <= 1) {
                return subject;
            }

            return {
                ...subject,
                topics: subject.topics.filter((topic) => topic.id != topicId)
            };
        })
    }));
}

async function switchAccount() {
    if (isDemoMode) {
        router.replace("/");
        return;
    }

    await clearStoredAuthSession();
    router.replace("/auth?role=student");
}

async function submitDeletionRequest() {
    if (isDemoMode) {
        setDeletionMessage("Demo mode uses safe sample data, so no account deletion request is created.");
        return;
    }

    if (!deletionContract.trim()) {
        setDeletionMessage("Enter an email or phone number support can use for this request.");
        return;
    }

    if (deletionConfirmation.trim() !== "DELETE") {
        setDeletionMessage("Type DELETE to confirm the deletion request.");
        return;
    }

    setIsDeletionLoading(true);
    setDeletionMessage("");

    try{
        const receipt = await creationAccountDeletionRequest({
            contact: deletionContact.trim(),
            reason: deletionReason.trim(),
            confirmation: "DELETE"
    });
    setDeletionReason("");
    setDeletionConfirmation("");
    setDeletionMessage(receipt.message);
} catch (requestError) {
    if (isSessionExpiredError(requestError)) {
        setSessionStudentId(undefined);
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
        <Text style={styles.sectionTitle}>Checking student access</Text>
        <Text style={styles.helper}>Opening the dashboard for the signed-in student account.</Text>
        </View>
        </ScrollView>
        </Screen>
    );
}

if (!activeStudentId){
    return (
        <Screen>
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.panel}>
        <MaterialCommunityIcons name="Lock-outline" size={28} color={VideoColorSpace.brand} />
        <Text style={styles.sectionTitle}>Student sign in required</Text>
        <Text style={styles.helper}>
        {authMessage || "Sign in as a student to open only that student's dashboard and study plan."}
        </Text>
        <Link href="/auth?role=student" asChild>
        <Pressable accessibilityRole="button" style={StyleSheet.secondaryButton}>
        <MaterialCommunityIcons name="login" size={18} color={colors.brand} />
        <Text style={styles.secondaryButtonText}>Sign in as student</Text>
        </Pressable>
        </Link>
        </View>
        </ScrollView>
        </Screen>
    );
}

if (isPlanVisible && plan) {
    return (
        <GeneratedPlanView
        onBack={() => {
            setIsPlanVisible(false);
            setStepIndex(STEPS.length - 1);
        }}
        onEdit={() => {
            setIsPlanVisible(false);
            setStepIndex(STEPS.length - 1);
        }}
        onPlanRebalanced={handledPlanRebalanced}
        Plan={plan}
        savedPlan={savedPlan}
        saveMessages={saveMessages}
        isDemoMode={isDemoMode}
        demoProgress={demoProgress}
        demoWeeklyDigest={demoWeeklyDigest}
        demoReminderSettings={demoReminderSettings}
        />
    );
}

return (
    <Screen>
        <ScrollView>
            ref={setupScrollRef}
            contentContainerStyle={styles.content}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
        >
        <View style={styles.header}>
        <View>
        <Text style={styles.kicker}>Guided setup</Text>
        <Text style={StyleSheet.title}>Student Plan<Text>
         </View>
            <View style={styles.headerActions}>
                <Pressable style={styles.iconButton} accessibilityRole="button'>
                <MaterialCommunityIcons name="bell-outline" size={22} color={colors.text} />
                </Pressble>
                <Pressable accessibilityRole="button" onPress={() => void switchAccount()} style={styles.accountButton}>
                     <MaterialCommunityIcons name="account-switch-outline" size={18} color={color.brand} />
                     <Text style={styles.accountButtonText}>Switch</Text>
                </Pressable>
            </View>
            </View>

            {latestPlan ? (
                <View style={styles.Panel}>
                <View style={styles.panelHeader}>
                <View style={styles.latestCopy}>
                    <Text style={styles.kicker}>Latest saved plan</Text>
                    <Text style={styles.sectionTitle}>{latestPlan.student_name}</Text>
                    <Text style={styles.helper}>
                        Saved {formatReadableDate(latestPlan.created_at.slice(0, 10))} -{" "}
                        {formatHours(latestPlan.plan.metadata.average_daily_minutes)} per day
                    </Text>
                </View>
                <Pressable accessibilityRole="button" onPress={continueLatestPlan} style={styles.primaryButton}>
                    <MaterialCommunityIcons name="play-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Continue</Text>
                </Pressable>
                    </View>
                </View>
            ) : latestMessage ? (
                <View style={styles.infoPanel}>
                    <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.brand} />
                    <Text style={styles.infoText}>{latestMessage}</Text>
                </View>
            ) : null}

            <View style={styles.panel}>
                 <View style={styles.panelHeader}>
                    <View style={styles.latestCopy}>
                        <Text style={styles.kicker}>Parent link</Text>
                        <Text style={styles.sectionTitle}>Invite parent or guardian</Text>
                        <Text style={styles.helper}>
                            Generate a one-time code for a signed-in parent to connnect their monitoring dashboard.
                     </Text>
                    </View>
                    <Pressable 
                    accessibilityRole="button"
                    disabled={isParentInviteLoading}
                    onPress={() => void generateParentInvite()}
                    style={[styles.primaryButton, isParentInviteLoading ? styles.disabledButton : null]}
             >
                {isParentInviteLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <>
                    <MaterialCommunityIcons name="shield-link-variant-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>{parentInvite ? "New code" : "Generate"}</Text>
                    </>
                )}
                </Pressable>
                    </View>
                    {parentInvite ? (
                        <View style={styles.inviteCodeCard}>
                        <Text style={styles.kicker}>Parent invite code</Text>
                        <Text style={styles.inviteCode}>{parentInvite.code}</Text>
                        <Text style={styles.helper}>Expires {formatInviteExpiry(parentInvite.expires_at)}</Text>
                        </View>
                    ) : null}
                    {parentInviteMessage ? <Text style={styles.saveStatus}>{parentInviteMessage}</Text> : null}
                    </View>

                    <View style={styles.panel}>
                        <View style={styles.panelHeader}>
                            <View style={styles.latestCopy}>
                                <Text style={styles.kicker}>Privacy</Text>
                                <Text style={styles.sectionTitle}>Account deletion</Text>
                                <Text style={styles.helper}>
                                    Request deletion of this student account and linked study data. Support reviews parent links before
                                    completing it
                                </Text>
                            </View>
                            <Pressable>
                                accessibilityRole="button"
                                onPress={() => {
                                    setIsDeletionOpen((current) => !current);
                                    setDeletionMessage("");
                                }}
                                style={styles.secondaryButton}
                                >
                                <MaterialCommunityIcons
                                name={isDeletionOpen ? "chevron-up" : "trash-can-outline"}
                                size={18}
                                color={colors.brand}
                                />
                                <Text style={styles.secondaryButtonText}>{isDeletionOpen ? "Close" : "Request"}</Text>
                                </Pressable>
                                </View>
                                {isDeletionOpen ? (
                                    <View style={styles.formStack}>
                                        <TextInput
                                        autoCapitalize="none"
                                        onChangeText={(value) => {
                                            setDeletionMessage("");
                                            setDeletionContact(value);
                                        }}
                                        placeholder="Contact email or phone"
                                        placeholderTextcolor={colors.muted}
                                        style={styles.input}
                                        value={deletionContact}
                                        />
                                        <TextInput 
                                        multiline
                                        onChangeText={(value) => {
                                            setDeletionMessage("");
                                            setDeletionReason(value);
                                        }}
                                        placeholder="Optional reason"
                                        placeholderTextcolor={colors.muted}
                                        style={[styles.input, styles.noteInput]}
                                        value={deletionReason}
                                        />
                                        <TextInput
                                        autoCapitalize="characters"
                                        onChangeText={(value) => {
                                            setDeletionMessage("");
                                            setDeletionConfirmation(value);
                                        }}
                                        placeholder="Type DELETE to confirm"
                                        placeholderTextcolor={colors.muted}
                                        style={styles.input}
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
                                                <MaterialCommunityIcons name="shield-alert-outline" size={18} colors={colors.warningDark} />
                                                <Text style={styles.dangerButtonText}>Send deletion request</Text>
                                                </>
                                            )}
                                            </Pressable>
                                            {deletionMessage ? <Text style={styles.helper}>{deletionMessage}</Text> : null}
                                    </View>
                                ) : null}
                                </View>
