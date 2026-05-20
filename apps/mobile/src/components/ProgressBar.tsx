import { StyleSheet, View, type DimensionValue } from "react-native";

import { useTheme } from "@/themeContext";

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const { colors } = useTheme();
  const width: DimensionValue = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <View style={[styles.track, { backgroundColor: colors.secondarySoft }]}>
      <View style={[styles.fill, { backgroundColor: colors.secondary, width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    borderRadius: 999,
    height: "100%"
  },
  track: {
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
    width: "100%"
  }
});
