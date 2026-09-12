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
          <ActivityIndicator color="#007AFF" />
          <Text style={styles.message}>正在恢复连接和登录设置…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#090B10", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: "#F5F7FA", fontSize: 16, textAlign: "center" },
  message: { color: "#9AA7B8", fontSize: 14, textAlign: "center" },
  button: { backgroundColor: "#007AFF", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
});
