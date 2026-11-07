import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, ErrorBanner, Muted, Screen, Title } from "../components/ui";
import { API_URL } from "../lib/config";
import { useSession } from "../hooks/useSession";
import { colors, space } from "../lib/theme";

/** Where Google (via our server) should send the user back to. */
export function authRedirectUri(): string {
  if (Platform.OS === "web" && typeof globalThis.location !== "undefined") {
    return `${globalThis.location.origin}/auth/callback`;
  }
  return Linking.createURL("auth/callback");
}

export function tokenFromUrl(url: string): { token?: string; error?: string } {
  try {
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams ?? {};
    const pick = (k: string) => (Array.isArray(qp[k]) ? String(qp[k][0]) : qp[k] ? String(qp[k]) : undefined);
    return { token: pick("token"), error: pick("error") };
  } catch {
    return {};
  }
}

export default function SignIn() {
  const { signIn } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    const redirectUri = authRedirectUri();
    const startUrl = `${API_URL}/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
    if (Platform.OS === "web") {
      globalThis.location?.assign(startUrl);
      return;
    }
    setBusy(true);
    try {
      const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
      if (result.type === "success") {
        const { token, error: err } = tokenFromUrl(result.url);
        if (token) {
          await signIn(token);
          router.replace("/(tabs)");
          return;
        }
        setError(err ? `Google sign-in failed: ${err}` : "No session token came back from the server.");
      } else if (result.type !== "cancel" && result.type !== "dismiss") {
        setError("Sign-in was interrupted. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ flex: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", gap: space.sm, marginBottom: space.xl }}>
        <Ionicons name="receipt-outline" size={56} color={colors.primary} />
        <Title>Rental Ledger</Title>
        <Muted style={{ textAlign: "center" }}>Snap a receipt. It lands in your property's Google Sheet, with the photo saved to Drive.</Muted>
      </View>
      <Card>
        <Text style={{ color: colors.text, lineHeight: 20 }}>
          Sign in with the Google account that should own the spreadsheets. We create a folder called "Rental Ledger" in that account's Drive and
          only touch files inside it (plus any sheet you explicitly link).
        </Text>
        <Button title="Continue with Google" icon="logo-google" onPress={start} loading={busy} />
        <ErrorBanner message={error} />
        <Muted style={{ fontSize: 12 }}>API: {API_URL}</Muted>
      </Card>
    </Screen>
  );
}
