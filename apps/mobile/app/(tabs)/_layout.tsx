import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { MAIN_ASSISTANT_NAME } from "@research-copilot/types";

type IconName = ComponentProps<typeof Ionicons>["name"];

const tabs: {
  name: string;
  title: string;
  icon: IconName;
  activeIcon: IconName;
}[] = [
  { name: "index",     title: "论文库",    icon: "document-text-outline",    activeIcon: "document-text" },
  { name: "xiaoyan",   title: MAIN_ASSISTANT_NAME, icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { name: "knowledge", title: "知识库",    icon: "book-outline",              activeIcon: "book" },
  { name: "settings",  title: "设置",      icon: "settings-outline",          activeIcon: "settings" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#8E8E93",
        tabBarStyle: {
          backgroundColor: "#F0F4F8",
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: "#1C1C1E",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
