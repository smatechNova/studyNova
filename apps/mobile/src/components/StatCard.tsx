import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { spacing } from "@/theme";
import { useTheme } from "@/themeContext";

type StatCardProps = {
  label: string;
  value: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

export function StatCard({ label, value, icon }: StatCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.brandSoft }]}>
      <View style={[styles.iconWell, { backgroundColor: colors.panel }]}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.brand} />
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    flexBasis: "31%",
    flexGrow: 1,
    gap: spacing.xs,
    minWidth: 104,
    padding: spacing.md
  },
  iconWell: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: 34
  },
  label: {
    fontSize: 12,
    lineHeight: 16
  },
  value: {
    fontSize: 19,
    fontWeight: "800"
  }
});
