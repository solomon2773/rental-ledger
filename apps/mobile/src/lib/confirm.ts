import { Alert, Platform } from "react-native";

/** Confirm dialog that works on web (window.confirm) and native (Alert). */
export function confirm(title: string, message: string, confirmLabel = "OK", destructive = false): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(globalThis.confirm ? globalThis.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
