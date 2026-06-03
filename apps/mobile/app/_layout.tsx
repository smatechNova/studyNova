import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider, useTheme } from "@/themeContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerRight: () => <ThemeToggle />,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          contentStyle: { backgroundColor: colors.surface }
        }}
      >
        <Stack.Screen name="index" options={{ title: "StudyNova" }} />
        <Stack.Screen name="auth" options={{ title: "Sign In" }} />
        <Stack.Screen name="accounts" options={{ title: "Account Setup" }} />
        <Stack.Screen name="student" options={{ title: "Student Dashboard" }} />
        <Stack.Screen name="parent" options={{ title: "Parent Dashboard" }} />
        <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
        <Stack.Screen name="terms" options={{ title: "Terms of Use" }} />
        <Stack.Screen name="delete-account" options={{ title: "Delete Account" }} />
        <Stack.Screen name="feedback" options={{ title: "Tester Feedback" }} />
        <Stack.Screen name="support" options={{ title: "Support Admin" }} />
      </Stack>
    </>
  );
}
