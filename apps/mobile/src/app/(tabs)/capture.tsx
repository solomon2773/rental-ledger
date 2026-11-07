import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, EmptyState, ErrorBanner, Loading, Muted, Screen, Select, Title } from "../../components/ui";
import { useProperties } from "../../hooks/queries";
import { api } from "../../lib/api";
import { pickReceipt } from "../../lib/images";
import { colors, space } from "../../lib/theme";

export default function CaptureScreen() {
  const params = useLocalSearchParams<{ propertyId?: string }>();
  const props = useProperties();
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "picking" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params.propertyId === "string") setPropertyId(params.propertyId);
  }, [params.propertyId]);
  useEffect(() => {
    if (!propertyId && props.data?.length) setPropertyId(props.data[0].id);
  }, [props.data, propertyId]);

  const capture = async (source: "camera" | "library") => {
    if (!propertyId) return;
    setError(null);
    setPhase("picking");
    try {
      const img = await pickReceipt(source);
      if (!img) {
        setPhase("idle");
        return;
      }
      setPhase("uploading");
      const scan = await api.scans.create(img.blob ?? { uri: img.uri, mimeType: img.mimeType, name: img.name }, propertyId);
      router.push({ pathname: "/entry/review", params: { scanId: scan.id, propertyId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPhase("idle");
    }
  };

  if (props.isLoading) return <Screen><Loading /></Screen>;
  if (props.data && props.data.length === 0) {
    return (
      <Screen>
        <EmptyState icon="home-outline" title="Add a property first" body="Receipts are filed into a property's Google Sheet." action={<Button title="New property" onPress={() => router.push("/property/new")} />} />
      </Screen>
    );
  }

  const ids = props.data?.map((p) => p.id) ?? [];
  const nameOf = (id: string) => props.data?.find((p) => p.id === id)?.name ?? id;

  return (
    <Screen>
      <Title>Scan a receipt</Title>
      <Select label="Property" value={propertyId} options={ids} onChange={setPropertyId} renderLabel={nameOf} />

      {phase === "uploading" ? (
        <Card>
          <Loading label="Reading the receipt… (vendor, date, total, items)" />
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.md }}>
              <Ionicons name="receipt-outline" size={48} color={colors.primary} />
              <Text style={{ color: colors.muted, textAlign: "center" }}>Lay the receipt flat, fill the frame, avoid glare. Long receipts can be photographed in one shot — we read the total.</Text>
            </View>
            <Button title="Take photo" icon="camera" onPress={() => capture("camera")} loading={phase === "picking"} disabled={!propertyId} />
            <Button title="Choose from library" icon="images-outline" variant="secondary" onPress={() => capture("library")} disabled={!propertyId || phase !== "idle"} />
          </Card>
          <Button title="Enter an expense manually" variant="ghost" onPress={() => propertyId && router.push({ pathname: "/entry/review", params: { propertyId } })} />
          <Button title="Record income" variant="ghost" onPress={() => propertyId && router.push({ pathname: "/entry/income", params: { propertyId } })} />
        </>
      )}
      <ErrorBanner message={error} />
      <Muted style={{ fontSize: 12 }}>Photos are downsized on-device, recognised by Claude, then stored in your Drive folder next to the sheet.</Muted>
    </Screen>
  );
}
