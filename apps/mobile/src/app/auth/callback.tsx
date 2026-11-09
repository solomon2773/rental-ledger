import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Button, ErrorBanner, Loading, Screen } from "../../components/ui";
import { useSession } from "../../hooks/useSession";

/**
 * Landing page after Google sign-in: /auth/callback?token=...  (web + deep links)
 */
export default function AuthCallback() {
  const params = useLocalSearchParams<{ token?: string; error?: string }>();
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof params.token === "string" ? params.token : undefined;
    if (token) {
      signIn(token).then(() => {
        // Keep the session token out of browser history on web.
        try {
          globalThis.history?.replaceState?.(null, "", "/");
        } catch {
          /* native */
        }
        router.replace("/(tabs)");
      });
    } else {
      setError(typeof params.error === "string" ? `Google sign-in failed: ${params.error}` : "Missing token in callback URL.");
    }
  }, [params.token, params.error, signIn]);

  return (
    <Screen>
      {error ? (
        <>
          <ErrorBanner message={error} />
          <Button title="Back to sign in" variant="secondary" onPress={() => router.replace("/sign-in")} />
        </>
      ) : (
        <Loading label="Finishing sign-in…" />
      )}
    </Screen>
  );
}
