import { useEffect, useMemo, useRef } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';
import type { ITripMap, ITripTrackPoint } from '@my-project/shared';
import BaseMap from './BaseMap';
import { applyDriverMapTheme, driverMapColors } from './driver-map-theme';
import { DEFAULT_VIEW } from './map-style';
import { OFF_ROUTE_KM, travelledRoute } from './route-progress';

type LngLat = [number, number];
export type OwnFix = { lng: number; lat: number; at: string };

/**
 * Bản đồ lộ trình của màn tài xế (D1 khi READY, D1b khi IN_TRANSIT). Chỉ import qua lazy chunk.
 * ROAD nét liền; STRAIGHT (đường thẳng ước lượng) và AIR (cung tròn lớn) nét đứt. Tự fit theo tuyến khi đổi chuyến.
 */
export default function DriverRouteMap({ map, track, running, ownFix }: {
  map: ITripMap;
  track: ITripTrackPoint[];
  running: boolean;
  /** Điểm GPS vừa lấy trên máy tài xế: cập nhật marker ngay, không chờ lần tải /map kế tiếp */
  ownFix: OwnFix | null;
}) {
  const ref = useRef<MapRef>(null);
  const fittedFor = useRef<string | null>(null);
  // Màu từ biến CSS --drs-* (xem driver-map-theme.ts): đọc một lần khi dựng bản đồ.
  const colors = useMemo(() => driverMapColors(document.querySelector('.drs')), []);

  const legs = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: map.legs.filter(leg => leg.coordinates).map(leg => ({
      type: 'Feature' as const,
      properties: { id: leg.id, mode: leg.mode },
      geometry: { type: 'LineString' as const, coordinates: leg.coordinates! },
    })),
  }), [map.legs]);

  const vehicle = useMemo(() => {
    const position = map.position;
    if (ownFix && (!position || Date.parse(ownFix.at) >= Date.parse(position.asOf))) {
      return { lng: ownFix.lng, lat: ownFix.lat, estimated: false, label: 'Vị trí của bạn (GPS)' };
    }
    if (!position) return null;
    return { lng: position.lng, lat: position.lat, estimated: position.source === 'ESTIMATED', label: position.label ?? 'Vị trí xe (GPS)' };
  }, [map.position, ownFix]);

  // Đoạn đã đi = phần TUYẾN ĐƯỜNG từ đầu chuyến tới điểm chiếu của xe (marker xe vẫn đặt đúng tọa độ GPS, không bắt dính).
  const { travelled, offRoute } = useMemo(() => {
    const result = travelledRoute(map.legs, vehicle ? [vehicle.lng, vehicle.lat] : null);
    return {
      offRoute: result.offsetKm !== null && result.offsetKm > OFF_ROUTE_KM,
      travelled: {
        type: 'FeatureCollection' as const,
        features: result.lines.map((line, i) => ({ type: 'Feature' as const, properties: { id: String(i), mode: line.mode }, geometry: { type: 'LineString' as const, coordinates: line.coordinates } })),
      },
    };
  }, [map.legs, vehicle]);

  // Vệt GPS thô chỉ hiện (rất mảnh) khi xe lệch tuyến > 300 m, để thấy xe đã đi đường nào ngoài tuyến.
  const offTrack = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: offRoute && track.length > 1
      ? [{ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: track.map(p => [p.lng, p.lat]) } }]
      : [],
  }), [offRoute, track]);

  const stops = map.stops.filter(stop => stop.lat !== null && stop.lng !== null);

  function fit() {
    const instance = ref.current;
    if (!instance) return;
    const points: LngLat[] = [...map.legs.flatMap(leg => leg.coordinates ?? []), ...stops.map(stop => [stop.lng!, stop.lat!] as LngLat)];
    if (!points.length) return;
    const lngs = points.map(p => p[0]);
    const lats = points.map(p => p[1]);
    instance.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 56, maxZoom: 12, duration: 0 });
    fittedFor.current = map.tripId;
  }

  // Đổi chuyến (hoặc dữ liệu tới sau khi bản đồ đã tải): fit lại; các lần làm mới 60 giây thì giữ khung người dùng đang xem.
  useEffect(() => {
    if (fittedFor.current !== map.tripId) fit();
  }, [map.tripId, map.legs.length]); // chỉ khi đổi chuyến, không theo mỗi lần làm mới

  const solid = ['==', ['get', 'mode'], 'ROAD'] as const;
  const dashed = ['!=', ['get', 'mode'], 'ROAD'] as const;

  return (
    <BaseMap ref={ref} initialViewState={DEFAULT_VIEW} onLoad={event => { applyDriverMapTheme(event.target, colors); fit(); }}>
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
              {(first || last) && <span className="drm-label">{label}</span>}
            </span>
          </Marker>
        );
      })}
      {vehicle && (
        <Marker longitude={vehicle.lng} latitude={vehicle.lat} anchor="center" style={{ zIndex: 2 }}>
          <span className={'drm-vehicle' + (vehicle.estimated ? ' is-estimated' : '')} role="img" aria-label={vehicle.label} title={vehicle.label} />
        </Marker>
      )}
    </BaseMap>
  );
}
