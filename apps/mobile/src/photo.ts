import { Directory, File, Paths } from "expo-file-system";

/**
 * Đính ảnh vào FormData. Expo SDK 58 thay `fetch` bằng expo/fetch, không nhận kiểu cũ
 * `{ uri, name, type }` của React Native (báo lỗi ngay khi gửi), nên phải gắn File thật.
 */
export function appendPhoto(form: FormData, uri: string, field = "photos") {
  if (uri) form.append(field, new File(uri) as unknown as Blob);
}

const queueDir = () => new Directory(Paths.document, "queue-photos");
const pickedDir = () => new Directory(Paths.document, "picked-photos");
const PICKED_MAX_AGE_MS = 7 * 24 * 3600000;

/**
 * Ảnh vừa chụp hoặc chọn nằm trong cache; máy ít dung lượng bị dọn cache ngay trong lúc đang điền form.
 * Chép sang thư mục riêng ngay khi có ảnh. Chép lỗi thì giữ đường dẫn cũ để form vẫn dùng được.
 */
export function keepPicked(uri: string) {
  try {
    const dir = pickedDir();
    dir.create({ intermediates: true, idempotent: true });
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const kept = new File(dir, name);
    new File(uri).copySync(kept);
    return kept.exists ? kept.uri : uri;
  } catch {
    return uri;
  }
}

/** Dọn ảnh của form đã bỏ dở; giữ 7 ngày vì nháp báo cáo sức khỏe có thể còn dùng. */
export function prunePickedPhotos(now = Date.now()) {
  try {
    const dir = pickedDir();
    if (!dir.exists) return;
    for (const entry of dir.list()) {
      if (
        entry instanceof File &&
        now - (entry.modificationTime ?? now) > PICKED_MAX_AGE_MS
      )
        entry.delete();
    }
  } catch {
    // Không dọn được thì để lần mở app sau.
  }
}

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
      if (!kept.exists) return uri;
      if (uri.startsWith(pickedDir().uri)) new File(uri).delete();
      return kept.uri;
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
