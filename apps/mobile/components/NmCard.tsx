import { View, type ViewStyle, StyleSheet } from "react-native";
import { colors } from "../features/theme";

interface NmCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "raised" | "flat" | "inset";
}

export function NmCard({ children, style, variant = "raised" }: NmCardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === "raised" && styles.raised,
        variant === "flat"   && styles.flat,
        variant === "inset"  && styles.inset,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.bgCard,
  },
  raised: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.72,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  flat: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.58,
    shadowRadius: 7,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.highlightBorder,
  },
  inset: {
    backgroundColor: colors.bgCardInset,
    shadowColor: colors.shadow,
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
