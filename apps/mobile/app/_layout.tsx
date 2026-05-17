import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: "700" },
          contentStyle: { backgroundColor: colors.surface }
        }}
      >
        <Stack.Screen name="index" options={{ title: "StudyNova" }} />
        <Stack.Screen name="student" options={{ title: "Student Dashboard" }} />
        <Stack.Screen name="parent" options={{ title: "Parent Dashboard" }} />
      </Stack>
    </>
  );
}

