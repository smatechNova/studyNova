import { Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";

import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type IllustrationPanelProps = {
  body?: string;
  imageSource: ImageSourcePropType;
  kicker?: string;
  title: string;
};

export function IllustrationPanel({ body, imageSource, kicker, title }: IllustrationPanelProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.panel}>
      <Image accessibilityIgnoresInvertColors source={imageSource} style={styles.image} />
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    body: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
      minWidth: 210
    },
    image: {
      borderRadius: 8,
      height: 112,
      width: 112
    },
    kicker: {
      color: colors.brand,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    panel: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
      padding: spacing.md
    },
    title: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900"
    }
  });
}

