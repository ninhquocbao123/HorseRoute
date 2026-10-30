import { useEffect, useMemo, useRef, useState } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';
import type { ITripMap, ITripTrackPoint } from '@my-project/shared';
import BaseMap from './BaseMap';
import { applyDriverMapTheme, driverMapColors } from './driver-map-theme';
import { DEFAULT_VIEW } from './map-style';
import { planView, VN_VIEW } from './map-view-plan';
import { OFF_ROUTE_KM, routeBearingAt, travelledRoute } from './route-progress';

type LngLat = [number, number];
/** Bề rộng ước lượng của nhãn (chữ 12px đậm ≈ 7px/ký tự) + lề 26px từ chấm + padding. */
const labelWidth = (stop: { name: string }, first: boolean) => 26 + 22 + (stop.name.length + (first ? ' · điểm gửi' : ' · điểm nhận').length) * 7;
export type OwnFix = { lng: number; lat: number; at: string; headingDeg?: number | null };
/** Góc nhìn chế độ dẫn đường (kiểu Google Maps): sát mặt đường, nghiêng, xe nằm phía dưới giữa khung. */
const NAV_ZOOM = 16;
const NAV_PITCH = 55;

/**
 * Bản đồ lộ trình của màn tài xế (D1 khi READY, D1b khi IN_TRANSIT). Chỉ import qua lazy chunk.
 * ROAD nét liền; STRAIGHT (đường thẳng ước lượng) và AIR (cung tròn lớn) nét đứt. Tự fit theo tuyến khi đổi chuyến.
 */
