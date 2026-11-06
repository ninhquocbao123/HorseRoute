/**
 * Dữ liệu vẽ bản đồ: chuyển ITripMap thành "cảnh" gửi xuống WebView. Hàm thuần, kiểm thử bằng node.
 * Cùng quy tắc với CustomerRouteMap và DriverRouteMap của web. Chỉ đổi cách vẽ, không đổi dữ liệu.
 */
import {
  planView,
  usablePoints,
  type LngLat,
  type ViewPlan,
} from "../../../../packages/shared/src/map/map-view-plan.ts";
import {
  OFF_ROUTE_KM,
  routeBearingAt,
  travelledRoute,
} from "../../../../packages/shared/src/map/route-progress.ts";
import type {
  ITripMap,
  ITripTrackPoint,
} from "../../../../packages/shared/src/types/trackmap.type";

export type MapMode = "customer" | "crew";

/** Điểm GPS vừa lấy trên máy tài xế, chỉ để vẽ, không gửi lên máy chủ. */
export type OwnFix = {
  lng: number;
  lat: number;
  at: string;
  headingDeg: number | null;
  speedKmh: number | null;
};

export type SceneStop = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  kind: "start" | "mid" | "end";
  label: string | null;
};
export type SceneLine = { coordinates: LngLat[]; mode: string };
export type SceneVehicle = {
  lng: number;
  lat: number;
  estimated: boolean;
  label: string;
};
export type MapColors = {
  land: string;
  water: string;
  green: string;
  road: string;
  casing: string;
  building: string;
  boundary: string;
  label: string;
  halo: string;
  routeDone: string;
  routeRest: string;
  routePlan: string;
  routeAir: string;
  stop: string;
  stopRing: string;
  vehicle: string;
};
export type MapScene = {
  mode: MapMode;
  dark: boolean;
  colors: MapColors;
  stops: SceneStop[];
  /** Toàn tuyến: nền nhạt khi đã có đoạn đã đi, màu đậm khi đang xem kế hoạch */
  route: SceneLine[];
  routeColor: "rest" | "plan";
  done: SceneLine[];
  offTrack: LngLat[];
  vehicle: SceneVehicle | null;
  bearing: number;
  /** Đổi khi sang chuyến khác hoặc có thêm dữ liệu: chỉ lúc đó mới fit lại góc nhìn */
  fitKey: string;
  view: ViewPlan;
  navigating: boolean;
  following: boolean;
  /** Thẻ nhỏ: không nhãn, không thao tác */
  compact: boolean;
};

/** Nền bản đồ, theo màu đã thử ở bước 0. Màu tuyến và xe lấy từ MapTokens của theme. */
const BASE_LIGHT = {
  land: "#f2f3f0",
  water: "#c9d7dc",
  green: "#e3ebdd",
  road: "#ffffff",
  casing: "#dcdfdb",
  building: "#e8e8e5",
  boundary: "#a9b4b5",
  label: "#55666a",
  halo: "#ffffff",
  routeRest: "#9fb9b4",
};
const BASE_DARK = {
  land: "#0b1f22",
  water: "#0f2e33",
  green: "#0e2a26",
  road: "#1d3d41",
  casing: "#14302f",
  building: "#132b2e",
  boundary: "#3f6064",
  label: "#96b4b7",
  halo: "#061416",
  routeRest: "#3f6064",
};

export type RouteTokens = {
  routeDone: string;
  routeAhead: string;
  routeAir: string;
  stop: string;
  stopRing: string;
  vehicle: string;
};

export function mapColors(tokens: RouteTokens, dark: boolean): MapColors {
  return {
    ...(dark ? BASE_DARK : BASE_LIGHT),
    routeDone: tokens.routeDone,
    routePlan: tokens.routeAhead,
    routeAir: tokens.routeAir,
    stop: tokens.stop,
    stopRing: tokens.stopRing,
    vehicle: tokens.vehicle,
  };
}

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

export function sceneStops(map: ITripMap | null, compact = false): SceneStop[] {
  const stops = (map?.stops ?? []).filter(
    (stop) =>
      finite(stop.lat) &&
      finite(stop.lng) &&
      usablePoints([[stop.lng!, stop.lat!]]).length === 1,
  );
  return stops.map((stop, index) => {
    const first = index === 0;
    const last = index === stops.length - 1 && stops.length > 1;
    return {
      id: stop.locationId,
      name: stop.name,
      lng: stop.lng!,
      lat: stop.lat!,
      kind: first ? "start" : last ? "end" : "mid",
      label:
        compact || (!first && !last)
          ? null
          : `${stop.name} · ${first ? "điểm gửi" : "điểm nhận"}`,
    };
  });
}

