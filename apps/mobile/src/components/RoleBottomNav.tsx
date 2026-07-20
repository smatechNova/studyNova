import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AnimatedPressable as Pressable } from "@/components/AnimatedPressable";
import { spacing, type AppColors } from "@/theme";
import { useTheme } from "@/themeContext";

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export type BottomNavItem<T extends string> = {
  key: T;
  label: string;
  icon: MaterialIconName;
  disabled?: boolean;
};

type RoleBottomNavProps<T extends string> = {
  activeKey: T;
  items: BottomNavItem<T>[];
  onSelect: (key: T) => void;
};

export function RoleBottomNav<T extends string>({ activeKey, items, onSelect }: RoleBottomNavProps<T>) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.shell}>
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <Pressable
            accessibilityRole="button"
            disabled={item.disabled}
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={[styles.item, isActive ? styles.itemActive : null, item.disabled ? styles.itemDisabled : null]}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={21}
              color={item.disabled ? colors.muted : isActive ? colors.brand : colors.muted}
            />
            <Text style={[styles.label, isActive ? styles.labelActive : null, item.disabled ? styles.labelDisabled : null]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    item: {
      alignItems: "center",
      borderRadius: 8,
      flex: 1,
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 58,
      minWidth: 56,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm
    },
    itemActive: {
      backgroundColor: colors.brandSoft
    },
    itemDisabled: {
      opacity: 0.5
    },
    label: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      textAlign: "center"
    },
    labelActive: {
      color: colors.brand
    },
    labelDisabled: {
      color: colors.muted
    },
    shell: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      marginBottom: spacing.sm,
      padding: spacing.xs
    }
  });
}
