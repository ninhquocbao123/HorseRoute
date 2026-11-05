import { Directory, File, Paths } from "expo-file-system";

/**
 * Đính ảnh vào FormData. Expo SDK 58 thay `fetch` bằng expo/fetch, không nhận kiểu cũ
 * `{ uri, name, type }` của React Native (báo lỗi ngay khi gửi), nên phải gắn File thật.
 */
export function appendPhoto(form: FormData, uri: string, field = "photos") {
  if (uri) form.append(field, new File(uri) as unknown as Blob);
}

const queueDir = () => new Directory(Paths.document, "queue-photos");

/**
 * Ảnh của mục hàng chờ có thể phải đợi rất lâu, mà ảnh chọn xong chỉ nằm trong cache (hệ thống xóa được):
 * chép sang thư mục riêng. Chép lỗi (đầy bộ nhớ…) thì giữ nguyên đường dẫn cũ để vẫn thử gửi.
 */
export function keepPhotos(id: string, uris: string[]) {
  return uris.map((uri, i) => {
    try {
      const dir = queueDir();
      dir.create({ intermediates: true, idempotent: true });
      const kept = new File(dir, `${id}-${i}.jpg`);
      new File(uri).copySync(kept);
      return kept.exists ? kept.uri : uri;
    } catch {
      return uri;
    }
  });
}

/** Xóa ảnh đã chép khi mục rời hàng chờ. Không đụng tới ảnh ngoài thư mục riêng. */
export function dropPhotos(uris: string[] = []) {
  const dir = queueDir().uri;
  for (const uri of uris) {
    if (!uri.startsWith(dir)) continue;
    try {
      new File(uri).delete();
    } catch {
      // Tệp đã mất thì thôi: không có gì để dọn.
    }
  }
}

export function hasMissingPhoto(uris: string[] = []) {
  return uris.some((uri) => {
    try {
      return !new File(uri).exists;
    } catch {
      return true;
    }
  });
}
