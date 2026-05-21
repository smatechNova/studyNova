import { MaterialCommunityIcons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { spacing } from "@/theme";
import { useTheme } from "@/themeContext";

type RoleCardProps = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
};

export const RoleCard = forwardRef<View, RoleCardProps>(
  ({ title, description, icon, onPress }, ref) => {
    const { colors } = useTheme();

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}
        accessibilityRole="button"
      >
        <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
          <MaterialCommunityIcons name={icon} size={28} color={colors.brand} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>
    );
  }
);

RoleCard.displayName = "RoleCard";

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  description: {
    fontSize: 14,
    lineHeight: 20
  },
  icon: {
    alignItems: "center",
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  title: {
    fontSize: 18,
    fontWeight: "800"
  }
});
