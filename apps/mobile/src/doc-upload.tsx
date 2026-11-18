import React, { useState } from "react";
import { Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Camera, CircleCheck, FileText, ImageIcon, RefreshCw, Trash2, TriangleAlert, Upload } from "lucide-react-native";
import { Txt, useTheme } from "./ui";
import { API_URL } from "./config";

/** Giống web (apps/web/src/features/customer/HorseProfiles.tsx): PDF, JPG, PNG, tối đa 5 MB mỗi tệp. */
export const DOC_MAX_BYTES = 5 * 1024 * 1024;
export const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export type PickedDoc = { uri: string; name: string; type: string; size: number };

/** Kiểm tra tệp như web; trả câu lỗi hoặc "". */
export function docError(file: Pick<PickedDoc, "type" | "size">) {
  if (!DOC_TYPES.includes(file.type)) return "Chọn tệp PDF, JPG hoặc PNG.";
  if (file.size > DOC_MAX_BYTES) return "Mỗi tệp tối đa 5 MB.";
  return "";
}

/** Ba loại giấy tờ cơ bản, nhận theo tên trong danh mục như web (không giả định mã giống nhau giữa các DB). */
export function coreDocumentTypes<T extends { name: string }>(types: T[]) {
  return [/hộ chiếu|passport/i, /tiêm|vaccin/i, /eia|coggins/i].flatMap((pattern) => {
    const type = types.find((t) => pattern.test(t.name));
    return type ? [type] : [];
  });
}

async function fromImage(camera: boolean): Promise<PickedDoc | null> {
  if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted)
    throw new Error("Chưa có quyền camera. Chọn ảnh từ thư viện hoặc mở Cài đặt để cho phép camera.");
  const result = camera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
  if (result.canceled) return null;
  const asset = result.assets[0];
  // Ảnh chụp giấy tờ thu về tối đa 2000px, JPEG: đủ đọc chữ, nhẹ hơn nhiều lần ảnh gốc.
  const big = asset.width > 2000 || asset.height > 2000;
  const photo = await manipulateAsync(
    asset.uri,
    big ? [{ resize: asset.width >= asset.height ? { width: 2000 } : { height: 2000 } }] : [],
    { compress: 0.8, format: SaveFormat.JPEG },
  );
  const size = await fetch(photo.uri)
    .then((r) => r.blob())
    .then((b) => b.size)
    .catch(() => 0);
  return { uri: photo.uri, name: `giay-to-${Date.now()}.jpg`, type: "image/jpeg", size };
}

async function fromFiles(): Promise<PickedDoc | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: DOC_TYPES, copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const type = asset.mimeType || (/\.pdf$/i.test(asset.name) ? "application/pdf" : /\.png$/i.test(asset.name) ? "image/png" : "image/jpeg");
  return { uri: asset.uri, name: asset.name, type, size: asset.size ?? 0 };
}

/**
 * Tải multipart có tiến trình (fetch không báo tiến trình tải lên, nên dùng XMLHttpRequest).
 * Lỗi máy chủ trả câu `message` của API.
 */
