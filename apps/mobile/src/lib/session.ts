import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "rental-ledger.session";

/**
 * Session token storage: Keychain/Keystore on device, localStorage on web.
 */
export const sessionStore = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage?.getItem(KEY) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.setItem(KEY, token);
      } catch {
        /* private mode */
      }
      return;
    }
    await SecureStore.setItemAsync(KEY, token);
  },
  async clear(): Promise<void> {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.removeItem(KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(KEY);
  },
};
