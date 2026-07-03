import { StyleSheet, Text, View } from "react-native";

type StudyProgressCardProps = {
  completedMinutes: number;
  confidence: number;
  plannedMinutes: number;
};

export function StudyProgressCard({ completedMinutes, confidence, plannedMinutes }: StudyProgressCardProps) {
  const percentage = plannedMinutes > 0 ? Math.min(100, Math.round((completedMinutes / plannedMinutes) * 100)) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Today</Text>
        <Text style={styles.percent}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage}%` }]} />
      </View>
      <View style={styles.grid}>
        <Metric label="Completed" value={`${completedMinutes}m`} />
        <Metric label="Planned" value={`${plannedMinutes}m`} />
        <Metric label="Confidence" value={`${confidence}/5`} />
      </View>
    </View>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E2EE",
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    padding: 16
  },
  fill: {
    backgroundColor: "#14B8A6",
    borderRadius: 99,
    height: "100%"
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  kicker: {
    color: "#52616F",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metric: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    flex: 1,
    minWidth: 90,
    padding: 10
  },
  metricLabel: {
    color: "#52616F",
    fontSize: 12,
    fontWeight: "700"
  },
  metricValue: {
    color: "#102A43",
    fontSize: 18,
    fontWeight: "900"
  },
  percent: {
    color: "#2563EB",
    fontSize: 24,
    fontWeight: "900"
  },
  track: {
    backgroundColor: "#DBEAFE",
    borderRadius: 99,
    height: 10,
    overflow: "hidden"
  }
});

 