export function uploadWithProgress<T>(
  path: string,
  token: string | null,
  fields: Record<string, string>,
  file: PickedDoc,
  onProgress: (fraction: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_URL + path);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: { message?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve(body as T);
      } else reject(new Error(body?.message || `Máy chủ từ chối tệp (mã ${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Mất kết nối khi tải tệp. Kiểm tra mạng rồi thử lại."));
    xhr.ontimeout = () => reject(new Error("Tải tệp quá lâu. Thử lại khi mạng ổn định hơn."));
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    xhr.send(form);
  });
}

export type SlotState = {
  picked?: PickedDoc;
  /** 0..1 khi đang tải. */
  progress?: number;
  error?: string;
  done?: boolean;
};

/**
 * Một dòng giấy tờ: chọn bằng camera, thư viện ảnh hoặc tệp; xem trước; đổi, xóa; thanh tiến trình; lỗi rõ ràng.
 * `stored`: tên tệp đã nộp trên máy chủ. `reason`: lý do cần nộp lại (viền đỏ).
 */
export function DocumentSlot({
  label,
  stored,
  reason,
  status,
  state,
  disabled,
  onPick,
  onRemove,
}: {
  label: string;
  stored?: string | null;
  reason?: string | null;
  status?: string;
  state: SlotState;
  disabled?: boolean;
  onPick: (file: PickedDoc | null, error?: string) => void;
  onRemove: () => void;
}) {
  const { colors: c } = useTheme();
  const [busy, setBusy] = useState(false);
  const pick = async (source: "camera" | "library" | "file") => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const file = source === "file" ? await fromFiles() : await fromImage(source === "camera");
      if (!file) return;
      const error = docError(file);
      onPick(error ? null : file, error || undefined);
    } catch (e) {
      onPick(null, e instanceof Error ? e.message : "Không mở được tệp.");
    } finally {
      setBusy(false);
    }
  };
  const needs = !!reason;
  const uploading = state.progress !== undefined && !state.done;
  const name = state.picked?.name || stored;
  const action = (Icon: typeof Camera, text: string, source: "camera" | "library" | "file") => (
    <Pressable
      key={source}
      accessibilityRole="button"
      accessibilityLabel={`${text}: ${label}`}
      disabled={busy || disabled || uploading}
      onPress={() => void pick(source)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: c.borderInput,
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        paddingVertical: 6,
        opacity: pressed || busy || disabled || uploading ? 0.6 : 1,
      })}
    >
      <Icon size={18} color={c.link} />
      <Txt size={12} bold color={c.link}>
        {text}
      </Txt>
    </Pressable>
  );
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: 16,
        borderWidth: needs ? 2 : 1,
        borderColor: state.error || needs ? c.dangerFg : c.border,
        backgroundColor: needs && !state.done ? c.dangerBg : c.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {state.done || (!needs && stored && !state.picked) ? (
          <CircleCheck size={22} color={c.successFg} />
        ) : needs ? (
          <TriangleAlert size={22} color={c.dangerFg} />
        ) : (
          <FileText size={22} color={c.textSecondary} />
        )}
        <View style={{ flex: 1 }}>
          <Txt size={15} bold>
            {label}
          </Txt>
          <Txt size={12} color={c.textSecondary} numberOfLines={1}>
            {state.done
              ? status && !state.picked
                ? status
                : "Đã gửi, chờ thẩm định"
              : name
                ? `${state.picked ? "Chưa gửi · " : ""}${name}`
                : status || "Chưa chọn tệp · PDF, JPG, PNG · tối đa 5 MB"}
          </Txt>
        </View>
        {state.picked && !uploading && !state.done ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Bỏ tệp vừa chọn: ${label}`}
            hitSlop={8}
            onPress={onRemove}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Trash2 size={20} color={c.dangerFg} />
          </Pressable>
        ) : null}
      </View>
      {needs && !state.done ? (
        <Txt size={15} color={c.dangerFg}>
          Cần nộp lại: {reason}
        </Txt>
      ) : null}
      {state.picked && state.picked.type.startsWith("image/") ? (
        <Image
          source={{ uri: state.picked.uri }}
          accessibilityLabel={`Xem trước ${label}`}
          style={{ width: "100%", height: 160, borderRadius: 12, backgroundColor: c.surfaceMuted }}
          resizeMode="contain"
        />
      ) : state.picked ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", padding: 12, borderRadius: 12, backgroundColor: c.surfaceMuted }}>
          <FileText size={28} color={c.link} />
          <Txt size={15} style={{ flex: 1 }} numberOfLines={2}>
            {state.picked.name} · {(state.picked.size / 1024 / 1024).toFixed(2)} MB
          </Txt>
        </View>
      ) : null}
      {uploading ? (
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((state.progress ?? 0) * 100) }} style={{ gap: 4 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surfaceMuted, overflow: "hidden" }}>
            <View style={{ width: `${Math.round((state.progress ?? 0) * 100)}%`, height: 8, backgroundColor: c.link }} />
          </View>
          <Txt size={12} color={c.textSecondary}>
            Đang tải {Math.round((state.progress ?? 0) * 100)}%
          </Txt>
        </View>
      ) : null}
      {state.error ? (
        <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start" }}>
          <TriangleAlert size={16} color={c.dangerFg} />
          <Txt size={12} color={c.dangerFg} style={{ flex: 1 }}>
            {state.error}
          </Txt>
        </View>
      ) : null}
      {!state.done ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {action(Camera, "Chụp ảnh", "camera")}
          {action(ImageIcon, "Thư viện", "library")}
          {action(name ? RefreshCw : Upload, name ? "Đổi tệp" : "Chọn tệp", "file")}
        </View>
      ) : null}
    </View>
  );
}
