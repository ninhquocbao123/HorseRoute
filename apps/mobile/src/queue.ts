import {
  appendPhoto,
  dropPhotos,
  hasMissingPhoto,
  keepPhotos,
  prunePickedPhotos,
} from "./photo";
import { isReplayConflict, queueWireFields } from "./live-domain";
/**
 * Hàng chờ gửi (COM-12). Thao tác ghi của tài xế và hộ tống đi qua đây:
 * - Hoàn tác 5 giây: mục giữ đến notBefore rồi mới gửi; Hoàn tác là bỏ khỏi hàng chờ (API không có xóa mốc).
 * - Mất mạng hoặc máy chủ lỗi 5xx: giữ lại, gửi lại theo thứ tự khi có mạng (lùi dần tới 60 giây).
 * - Phiên hết hạn (401): giữ nguyên, gửi tiếp khi đăng nhập lại đúng tài khoản.
 * - 4xx khác: "Bị từ chối" kèm lý do; người dùng sửa giờ hoặc bỏ. Mốc giao ngựa bị 402 (khách chưa trả đủ) gửi lại được sau khi khách trả.
 * - Ảnh đính kèm không còn trên máy: "Bị từ chối" luôn, thử lại cũng không gửi được.
 * - Gửi lại không tạo bản ghi trùng: mỗi mục có clientRequestId riêng (G2), mốc kèm queuedAt để được ghi bù 24 giờ (G3).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useMemo, useSyncExternalStore } from "react";
import { ApiError, type RequestOptions } from "./api/http";

export type QueueKind =
  | "milestone"
  | "checkin"
  | "complete"
  | "care"
  | "horseLog"
  | "incident";

export type QueueItem = {
  id: string;
  tripId: string;
  kind: QueueKind;
  /** Câu hiển thị: "Đã đến Trảng Bàng · 07:42" */
  label: string;
  path: string;
  /** Thân JSON, hoặc các trường multipart khi có photos. */
  body: Record<string, unknown>;
  photos?: string[];
  /** Trường giờ trong body, để sửa giờ khi bị từ chối. */
  timeField: "occurredAt" | "performedAt" | "loggedAt" | null;
  /** Dữ liệu cho giao diện phản ánh ngay thao tác (applyPending). */
  legId?: string;
  milestoneType?: string;
  waypointId?: string;
  horseIds?: string[];
  createdAt: number;
  notBefore: number;
  status: "QUEUED" | "SENDING" | "REJECTED";
  error?: string;
  /** Lý do lần thử gần nhất thất bại khi chưa gọi được máy chủ. */
  lastFailure?: string;
  /** Máy chủ đã nhận, mục chỉ còn giữ để màn chuyến không lùi trạng thái. */
  sent?: boolean;
  attempts: number;
  ownerId?: string;
};

type Request = <T>(path: string, input?: RequestOptions) => Promise<T>;

const KEY = "horseroute.queue.v1";
let items: QueueItem[] = [];
/** Mốc vừa gửi xong: giữ lại để màn chuyến không quay về trạng thái cũ trong lúc tải lại từ máy chủ. */
let recent: { item: QueueItem; sentAt: number }[] = [];
let progress: QueueItem[] = [];
const RECENT_MS = 120000;
let loaded = false;
let flushing = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let online = true;
let owner: string | null = null;
let request: Request | null = null;
const listeners = new Set<() => void>();
const sentListeners = new Set<(item: QueueItem) => void>();
const rejectedListeners = new Set<(item: QueueItem, status: number) => void>();

function emit() {
  items = [...items];
  recent = recent.filter((r) => Date.now() - r.sentAt < RECENT_MS);
  progress = [...recent.map((r) => r.item), ...items];
  listeners.forEach((l) => l());
}
async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
}
const mine = (i: QueueItem) => !!owner && (i.ownerId ?? owner) === owner;

/** Gọi khi đăng nhập, mở app hoặc phiên hết hạn (null: tạm dừng gửi). */
export function configureQueue(client: Request | null, userId: string | null) {
  request = client;
  owner = userId;
  if (userId && loaded) void flush();
}

export async function initQueue() {
  if (loaded) return;
  loaded = true;
  prunePickedPhotos();
  try {
    const raw = await AsyncStorage.getItem(KEY);
    // Mục đang gửi dở khi app bị tắt: quay về chờ gửi.
    items = raw
      ? (JSON.parse(raw) as QueueItem[]).map((i) =>
          i.status === "SENDING" ? { ...i, status: "QUEUED" as const } : i,
        )
      : [];
  } catch {
    items = [];
  }
  emit();
  NetInfo.addEventListener((state) => {
    const now = !!state.isConnected && state.isInternetReachable !== false;
    const cameBack = now && !online;
    online = now;
    emit();
    if (cameBack) void flush();
  });
  setInterval(() => void flush(), 30000);
  void flush();
}

function schedule() {
  if (timer) clearTimeout(timer);
  const next = items
    .filter((i) => i.status === "QUEUED" && mine(i))
    .reduce((min, i) => Math.min(min, i.notBefore), Infinity);
  if (next === Infinity) return;
  timer = setTimeout(() => void flush(), Math.max(0, next - Date.now()) + 50);
}

export function enqueue(
  input: Omit<
    QueueItem,
    "id" | "createdAt" | "notBefore" | "status" | "attempts" | "ownerId"
  > & { delayMs?: number },
) {
  const { delayMs, ...rest } = input;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item: QueueItem = {
    ...rest,
    photos: rest.photos ? keepPhotos(id, rest.photos) : undefined,
    id,
    createdAt: Date.now(),
    notBefore: Date.now() + (delayMs ?? 0),
    status: "QUEUED",
    attempts: 0,
    ownerId: owner ?? undefined,
  };
  items.push(item);
  emit();
  void persist();
  if (delayMs) schedule();
  else void flush();
  return id;
}

