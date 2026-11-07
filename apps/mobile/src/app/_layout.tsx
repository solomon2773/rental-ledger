import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "../hooks/useSession";
import { colors } from "../lib/theme";

// Lets the web auth popup/redirect hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerShadowVisible: false,
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="property/new" options={{ title: "New property", presentation: "modal" }} />
            <Stack.Screen name="property/[id]" options={{ title: "Property" }} />
            <Stack.Screen name="property/link" options={{ title: "Link existing sheet", presentation: "modal" }} />
            <Stack.Screen name="entry/review" options={{ title: "Review receipt" }} />
            <Stack.Screen name="entry/income" options={{ title: "Record income", presentation: "modal" }} />
          </Stack>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
