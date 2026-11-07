import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Button, Card, ErrorBanner, Muted, Screen, TextField } from "../../components/ui";
import { useLinkWorkbook } from "../../hooks/queries";
import { colors } from "../../lib/theme";

export default function LinkWorkbook() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const [sheet, setSheet] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const link = useLinkWorkbook(propertyId ?? "");

  return (
    <Screen>
      <Card>
        <Text style={{ color: colors.text, lineHeight: 20 }}>
          Paste the link of a Google Sheet you already use (like the original "AirBnb Balance Sheets"). We detect the Supply / Setup / Regular
          Expense tabs by name, add any missing ledger tabs (Regular Bills, Income) and start appending rows there. Nothing existing is changed.
        </Text>
        <Muted>The signed-in Google account must have edit access to the sheet.</Muted>
      </Card>
      <TextField label="Spreadsheet URL or ID" placeholder="https://docs.google.com/spreadsheets/d/…" value={sheet} onChangeText={setSheet} autoCapitalize="none" autoCorrect={false} />
      <TextField label="Year this sheet covers" keyboardType="number-pad" value={year} onChangeText={setYear} />
      <ErrorBanner message={link.error?.message} />
      <Button
        title="Link sheet"
        loading={link.isPending}
        disabled={!sheet.trim() || !propertyId}
        onPress={() =>
          link.mutate({ spreadsheet: sheet.trim(), year: Number(year) || new Date().getFullYear() }, { onSuccess: () => router.back() })
        }
      />
    </Screen>
  );
}
