import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { PROPERTY_TYPE_LABELS } from "@rental-ledger/shared";
import { Badge, Button, Card, ChipGroup, ErrorBanner, Label, Loading, Money, Muted, Row, Screen, Spacer, Subtitle } from "../../components/ui";
import { PropertyForm, type PropertyFormValues } from "../../components/PropertyForm";
import { keys, useProperty, useSummary, useUpdateProperty } from "../../hooks/queries";
import { api } from "../../lib/api";
import { confirm, notify } from "../../lib/confirm";
import { openUrl } from "../../lib/open";
import { colors, space } from "../../lib/theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const property = useProperty(id);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const summary = useSummary(id, year);
  const update = useUpdateProperty(id ?? "");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PropertyFormValues | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const p = property.data;
  const years = useMemo(() => {
    const ys = new Set<number>([currentYear, ...(p?.workbooks.map((w) => w.year) ?? [])]);
    return Array.from(ys).sort((a, b) => b - a).map(String);
  }, [p, currentYear]);
  const workbook = p?.workbooks.find((w) => w.year === year);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setActionError(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: keys.property(id ?? "") });
      await qc.invalidateQueries({ queryKey: keys.properties });
      await qc.invalidateQueries({ queryKey: ["summary", id] });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (property.isLoading) return <Screen><Loading /></Screen>;
  if (!p) return <Screen><ErrorBanner message={property.error?.message ?? "Property not found"} onRetry={() => property.refetch()} /></Screen>;

  const t = summary.data?.totals;

  return (
    <Screen>
      <Stack.Screen options={{ title: p.name }} />
      <View>
        <Row style={{ justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text, flex: 1 }}>{p.name}</Text>
          <Badge label={PROPERTY_TYPE_LABELS[p.type].split(" (")[0]} />
        </Row>
        {p.address ? <Muted>{p.address}</Muted> : null}
      </View>

      <ChipGroup options={years} value={String(year)} onChange={(y) => setYear(Number(y))} />

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Subtitle>{year} summary</Subtitle>
          {workbook ? <Badge label={workbook.source === "linked" ? "Linked sheet" : "App-created sheet"} tone={workbook.source === "linked" ? "warning" : "success"} /> : <Badge label="No sheet yet" />}
        </Row>
        {summary.isLoading ? (
          <Loading label="Reading Google Sheet…" />
        ) : summary.error ? (
          <ErrorBanner message={summary.error.message} onRetry={() => summary.refetch()} />
        ) : t ? (
          <View style={{ gap: 6 }}>
            <Stat label="Rent collected" value={t.airbnbRent + t.cashRent} tone="income" />
            <Stat label="Regular bills" value={t.regularExpenses} tone="expense" />
            <Stat label="Supply expenses" value={t.supplyExpenses} tone="expense" />
            <Stat label="Initial setup" value={t.setupExpenses} tone="expense" />
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
            <Stat label="Net P&L (operating)" value={t.netOperating} tone={t.netOperating >= 0 ? "income" : "expense"} bold />
            <Stat label="Net incl. setup" value={t.netIncludingSetup} tone={t.netIncludingSetup >= 0 ? "income" : "expense"} />
          </View>
        ) : null}
        {workbook ? (
          <Row style={{ flexWrap: "wrap" }}>
            <Button title="Open Google Sheet" icon="open-outline" variant="secondary" onPress={() => openUrl(workbook.spreadsheetUrl)} />
            {p.driveFolderUrl ? <Button title="Drive folder" icon="folder-open-outline" variant="secondary" onPress={() => openUrl(p.driveFolderUrl!)} /> : null}
          </Row>
        ) : (
          <Button title={`Create ${year} Google Sheet`} icon="add-circle-outline" loading={busy === "create"} onPress={() => run("create", () => api.properties.ensureWorkbook(p.id, year))} />
        )}
      </Card>

      {summary.data && summary.data.monthly.some((m) => m.income || m.regularExpenses) ? (
        <Card>
          <Subtitle>By month</Subtitle>
          {summary.data.monthly.map((m) => (
            <Row key={m.month} style={{ justifyContent: "space-between" }}>
              <Text style={{ width: 40, color: colors.muted }}>{MONTHS[m.month - 1]}</Text>
              <Money value={m.income} tone="income" size={14} />
              <Money value={m.regularExpenses} tone="expense" size={14} />
              <Money value={m.profit} size={14} />
            </Row>
          ))}
          <Muted style={{ fontSize: 12 }}>Rent · Regular bills · Profit</Muted>
        </Card>
      ) : null}

      <Card>
        <Subtitle>Record</Subtitle>
        <Button title="Scan a receipt" icon="camera-outline" onPress={() => router.push({ pathname: "/(tabs)/capture", params: { propertyId: p.id } })} />
        <Row>
          <Button title="Expense (manual)" icon="create-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/entry/review", params: { propertyId: p.id } })} />
          <Button title="Income" icon="cash-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: "/entry/income", params: { propertyId: p.id } })} />
        </Row>
      </Card>

      <Card>
        <Subtitle>Workbooks</Subtitle>
        {p.workbooks.length === 0 ? <Muted>No Google Sheets yet. One is created automatically on the first entry of a year.</Muted> : null}
        {p.workbooks.map((w) => (
          <View key={w.id} style={{ gap: 6, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Row style={{ justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "600", color: colors.text }}>{w.year}</Text>
              <Badge label={w.source} />
            </Row>
            <Row style={{ flexWrap: "wrap" }}>
              <Button title="Open" variant="ghost" onPress={() => openUrl(w.spreadsheetUrl)} />
              <Button
                title="Rebuild summary formulas"
                variant="ghost"
                loading={busy === `rebuild-${w.id}`}
                onPress={async () => {
                  if (
                    await confirm(
                      "Rebuild summary tab?",
                      "This rewrites the Regular Expense tab with formulas that read from the ledger tabs. Anything typed by hand into that tab will be overwritten.",
                      "Rebuild",
                      true,
                    )
                  )
                    run(`rebuild-${w.id}`, () => api.properties.rebuildSummary(p.id, w.id));
                }}
              />
              <Button
                title="Unlink"
                variant="ghost"
                onPress={async () => {
                  if (await confirm("Unlink workbook?", "The Google Sheet is kept; the app just forgets about it.", "Unlink", true))
                    run(`unlink-${w.id}`, () => api.properties.unlinkWorkbook(p.id, w.id));
                }}
              />
            </Row>
          </View>
        ))}
        <Button title="Link an existing sheet" icon="link-outline" variant="secondary" onPress={() => router.push({ pathname: "/property/link", params: { propertyId: p.id } })} />
      </Card>

      <Card>
        <Row style={{ justifyContent: "space-between" }}>
          <Subtitle>Settings</Subtitle>
          <Button
            title={editing ? "Cancel" : "Edit"}
            variant="ghost"
            onPress={() => {
              setEditing(!editing);
              setForm({
                name: p.name,
                address: p.address,
                type: p.type,
                regularCategories: p.regularCategories,
                paymentMethods: p.paymentMethods,
                year: currentYear,
                createWorkbook: false,
              });
            }}
          />
        </Row>
        {editing && form ? (
          <>
            <PropertyForm values={form} onChange={setForm} mode="edit" />
            <ErrorBanner message={update.error?.message} />
            <Button
              title="Save changes"
              loading={update.isPending}
              onPress={() =>
                update.mutate(
                  { name: form.name, address: form.address, type: form.type, regularCategories: form.regularCategories, paymentMethods: form.paymentMethods },
                  { onSuccess: () => setEditing(false) },
                )
              }
            />
          </>
        ) : (
          <>
            <Label>Monthly bill columns</Label>
            <Muted>{p.regularCategories.join(" · ")}</Muted>
            <Label>Payment methods</Label>
            <Muted>{p.paymentMethods.length ? p.paymentMethods.join(" · ") : "None saved yet (added automatically as you record receipts)"}</Muted>
          </>
        )}
      </Card>

      <ErrorBanner message={actionError} />
      <Button
        title="Archive property"
        variant="danger"
        onPress={async () => {
          if (await confirm("Archive property?", "It disappears from the list. Your Google Sheets and Drive files are untouched.", "Archive", true)) {
            await api.properties.archive(p.id);
            await qc.invalidateQueries({ queryKey: keys.properties });
            notify("Archived");
            router.replace("/(tabs)");
          }
        }}
      />
      <Spacer h={space.xl} />
    </Screen>
  );
}

function Stat({ label, value, tone, bold }: { label: string; value: number; tone: "income" | "expense" | "neutral"; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: "space-between" }}>
      <Text style={{ color: bold ? colors.text : colors.muted, fontWeight: bold ? "700" : "400" }}>{label}</Text>
      <Money value={value} tone={tone} size={bold ? 18 : 15} />
    </Row>
  );
}