export default function DriverRouteMap({ map, track, running, ownFix, navigating = false }: {
  /** null khi chưa tải được /map: vẫn hiện bản đồ ở góc nhìn Việt Nam */
  map: ITripMap | null;
  track: ITripTrackPoint[];
  running: boolean;
  /** Điểm GPS vừa lấy trên máy tài xế: cập nhật marker ngay, không chờ lần tải /map kế tiếp */
  ownFix: OwnFix | null;
  /** Chế độ dẫn đường: camera bám theo xe, quay theo hướng đi; kéo bản đồ thì tạm ngừng bám, có nút "Về giữa". */
  navigating?: boolean;
}) {
  const ref = useRef<MapRef>(null);
  const fittedFor = useRef<string | null>(null);
  // Màu từ biến CSS --drs-* (xem driver-map-theme.ts): đọc một lần khi dựng bản đồ.
  const colors = useMemo(() => driverMapColors(document.querySelector('.drs')), []);

  const mapLegs = useMemo(() => map?.legs ?? [], [map?.legs]);
  const legs = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: mapLegs.filter(leg => leg.coordinates).map(leg => ({
      type: 'Feature' as const,
      properties: { id: leg.id, mode: leg.mode },
      geometry: { type: 'LineString' as const, coordinates: leg.coordinates! },
    })),
  }), [mapLegs]);

  const vehicle = useMemo(() => {
    const position = map?.position ?? null;
    // Chuyến đã giao (xem lại lịch sử): không còn xe để hiện.
    if (!running && map?.orderStatus === 'DELIVERED') return null;
    if (ownFix && (!position || Date.parse(ownFix.at) >= Date.parse(position.asOf))) {
      return { lng: ownFix.lng, lat: ownFix.lat, estimated: false, label: 'Vị trí của bạn (GPS)' };
    }
    if (!position) return null;
    return { lng: position.lng, lat: position.lat, estimated: position.source === 'ESTIMATED', label: position.label ?? 'Vị trí xe (GPS)' };
  }, [map?.position, map?.orderStatus, running, ownFix]);

  // Đoạn đã đi = phần TUYẾN ĐƯỜNG từ đầu chuyến tới điểm chiếu của xe (marker xe vẫn đặt đúng tọa độ GPS, không bắt dính).
  const { travelled, offRoute } = useMemo(() => {
    const result = travelledRoute(mapLegs, vehicle ? [vehicle.lng, vehicle.lat] : null);
    return {
      offRoute: result.offsetKm !== null && result.offsetKm > OFF_ROUTE_KM,
      travelled: {
        type: 'FeatureCollection' as const,
        features: result.lines.map((line, i) => ({ type: 'Feature' as const, properties: { id: String(i), mode: line.mode }, geometry: { type: 'LineString' as const, coordinates: line.coordinates } })),
      },
    };
  }, [mapLegs, vehicle]);

  // Vệt GPS thô chỉ hiện (rất mảnh) khi xe lệch tuyến > 300 m, để thấy xe đã đi đường nào ngoài tuyến.
  const offTrack = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: offRoute && track.length > 1
      ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: track.map(p => [p.lng, p.lat]) } }]
      : [],
  }), [offRoute, track]);

  const stops = (map?.stops ?? []).filter(stop => stop.lat !== null && stop.lng !== null);

  // Hướng đi: ưu tiên la bàn GPS của máy (chỉ có khi xe đang chạy), không có thì theo hướng tuyến tại chỗ xe đứng.
  const bearing = useMemo(() => {
    if (!vehicle) return 0;
    if (ownFix?.headingDeg != null && !vehicle.estimated) return ownFix.headingDeg;
    const leg = mapLegs.find(item => item.status === 'MOVING' || item.status === 'AT_STOP') ?? mapLegs.find(item => item.status !== 'COMPLETED');
    return routeBearingAt(leg?.coordinates ?? null, [vehicle.lng, vehicle.lat]) ?? 0;
  }, [vehicle, ownFix?.headingDeg, mapLegs]);

  const [following, setFollowing] = useState(true);
  const loaded = useRef(false);
  const follow = () => {
    const instance = ref.current;
    if (!instance || !vehicle) return;
    const height = instance.getContainer().clientHeight;
    // Lề trên lớn (banner chỉ đường) để xe nằm ở khoảng 2/3 khung như Google Maps.
    instance.easeTo({ center: [vehicle.lng, vehicle.lat], zoom: NAV_ZOOM, pitch: NAV_PITCH, bearing, duration: 900,
      padding: { top: Math.round(height * 0.35), bottom: 90, left: 0, right: 0 } });
  };
  useEffect(() => {
    if (navigating) setFollowing(true);
    const instance = ref.current;
    if (!instance || !loaded.current) return;
    if (navigating) follow();
    else {
      // Thoát dẫn đường: trả về góc nhìn toàn tuyến, không nghiêng.
      instance.easeTo({ pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 0 });
      fit();
    }
  }, [navigating]); // chỉ khi bật/tắt chế độ
  useEffect(() => {
    if (navigating && following && loaded.current) follow();
  }, [vehicle?.lng, vehicle?.lat, bearing, following]); // bám theo mỗi lần xe có vị trí mới

  /** Đưa góc nhìn về đúng chỗ: không điểm nào → Việt Nam; một điểm → zoom ~10; nhiều điểm → fit khung có lề (xem map-view-plan.ts). */
  function fit() {
    const instance = ref.current;
    if (!instance) return;
    const container = instance.getContainer();
    const points: LngLat[] = [...mapLegs.flatMap(leg => leg.coordinates ?? []), ...stops.map(stop => [stop.lng!, stop.lat!] as LngLat)];
    const plan = planView(points, { width: container.clientWidth, height: container.clientHeight });
    const home = () => instance.jumpTo({ center: [VN_VIEW.longitude, VN_VIEW.latitude], zoom: VN_VIEW.zoom });
    if (plan.kind === 'default') home();
    else if (plan.kind === 'point') instance.flyTo({ center: plan.center, zoom: plan.zoom, duration: 0 });
    else {
      try {
        instance.fitBounds(plan.bounds, { padding: plan.padding, maxZoom: plan.maxZoom, duration: 0 });
      } catch {
        home(); // fitBounds không được phép làm trắng bản đồ
      }
    }
    fittedFor.current = map?.tripId ?? null;
    updateFlips();
  }

  // Nhãn điểm gửi/nhận mặc định nằm bên phải chấm; chấm sát mép phải thì đổi sang bên trái để nhãn không bị cắt.
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  function updateFlips() {
    const instance = ref.current;
    if (!instance) return;
    const width = instance.getContainer().clientWidth;
    const next: Record<string, boolean> = {};
    stops.forEach((stop, index) => {
      if (index !== 0 && index !== stops.length - 1) return;
      const x = instance.project([stop.lng!, stop.lat!]).x;
      next[stop.locationId] = x + labelWidth(stop, index === 0) > width - 8;
    });
    setFlipped(previous => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
  }

  // Đổi chuyến (hoặc dữ liệu tới sau khi bản đồ đã tải): fit lại; các lần làm mới 60 giây thì giữ khung người dùng đang xem.
  useEffect(() => {
    if (map && fittedFor.current !== map.tripId) {
      if (navigating && loaded.current) { fittedFor.current = map.tripId; follow(); } else fit();
    }
  }, [map?.tripId, mapLegs.length, stops.length]); // chỉ khi đổi chuyến / có dữ liệu mới, không theo mỗi lần làm mới

  const solid = ['==', ['get', 'mode'], 'ROAD'] as const;
  const dashed = ['!=', ['get', 'mode'], 'ROAD'] as const;

  return (
    <BaseMap
      ref={ref} initialViewState={DEFAULT_VIEW} maxPitch={60}
      onLoad={event => { applyDriverMapTheme(event.target, colors); loaded.current = true; if (navigating) { fittedFor.current = map?.tripId ?? null; follow(); } else fit(); }}
      onMoveEnd={updateFlips}
      // Chỉ thao tác của người dùng (có originalEvent) mới ngừng bám xe; easeTo của chính bản đồ thì không.
      onDragStart={event => { if (navigating && (event as { originalEvent?: unknown }).originalEvent) setFollowing(false); }}
      onZoomStart={event => { if (navigating && (event as { originalEvent?: unknown }).originalEvent) setFollowing(false); }}
    >
      <Source id="driver-legs" type="geojson" data={legs}>
        {/* Quầng teal mờ + viền trắng để tuyến nổi trên nền đất và đường trắng (Figma: quầng #0B3B42 18%). */}
        <Layer id="legs-halo" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': colors.routeHalo, 'line-width': 11, 'line-opacity': 0.18 }} />
        <Layer id="legs-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.95 }} />
        <Layer id="legs-solid" type="line" filter={solid as never} layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': running ? colors.routeRest : colors.route, 'line-width': 5 }} />
        <Layer id="legs-dashed" type="line" filter={dashed as never} layout={{ 'line-cap': 'butt', 'line-join': 'round' }}
          paint={{ 'line-color': running ? colors.routeRest : colors.route, 'line-width': 4, 'line-dasharray': [2, 1.5] }} />
      </Source>
      {running && (
        <Source id="driver-travelled" type="geojson" data={travelled}>
          <Layer id="travelled-solid" type="line" filter={solid as never} layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': colors.routeDone, 'line-width': 5 }} />
          <Layer id="travelled-dashed" type="line" filter={dashed as never} paint={{ 'line-color': colors.routeDone, 'line-width': 4, 'line-dasharray': [2, 1.5] }} />
        </Source>
      )}
      {running && (
        <Source id="driver-off-track" type="geojson" data={offTrack}>
          <Layer id="off-track" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': colors.routeDone, 'line-width': 1.5, 'line-opacity': 0.8 }} />
        </Source>
      )}
      {stops.map((stop, index) => {
        const first = index === 0;
        const last = index === stops.length - 1;
        const label = first ? `${stop.name} · điểm gửi` : last ? `${stop.name} · điểm nhận` : stop.name;
        return (
          <Marker key={stop.locationId} longitude={stop.lng!} latitude={stop.lat!} anchor="center">
            <span className={'drm-stop' + (first ? ' is-start' : last ? ' is-end' : '')} role="img" aria-label={label}>
              {(first || last) && <span className={'drm-label' + (flipped[stop.locationId] ? ' is-left' : '')}>{label}</span>}
            </span>
          </Marker>
        );
      })}
      {vehicle && (
        <Marker
          longitude={vehicle.lng} latitude={vehicle.lat} anchor="center" className="drm-vehicle-marker"
          rotation={navigating ? bearing : 0} rotationAlignment={navigating ? 'map' : 'viewport'} pitchAlignment={navigating ? 'map' : 'viewport'}
        >
          <span className={'drm-vehicle' + (navigating ? ' is-nav' : '') + (vehicle.estimated ? ' is-estimated' : '')} role="img" aria-label={vehicle.label} title={vehicle.label} />
        </Marker>
      )}
      {navigating && !following && vehicle && (
        <button type="button" className="drm-recenter" onClick={() => { setFollowing(true); follow(); }}>
          <span className="drm-recenter-arrow" aria-hidden="true" />Về giữa
        </button>
      )}
    </BaseMap>
  );
}
