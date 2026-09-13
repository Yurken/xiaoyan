import {
  TouchableOpacity,
  Text,
  type ViewStyle,
  type TextStyle,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { colors } from "../features/theme";

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
            color={variant === "primary" ? colors.highlight : colors.accent}
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
    backgroundColor: colors.accent,
    shadowColor: colors.accentStrong,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  secondary: {
    backgroundColor: colors.bg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: { opacity: 0.45 },

  text: { fontWeight: "600", fontSize: 15 },
  textSm: { fontSize: 13 },
  textLg: { fontSize: 17 },
  textPrimary:   { color: colors.highlight },
  textSecondary: { color: colors.textSecondary },
  textGhost:     { color: colors.accent },
});