/** Hoàn tác hoặc bỏ mục. Trả về false nếu mục đang được gửi. */
export function cancel(id: string) {
  const item = items.find((i) => i.id === id);
  if (!item || item.status === "SENDING") return false;
  items = items.filter((i) => i.id !== id);
  dropPhotos(item.photos);
  emit();
  void persist();
  return true;
}

/** Gửi ngay, bỏ phần còn lại của cửa sổ Hoàn tác. */
export function sendNow(id: string) {
  const item = items.find((i) => i.id === id);
  if (!item) return;
  item.notBefore = 0;
  emit();
  void flush();
}

export function retry(id?: string) {
  items.forEach((i) => {
    if ((!id || i.id === id) && i.status === "REJECTED") {
      i.status = "QUEUED";
      i.error = undefined;
      i.lastFailure = undefined;
      i.notBefore = 0;
    }
  });
  emit();
  void persist();
  void flush();
}

/** Sửa giờ của mục bị từ chối (ghi lùi quá 24 giờ, giờ tương lai…) rồi gửi lại. */
export function updateTime(id: string, iso: string) {
  const item = items.find((i) => i.id === id);
  if (!item || !item.timeField) return;
  item.body = { ...item.body, [item.timeField]: iso };
  // Giờ vừa sửa không được muộn hơn giờ vào hàng chờ gửi kèm.
  item.createdAt = Date.now();
  item.status = "QUEUED";
  item.error = undefined;
  item.lastFailure = undefined;
  item.notBefore = 0;
  emit();
  void persist();
  void flush();
}

export const timeOf = (item: QueueItem) =>
  item.timeField ? (item.body[item.timeField] as string) : null;

/** Mục còn lại của tài khoản khác trên cùng máy. */
export const foreignItems = (userId: string) =>
  items.filter((i) => i.ownerId && i.ownerId !== userId);

export async function discardForeign(userId: string) {
  items
    .filter((i) => i.ownerId && i.ownerId !== userId)
    .forEach((i) => dropPhotos(i.photos));
  items = items.filter((i) => !i.ownerId || i.ownerId === userId);
  emit();
  await persist();
}

function payload(item: QueueItem): RequestOptions["body"] {
  const body = { ...item.body, ...queueWireFields(item) };
  if (!item.photos) return body;
  const form = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      form.append(key, String(value));
  });
  // expo/fetch (SDK 58) chỉ nhận File/Blob thật, không nhận { uri, name, type }.
  item.photos.forEach((uri) => appendPhoto(form, uri));
  return form;
}

export async function flush() {
  if (flushing || !owner || !request) return;
  flushing = true;
  try {
    for (;;) {
      if (!owner || !request) break;
      const item = items.find(
        (i) => i.status === "QUEUED" && mine(i) && i.notBefore <= Date.now(),
      );
      if (!item) break;
      if (hasMissingPhoto(item.photos)) {
        item.status = "REJECTED";
        item.error =
          "Ảnh đính kèm không còn trên máy nên không gửi được. Bỏ mục này rồi tạo lại.";
        emit();
        void persist();
        continue;
      }
      item.status = "SENDING";
      item.attempts += 1;
      emit();
      try {
        await request(item.path, { method: "POST", body: payload(item) }).catch(
          (e) => {
            if (!isReplayConflict(item, e instanceof ApiError ? e.status : 0))
              throw e;
          },
        );
        items = items.filter((i) => i.id !== item.id);
        if (item.legId)
          recent.push({ item: { ...item, sent: true }, sentAt: Date.now() });
        dropPhotos(item.photos);
        emit();
        void persist();
        sentListeners.forEach((l) => l(item));
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401) {
          item.status = "QUEUED";
          item.attempts -= 1;
          emit();
          void persist();
          break;
        }
        if (status === 0 || status === 408 || status === 429 || status >= 500) {
          // Giữ thứ tự: mốc sau phụ thuộc mốc trước.
          item.status = "QUEUED";
          item.notBefore = Date.now() + Math.min(60000, 5000 * item.attempts);
          item.lastFailure =
            e instanceof ApiError
              ? (e.detail ?? e.message)
              : e instanceof Error
                ? e.message
                : String(e);
          emit();
          void persist();
          break;
        }
        item.status = "REJECTED";
        item.error =
          e instanceof Error ? e.message : "Máy chủ không nhận mục này.";
        emit();
        void persist();
        rejectedListeners.forEach((l) => l(item, status));
      }
    }
  } finally {
    flushing = false;
    schedule();
  }
}

export function onSent(fn: (item: QueueItem) => void) {
  sentListeners.add(fn);
  return () => {
    sentListeners.delete(fn);
  };
}
export function onRejected(fn: (item: QueueItem, status: number) => void) {
  rejectedListeners.add(fn);
  return () => {
    rejectedListeners.delete(fn);
  };
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function useQueue(tripId?: string) {
  const all = useSyncExternalStore(subscribe, () => items);
  return tripId ? all.filter((i) => i.tripId === tripId) : all;
}
/** Mốc đang chờ gửi và mốc vừa gửi xong của chuyến, để áp lên dữ liệu máy chủ (applyPending). */
export function useTripProgress(tripId: string) {
  const all = useSyncExternalStore(subscribe, () => progress);
  return useMemo(() => all.filter((i) => i.tripId === tripId), [all, tripId]);
}
export function useOnline() {
  return useSyncExternalStore(subscribe, () => online);
}
