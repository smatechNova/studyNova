import { MaterialCommunityIcons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

type RoleCardProps = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
};

export const RoleCard = forwardRef<View, RoleCardProps>(
  ({ title, description, icon, onPress }, ref) => {
    return (
      <Pressable ref={ref} onPress={onPress} style={styles.card} accessibilityRole="button">
        <View style={styles.icon}>
          <MaterialCommunityIcons name={icon} size={28} color={colors.brand} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
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
    backgroundColor: colors.panel,
    borderColor: colors.border,
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
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.brandSoft,
    borderRadius: 8,
    height: 52,
    justifyContent: "center",
    width: 52
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800"
  }
});

