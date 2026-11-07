import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

/** Open an external URL (Google Sheet, Drive folder, receipt image). */
export async function openUrl(url: string) {
  if (Platform.OS === "web") {
    globalThis.open?.(url, "_blank", "noopener");
    return;
  }
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
  }
}
