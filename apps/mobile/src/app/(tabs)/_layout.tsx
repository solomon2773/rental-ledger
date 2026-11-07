import React from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../hooks/useSession";
import { colors } from "../../lib/theme";
import { Loading, Screen } from "../../components/ui";

/** Tab bar passes a string tint; guard against RN's wider ColorValue type. */
const iconColor = (c: unknown): string | undefined => (typeof c === "string" ? c : undefined);

export default function TabsLayout() {
  const { ready, token } = useSession();
  if (!ready) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!token) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Properties", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={iconColor(color)} /> }}
      />
      <Tabs.Screen
        name="capture"
        options={{ title: "Scan", tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" size={size} color={iconColor(color)} /> }}
      />
      <Tabs.Screen
        name="ledger"
        options={{ title: "Ledger", tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={iconColor(color)} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={iconColor(color)} /> }}
      />
    </Tabs>
  );
}
