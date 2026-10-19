import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'wdp:tracking:';

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Bộ nhớ đầy hoặc bị chặn: bản nháp chỉ còn trong phiên hiện tại.
  }
}

/**
 * Bản nháp lưu trong localStorage để form không mất dữ liệu khi lỗi mạng hoặc tải lại trang (NFR-REL-01).
 * `key` đổi (ví dụ đổi chuyến/chặng) thì nạp bản nháp của khóa mới.
 */
export function useDraft<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(() => read<T>(key) ?? initialRef.current);
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    setValue(read<T>(key) ?? initialRef.current);
  }, [key]);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue(previous => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(previous) : next;
        write(keyRef.current, resolved);
        return resolved;
      });
    },
    [],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(PREFIX + keyRef.current);
    } catch {
      // bỏ qua
    }
    setValue(initialRef.current);
  }, []);

  return [value, update, clear] as const;
}

/** Thao tác đã chốt giờ nhưng chưa gửi được (mất mạng): giữ để gửi lại đúng giờ thực tế. */
export type PendingMilestone = { legId: string; type: string; occurredAt: string };

export const pendingStore = {
  get: (legId: string) => read<PendingMilestone>(`pending:${legId}`),
  set: (pending: PendingMilestone) => write(`pending:${pending.legId}`, pending),
  clear: (legId: string) => {
    try {
      localStorage.removeItem(PREFIX + `pending:${legId}`);
    } catch {
      // bỏ qua
    }
  },
};
