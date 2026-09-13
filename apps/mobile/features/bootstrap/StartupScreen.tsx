import { colors } from "../theme";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export function StartupScreen({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  return (
    <View style={styles.screen}>
      {failed ? (
        <>
          <Text style={styles.title}>暂时无法读取连接和登录设置</Text>
          <Text style={styles.message}>请重试。恢复设置后即可继续使用。</Text>
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onRetry}>
            <Text style={styles.title}>重试</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.message}>正在恢复连接和登录设置…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: colors.textPrimary, fontSize: 16, textAlign: "center" },
  message: { color: colors.textSecondary, fontSize: 14, textAlign: "center" },
  button: { backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
});
