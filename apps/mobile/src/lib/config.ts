import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Base URL of the API server.
 * Set EXPO_PUBLIC_API_URL in apps/mobile/.env (e.g. http://192.168.1.20:8787 for a phone on your LAN).
 * On Android emulators "localhost" means the emulator itself, so we default to 10.0.2.2.
 */
function defaultApiUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:8787";
  // When running on a physical device via Expo Go, derive the dev machine's LAN IP from the Metro host.
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && Platform.OS !== "web") return `http://${host}:8787`;
  return "http://localhost:8787";
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl()).replace(/\/$/, "");
