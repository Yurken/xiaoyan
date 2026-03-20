import { TextInput, View, Text, TextInputProps, StyleSheet } from "react-native";
import { useState } from "react";

interface NmInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function NmInput({ label, error, style, ...props }: NmInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="#8E8E93"
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e)  => { setFocused(false); props.onBlur?.(e); }}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: "100%" },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#E8ECF0",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1C1C1E",
    borderWidth: 1,
    borderColor: "rgba(200,205,211,0.6)",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  inputFocused: {
    borderColor: "rgba(0,122,255,0.35)",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  inputError: {
    borderColor: "rgba(255,59,48,0.4)",
  },
  error: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 12,
    color: "#FF3B30",
  },
});
