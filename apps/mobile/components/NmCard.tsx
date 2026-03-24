import { View, ViewStyle, StyleSheet } from "react-native";

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
    backgroundColor: "#141A23",
  },
  raised: {
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.7)",
  },
  flat: {
    shadowColor: "#000000",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 7,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(60,74,92,0.55)",
  },
  inset: {
    backgroundColor: "#0F141C",
    shadowColor: "#000000",
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(36,45,58,0.8)",
  },
});
