import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { LEDGER_LABELS, type Entry } from "@rental-ledger/shared";
import { Badge, Button, Chip, EmptyState, ErrorBanner, ListItem, Loading, Money, Muted, Screen } from "../../components/ui";
import { useEntries, useProperties, useRemoveEntry } from "../../hooks/queries";
import { confirm } from "../../lib/confirm";
import { openUrl } from "../../lib/open";
import { colors, space } from "../../lib/theme";

export default function LedgerScreen() {
  const props = useProperties();
  const [propertyId, setPropertyId] = useState<string | undefined>(undefined);
  const entries = useEntries(propertyId);
  const remove = useRemoveEntry();
  const [selected, setSelected] = useState<Entry | null>(null);

  const nameOf = (id: string) => props.data?.find((p) => p.id === id)?.name ?? "";

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={entries.isRefetching} onRefresh={() => { void entries.refetch(); }} />}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          <Chip label="All" selected={!propertyId} onPress={() => setPropertyId(undefined)} />
          {props.data?.map((p) => <Chip key={p.id} label={p.name} selected={propertyId === p.id} onPress={() => setPropertyId(p.id)} />)}
        </ScrollView>

        {entries.isLoading ? <Loading /> : null}
        <ErrorBanner message={entries.error?.message} onRetry={() => entries.refetch()} />
        {entries.data && entries.data.length === 0 ? <EmptyState icon="list-outline" title="No entries yet" body="Scan a receipt or record income and it will show up here (and in the Google Sheet)." /> : null}

        {entries.data?.map((e) => {
          const isIncome = e.ledger === "income";
          return (
            <ListItem
              key={e.id}
              icon={isIncome ? "cash-outline" : e.driveLink ? "image-outline" : "receipt-outline"}
              title={`${e.vendor || (isIncome ? e.category : "Expense")}`}
              subtitle={`${e.date} · ${isIncome ? e.category : e.category} · ${nameOf(e.propertyId)}${e.details ? `\n${e.details}` : ""}`}
              right={<Money value={e.amount} tone={isIncome ? "income" : "expense"} />}
              onPress={() => setSelected(selected?.id === e.id ? null : e)}
            />
          );
        })}

        {selected ? (
          <View style={{ gap: space.sm, backgroundColor: colors.card, padding: space.lg, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: "600", color: colors.text }}>{selected.vendor || selected.category}</Text>
            <Badge label={LEDGER_LABELS[selected.ledger]} />
            <Muted>{selected.notes || "No notes"}</Muted>
            {selected.payBy ? <Muted>Paid by {selected.payBy}</Muted> : null}
            {selected.sheetRow ? <Muted>Sheet row {selected.sheetRow}</Muted> : null}
            {selected.driveLink ? <Button title="Open receipt photo" icon="image-outline" variant="secondary" onPress={() => openUrl(selected.driveLink!)} /> : null}
            <Button
              title="Delete entry"
              variant="danger"
              loading={remove.isPending}
              onPress={async () => {
                if (await confirm("Delete entry?", "Removes the row from the Google Sheet and moves the receipt photo to Drive trash.", "Delete", true)) {
                  remove.mutate(selected.id, { onSuccess: () => setSelected(null) });
                }
              }}
            />
            <ErrorBanner message={remove.error?.message} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
