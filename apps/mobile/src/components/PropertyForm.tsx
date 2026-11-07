import React, { useState } from "react";
import { Switch, Text, View } from "react-native";
import { DEFAULT_REGULAR_CATEGORIES, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, type PropertyCreate, type PropertyType } from "@rental-ledger/shared";
import { Button, Card, Chip, ChipGroup, Label, Muted, Row, TextField } from "./ui";
import { colors, space } from "../lib/theme";

export interface PropertyFormValues {
  name: string;
  address: string;
  type: PropertyType;
  regularCategories: string[];
  paymentMethods: string[];
  year: number;
  createWorkbook: boolean;
}

export function defaultPropertyValues(): PropertyFormValues {
  return {
    name: "",
    address: "",
    type: "short_term",
    regularCategories: [...DEFAULT_REGULAR_CATEGORIES],
    paymentMethods: [],
    year: new Date().getFullYear(),
    createWorkbook: true,
  };
}

export function toCreatePayload(v: PropertyFormValues): PropertyCreate {
  return {
    name: v.name.trim(),
    address: v.address.trim(),
    type: v.type,
    regularCategories: v.regularCategories,
    paymentMethods: v.paymentMethods,
    year: v.year,
    createWorkbook: v.createWorkbook,
  };
}

export function PropertyForm({
  values,
  onChange,
  mode,
}: {
  values: PropertyFormValues;
  onChange: (v: PropertyFormValues) => void;
  mode: "create" | "edit";
}) {
  const [newCategory, setNewCategory] = useState("");
  const [newMethod, setNewMethod] = useState("");
  const set = <K extends keyof PropertyFormValues>(k: K, val: PropertyFormValues[K]) => onChange({ ...values, [k]: val });

  const toggleCategory = (c: string) => {
    const has = values.regularCategories.includes(c);
    set("regularCategories", has ? values.regularCategories.filter((x) => x !== c) : [...values.regularCategories, c]);
  };
  const allCategoryOptions = Array.from(new Set([...DEFAULT_REGULAR_CATEGORIES, ...values.regularCategories]));

  return (
    <View style={{ gap: space.md }}>
      <Card>
        <TextField label="Property name" placeholder="2529 Persimmon Dr" value={values.name} onChangeText={(t) => set("name", t)} autoCapitalize="words" />
        <TextField label="Address (optional)" placeholder="Street, City, State" value={values.address} onChangeText={(t) => set("address", t)} />
        <Label>Rental type</Label>
        <ChipGroup options={PROPERTY_TYPES} value={values.type} onChange={(t) => set("type", t)} labels={PROPERTY_TYPE_LABELS} />
      </Card>

      <Card>
        <Label>Monthly bill columns</Label>
        <Muted>These become the columns of the "Regular Expense" summary tab. Tap to toggle, or add your own.</Muted>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {allCategoryOptions.map((c) => (
            <Chip key={c} label={c} selected={values.regularCategories.includes(c)} onPress={() => toggleCategory(c)} />
          ))}
        </View>
        <Row>
          <TextField placeholder="Add a column, e.g. Lawn Care" value={newCategory} onChangeText={setNewCategory} style={{ flex: 1 }} />
          <Button
            title="Add"
            variant="secondary"
            onPress={() => {
              const c = newCategory.trim();
              if (c && !values.regularCategories.includes(c)) set("regularCategories", [...values.regularCategories, c]);
              setNewCategory("");
            }}
          />
        </Row>
        {mode === "edit" ? <Muted style={{ fontSize: 12 }}>Changing columns on an existing year requires "Rebuild summary formulas" on that workbook.</Muted> : null}
      </Card>

      <Card>
        <Label>Payment methods ("Pay by")</Label>
        <Muted>Saved so receipts can be matched by the card's last 4 digits, e.g. "Visa - 8941".</Muted>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {values.paymentMethods.map((m) => (
            <Chip key={m} label={m} onRemove={() => set("paymentMethods", values.paymentMethods.filter((x) => x !== m))} />
          ))}
          {values.paymentMethods.length === 0 ? <Muted>None yet</Muted> : null}
        </View>
        <Row>
          <TextField placeholder="Visa - 8941" value={newMethod} onChangeText={setNewMethod} style={{ flex: 1 }} />
          <Button
            title="Add"
            variant="secondary"
            onPress={() => {
              const m = newMethod.trim();
              if (m && !values.paymentMethods.includes(m)) set("paymentMethods", [...values.paymentMethods, m]);
              setNewMethod("");
            }}
          />
        </Row>
      </Card>

      {mode === "create" ? (
        <Card>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.text }}>Create Google Sheet now</Text>
              <Muted>Creates "{values.name.trim() || "Property"} - Balance Sheets - {values.year}" in your Drive.</Muted>
            </View>
            <Switch value={values.createWorkbook} onValueChange={(v) => set("createWorkbook", v)} />
          </Row>
          {values.createWorkbook ? (
            <TextField
              label="Year"
              keyboardType="number-pad"
              value={String(values.year)}
              onChangeText={(t) => set("year", Number(t.replace(/\D/g, "")) || values.year)}
            />
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}
