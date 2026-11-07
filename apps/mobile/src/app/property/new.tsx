import React, { useState } from "react";
import { router } from "expo-router";
import { Button, ErrorBanner, Screen } from "../../components/ui";
import { PropertyForm, defaultPropertyValues, toCreatePayload } from "../../components/PropertyForm";
import { useCreateProperty } from "../../hooks/queries";

export default function NewProperty() {
  const [values, setValues] = useState(defaultPropertyValues());
  const create = useCreateProperty();

  const submit = () => {
    if (!values.name.trim()) return;
    create.mutate(toCreatePayload(values), {
      onSuccess: ({ property }) => router.replace({ pathname: "/property/[id]", params: { id: property.id } }),
    });
  };

  return (
    <Screen>
      <PropertyForm values={values} onChange={setValues} mode="create" />
      <ErrorBanner message={create.error?.message} />
      <Button title={values.createWorkbook ? "Create property + Google Sheet" : "Create property"} onPress={submit} loading={create.isPending} disabled={!values.name.trim()} />
    </Screen>
  );
}
