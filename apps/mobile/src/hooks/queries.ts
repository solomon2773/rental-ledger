import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseEntryCreate, IncomeEntryCreate, PropertyCreate, PropertyUpdate, WorkbookLink } from "@rental-ledger/shared";
import { api } from "../lib/api";

export const keys = {
  me: ["me"] as const,
  properties: ["properties"] as const,
  property: (id: string) => ["properties", id] as const,
  summary: (id: string, year: number) => ["summary", id, year] as const,
  entries: (propertyId?: string) => ["entries", propertyId ?? "all"] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: api.me, retry: false });
export const useProperties = () => useQuery({ queryKey: keys.properties, queryFn: api.properties.list });
export const useProperty = (id: string | undefined) =>
  useQuery({ queryKey: keys.property(id ?? ""), queryFn: () => api.properties.get(id!), enabled: Boolean(id) });
export const useSummary = (id: string | undefined, year: number) =>
  useQuery({ queryKey: keys.summary(id ?? "", year), queryFn: () => api.properties.summary(id!, year), enabled: Boolean(id) });
export const useEntries = (propertyId?: string) =>
  useQuery({ queryKey: keys.entries(propertyId), queryFn: () => api.entries.list({ propertyId, limit: 200 }) });

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PropertyCreate) => api.properties.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.properties }),
  });
}

export function useUpdateProperty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: PropertyUpdate) => api.properties.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.properties });
      qc.invalidateQueries({ queryKey: keys.property(id) });
    },
  });
}

export function useLinkWorkbook(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkbookLink) => api.properties.linkWorkbook(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.properties });
      qc.invalidateQueries({ queryKey: keys.property(id) });
    },
  });
}

export function useAddExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpenseEntryCreate) => api.entries.addExpense(input),
    onSuccess: (_e, input) => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["summary", input.propertyId] });
      qc.invalidateQueries({ queryKey: keys.properties });
    },
  });
}

export function useAddIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IncomeEntryCreate) => api.entries.addIncome(input),
    onSuccess: (_e, input) => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["summary", input.propertyId] });
    },
  });
}

export function useRemoveEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.entries.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
