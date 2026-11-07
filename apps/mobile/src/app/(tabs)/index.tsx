import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { PROPERTY_TYPE_LABELS } from "@rental-ledger/shared";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, Muted, Row, Screen, Spacer } from "../../components/ui";
import { useProperties } from "../../hooks/queries";
import { useSession } from "../../hooks/useSession";
import { ApiError } from "../../lib/api";
import { openUrl } from "../../lib/open";
import { colors, space } from "../../lib/theme";

export default function PropertiesScreen() {
  const q = useProperties();
  const { signOut } = useSession();
  const year = new Date().getFullYear();

  const reauth = q.error instanceof ApiError && q.error.needsReauth;

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { void q.refetch(); }} />}
      >
        {q.isLoading ? <Loading /> : null}
        {q.error ? (
          <ErrorBanner
            message={q.error.message}
            onRetry={reauth ? undefined : () => q.refetch()}
            actionTitle={reauth ? "Sign in again" : undefined}
            onAction={reauth ? () => signOut().then(() => router.replace("/sign-in")) : undefined}
          />
        ) : null}

        {q.data && q.data.length === 0 ? (
          <EmptyState
            icon="home-outline"
            title="Add your first property"
            body="Each property gets its own Google Sheet per year plus a Drive folder for receipt photos."
            action={<Button title="New property" icon="add" onPress={() => router.push("/property/new")} />}
          />
        ) : null}

        {q.data?.map((p) => {
          const wb = p.workbooks.find((w) => w.year === year) ?? p.workbooks[0];
          return (
            <Card key={p.id}>
              <Row style={{ justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }} onPress={() => router.push({ pathname: "/property/[id]", params: { id: p.id } })}>
                    {p.name}
                  </Text>
                  {p.address ? <Muted>{p.address}</Muted> : null}
                </View>
                <Badge label={PROPERTY_TYPE_LABELS[p.type].split(" (")[0]} />
              </Row>
              <Muted>
                {p.workbooks.length ? `Sheets: ${p.workbooks.map((w) => w.year).sort().join(", ")}` : "No Google Sheet yet — created on first entry"}
              </Muted>
              <Row style={{ flexWrap: "wrap" }}>
                <Button title="Scan receipt" icon="camera-outline" onPress={() => router.push({ pathname: "/(tabs)/capture", params: { propertyId: p.id } })} />
                <Button title="Details" variant="secondary" onPress={() => router.push({ pathname: "/property/[id]", params: { id: p.id } })} />
                {wb ? <Button title="Sheet" icon="open-outline" variant="ghost" onPress={() => openUrl(wb.spreadsheetUrl)} /> : null}
              </Row>
            </Card>
          );
        })}

        {q.data && q.data.length > 0 ? (
          <>
            <Spacer h={space.sm} />
            <Button title="New property" icon="add" variant="secondary" onPress={() => router.push("/property/new")} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
