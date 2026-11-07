import { Platform } from "react-native";

export const colors = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  primary: "#2563EB",
  primaryText: "#FFFFFF",
  success: "#059669",
  danger: "#DC2626",
  warning: "#D97706",
  chip: "#EEF2FF",
  chipText: "#3730A3",
  income: "#059669",
  expense: "#B91C1C",
};

export const radius = { sm: 8, md: 12, lg: 16 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  regular: Platform.select({ ios: "System", android: "Roboto", default: "System" }),
};

export const shadow = Platform.select({
  web: { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } as object,
  default: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
