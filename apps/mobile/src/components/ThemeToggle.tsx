import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { spacing } from "@/theme";
import { useTheme } from "@/themeContext";

export function ThemeToggle() {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <Pressable
      accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      onPress={toggleTheme}
      style={[styles.button, { backgroundColor: colors.panel, borderColor: colors.border }]}
    >
      <MaterialCommunityIcons
        name={isDark ? "weather-night" : "white-balance-sunny"}
        size={18}
        color={colors.brand}
      />
      <Text style={[styles.label, { color: colors.text }]}>{isDark ? "Dark" : "Light"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 38,
    paddingHorizontal: spacing.sm
  },
  label: {
    fontSize: 12,
    fontWeight: "800"
  }
});
