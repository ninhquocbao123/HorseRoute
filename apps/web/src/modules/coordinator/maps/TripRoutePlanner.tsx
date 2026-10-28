import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from 'antd';
import type { TripPlanLegInput, TripPlanOptions } from '../../trips/types/trip.types';
import { RouteMap } from './RouteMap';
import { calculateRoutes, isLatLng, routeInputKey } from './map.service';
import type { LatLng, Waypoint } from './route.types';

export default function TripRoutePlanner({ legs, locations, readOnly = false }: { legs: TripPlanLegInput[]; locations: TripPlanOptions['locations']; readOnly?: boolean }) {
  const waypoints = useMemo<Waypoint[]>(() => {
    const ids = legs.flatMap((leg, i) => i === 0 || legs[i - 1].toLocationId !== leg.fromLocationId ? [leg.fromLocationId, leg.toLocationId] : [leg.toLocationId]);
    return ids.map((id, i) => {
      const location = locations.find(l => l.id === id);
      const position = [location?.latitude, location?.longitude];
      return { id: `${i}-${id}`, label: location?.name || 'Chưa chọn địa điểm', kind: i === 0 ? 'origin' : i === ids.length - 1 ? 'destination' : 'stop', position: isLatLng(position) ? position : undefined };
    });
  }, [legs, locations]);
  const sourceKey = routeInputKey(waypoints);
  const [preview, setPreview] = useState<{ key: string; positions: Record<string, LatLng> }>({ key: '', positions: {} });
  const [picking, setPicking] = useState<string>();
  const points = waypoints.map(p => ({ ...p, position: preview.key === sourceKey ? preview.positions[p.id] || p.position : p.position }));
  const move = (id: string, position: LatLng) => setPreview(previous => ({ key: sourceKey, positions: { ...(previous.key === sourceKey ? previous.positions : {}), [id]: position } }));
  const key = routeInputKey(points);
  const [requestedKey, setRequestedKey] = useState('');
  const [selected, setSelected] = useState({ key: '', index: 0 });
  const valid = points.length > 1 && points.every(p => p.position);
  const routes = useQuery({ queryKey: ['coordinator-osrm', key], queryFn: ({ signal }) => calculateRoutes(points, signal), enabled: valid && requestedKey === key, retry: false, staleTime: 300000, refetchOnWindowFocus: false });
  const candidates = requestedKey === key ? routes.data || [] : [];
  const index = selected.key === key ? selected.index : 0;
  return <div className="osm-planner">
    <div className="waypoint-list">{points.map((point, i) => <div className="waypoint-editor" key={point.id}><div className="waypoint-heading"><strong>{i + 1}. {point.kind === 'origin' ? 'Điểm gửi' : point.kind === 'destination' ? 'Điểm nhận' : 'Điểm dừng'} · {point.label}</strong>{!readOnly && <Button onClick={() => setPicking(point.id)}>Chọn trên bản đồ</Button>}</div><small>{point.position ? point.position.map(n => n.toFixed(5)).join(', ') : readOnly ? 'Địa điểm chưa có tọa độ để hiển thị.' : 'Chưa xác định vị trí. Chọn trên bản đồ để xem tuyến tham khảo.'}</small></div>)}</div>
    {picking && <Alert type="info" message="Nhấn trên bản đồ để đặt vị trí xem trước; không thay đổi địa điểm đã lưu." action={<Button onClick={() => setPicking(undefined)}>Hủy</Button>} />}
    <RouteMap waypoints={points} geometry={candidates[index]?.geometry} readOnly={readOnly} picking={!!picking} onPick={position => { if (picking) move(picking, position); setPicking(undefined); }} onMove={readOnly ? undefined : move} />
    <p className="osm-source">Nền OpenStreetMap · Tuyến tham khảo OSRM. Tuyến không kiểm tra giới hạn xe chở ngựa; hình tuyến không được lưu bởi API kế hoạch hiện tại.</p>
    {!readOnly && preview.key === sourceKey && Object.keys(preview.positions).length > 0 && <Alert type="warning" message="Vị trí kéo/chọn trên bản đồ chỉ dùng xem trước, không lưu vào địa điểm của chuyến." action={<Button onClick={() => setPreview({key:'',positions:{}})}>Đặt lại</Button>} />}
    <div className="route-comparison-heading"><strong>Chọn lộ trình vận chuyển</strong></div>
    {!valid && <Alert type="info" message="Chọn các địa điểm có tọa độ trong danh mục để tìm đường. Địa điểm thiếu tọa độ vẫn có thể lưu trong kế hoạch." />}
    <div className="osm-toolbar"><Button disabled={!valid} loading={routes.isFetching} onClick={() => { setRequestedKey(key); if (requestedKey === key) void routes.refetch(); }}>Tìm tuyến đường</Button></div>
    {requestedKey === key && routes.isError && <Alert type="warning" message={routes.error.message} action={<Button size="small" onClick={() => void routes.refetch()}>Thử lại</Button>} />}
    {requestedKey === key && routes.isSuccess && candidates.length === 0 && <Alert type="info" message="Dịch vụ chưa trả về phương án tuyến phù hợp." />}
    <div className="osm-route-options">{candidates.map((route, i) => <label key={route.id} className={index === i ? 'is-selected' : ''}><input type="radio" name="coordinator-route" checked={index === i} onChange={() => setSelected({ key, index: i })} /><span><strong>Tuyến {i + 1} · {(route.distanceM / 1000).toFixed(1)} km</strong><small>Ước tính {Math.round(route.durationS / 60)} phút lái xe, chưa tính nghỉ và xử lý tại trạm.</small></span></label>)}</div>
  </div>;
}
