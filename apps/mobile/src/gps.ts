/**
 * Gửi vị trí xe khi chuyến đang chạy (tài xế). Android dùng foreground service có thông báo cố định,
 * nên vẫn gửi khi tắt màn hình. Điểm gom lô tối đa 20 rồi POST /tracking/trips/:id/positions; mất mạng thì giữ lại.
 * index.ts import file này để TaskManager.defineTask có sẵn khi app khởi động nền.
 * Expo Go không chạy được vị trí nền trên Android; cần bản build riêng (npm run android).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { ApiError, createApiClient } from "./api/http";
import { API_URL, AUTH_KEY } from "./config";
import { shouldStopTracking } from "./live-domain";

export const GPS_TASK = "horseroute-trip-gps";
const TRIP_KEY = "horseroute.gps.trip";
const BUFFER_KEY = "horseroute.gps.buffer";
const MAX_BUFFER = 600;

type Point = {
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM?: number;
  speedMps?: number;
  headingDeg?: number;
};

let token: string | null = null;
const request = createApiClient({ baseUrl: API_URL, getToken: () => token });

async function readBuffer(): Promise<Point[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(BUFFER_KEY)) || "[]");
  } catch {
    return [];
  }
}

let sending = false;
async function flushPositions(tripId: string) {
  if (sending) return;
  sending = true;
  try {
    token = await SecureStore.getItemAsync(AUTH_KEY).catch(() => null);
    if (!token) return;
    let buffer = await readBuffer();
    while (buffer.length) {
      const batch = buffer.slice(0, 20);
      try {
        await request(
          `/tracking/trips/${encodeURIComponent(tripId)}/positions`,
          {
            method: "POST",
            body: { points: batch },
          },
        );
      } catch (e) {
        if (!(e instanceof ApiError) || e.status === 0 || e.status >= 500)
          break;
        // 4xx (chặng không chạy, điểm sai): bỏ lô này để không kẹt mãi.
      }
      buffer = buffer.slice(batch.length);
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
    }
  } finally {
    sending = false;
  }
}

if (!TaskManager.isTaskDefined(GPS_TASK))
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    GPS_TASK,
    async ({ data, error }) => {
      if (error || !data) return;
      const tripId = await AsyncStorage.getItem(TRIP_KEY);
      if (!tripId) return;
      const points: Point[] = data.locations.map((l) => ({
        latitude: l.coords.latitude,
        longitude: l.coords.longitude,
        recordedAt: new Date(Math.min(l.timestamp, Date.now())).toISOString(),
        accuracyM: l.coords.accuracy ?? undefined,
        speedMps:
          l.coords.speed != null && l.coords.speed >= 0
            ? l.coords.speed
            : undefined,
        headingDeg:
          l.coords.heading != null && l.coords.heading >= 0
            ? l.coords.heading
            : undefined,
      }));
      const buffer = [...(await readBuffer()), ...points].slice(-MAX_BUFFER);
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
      await flushPositions(tripId);
    },
  );

export type GpsState =
  /** Đang gửi nền */
  | "background"
  /** Chỉ gửi khi mở app: banner cảnh báo */
  | "foreground-only"
  | "denied"
  /** Định vị của máy đang tắt: banner đỏ */
  | "services-off"
  | "unknown";

export async function readGpsState(): Promise<GpsState> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return "services-off";
    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== "granted") return fg.canAskAgain ? "unknown" : "denied";
    const bg = await Location.getBackgroundPermissionsAsync();
    return bg.status === "granted" ? "background" : "foreground-only";
  } catch {
    return "unknown";
  }
}

/**
 * Android 11+ không có "Luôn cho phép" trong hộp hệ thống: bước 1 xin "Khi dùng ứng dụng",
 * bước 2 mở Cài đặt để chọn "Luôn cho phép".
 */
export async function requestGps(): Promise<GpsState> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return fg.canAskAgain ? "unknown" : "denied";
  const bg = await Location.requestBackgroundPermissionsAsync().catch(
    () => null,
  );
  if (
    bg?.status !== "granted" &&
    Platform.OS === "android" &&
    Number(Platform.Version) >= 30
  )
    await Linking.openSettings();
  return readGpsState();
}

export async function startTripTracking(tripId: string) {
  await AsyncStorage.setItem(TRIP_KEY, tripId);
  const state = await readGpsState();
  if (state !== "background" && state !== "foreground-only") return state;
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(
      GPS_TASK,
    ).catch(() => false);
    if (!running)
      await Location.startLocationUpdatesAsync(GPS_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000,
        distanceInterval: 50,
        deferredUpdatesInterval: 60000,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "HorseRoute đang gửi vị trí xe",
          notificationBody:
            "Điều phối thấy xe trong lúc chuyến đang chạy. Tự tắt khi giao xong.",
          notificationColor: "#0b3b42",
        },
      });
  } catch {
    // Expo Go không hỗ trợ vị trí nền: banner nhắc vẫn hiện theo state.
    return "foreground-only" as GpsState;
  }
  return state;
}

export async function stopTripTracking(tripId: string) {
  if (!shouldStopTracking(await AsyncStorage.getItem(TRIP_KEY), tripId)) return;
  await AsyncStorage.removeItem(TRIP_KEY);
  if (
    await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)
  )
    await Location.stopLocationUpdatesAsync(GPS_TASK).catch(() => {});
}

/** Trạng thái GPS hiện tại, đọc lại mỗi 15 giây khi chuyến chạy. */
export function useGpsState(active: boolean) {
  const [state, setState] = useState<GpsState>("unknown");
  const refresh = useCallback(() => {
    void readGpsState().then(setState);
  }, []);
  useEffect(() => {
    if (!active) return;
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [active, refresh]);
  return { state, refresh };
}

export async function currentPosition() {
  try {
    const p =
      (await Location.getLastKnownPositionAsync({ maxAge: 120000 })) ??
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }));
    return p
      ? `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`
      : null;
  } catch {
    return null;
  }
}
