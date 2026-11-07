import React, { useState } from "react";
import { Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { INCOME_SOURCES, incomeBucketFor, todayIso, type IncomeSource } from "@rental-ledger/shared";
import { Button, Card, ErrorBanner, Muted, Row, Screen, Select, Subtitle, TextField } from "../../components/ui";
import { useAddIncome, useProperty } from "../../hooks/queries";
import { openUrl } from "../../lib/open";
import { colors } from "../../lib/theme";

export default function IncomeEntry() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const property = useProperty(propertyId);
  const add = useAddIncome();
  const [date, setDate] = useState(todayIso());
  const [source, setSource] = useState<IncomeSource>(property.data?.type === "long_term" ? "Cash Rent" : "Airbnb");
  const [payer, setPayer] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [savedUrl, setSavedUrl] = useState<string | null | undefined>(undefined);

  const amountNum = Number(amount.replace(/[^0-9.]/g, ""));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const canSave = Boolean(propertyId) && amountNum > 0 && dateOk;

  if (savedUrl !== undefined) {
    return (
      <Screen>
        <Card>
          <Subtitle>Income recorded</Subtitle>
          <Text style={{ color: colors.text }}>
            {source} · ${amountNum.toFixed(2)} · {date} → rolls up into "{incomeBucketFor(source)}"
          </Text>
          {savedUrl ? <Button title="Open Google Sheet" icon="open-outline" variant="secondary" onPress={() => openUrl(savedUrl)} /> : null}
          <Button title="Done" onPress={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Row>
          <TextField label="Date received" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} error={dateOk ? null : "Use YYYY-MM-DD"} />
          <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" style={{ flex: 1 }} />
        </Row>
        <Select label="Source" value={source} options={INCOME_SOURCES} onChange={setSource} />
        <Muted>Counts toward "{incomeBucketFor(source)}" on the Regular Expense tab.</Muted>
        <TextField label="Guest / tenant / confirmation (optional)" value={payer} onChangeText={setPayer} placeholder="HMABCDEF or Jane Doe" />
        <TextField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Payout for Oct 3–7 stay" />
      </Card>
      <ErrorBanner message={add.error?.message} />
      <Button
        title="Save income"
        icon="cloud-upload-outline"
        loading={add.isPending}
        disabled={!canSave}
        onPress={() =>
          add.mutate(
            { propertyId: propertyId!, date, source, payer: payer.trim(), amount: Math.round(amountNum * 100) / 100, notes: notes.trim() },
            { onSuccess: (entry) => setSavedUrl(property.data?.workbooks.find((w) => w.id === entry.workbookId)?.spreadsheetUrl ?? null) },
          )
        }
      />
    </Screen>
  );
}
