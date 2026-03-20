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
    backgroundColor: "#F2F6FA",
  },
  raised: {
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
  },
  flat: {
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  inset: {
    backgroundColor: "#E8ECF0",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.5)",
  },
});
