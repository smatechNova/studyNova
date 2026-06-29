import { Image, StyleSheet, Text, View } from "react-native";

type HomeBrandCardProps = {
  imageSource?: number;
};

export function HomeBrandCard({ imageSource }: HomeBrandCardProps) {
  return (
    <View style={styles.card}>
      {imageSource ? <Image source={imageSource} style={styles.image} /> : <View style={styles.imagePlaceholder} />}
      <View style={styles.copy}>
        <Text style={styles.kicker}>StudyNova</Text>
        <Text style={styles.title}>Plan smarter. Study calmer.</Text>
        <Text style={styles.body}>
          A focused academic planner for students, parents, and schools.
        </Text>
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
    backgroundColor: "#F8FAFC",
    borderColor: "#D8E2EE",
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    padding: 16
  },
  copy: {
    gap: 6
  },
  image: {
    borderRadius: 14,
    height: 160,
    width: "100%"
  },
  imagePlaceholder: {
    backgroundColor: "#DBEAFE",
    borderRadius: 14,
    height: 160,
    width: "100%"
  },
  kicker: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#102A43",
    fontSize: 24,
    fontWeight: "900"
  }
});

