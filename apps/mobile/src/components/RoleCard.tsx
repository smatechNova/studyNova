import { MaterialCommunityIcons } from "@expo/vector-icons";
import { forwardRef } from "react";
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { spacing } from "@/theme";
import { useTheme } from "@/themeContext";

type RoleCardProps = {
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  imageSource?: ImageSourcePropType;
  onPress?: () => void;
};

export const RoleCard = forwardRef<View, RoleCardProps>(
  ({ title, description, icon, imageSource, onPress }, ref) => {
    const { colors } = useTheme();

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.border }]}
        accessibilityRole="button"
      >
        <View style={[styles.art, { backgroundColor: colors.brandSoft }]}>
          {imageSource ? (
            <Image accessibilityIgnoresInvertColors source={imageSource} style={styles.image} />
          ) : (
            <MaterialCommunityIcons name={icon} size={28} color={colors.brand} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
      </Pressable>
    );
  }
);

RoleCard.displayName = "RoleCard";

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md
  },
  copy: {
    flex: 1,
    gap: spacing.xs
  },
  description: {
    fontSize: 14,
    lineHeight: 20
  },
  art: {
    alignItems: "center",
    borderRadius: 8,
    height: 72,
    overflow: "hidden",
    justifyContent: "center",
    width: 72
  },
  image: {
    height: "100%",
    width: "100%"
  },
  title: {
    fontSize: 18,
    fontWeight: "800"
  }
});
