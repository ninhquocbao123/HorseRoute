/**
 * Dữ liệu bản đồ tự làm mới, cùng cách làm với useTripMap của web:
 * 60 giây một lần, chỉ khi app đang mở; quay lại app sau hơn 60 giây thì tải ngay.
 * /map và /positions giới hạn 60 lượt/phút mỗi tài khoản, app chỉ dựng màn trên cùng nên không tải song song.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { ITripMap } from "../api/types";
import { useResource, useSession } from "../session";
import type { ITripTrackPoint } from "../../../../packages/shared/src/types/trackmap.type";
import { useKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import type { OwnFix } from "./map-scene";

export const MAP_REFRESH_MS = 60_000;
const MAX_TRACK = 500;

/** Gọi `tick` định kỳ khi app đang mở, và ngay khi quay lại app sau hơn một chu kỳ. */
export function useAutoRefresh(tick: () => void, ms = MAP_REFRESH_MS) {
  const latest = useRef(tick);
  latest.current = tick;
  const last = useRef(Date.now());
  useEffect(() => {
    const run = () => {
      last.current = Date.now();
      latest.current();
    };
    const timer = setInterval(() => {
      if (AppState.currentState === "active") run();
    }, ms);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - last.current >= ms) run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [ms]);
}

/** Vệt GPS đã đi của chuyến: nối dần bằng `since`, lỗi thì bỏ qua vì đây là phần phụ. */
export function useTripTrack(tripId: string | null, enabled: boolean) {
  const { request } = useSession();
  const [track, setTrack] = useState<ITripTrackPoint[]>([]);
  const since = useRef<string | undefined>(undefined);
  const load = useCallback(async () => {
    if (!tripId || !enabled) return;
    try {
      const query = since.current
        ? `?since=${encodeURIComponent(since.current)}`
        : "";
      const points = await request<ITripTrackPoint[]>(
        `/tracking/trips/${encodeURIComponent(tripId)}/positions${query}`,
      );
      if (points.length) {
        since.current = points[points.length - 1].recordedAt;
        setTrack((old) => [...old, ...points].slice(-MAX_TRACK));
      }
    } catch {
      // Vệt đường là phần phụ: lỗi thì vẫn hiện tuyến và vị trí.
    }
  }, [tripId, enabled, request]);
  useEffect(() => {
    setTrack([]);
    since.current = undefined;
    void load();
  }, [load]);
  useAutoRefresh(() => void load());
  return track;
}

export function useLiveTripMap(path: string) {
  const resource = useResource<ITripMap>(path);
  useAutoRefresh(resource.reload);
  return resource;
}

/**
 * GPS trên máy khi đang mở bản đồ, khoảng 5 giây một lần, chỉ để vẽ và không gửi lên máy chủ.
 * Không tự xin quyền: quyền đã được xin ở màn chuyến. gps.ts vẫn gửi nền 30 giây một lần như cũ.
 */
export function useOwnFix(active: boolean) {
  const [fix, setFix] = useState<OwnFix | null>(null);
  useEffect(() => {
    if (!active) {
      setFix(null);
      return;
    }
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (cancelled || permission.status !== "granted") return;
        const started = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 5,
          },
          (location) =>
            setFix({
              lng: location.coords.longitude,
              lat: location.coords.latitude,
              at: new Date(Math.min(location.timestamp, Date.now())).toISOString(),
              headingDeg:
                location.coords.heading != null && location.coords.heading >= 0
                  ? location.coords.heading
                  : null,
              speedKmh:
                location.coords.speed != null && location.coords.speed >= 0
                  ? location.coords.speed * 3.6
                  : null,
            }),
        );
        if (cancelled) started.remove();
        else subscription = started;
      } catch {
        // Không lấy được GPS: bản đồ dùng vị trí từ máy chủ.
      }
    })();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [active]);
  return fix;
}

/** Giữ màn hình sáng khi tài xế đang bám xe. Hook không điều kiện nên tách thành component rỗng. */
export function KeepScreenAwake() {
  useKeepAwake("horseroute-map");
  return null;
}
