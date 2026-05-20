import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { ThemeToggle } from "@/components/ThemeToggle";
import { ThemeProvider, useTheme } from "@/themeContext";

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
      </Stack>
    </>
  );
}
