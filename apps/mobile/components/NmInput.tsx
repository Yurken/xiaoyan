import { TextInput, View, Text, type TextInputProps, StyleSheet } from "react-native";
import { useState } from "react";
import { colors } from "../features/theme";

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
        placeholderTextColor={colors.textMuted}
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
    color: colors.textSecondary,
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: -1, height: -1 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  inputFocused: {
    borderColor: colors.accentBorder,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    marginTop: 4,
    marginLeft: 4,
    fontSize: 12,
    color: colors.danger,
  },
});
