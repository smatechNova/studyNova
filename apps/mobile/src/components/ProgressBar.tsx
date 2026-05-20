import { StyleSheet, View, type DimensionValue } from "react-native";

import { colors } from "@/theme";

type ProgressBarProps = {
  value: number;
};

export function ProgressBar({ value }: ProgressBarProps) {
  const width: DimensionValue = `${Math.max(0, Math.min(100, value))}%`;

  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    height: "100%"
  },
  track: {
    backgroundColor: colors.secondarySoft,
    borderRadius: 999,
    height: 10,
    overflow: "hidden",
    width: "100%"
  }
});
