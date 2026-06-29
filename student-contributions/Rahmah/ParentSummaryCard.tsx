import { StyleSheet, Text, View } from "react-native";

type ParentSummaryCardProps = {
  completedSessions: number;
  latestProof: string;
  missedSessions: number;
  studentName: string;
};

export function ParentSummaryCard({
  completedSessions,
  latestProof,
  missedSessions,
  studentName
}: ParentSummaryCardProps) {
  const needsAttention = missedSessions > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Parent view</Text>
      <Text style={styles.title}>{studentName}</Text>
      <View style={styles.grid}>
        <Metric label="Completed" value={`${completedSessions}`} />
        <Metric label="Missed" tone={needsAttention ? "warning" : "normal"} value={`${missedSessions}`} />
      </View>
      <View style={styles.proofCard}>
        <Text style={styles.proofTitle}>Latest study proof</Text>
        <Text style={styles.proofText}>{latestProof}</Text>
      </View>
    </View>
  );
}

type MetricProps = {
  label: string;
  tone?: "normal" | "warning";
  value: string;
};

function Metric({ label, tone = "normal", value }: MetricProps) {
  return (
    <View style={[styles.metric, tone === "warning" ? styles.metricWarning : null]}>
      <Text style={[styles.metricValue, tone === "warning" ? styles.metricValueWarning : null]}>{value}</Text>
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
  grid: {
    flexDirection: "row",
    gap: 10
  },
  kicker: {
    color: "#14B8A6",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metric: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    flex: 1,
    padding: 12
  },
  metricLabel: {
    color: "#52616F",
    fontSize: 12,
    fontWeight: "700"
  },
  metricValue: {
    color: "#102A43",
    fontSize: 22,
    fontWeight: "900"
  },
  metricValueWarning: {
    color: "#B45309"
  },
  metricWarning: {
    backgroundColor: "#FEF3C7"
  },
  proofCard: {
    backgroundColor: "#DBEAFE",
    borderRadius: 12,
    gap: 4,
    padding: 12
  },
  proofText: {
    color: "#52616F",
    fontSize: 13,
    lineHeight: 18
  },
  proofTitle: {
    color: "#102A43",
    fontSize: 14,
    fontWeight: "900"
  },
  title: {
    color: "#102A43",
    fontSize: 24,
    fontWeight: "900"
  }
});

