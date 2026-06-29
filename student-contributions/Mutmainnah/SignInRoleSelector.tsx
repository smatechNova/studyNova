import { Pressable, StyleSheet, Text, View } from "react-native";

type Role = "student" | "parent";

type SignInRoleSelectorProps = {
  selectedRole: Role;
  onSelectRole: (role: Role) => void;
};

export function SignInRoleSelector({ selectedRole, onSelectRole }: SignInRoleSelectorProps) {
  return (
    <View style={styles.wrap}>
      <RoleOption
        description="Open your own study plan and progress."
        isSelected={selectedRole === "student"}
        label="Student"
        onPress={() => onSelectRole("student")}
      />
      <RoleOption
        description="Monitor linked students and study proof."
        isSelected={selectedRole === "parent"}
        label="Parent or guardian"
        onPress={() => onSelectRole("parent")}
      />
    </View>
  );
}

type RoleOptionProps = {
  description: string;
  isSelected: boolean;
  label: string;
  onPress: () => void;
};

function RoleOption({ description, isSelected, label, onPress }: RoleOptionProps) {
  return (
    <Pressable onPress={onPress} style={[styles.option, isSelected ? styles.optionSelected : null]}>
      <Text style={[styles.label, isSelected ? styles.labelSelected : null]}>{label}</Text>
      <Text style={styles.description}>{description}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  description: {
    color: "#52616F",
    fontSize: 13,
    lineHeight: 18
  },
  label: {
    color: "#102A43",
    fontSize: 16,
    fontWeight: "900"
  },
  labelSelected: {
    color: "#2563EB"
  },
  option: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D8E2EE",
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    minWidth: 150,
    padding: 14
  },
  optionSelected: {
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB"
  },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  }
});

