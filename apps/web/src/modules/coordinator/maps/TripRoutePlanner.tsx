import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Input } from 'antd';
import { DeleteOutlined, DownOutlined, PlusOutlined, SaveOutlined, UpOutlined } from '@ant-design/icons';
import { api } from '../../../lib/axios';
import { errorMessage } from '../../../features/tracking/tracking.api';
import { RouteMap } from './RouteMap';
import type { AddressResult, LatLng, RouteCandidate, Waypoint } from './route.types';

export type RoutePlanWaypoint = { id: string; kind: 'ORIGIN' | 'REST_STOP' | 'DESTINATION'; label: string; latitude: number; longitude: number; note: string };
export type StoredRoute = Omit<RouteCandidate, 'verificationToken'>;
export type RoutePlan = { version: 1; waypoints: RoutePlanWaypoint[]; selectedRoute: StoredRoute | null };
const MAX_WAYPOINTS = 12;
const newId = () => `wp-${crypto.randomUUID()}`;
type SearchState = { loading: boolean; items?: AddressResult[]; error?: string };

export default function TripRoutePlanner({ tripId, originAddress, destinationAddress, initialPlan, initialRevision, readOnly = false, onDirtyChange, onSaved }:
  { tripId: string; originAddress: string; destinationAddress: string; initialPlan: RoutePlan | null; initialRevision: number; readOnly?: boolean; onDirtyChange: (dirty: boolean) => void; onSaved: (plan: RoutePlan, revision: number) => void }) {
  // Deliberately initialize once per TripWorkspace key; cache refetches must never replace a local draft.
  const [points, setPoints] = useState<RoutePlanWaypoint[]>(() => initialPlan?.waypoints ?? [
    { id: newId(), kind: 'ORIGIN', label: originAddress || 'Điểm gửi', latitude: NaN, longitude: NaN, note: '' },
    { id: newId(), kind: 'DESTINATION', label: destinationAddress || 'Điểm nhận', latitude: NaN, longitude: NaN, note: '' },
  ]);
  const [queries, setQueries] = useState<Record<string, string>>(() => Object.fromEntries(points.map(p => [p.id, p.label])));
  const [selected, setSelected] = useState<StoredRoute | null>(initialPlan?.selectedRoute ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<RouteCandidate[]>([]);
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [picking, setPicking] = useState<string>();
  const [routing, setRouting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(initialRevision);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const routeRequest = useRef<AbortController>();
  const searchRequests = useRef(new Map<string, AbortController>());
  const saveRequest = useRef<AbortController>();
  const mounted = useRef(false);
  const locked = readOnly || saving;
  const cannotEdit = () => readOnly || !!saveRequest.current;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      routeRequest.current?.abort();
      searchRequests.current.forEach(request => request.abort());
      saveRequest.current?.abort();
    };
  }, []);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  const mapPoints: Waypoint[] = points.map(p => ({
    id: p.id, label: p.label, kind: p.kind === 'ORIGIN' ? 'origin' : p.kind === 'DESTINATION' ? 'destination' : 'stop',
    position: Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? [p.latitude, p.longitude] : undefined,
  }));
  const allLocated = points.length >= 2 && mapPoints.every(p => p.position);
  const cancelSearch = (pointId: string) => {
    searchRequests.current.get(pointId)?.abort();
    searchRequests.current.delete(pointId);
    setSearches(value => { const next = { ...value }; delete next[pointId]; return next; });
  };
  const cancelRouting = () => {
    routeRequest.current?.abort(); routeRequest.current = undefined; setRouting(false);
  };
  const invalidateRoute = () => {
    cancelRouting(); setSelected(null); setSelectedId(null); setVerificationToken(null); setCandidates([]);
    setNotice('Các điểm đã thay đổi. Hãy tính và chọn lại tuyến.'); setError('');
  };
  const changePoint = (pointId: string, patch: Partial<RoutePlanWaypoint>, affectsRoute = true) => {
    if (cannotEdit()) return;
    setPoints(value => value.map(p => p.id === pointId ? { ...p, ...patch } : p));
    if (affectsRoute) invalidateRoute();
    setDirty(true);
  };
  const choosePosition = (pointId: string, position: LatLng, label?: string) => {
    if (cannotEdit() || !points.some(p => p.id === pointId)) return;
    cancelSearch(pointId);
    const point = points.find(p => p.id === pointId)!;
    changePoint(pointId, { latitude: position[0], longitude: position[1], ...(point.kind === 'REST_STOP' && label ? { label } : {}) });
    if (label) setQueries(value => ({ ...value, [pointId]: label }));
    setPicking(undefined);
  };
  const search = async (pointId: string) => {
    const query = queries[pointId]?.trim() ?? '';
    if (cannotEdit() || query.length < 3 || query.length > 200) return;
    cancelSearch(pointId);
    const request = new AbortController(); searchRequests.current.set(pointId, request);
    setSearches(value => ({ ...value, [pointId]: { loading: true } }));
    const current = () => mounted.current && searchRequests.current.get(pointId) === request && !request.signal.aborted;
    try {
      const { data } = await api.get<{ items: AddressResult[] }>('/maps/search', { params: { q: query }, signal: request.signal });
      if (current()) setSearches(value => ({ ...value, [pointId]: { loading: false, items: data.items } }));
    } catch (failure) {
      if (current()) setSearches(value => ({ ...value, [pointId]: { loading: false, error: errorMessage(failure) } }));
    } finally { if (current()) searchRequests.current.delete(pointId); }
  };
  const findRoutes = async () => {
    if (cannotEdit() || !allLocated) return;
    cancelRouting();
    const request = new AbortController(); routeRequest.current = request;
    setRouting(true); setError(''); setCandidates([]); setSelectedId(null);
    const current = () => mounted.current && routeRequest.current === request && !request.signal.aborted;
    try {
      const { data } = await api.post<{ routes: RouteCandidate[] }>(`/trips/${encodeURIComponent(tripId)}/route-preview`, { waypoints: points }, { signal: request.signal });
      if (current()) {
        setCandidates(data.routes);
        setNotice(selected ? 'Đang giữ tuyến hiện tại. Chọn một phương án mới nếu muốn thay thế.' : 'Chọn một phương án để xác nhận tuyến.');
      }
    } catch (failure) { if (current()) setError(errorMessage(failure)); }
    finally { if (current()) { routeRequest.current = undefined; setRouting(false); } }
  };
  const save = async () => {
    if (cannotEdit() || !dirty || !allLocated) return;
    const request = new AbortController(); saveRequest.current = request;
    cancelRouting(); searchRequests.current.forEach(r => r.abort()); searchRequests.current.clear(); setSearches({}); setPicking(undefined);
    setSaving(true); setError('');
    try {
      const routePlan: RoutePlan = { version: 1, waypoints: points, selectedRoute: selected };
      const { data } = await api.put<{ routePlan: RoutePlan; routePlanRevision: number }>(`/trips/${encodeURIComponent(tripId)}/route-plan`, { revision, routePlan, verificationToken }, { signal: request.signal });
      if (!mounted.current || request.signal.aborted) return;
      setPoints(data.routePlan.waypoints); setSelected(data.routePlan.selectedRoute); setRevision(data.routePlanRevision);
      setVerificationToken(null); setSelectedId(null); setCandidates([]); setDirty(false);
      onSaved(data.routePlan, data.routePlanRevision);
      setNotice('Đã lưu lộ trình. Hãy xác nhận và lưu lại thời gian dự kiến cho tuyến này.');
    } catch (failure) { if (mounted.current && !request.signal.aborted) setError(errorMessage(failure)); }
    finally { if (mounted.current) { saveRequest.current = undefined; setSaving(false); } }
  };
  const moveStop = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (cannotEdit() || target < 1 || target >= points.length - 1) return;
    setPoints(value => { const copy = [...value]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy; });
    invalidateRoute(); setDirty(true);
  };
  return <div className="osm-planner">
    {error && <Alert type="error" showIcon message={error} />}
    <div className="route-stage-heading">
      <span>1</span>
      <div><strong>Điểm hành trình</strong><small>Điểm gửi và điểm nhận lấy từ đơn hàng. Bạn có thể bổ sung điểm nghỉ ở giữa.</small></div>
    </div>
    <div className="waypoint-list">{points.map((point, index) => {
      const state = searches[point.id];
      const queryValid = (queries[point.id]?.trim().length ?? 0) >= 3 && (queries[point.id]?.trim().length ?? 0) <= 200;
      return <section className="waypoint-editor" data-kind={point.kind} key={point.id}>
        <div className="waypoint-heading"><strong>{index + 1}. {point.kind === 'ORIGIN' ? 'Điểm gửi' : point.kind === 'DESTINATION' ? 'Điểm nhận' : 'Điểm nghỉ'}</strong>
          {point.kind === 'REST_STOP' && <span className="waypoint-actions">
            <Button aria-label="Đưa điểm nghỉ lên" icon={<UpOutlined />} disabled={locked || index === 1} onClick={() => moveStop(index, -1)} />
            <Button aria-label="Đưa điểm nghỉ xuống" icon={<DownOutlined />} disabled={locked || index === points.length - 2} onClick={() => moveStop(index, 1)} />
            <Button danger aria-label="Xóa điểm nghỉ" icon={<DeleteOutlined />} disabled={locked} onClick={() => {
              if (cannotEdit()) return;
              cancelSearch(point.id); if (picking === point.id) setPicking(undefined);
              setPoints(value => value.filter(p => p.id !== point.id)); invalidateRoute(); setDirty(true);
            }} />
          </span>}
        </div>
        {point.kind !== 'REST_STOP' && <small>Địa chỉ gốc từ đơn: {point.kind === 'ORIGIN' ? originAddress : destinationAddress}</small>}
        <div className="waypoint-search">
          <Input aria-label={`Tìm ${point.kind}`} maxLength={200} disabled={locked} value={queries[point.id] ?? ''} onChange={event => {
            if (cannotEdit()) return; cancelSearch(point.id); setQueries(value => ({ ...value, [point.id]: event.target.value }));
          }} onPressEnter={() => void search(point.id)} />
          <Button disabled={locked || !queryValid} loading={state?.loading} onClick={() => void search(point.id)}>Tìm</Button>
          <Button disabled={locked} onClick={() => { cancelSearch(point.id); setPicking(point.id); }}>Chọn trên bản đồ</Button>
        </div>
        {state?.error && <Alert type="error" message={state.error} />}
        {state?.items?.length === 0 && <p role="status">Không tìm thấy địa chỉ phù hợp</p>}
        {!!state?.items?.length && <div className="address-results">{state.items.map(result => <button type="button" disabled={locked} key={result.id} onClick={() => choosePosition(point.id, [result.latitude, result.longitude], result.label)}>{result.label}</button>)}</div>}
        <small>{Number.isFinite(point.latitude) ? `Đã xác nhận: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'Chưa xác định vị trí'}</small>
        {point.kind === 'REST_STOP' && <Input.TextArea aria-label="Ghi chú điểm nghỉ" disabled={locked} maxLength={500} showCount value={point.note} placeholder="Ghi chú tùy chọn" onChange={event => changePoint(point.id, { note: event.target.value }, false)} />}
      </section>;
    })}</div>
    {!readOnly && <Button icon={<PlusOutlined />} disabled={locked || points.length >= MAX_WAYPOINTS} onClick={() => {
      if (cannotEdit()) return;
      const point: RoutePlanWaypoint = { id: newId(), kind: 'REST_STOP', label: 'Điểm nghỉ mới', latitude: NaN, longitude: NaN, note: '' };
      setPoints(value => [...value.slice(0, -1), point, value.at(-1)!]); setQueries(value => ({ ...value, [point.id]: '' })); invalidateRoute(); setDirty(true);
    }}>Thêm điểm nghỉ ({points.length}/{MAX_WAYPOINTS})</Button>}
    {picking && !locked && <Alert type="info" message="Nhấn trên bản đồ để xác nhận vị trí." action={<Button onClick={() => setPicking(undefined)}>Hủy</Button>} />}
    <div className="route-stage-heading route-map-heading">
      <span>2</span>
      <div><strong>Xác nhận trên bản đồ</strong><small>Chọn trực tiếp hoặc kéo marker để điều chỉnh vị trí từng điểm.</small></div>
    </div>
    <RouteMap waypoints={mapPoints} geometry={selected?.geometry} readOnly={locked} picking={!!picking && !locked} onPick={position => { if (picking) choosePosition(picking, position); }} onMove={choosePosition} />
    <p className="osm-source">Nền © OpenStreetMap · Tìm kiếm và tuyến © <a href="https://www.mapbox.com/about/maps/">Mapbox</a>. Thời gian lái xe chưa gồm thời gian nghỉ; chưa kiểm tra hạn chế xe chở ngựa.</p>
    {notice && <Alert type="info" message={notice} />}
    {selected && <div className="saved-route" role="status"><strong>{verificationToken ? 'Tuyến đã chọn — chưa lưu' : 'Tuyến đã lưu'}</strong><p>{(selected.distanceM / 1000).toFixed(1)} km · {Math.round(selected.durationS / 60)} phút lái xe, chưa gồm nghỉ.</p></div>}
    {!allLocated && <Alert type="info" message="Xác nhận tọa độ của tất cả điểm để tìm và lưu lộ trình." />}
    <div className="route-stage-heading route-selection-heading">
      <span>3</span>
      <div><strong>Tính, chọn và lưu tuyến</strong><small>Chọn một phương án phù hợp trước khi lưu lộ trình.</small></div>
    </div>
    <div className="osm-toolbar"><Button type="primary" disabled={locked || !allLocated} loading={routing} onClick={() => void findRoutes()}>Tìm tuyến đường</Button>{!readOnly && <Button icon={<SaveOutlined />} disabled={locked || !dirty || !allLocated} loading={saving} onClick={() => void save()}>Lưu lộ trình</Button>}</div>
    <div className="osm-route-options">{candidates.map((route, index) => <label key={route.verificationToken} className={selectedId === route.verificationToken ? 'is-selected' : ''}>
      <input type="radio" disabled={locked} name={`route-${tripId}`} checked={selectedId === route.verificationToken} onChange={() => {
        if (cannotEdit()) return;
        const { verificationToken: token, ...stored } = route;
        setSelected(stored); setSelectedId(token); setVerificationToken(token); setDirty(true); setNotice(''); setError('');
      }} /><span><strong>Tuyến {index + 1} · {(route.distanceM / 1000).toFixed(1)} km</strong><small>Khoảng {Math.round(route.durationS / 60)} phút lái xe, chưa tính nghỉ.</small></span>
    </label>)}</div>
  </div>;
}
