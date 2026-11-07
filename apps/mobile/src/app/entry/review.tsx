import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_LEDGERS,
  LEDGER_DESCRIPTIONS,
  LEDGER_LABELS,
  todayIso,
  type ExpenseLedgerKind,
} from "@rental-ledger/shared";
import { Badge, Button, Card, ChipGroup, ErrorBanner, Label, Loading, Muted, Row, Screen, Select, Subtitle, TextField, WarningList } from "../../components/ui";
import { useAddExpense, useProperty } from "../../hooks/queries";
import { api } from "../../lib/api";
import { openUrl } from "../../lib/open";
import { colors, radius, space } from "../../lib/theme";

interface FormState {
  ledger: ExpenseLedgerKind;
  date: string;
  vendor: string;
  amount: string;
  category: string;
  details: string;
  payBy: string;
  notes: string;
}

export default function ReviewEntry() {
  const { scanId, propertyId } = useLocalSearchParams<{ scanId?: string; propertyId: string }>();
  const property = useProperty(propertyId);
  const scan = useQuery({ queryKey: ["scan", scanId], queryFn: () => api.scans.get(scanId!), enabled: Boolean(scanId) });
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const add = useAddExpense();
  const [form, setForm] = useState<FormState>({ ledger: "supply", date: todayIso(), vendor: "", amount: "", category: "Supplies", details: "", payBy: "", notes: "" });
  const [prefilled, setPrefilled] = useState(false);
  const [saved, setSaved] = useState<{ sheetUrl: string | null; driveLink: string | null } | null>(null);

  useEffect(() => {
    if (scanId) api.scans.imageUrl(scanId).then(setImageUrl);
  }, [scanId]);

  useEffect(() => {
    const pf = scan.data?.prefill;
    if (pf && !prefilled) {
      setForm({
        ledger: pf.ledger,
        date: pf.date,
        vendor: pf.vendor,
        amount: pf.amount ? String(pf.amount) : "",
        category: pf.category,
        details: pf.details,
        payBy: pf.payBy,
        notes: "",
      });
      setPrefilled(true);
    }
  }, [scan.data, prefilled]);

  const p = property.data;
  const categories = useMemo(() => (form.ledger === "regular" ? (p?.regularCategories ?? []) : [...EXPENSE_CATEGORIES]), [form.ledger, p]);

  // Keep the category valid when the ledger changes.
  useEffect(() => {
    if (categories.length && !categories.includes(form.category)) setForm((f) => ({ ...f, category: categories[0] }));
  }, [categories, form.category]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const amountNum = Number(form.amount.replace(/[^0-9.]/g, ""));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(form.date);
  const canSave = Boolean(propertyId) && form.vendor.trim().length > 0 && amountNum > 0 && dateOk && form.category.length > 0;

  const submit = () => {
    if (!propertyId || !canSave) return;
    add.mutate(
      {
        propertyId,
        ledger: form.ledger,
        date: form.date,
        vendor: form.vendor.trim(),
        category: form.category,
        details: form.details.trim(),
        amount: Math.round(amountNum * 100) / 100,
        payBy: form.payBy.trim(),
        notes: form.notes.trim(),
        scanId: scanId || undefined,
      },
      {
        onSuccess: (entry) => {
          const wb = p?.workbooks.find((w) => w.id === entry.workbookId);
          setSaved({ sheetUrl: wb?.spreadsheetUrl ?? null, driveLink: entry.driveLink });
        },
      },
    );
  };

  if (saved) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Saved" }} />
        <Card>
          <Subtitle>Recorded in {LEDGER_LABELS[form.ledger]}</Subtitle>
          <Text style={{ color: colors.text }}>
            {form.vendor} · ${amountNum.toFixed(2)} · {form.date}
          </Text>
          {saved.sheetUrl ? <Button title="Open Google Sheet" icon="open-outline" variant="secondary" onPress={() => openUrl(saved.sheetUrl!)} /> : null}
          {saved.driveLink ? <Button title="View receipt in Drive" icon="image-outline" variant="secondary" onPress={() => openUrl(saved.driveLink!)} /> : null}
          <Button title="Scan another" icon="camera-outline" onPress={() => router.replace({ pathname: "/(tabs)/capture", params: { propertyId } })} />
          <Button title="Done" variant="ghost" onPress={() => router.replace("/(tabs)")} />
        </Card>
      </Screen>
    );
  }

  const x = scan.data?.extraction;

  return (
    <Screen>
      <Stack.Screen options={{ title: scanId ? "Review receipt" : "New expense" }} />
      {scanId ? (
        <Card>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={{ width: "100%", height: 220, borderRadius: radius.md, backgroundColor: colors.bg }} contentFit="contain" /> : null}
          {scan.isLoading ? <Loading label="Loading extraction…" /> : null}
          <ErrorBanner message={scan.error?.message} onRetry={() => scan.refetch()} />
          {x ? (
            <Row style={{ flexWrap: "wrap" }}>
              <Badge label={`confidence: ${x.confidence}`} tone={x.confidence === "high" ? "success" : x.confidence === "medium" ? "neutral" : "warning"} />
              {x.lineItems.length ? <Badge label={`${x.lineItems.length} line items`} /> : null}
              {x.tax != null ? <Badge label={`tax $${x.tax.toFixed(2)}`} /> : null}
            </Row>
          ) : null}
          {x ? <WarningList items={x.warnings} /> : null}
        </Card>
      ) : null}

      <Card>
        <Label>Ledger tab</Label>
        <ChipGroup options={EXPENSE_LEDGERS} value={form.ledger} onChange={(l) => set("ledger", l)} labels={LEDGER_LABELS} />
        <Muted>{LEDGER_DESCRIPTIONS[form.ledger]}</Muted>
      </Card>

      <Card>
        <Row>
          <TextField label="Date" value={form.date} onChangeText={(t) => set("date", t)} placeholder="YYYY-MM-DD" style={{ flex: 1 }} error={dateOk ? null : "Use YYYY-MM-DD"} />
          <TextField label="Amount" value={form.amount} onChangeText={(t) => set("amount", t)} keyboardType="decimal-pad" placeholder="0.00" style={{ flex: 1 }} />
        </Row>
        <TextField label="From (vendor)" value={form.vendor} onChangeText={(t) => set("vendor", t)} placeholder="Costco" />
        <Select label="Category" value={form.category || null} options={categories} onChange={(c) => set("category", c)} />
        {form.ledger === "regular" && !categories.length ? <Muted>This property has no monthly bill columns. Add some in property settings.</Muted> : null}
        <TextField label="Details" value={form.details} onChangeText={(t) => set("details", t)} placeholder="Queen mattress, cooking pot set, kitchen towels" multiline />
        <Select label="Pay by" value={form.payBy || null} options={p?.paymentMethods ?? []} onChange={(v) => set("payBy", v)} placeholder="Visa - 8941" allowCustom />
        <TextField label="Notes (optional)" value={form.notes} onChangeText={(t) => set("notes", t)} placeholder="Split with partner, reimbursed, etc." />
      </Card>

      {x?.lineItems.length ? (
        <Card>
          <Subtitle>Line items read from the receipt</Subtitle>
          {x.lineItems.slice(0, 25).map((li, i) => (
            <Row key={i} style={{ justifyContent: "space-between" }}>
              <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                {li.quantity && li.quantity !== 1 ? `${li.quantity} × ` : ""}
                {li.description}
              </Text>
              <Muted>{li.amount != null ? `$${li.amount.toFixed(2)}` : ""}</Muted>
            </Row>
          ))}
        </Card>
      ) : null}

      <ErrorBanner message={add.error?.message} />
      <Button title={scanId ? "Save to Google Sheet + Drive" : "Save to Google Sheet"} icon="cloud-upload-outline" onPress={submit} loading={add.isPending} disabled={!canSave} />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
