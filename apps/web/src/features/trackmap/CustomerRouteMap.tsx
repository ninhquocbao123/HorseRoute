import { useEffect, useMemo, useRef } from 'react';
import { Layer, Marker, Source, type MapRef } from 'react-map-gl/mapbox';
import type { ITripMap } from '@my-project/shared';
import BaseMap from './BaseMap';
import { DEFAULT_VIEW } from './map-style';
import { planView, VN_VIEW } from './map-view-plan';

type LngLat = [number, number];
const ROUTE_REST = '#b9cfc9';
const ROUTE_DONE = '#0c3e47';

/**
 * Bản đồ nhỏ của khách (thẻ "Chuyến đang chạy"): tuyến, điểm dừng và xe tải đặt theo MỐC tài xế đã ghi (API khách không có GPS).
 * Đoạn đã đi (chặng đã đến / hoàn thành) đậm, đoạn chưa đi nhạt. Chỉ import qua lazy chunk.
 */
export default function CustomerRouteMap({ map }: { map: ITripMap | null }) {
  const ref = useRef<MapRef>(null);
  const legs = useMemo(() => map?.legs ?? [], [map?.legs]);
  const all = useMemo(() => lineCollection(legs, false), [legs]);
  const done = useMemo(() => lineCollection(legs, true), [legs]);
  const stops = (map?.stops ?? []).filter(stop => stop.lat !== null && stop.lng !== null);

  function fit() {
    const instance = ref.current;
    if (!instance) return;
    const container = instance.getContainer();
    const points: LngLat[] = [...legs.flatMap(leg => leg.coordinates ?? []), ...stops.map(stop => [stop.lng!, stop.lat!] as LngLat)];
    const plan = planView(points, { width: container.clientWidth, height: container.clientHeight });
    const home = () => instance.jumpTo({ center: [VN_VIEW.longitude, VN_VIEW.latitude], zoom: VN_VIEW.zoom });
    if (plan.kind === 'default') home();
    else if (plan.kind === 'point') instance.jumpTo({ center: plan.center, zoom: plan.zoom });
    else {
      try { instance.fitBounds(plan.bounds, { padding: 28, maxZoom: plan.maxZoom, duration: 0 }); } catch { home(); }
    }
  }
  useEffect(fit, [map?.tripId, legs.length, stops.length]); // chỉ khi đổi chuyến / có dữ liệu mới

  const position = map?.position ?? null;
  return (
    // Thẻ nhỏ trong trang: tắt cuộn-để-zoom để cuộn trang không bị bản đồ "bắt" mất.
    <BaseMap ref={ref} initialViewState={DEFAULT_VIEW} onLoad={fit} scrollZoom={false} dragRotate={false}>
      <Source id="customer-route" type="geojson" data={all}>
        <Layer id="customer-route-casing" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#ffffff', 'line-width': 8 }} />
        <Layer id="customer-route-rest" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': ROUTE_REST, 'line-width': 5 }} />
      </Source>
      <Source id="customer-route-done" type="geojson" data={done}>
        <Layer id="customer-route-done" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': ROUTE_DONE, 'line-width': 5 }} />
      </Source>
      {stops.map((stop, index) => (
        <Marker key={stop.locationId + index} longitude={stop.lng!} latitude={stop.lat!} anchor="center">
          <span className={'crm-stop' + (index === 0 ? ' is-start' : index === stops.length - 1 ? ' is-end' : '')} role="img" aria-label={stop.name} title={stop.name} />
        </Marker>
      ))}
      {position && (
        <Marker longitude={position.lng} latitude={position.lat} anchor="center" className="drm-vehicle-marker">
          <span className="drm-vehicle crm-truck" role="img" aria-label={position.label ?? 'Vị trí xe'} title={position.label ?? 'Vị trí xe'} />
        </Marker>
      )}
    </BaseMap>
  );
}

/** Tuyến các chặng; `done` = chỉ chặng đã đến điểm cuối (AT_STOP) hoặc hoàn thành. */
function lineCollection(legs: ITripMap['legs'], done: boolean) {
  return {
    type: 'FeatureCollection' as const,
    features: legs.filter(leg => leg.coordinates && (!done || leg.status === 'COMPLETED' || leg.status === 'AT_STOP')).map(leg => ({
      type: 'Feature' as const, properties: { id: leg.id }, geometry: { type: 'LineString' as const, coordinates: leg.coordinates! },
    })),
  };
}
