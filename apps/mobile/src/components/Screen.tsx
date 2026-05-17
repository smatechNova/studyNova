import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>{children}</View>
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
  safeArea: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flex: 1
  }
});

