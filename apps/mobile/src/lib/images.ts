import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

export interface PreparedImage {
  /** Local URI (native) or blob URL (web) of the downsized JPEG. */
  uri: string;
  mimeType: "image/jpeg";
  name: string;
  width: number;
  height: number;
  /** Web only: the binary to upload. */
  blob?: Blob;
}

const MAX_EDGE = 1800; // plenty for receipt OCR; keeps uploads ~300-600 KB

/**
 * Let the user take or choose a receipt photo, then downscale + re-encode as JPEG so
 * uploads stay small and under the 5 MB recognition limit.
 * Returns null when the user cancels.
 */
export async function pickReceipt(source: "camera" | "library"): Promise<PreparedImage | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error("Camera permission is required to photograph receipts.");
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted && Platform.OS !== "web") throw new Error("Photo library permission is required.");
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.9,
    allowsEditing: false,
    exif: false,
  };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  const scale = Math.min(1, MAX_EDGE / Math.max(asset.width || MAX_EDGE, asset.height || MAX_EDGE));
  const context = ImageManipulator.manipulate(asset.uri);
  if (scale < 1) context.resize({ width: Math.round((asset.width || MAX_EDGE) * scale) });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });

  const prepared: PreparedImage = {
    uri: saved.uri,
    mimeType: "image/jpeg",
    name: `receipt-${Date.now()}.jpg`,
    width: saved.width,
    height: saved.height,
  };
  if (Platform.OS === "web") {
    prepared.blob = await (await fetch(saved.uri)).blob();
  }
  return prepared;
}
