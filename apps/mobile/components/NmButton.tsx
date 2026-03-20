import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";

interface NmButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function NmButton({
  onPress,
  children,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  style,
  textStyle,
}: NmButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        size === "sm" && styles.sm,
        size === "md" && styles.md,
        size === "lg" && styles.lg,
        variant === "primary"   && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost"     && styles.ghost,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === "primary" ? "#FFFFFF" : "#007AFF"}
            style={{ marginRight: 6 }}
          />
        )}
        {typeof children === "string" ? (
          <Text
            style={[
              styles.text,
              size === "sm" && styles.textSm,
              size === "lg" && styles.textLg,
              variant === "primary"   && styles.textPrimary,
              variant === "secondary" && styles.textSecondary,
              variant === "ghost"     && styles.textGhost,
              textStyle,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  sm: { paddingHorizontal: 14, paddingVertical: 8 },
  md: { paddingHorizontal: 20, paddingVertical: 12 },
  lg: { paddingHorizontal: 24, paddingVertical: 14 },

  primary: {
    backgroundColor: "#007AFF",
    shadowColor: "#0062CC",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  secondary: {
    backgroundColor: "#E8ECF0",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: { opacity: 0.45 },

  text: { fontWeight: "600", fontSize: 15 },
  textSm: { fontSize: 13 },
  textLg: { fontSize: 17 },
  textPrimary:   { color: "#FFFFFF" },
  textSecondary: { color: "#3C3C43" },
  textGhost:     { color: "#007AFF" },
});
