import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "@/theme";

type StatCardProps = {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <View style={styles.card}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.brand} />
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: "31%",
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 104,
    padding: spacing.md
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16
  },
  value: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800"
  }
});

