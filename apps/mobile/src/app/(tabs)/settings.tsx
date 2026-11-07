import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, ErrorBanner, Loading, Muted, Row, Screen, Subtitle } from "../../components/ui";
import { useMe } from "../../hooks/queries";
import { useSession } from "../../hooks/useSession";
import { api } from "../../lib/api";
import { API_URL } from "../../lib/config";
import { confirm } from "../../lib/confirm";
import { colors } from "../../lib/theme";

export default function SettingsScreen() {
  const me = useMe();
  const { signOut } = useSession();

  return (
    <Screen>
      <Card>
        <Subtitle>Account</Subtitle>
        {me.isLoading ? <Loading /> : null}
        <ErrorBanner message={me.error?.message} onRetry={() => me.refetch()} />
        {me.data ? (
          <>
            <Text style={{ color: colors.text, fontSize: 16 }}>{me.data.name ?? me.data.email}</Text>
            <Muted>{me.data.email}</Muted>
            <Row>
              <Muted>Google Drive & Sheets</Muted>
              <Badge label={me.data.googleConnected ? "Connected" : "Not connected"} tone={me.data.googleConnected ? "success" : "warning"} />
            </Row>
          </>
        ) : null}
        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace("/sign-in");
          }}
        />
        <Button
          title="Disconnect Google"
          variant="ghost"
          onPress={async () => {
            if (await confirm("Disconnect Google?", "We forget the stored Google permission. You'll be asked to sign in again before the next entry.", "Disconnect", true)) {
              await api.disconnect();
              await signOut();
              router.replace("/sign-in");
            }
          }}
        />
      </Card>

      <Card>
        <Subtitle>How it works</Subtitle>
        <Muted>1. Each property gets a Google Sheet per year ("Name - Balance Sheets - YYYY") inside Drive → Rental Ledger → Property → Year.</Muted>
        <Muted>2. A receipt photo is read by Claude into vendor, date, total, items and payment method. You confirm, then a row is appended to the matching ledger tab.</Muted>
        <Muted>3. The photo is saved to the year's Receipts folder and the row's "Receipt" cell links to it.</Muted>
        <Muted>4. The Regular Expense tab recalculates monthly totals, yearly totals, utilities and net P&L from the ledger tabs.</Muted>
      </Card>

      <Card>
        <Subtitle>Server</Subtitle>
        <Muted>{API_URL}</Muted>
        <Muted style={{ fontSize: 12 }}>Change with EXPO_PUBLIC_API_URL in apps/mobile/.env</Muted>
      </Card>
    </Screen>
  );
}
