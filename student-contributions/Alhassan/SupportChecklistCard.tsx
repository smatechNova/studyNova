import { StyleSheet, Text, View } from "react-native";

type ChecklistStatus = "ready" | "review" | "blocked";

type SupportChecklistCardProps = {
  description: string;
  status: ChecklistStatus;
  title: string;
};

export function SupportChecklistCard({ description, status, title }: SupportChecklistCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.statusDot, styles[status]]} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={[styles.statusText, styles[`${status}Text`]]}>{statusLabel(status)}</Text>
      </View>
    </View>
  );
}

function statusLabel(status: ChecklistStatus) {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "review") {
    return "Needs review";
  }

  return "Blocked";
}

const styles = StyleSheet.create({
  blocked: {
    backgroundColor: "#F59E0B"
  },
  blockedText: {
    color: "#B45309"
  },
  card: {
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E2EE",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 16
  },
  copy: {
    flex: 1,
    gap: 5
  },
  description: {
    color: "#52616F",
    fontSize: 13,
    lineHeight: 18
  },
  ready: {
    backgroundColor: "#047857"
  },
  readyText: {
    color: "#047857"
  },
  review: {
    backgroundColor: "#2563EB"
  },
  reviewText: {
    color: "#2563EB"
  },
  statusDot: {
    borderRadius: 999,
    height: 14,
    marginTop: 4,
    width: 14
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: "#102A43",
    fontSize: 16,
    fontWeight: "900"
  }
});

