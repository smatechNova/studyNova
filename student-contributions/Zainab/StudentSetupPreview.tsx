import { StyleSheet, Text, View } from "react-native";

const steps = ["Profile", "Exam", "Pace", "Subjects", "Review"];

export function StudentSetupPreview() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Setup guide</Text>
      <Text style={styles.title}>Build a better study plan</Text>
      <Text style={styles.body}>
        Complete each step so StudyNova can estimate reading time, daily work, and exam countdowns.
      </Text>
      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepLabel}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#52616F",
    fontSize: 14,
    lineHeight: 20
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E2EE",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16
  },
  kicker: {
    color: "#14B8A6",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  step: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    gap: 4,
    minWidth: 86,
    padding: 10
  },
  stepLabel: {
    color: "#102A43",
    fontSize: 12,
    fontWeight: "800"
  },
  stepNumber: {
    color: "#2563EB",
    fontSize: 18,
    fontWeight: "900"
  },
  steps: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  title: {
    color: "#102A43",
    fontSize: 22,
    fontWeight: "900"
  }
});

