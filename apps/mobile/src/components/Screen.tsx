import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { spacing } from "@/theme";
import { useTheme } from "@/themeContext";

export function Screen({ children }: PropsWithChildren) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
        style={styles.keyboard}
      >
        <View style={styles.container}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 720,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    width: "100%"
  },
  keyboard: {
    alignItems: "center",
    flex: 1,
    width: "100%"
  },
  safeArea: {
    alignItems: "center",
    flex: 1
  }
});
