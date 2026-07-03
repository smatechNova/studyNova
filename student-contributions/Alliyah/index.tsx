import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, router } from "@expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/componenets/AnimatedPressable";
import { RoleCard } from "@/components/RoleCard";
import { Screen } from "@/components/Screen";
import { StatCard } from "@/components/StatCard";
import { clearStoredAuthSession, getStoredAuthSession } from "@/lib/session";
import { spacing, type AppColours } from "@/theme";
import { useTheme } from "@/themeContext";
import type { AuthSession } from "@/types";

const brandLogo = require("../assets/brand/studynova-logo-concept.png");
const studentCardImage = require("../assets/brand/student-card.png");
const parentCardImage = require("../assets/brand/parent-card.png");

export default function Homescreen() {
    const { colors } = useTheme();
    const styles = useMemo(()=> createStyles(colors), [colors]);
    const [savedSession, setSavedSession] = useState(AuthSession | null>(null);

    useEffect(() => {
        let isMounted = true;
          
        async function loadSession() {
            const session = await getStoredAuthSession();
            if(isMounted) {
                setSavedSession(session);
            }
        }
    void loadSession();


    return () => {
        isMounted = false;
    };
  ), []);

  function continueSavedSession() {
    if (savedSession?.role === "student" && savedSession.student) {
        router.replace('/student?studentId=${encodeURIComponent(savedSession.student.id)}');
        return;
    }
  
     if (savedSession?.role === "parent" && savedSession.parent) {
        router.replace('/parent?parentId=${encodeURIComponent(savedSession.parent.id)}');
     }
    }      

    async function signOut() {
        await clearStoredAuthSession();
        setSavedSession(null);
    }

    function openScreenshotDemo(role: "student" | "parent") {
        router.push(role === "student" ? "/student?demo=student" : "/parent?demo=parent");
    }

    return {
        <Screen>
         <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
           <View style={styles.logo}>
            <Image accessibilityIgnoresInvertColours source={brandLogo} style={styles.logoImage}
            </View>
            <View style={styles.heroText}>
             <Text style={styles.kicker}>For students, parents, and schools</Text>
             <Text style={styles.title}>StudyNova</Text>
             <Text style={styles.subtitle}>
               A focused planner that turns subjects, topics, reading pace, and exam dates into daily academic plan.
             </Text>
            </View>
           </View>

         {savedSession ? (
            <View style={styles.continuePanel}>
             <View style={styles.continueCopy}>
               <Text style={styles.kicker}>Saved sign in</Text>
               <Text  style={styles.continueTitle}>{savedSessionLabel{savedSession}}</Text>
               <Text style={styles.subtitle}>{savedSessionDescription{savedSession}}</Text>
              </View>
            <View style={styles.continueActions}>
                <Pressable accessibilityRole="button" onPress={continueSavedSession} style={styles.primaryButton}>
                    <MaterialCommunityIcons name="login" size={18} color="#FFFFFF"/>
                    <Text style={styles.primaryButtonText}>Continue</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Sign Out</Text>
                </Pressable>
            </View>
        </View>
    ): null}
            
    <View style={styles.demoPanel}>
    <View style={styles.demoIcon}>
        <MaterialCommunityIcons name="camera-outline" size={26} color={colors.brand} />
    </View>
    <View style={styles.demoCopy}>               
     <Text style={styles.kicker}>Play Store screenshot</Text>       
     <Text style={styles.demoTitle}>Open safe demo data</Text>       
     <Text style={styles.subtitle}>
       Use sample student and parent dashboards for screenshots without exposing real learner data.
     </Text>   
    </View>  
    <View style={styles.demoActions}>
     <Pressable accessibilityRole="button" onPress={() => openScreenshotDemo("student")} style={styles.secondaryButton}>
       <MaterialCommunityIcons name="notebook-edit-outline" size={18} color={colors.brand} />
       <Text style={styles.secondaryButtonText}>Student demo</Text>
     </Pressable>
     <Pressable accessibilityRole="button" onPress={() => openScreenshotDemo("parent")} style={styles.secondaryButton}>
       <MaterialCommunityIcons name="account-supervisor-outline" size={18} color={colors.brand} />
       <Text style={styles.secondaryButtonText}>Parent demo</Text>
     </Pres(sable>
    </View>
   </View>
    
   <View style={styles.statsGrid}>
     <StatCard label="Smart planning" value="Daily" icon="calendar-clock" />
     <StatCard label="Study proof" value="Recall" icon="book-check-outline" />
     <StatCard label="Parent view" value="Live" icon="account-supervisor-outline" />
    </View>

    <View style={styles.roleGrid}>
     <Link href="/auth?role=student" asChild>
       <RoleCard
         title="Student sign in"
         description="Open one student's own study dashboard and progress."
         icon="notebook-edit-outline"
         imageSource={studentCardImage}
        />
     </Link>
     <Link href="/auth?role=parent" asChild>
        <RoleCard
           title="Parent/guardian sign in"
           description="Monitor linked students from the parent dashboard."
           icon="shield-account-outline"
           imageSource={parentCardImage}
        />
     </Link>
     <Link href="/accounts"asChild>
        <RoleCard
           title="Account setup"
           description="Create one student account, then link it to a parent monitoring account."
           icon="account-multiple-plus-outline"  
        />   
     </Link>
     <RoleCard
        title="Tester feedback"
        description="Send one clear note about anything confusing, broken, or ready."
        icon="message-text-outline"
        onPress={() => router.push("/feedback" as never)}
        />
       </View>

       <View style={styles.legalLinks}>
         <Pressable
           accessibilityRole="button"
           onPress={() => router.push("/privacy" as never)}
           style={styles.privacyLink}
        >
           <MaterialCommunityIcons name="shield-lock-outline" size={18} color={colors.muted} />
           <Text style={styles.privacyLinkText}>Privacy policy</Text>
          </Pressable>
          <Pressable 
            accessibilityRole="button"
            onPress={() => router.push("/terms" as never)} 
            style={styles.privacyLInk}  
          >
        
        <MaterialCommunityIcons name="file-document-outline" size={18} color={colors.muted} />
        <Text style={styles.privacyLinkText}>Terms of use</Text>
       </Pressable>
       <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/delete-account" as never)}
            style={styles.privacyLInk}
          <MaterialCommunityIcons name="account-remove-outline" size={18} color={colors.muted} />
          <Text style={styles.privacyLinkText}>Request account deletion</Text>
        </Pressable>
      </View>
    </ScrollView>
   </Screen>   
  );
 }

 function savedSessionLabel(session: AuthSession) {
    if (session.role === "student") {
        return session.student?.name ?? "Student account";
    }

return session.parent?.name ?? "Parent account";
}

function savedSessionDescription(session: AuthSession) {
    if(session.role === "student") {
return `Open the student dashboard without entering the login ID again.";
}

const count = session.students.length;
return `Open parent monitoring for ${count} linked ${count === 1 ? "student" : "students"},`;
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  continueActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
},
continueCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 200
},
continuePanel: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap"
    gap: spacing.md,
    padding: spacing.1g
},
continueTitle: {
    color: colors.text
    fontSize:20,
    fontWeight:"800"
},
content: {
    gap: spacing.x1,
    paddingBottom: spacing.xx1
},
hero: {
alignItems: "center",
backgroundColor: colors.panel,
borderColor: colors.border,
borderRadius: 8,
borderWidth: 1,
flexDirection:"row",
gap: spacing.md,
padding: spacing.lg
},
heroText: {
    flex: 1,
    gap: spacing.xs
},
demoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
},
demoCopy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 220
},
demoIcon: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
},
demoPanel: {
alignItems: "center",
backgroundColor: colors.panel,
borderColor: colors.border,
borderRadius: 8,
borderWidth: 1,
flexDirection: "row",
flexWrap: "wrap",
gap: spacing.md,
padding: spacing.lg
},
demoTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
},
kicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
},
logo: {
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
    height: 92,
    justifyContent: "center",
    overflow: "hidden",
    width: 92
},
logoImage: {
    height: "100%",
    width: "100%"
},
legalLinks: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "center"
}
roleGrid: {
    gap: spacing.md
},
primaryButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 42,
    paddingHorizontal: spacing.md
},
primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800"
},
privacyLink: {
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: spacing.sm
},
privacyLinkText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
},
secondaryButton: {
    alignitems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.md
},
secondaryButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800"
},
statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
},
subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
},
title: {
    color: colors.text,
    fontSize: 32,
    FontWeight: "800"
}
});
}