// react-native-web's Alert.alert() is a complete no-op (see
// node_modules/react-native-web/src/exports/Alert/index.js) — on web it
// silently does nothing, buttons and all. Since this app builds for web
// too (app.json -> web.output), anything relying on Alert.alert for
// confirmation (not just a message) would be permanently unreachable
// there. These helpers fall back to window.alert/confirm on web and use
// the real native Alert everywhere else.
import { Alert, Platform } from "react-native";

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function showConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
): void {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: options?.cancelText ?? "Cancel", style: "cancel" },
    {
      text: options?.confirmText ?? "OK",
      style: options?.destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}