/** Xe của tài xế: GPS trên máy nếu mới hơn dữ liệu máy chủ. Khách chỉ có vị trí theo mốc. */
export function sceneVehicle(
  map: ITripMap | null,
  mode: MapMode,
  running: boolean,
  ownFix: OwnFix | null,
): SceneVehicle | null {
  const position = map?.position ?? null;
  if (mode === "crew") {
    if (!running && map?.orderStatus === "DELIVERED") return null;
    if (
      ownFix &&
      (!position || Date.parse(ownFix.at) >= Date.parse(position.asOf))
    )
      return {
        lng: ownFix.lng,
        lat: ownFix.lat,
        estimated: false,
        label: "Vị trí của bạn (GPS)",
      };
  }
  if (!position) return null;
  return {
    lng: position.lng,
    lat: position.lat,
    estimated: position.source === "ESTIMATED",
    label: position.label ?? "Vị trí xe",
  };
}

export function buildScene(input: {
  map: ITripMap | null;
  mode: MapMode;
  running: boolean;
  track?: ITripTrackPoint[];
  ownFix?: OwnFix | null;
  navigating?: boolean;
  following?: boolean;
  compact?: boolean;
  colors: MapColors;
  dark: boolean;
  size: { width: number; height: number };
}): MapScene {
  const { map, mode, running, colors, dark, size } = input;
  const crew = mode === "crew";
  // Tuyệt đối không dùng GPS cho khách, kể cả khi dữ liệu có truyền nhầm vào.
  const ownFix = crew ? (input.ownFix ?? null) : null;
  const track = crew ? (input.track ?? []) : [];
  const compact = !!input.compact;
  const navigating = crew && running && !!input.navigating;
  const legs = map?.legs ?? [];
  const lined = legs.filter((leg) => leg.coordinates);
  const stops = sceneStops(map, compact);
  const vehicle = sceneVehicle(map, mode, running, ownFix);

  const route: SceneLine[] = lined.map((leg) => ({
    coordinates: leg.coordinates as LngLat[],
    mode: leg.mode,
  }));
  let done: SceneLine[];
  let offTrack: LngLat[] = [];
  if (crew && running) {
    const travelled = travelledRoute(
      legs,
      vehicle ? [vehicle.lng, vehicle.lat] : null,
    );
    done = travelled.lines;
    if (
      travelled.offsetKm !== null &&
      travelled.offsetKm > OFF_ROUTE_KM &&
      track.length > 1
    )
      offTrack = track.map((point) => [point.lng, point.lat]);
  } else if (crew) {
    done = [];
  } else {
    done = lined
      .filter((leg) => leg.status === "COMPLETED" || leg.status === "AT_STOP")
      .map((leg) => ({
        coordinates: leg.coordinates as LngLat[],
        mode: leg.mode,
      }));
  }

  let bearing = 0;
  if (vehicle) {
    if (ownFix?.headingDeg != null && !vehicle.estimated)
      bearing = ownFix.headingDeg;
    else {
      const leg =
        legs.find((item) => item.status === "MOVING" || item.status === "AT_STOP") ??
        legs.find((item) => item.status !== "COMPLETED");
      bearing =
        routeBearingAt(
          (leg?.coordinates as LngLat[] | null | undefined) ?? null,
          [vehicle.lng, vehicle.lat],
        ) ?? 0;
    }
  }

  const points: LngLat[] = [
    ...route.flatMap((line) => line.coordinates),
    ...stops.map((stop): LngLat => [stop.lng, stop.lat]),
  ];
  return {
    mode,
    dark,
    colors,
    stops,
    route,
    routeColor: !crew || running ? "rest" : "plan",
    done,
    offTrack,
    vehicle,
    bearing,
    fitKey: `${map?.tripId ?? ""}|${legs.length}|${stops.length}`,
    view: planView(points, size),
    navigating,
    following: navigating && input.following !== false,
    compact,
  };
}

/** Khách: bỏ tiền tố kỹ thuật, viết hoa đầu câu, giống CustomerTripMap của web. */
export function customerPositionText(map: ITripMap | null): string | null {
  const text = map?.position?.label?.replace(
    /^Ước tính theo kế hoạch, không phải GPS: /,
    "",
  );
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : null;
}

/** Điểm chưa có tọa độ: nhắc nhờ ghim vị trí, thay cho cảnh báo chung của API. */
export function crewMapNotes(map: ITripMap | null): string[] {
  const warnings = (map?.warnings ?? []).filter(
    (warning) => !warning.startsWith("Chưa có tọa độ cho "),
  );
  // Nhiều chặng cùng thiếu tuyến thì gộp một dòng, màn điện thoại không đủ chỗ cho từng dòng.
  const straight = /^Chặng (\d+): (chưa có tuyến đường bộ.*)$/;
  const legs = warnings
    .map((warning) => straight.exec(warning))
    .filter((match): match is RegExpExecArray => !!match);
  const merged =
    legs.length > 1
      ? [
          `Chặng ${legs.map((match) => match[1]).join(", ")}: ${legs[0][2]}`,
          ...warnings.filter((warning) => !straight.test(warning)),
        ]
      : warnings;
  return [
    ...merged,
    ...(map?.stops ?? [])
      .filter((stop) => stop.lat === null || stop.lng === null)
      .map(
        (stop) =>
          `Điểm ${stop.name} chưa có tọa độ. Nhờ Specialist ghim trên màn Địa điểm.`,
      ),
  ];
}
