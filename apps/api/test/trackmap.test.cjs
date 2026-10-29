// Bản đồ chuyến + GPS (kế hoạch Bước 4 + 6): hình học, cache tuyến Mapbox (fetch giả, không gọi mạng), dựng /map, nhận vị trí.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Role, OrderStatus, LegStatus } = require('@my-project/shared');
const geo = require('../src/features/tracking/trackmap.geo');
const { RoutesProvider, limitRoutePoints, MAX_POINTS } = require('../src/features/tracking/trackmap.routes-provider');
const { RouteCacheFull1800000010000 } = require('../src/database/migrations/1800000010000-RouteCacheFull');
const { buildTripMap } = require('../src/features/tracking/trackmap.build');
const { TrackingService } = require('../src/features/tracking/tracking.service');

delete process.env.MAPBOX_ACCESS_TOKEN; // không bao giờ gọi Mapbox thật trong test

const CU_CHI = [106.4933, 10.9733];
const MOC_BAI = [106.158, 11.076];
const TSN = [106.652, 10.8188];
const CHANGI = [103.9915, 1.3644];
const now = Date.now();
const at = minutes => new Date(now + minutes * 60_000);

test('geo: haversine, polyline length, point along, projection and great circle', () => {
  assert.ok(Math.abs(geo.haversineKm(TSN, CHANGI) - 1090) < 15, 'TSN → Changi ~1090 km');
  assert.equal(geo.haversineKm(CU_CHI, CU_CHI), 0);
  const line = [[0, 0], [0, 1], [1, 1]];
  assert.ok(Math.abs(geo.lineLengthKm(line) - 2 * 111.19) < 1);
  assert.deepEqual(geo.pointAlong(line, 0), [0, 0]);
  assert.deepEqual(geo.pointAlong(line, 1), [1, 1]);
  assert.deepEqual(geo.pointAlong(line, 2), [1, 1], 'fraction is clamped');
  const mid = geo.pointAlong(line, 0.5);
  assert.ok(Math.abs(mid[0]) < 1e-9 && Math.abs(mid[1] - 1) < 1e-3, 'half way is (almost) the corner: 1° of longitude at 1°N is slightly shorter');
  const projected = geo.projectOnLine(line, [0.02, 0.5]);
  assert.ok(Math.abs(projected.fraction - 0.25) < 0.01);
  assert.ok(projected.offsetKm > 2 && projected.offsetKm < 2.5);
  const arc = geo.greatCircle(TSN, CHANGI, 16);
  assert.equal(arc.length, 17);
  assert.deepEqual(arc[0].map(n => +n.toFixed(4)), TSN);
  assert.deepEqual(arc[16].map(n => +n.toFixed(4)), CHANGI);
  // Qua kinh tuyến 180: kinh độ liên tục, không nhảy 360 độ.
  const pacific = geo.greatCircle([151.17, -33.94], [-118.41, 33.94], 32);
  for (let i = 1; i < pacific.length; i++) assert.ok(Math.abs(pacific[i][0] - pacific[i - 1][0]) < 180);
  assert.equal(geo.modeForVehicle('HEAVY'), 'ROAD');
  assert.equal(geo.modeForVehicle('LIGHT'), 'ROAD');
  assert.equal(geo.modeForVehicle(null), 'ROAD');
});

function memoryStore(rows = []) {
  const calls = { saved: [], deleted: [] };
  return {
    calls,
    async findRoutes(fromId, toId) { return rows.filter(r => r.fromId === fromId && r.toId === toId); },
    async saveRoute(fromId, toId, route) { calls.saved.push({ fromId, toId, ...route }); rows.push({ fromId, toId, ...route, fetchedAt: new Date() }); },
    async deleteRoute(fromId, toId, mode) { calls.deleted.push({ fromId, toId, mode }); },
  };
}
const directions = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('routes provider: no token → STRAIGHT without fetch and without caching', async () => {
  const store = memoryStore();
  let fetched = 0;
  const provider = new RoutesProvider(store, { token: () => '', fetch: async () => { fetched++; } });
  const route = await provider.route('1', '2', CU_CHI, MOC_BAI, 'ROAD');
  assert.equal(route.mode, 'STRAIGHT');
  assert.deepEqual(route.coordinates, [CU_CHI, MOC_BAI]);
  assert.equal(fetched, 0);
  assert.equal(store.calls.saved.length, 0, 'a missing token is not remembered');
});

test('routes provider: Mapbox route is cached; concurrent and later views do not call Directions again', async () => {
  const store = memoryStore();
  let fetched = 0;
  let url = '';
  const provider = new RoutesProvider(store, {
    token: () => 'pk.test',
    fetch: async (requestUrl, init) => {
      fetched++; url = requestUrl;
      assert.ok(init.signal, 'request has a timeout signal');
      return { ok: true, status: 200, json: async () => ({ code: 'Ok', routes: [{ geometry: { coordinates: [CU_CHI, [106.35, 11.02], MOC_BAI] }, distance: 45210.4, duration: 3600 }] }) };
    },
  });
  const [a, b] = await Promise.all([provider.route('1', '2', CU_CHI, MOC_BAI, 'ROAD'), provider.route('1', '2', CU_CHI, MOC_BAI, 'ROAD')]);
  assert.equal(fetched, 1, 'one Directions call for concurrent viewers');
  assert.equal(a.mode, 'ROAD');
  assert.equal(b.coordinates.length, 3);
  assert.equal(a.distanceKm, 45.21);
  assert.match(url, /\/driving\/106\.4933,10\.9733;106\.158,11\.076\?geometries=geojson&overview=full&access_token=pk\.test$/);
  assert.deepEqual(store.calls.saved.map(r => [r.mode, r.distanceM, r.durationS]), [['ROAD', 45210, 3600]]);
  assert.deepEqual(store.calls.deleted, [{ fromId: '1', toId: '2', mode: 'STRAIGHT' }], 'an older "no road" entry is dropped');
  const again = await provider.route('1', '2', CU_CHI, MOC_BAI, 'ROAD');
  assert.equal(fetched, 1, 'served from cache');
  assert.equal(again.distanceKm, 45.21);
});

test('routes provider: NoRoute is remembered as STRAIGHT; timeouts and HTTP errors fall back without caching', async () => {
  const noRoute = memoryStore();
  const provider = new RoutesProvider(noRoute, { token: () => 'pk.test', fetch: directions(200, { code: 'NoRoute', routes: [] }) });
  assert.equal((await provider.route('1', '7', TSN, CHANGI, 'ROAD')).mode, 'STRAIGHT');
  assert.deepEqual(noRoute.calls.saved.map(r => r.mode), ['STRAIGHT']);
  let calls = 0;
  const cachedNoRoute = new RoutesProvider(noRoute, { token: () => 'pk.test', fetch: async () => { calls++; } });
  assert.equal((await cachedNoRoute.route('1', '7', TSN, CHANGI, 'ROAD')).mode, 'STRAIGHT');
  assert.equal(calls, 0, 'cached STRAIGHT is not retried on every view');

  const timeoutStore = memoryStore();
  const slow = new RoutesProvider(timeoutStore, {
    token: () => 'pk.test', timeoutMs: 20,
    fetch: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
  });
  const timedOut = await slow.route('1', '2', CU_CHI, MOC_BAI, 'ROAD');
  assert.equal(timedOut.mode, 'STRAIGHT');
  assert.equal(timeoutStore.calls.saved.length, 0, 'transient failure is retried next time');

  const errorStore = memoryStore();
  const failing = new RoutesProvider(errorStore, { token: () => 'pk.test', fetch: directions(401, { message: 'Not Authorized - Invalid Token' }) });
  assert.equal((await failing.route('1', '2', CU_CHI, MOC_BAI, 'ROAD')).mode, 'STRAIGHT');
  assert.equal(errorStore.calls.saved.length, 0);

  const brokenStore = { async findRoutes() { throw new Error('db down'); }, async saveRoute() { throw new Error('db down'); }, async deleteRoute() {} };
  const resilient = new RoutesProvider(brokenStore, { token: () => 'pk.test', fetch: directions(200, { code: 'Ok', routes: [{ geometry: { coordinates: [CU_CHI, MOC_BAI] }, distance: 40000 }] }) });
  assert.equal((await resilient.route('1', '2', CU_CHI, MOC_BAI, 'ROAD')).mode, 'ROAD', 'cache errors never break the map');
});

test('routes provider: expired cache is refreshed; air legs use a great circle without Mapbox', async () => {
  const store = memoryStore([{ fromId: '1', toId: '2', mode: 'ROAD', coordinates: [CU_CHI, MOC_BAI], distanceM: 1000, fetchedAt: new Date(now - 31 * 86_400_000) }]);
  let fetched = 0;
  const provider = new RoutesProvider(store, { token: () => 'pk.test', fetch: async (...args) => { fetched++; return directions(200, { code: 'Ok', routes: [{ geometry: { coordinates: [CU_CHI, MOC_BAI] }, distance: 41000 }] })(...args); } });
  assert.equal((await provider.route('1', '2', CU_CHI, MOC_BAI, 'ROAD')).distanceKm, 41);
  assert.equal(fetched, 1, 'older than 30 days → refetched');
  const air = await provider.route('1', '7', TSN, CHANGI, 'AIR');
  assert.equal(air.mode, 'AIR');
  assert.ok(air.coordinates.length > 10);
  assert.equal(fetched, 1, 'air legs never call Directions');
});

const legRow = (overrides = {}) => ({
  id: '10', seqNo: 1, status: LegStatus.NOT_STARTED,
  plannedDepartureAt: at(-60), plannedArrivalAt: at(60), actualDepartureAt: null, actualArrivalAt: null,
  fromId: '1', fromName: 'Củ Chi', fromType: 'QUARANTINE_STATION', fromLat: '10.973300', fromLng: '106.493300',
  toId: '2', toName: 'Mộc Bài', toType: 'BORDER', toLat: '11.076000', toLng: '106.158000', vehicleType: 'MEDIUM',
  ...overrides,
});
const straightRoute = leg => {
  const from = [Number(leg.fromLng), Number(leg.fromLat)];
  const to = [Number(leg.toLng), Number(leg.toLat)];
  return { mode: 'STRAIGHT', coordinates: [from, to], distanceKm: geo.haversineKm(from, to) };
};
const build = (legs, extra = {}) => buildTripMap({
  trip: { id: '100', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, ...extra.trip },
  legs, routes: new Map(legs.map(l => [l.id, l.fromLat === null || l.toLat === null ? null : straightRoute(l)])),
  latest: extra.latest, speedLimitKmh: extra.speedLimitKmh ?? 80, now,
});

test('map: estimated position by leg status, km totals and labels', () => {
  const legKm = geo.roundKm(geo.haversineKm(CU_CHI, MOC_BAI));
  const ready = build([legRow()], { trip: { orderStatus: OrderStatus.READY } });
  assert.equal(ready.position.source, 'ESTIMATED');
  assert.deepEqual([ready.position.lng, ready.position.lat], CU_CHI, 'not departed → at the origin');
  assert.match(ready.position.label, /^Ước tính theo kế hoạch, không phải GPS: chưa xuất phát/);
  assert.equal(ready.totalKm, legKm);
  assert.equal(ready.remainingKm, legKm);
  assert.equal(ready.speedLimitKmh, 80);
  assert.deepEqual(ready.stops.map(s => s.name), ['Củ Chi', 'Mộc Bài']);
  assert.equal(ready.legs[0].mode, 'STRAIGHT');
  assert.match(ready.warnings.join('|'), /Chặng 1: chưa có tuyến đường bộ/);

  // MOVING: half of the planned 2 hours elapsed → half way.
  const moving = build([legRow({ status: LegStatus.MOVING, actualDepartureAt: at(-60) })]);
  assert.ok(Math.abs(moving.remainingKm - legKm / 2) < 0.2);
  assert.match(moving.position.label, /đang trên đường từ Củ Chi đến Mộc Bài/);
  // Long overdue: clamped to 95%, never "arrived" without the milestone.
  const late = build([legRow({ status: LegStatus.MOVING, plannedDepartureAt: at(-600), actualDepartureAt: at(-600), plannedArrivalAt: at(-300) })]);
  assert.ok(Math.abs(late.remainingKm - legKm * 0.05) < 0.2);
  assert.equal(late.legs[0].isOverdue, true);
  const stopped = build([legRow({ status: LegStatus.AT_STOP })]);
  assert.deepEqual([stopped.position.lng, stopped.position.lat], MOC_BAI);
  assert.equal(stopped.remainingKm, 0);
  const delivered = build([legRow({ status: LegStatus.COMPLETED })], { trip: { orderStatus: OrderStatus.DELIVERED } });
  assert.equal(delivered.remainingKm, 0);
  assert.match(delivered.position.label, /đã giao tại Mộc Bài/);
});

test('map: GPS beats the estimate while fresh; STALE is labelled; OLD points fall back to the estimate', () => {
  const legs = [legRow({ status: LegStatus.MOVING, actualDepartureAt: at(-60) })];
  const point = { legId: '10', latitude: '11.020000', longitude: '106.350000', accuracyM: 12, speedMps: '17.80', headingDeg: 310, recordedAt: at(-1) };
  const live = build(legs, { latest: point });
  assert.equal(live.position.source, 'GPS');
  assert.equal(live.position.label, null);
  assert.deepEqual(live.latestPosition, { lat: 11.02, lng: 106.35, speedKmh: 64.1, accuracyM: 12, headingDeg: 310, recordedAt: point.recordedAt.toISOString(), legId: '10', freshness: 'LIVE' });
  assert.ok(live.remainingKm > 0 && live.remainingKm < live.totalKm);
  const stale = build(legs, { latest: { ...point, recordedAt: at(-5) } });
  assert.equal(stale.position.source, 'GPS');
  assert.match(stale.position.label, /Mất tín hiệu GPS/);
  const old = build(legs, { latest: { ...point, recordedAt: at(-30) } });
  assert.equal(old.position.source, 'ESTIMATED');
  assert.equal(old.latestPosition.freshness, 'OLD', 'the raw point is still reported');
  const heavy = build([legRow({ status: LegStatus.MOVING, actualDepartureAt: at(-60), vehicleType: 'HEAVY' })], { latest: point });
  assert.equal(heavy.position.source, 'GPS', 'all catalog vehicle types are road vehicles');
});

test('map: milestone newer than the last GPS point wins; newer GPS wins; no GPS uses the milestone', () => {
  const legKm = geo.roundKm(geo.haversineKm(CU_CHI, MOC_BAI));
  const gps = (minutes, speedMps = '16') => ({ legId: '10', latitude: '11.020000', longitude: '106.350000', accuracyM: 5, speedMps, headingDeg: null, recordedAt: at(minutes) });
  const stopped = { status: LegStatus.AT_STOP, actualDepartureAt: at(-60), actualArrivalAt: at(-3) };

  // 1. GPS mới hơn mốc đến (xe đã dừng nhưng vẫn gửi GPS): dùng GPS và tốc độ như cũ.
  const gpsNewer = build([legRow(stopped)], { latest: gps(-1) });
  assert.equal(gpsNewer.position.source, 'GPS');
  assert.equal(gpsNewer.latestPosition.speedKmh, 57.6);
  assert.ok(gpsNewer.remainingKm > 0 && gpsNewer.remainingKm < legKm);

  // 2. Mốc đến mới hơn điểm GPS cuối: vị trí = điểm dừng, còn 0 km, không trả tốc độ cũ.
  const milestoneNewer = build([legRow(stopped)], { latest: gps(-10) });
  assert.equal(milestoneNewer.position.source, 'ESTIMATED');
  assert.deepEqual([milestoneNewer.position.lng, milestoneNewer.position.lat], MOC_BAI);
  assert.match(milestoneNewer.position.label, /đã đến Mộc Bài lúc \d{2}:\d{2}$/);
  assert.equal(milestoneNewer.remainingKm, 0);
  assert.equal(milestoneNewer.latestPosition.speedKmh, null, 'tốc độ của điểm GPS cũ hơn mốc bị bỏ');
  assert.equal(milestoneNewer.latestPosition.lat, 11.02, 'điểm GPS thô vẫn được trả');

  // 3. Không có GPS: vị trí theo mốc.
  const noGps = build([legRow(stopped)]);
  assert.deepEqual([noGps.position.lng, noGps.position.lat], MOC_BAI);
  assert.equal(noGps.remainingKm, 0);
  assert.equal(noGps.latestPosition, null);

  // Nhiều chặng: dừng ở cuối chặng 2, km còn lại = chặng 3 (không còn dựa GPS cũ cách điểm dừng hàng chục km).
  const second = legRow({ id: '11', seqNo: 2, fromId: '2', fromName: 'Mộc Bài', toId: '3', toName: 'Phnom Penh', toLat: '11.560000', toLng: '104.920000', status: LegStatus.NOT_STARTED });
  const two = build([legRow({ status: LegStatus.COMPLETED, actualDepartureAt: at(-120), actualArrivalAt: at(-90) }), { ...second, status: LegStatus.AT_STOP, actualDepartureAt: at(-80), actualArrivalAt: at(-2), plannedDepartureAt: at(-80), plannedArrivalAt: at(0) }, legRow({ id: '12', seqNo: 3, fromId: '3', fromName: 'Phnom Penh', toId: '4', toName: 'Đích', fromLat: '11.560000', fromLng: '104.920000', toLat: '10.600000', toLng: '103.500000' })], { latest: gps(-20) });
  assert.equal(two.position.legId, '11');
  assert.equal(two.remainingKm, two.legs[2].distanceKm);
});

test('map: missing coordinates produce warnings and null km, never an error', () => {
  const map = build([legRow({ toLat: null, toLng: null })]);
  assert.deepEqual(map.stops[1], { locationId: '2', name: 'Mộc Bài', locationType: 'BORDER', lat: null, lng: null });
  assert.equal(map.legs[0].coordinates, null);
  assert.equal(map.totalKm, null);
  assert.equal(map.remainingKm, null);
  assert.equal(map.position, null);
  assert.ok(map.warnings.includes('Chưa có tọa độ cho Mộc Bài'));
  assert.equal(build([]).position, null);
});

function mapRepo(overrides = {}, calls = {}) {
  return {
    findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'WDP-1', orderStatus: OrderStatus.IN_TRANSIT, plannedBy: '3', customerId: '1' }),
    getDriverAssignment: async (_trip, user) => (user === '6' ? { role: 'DRIVER' } : user === '8' ? { role: 'ESCORT' } : undefined),
    getTripMapLegs: async () => [legRow({ status: LegStatus.MOVING, actualDepartureAt: at(-60) })],
    getLatestPosition: async () => ({ legId: '10', latitude: '11.02', longitude: '106.35', accuracyM: 5, speedMps: '10', headingDeg: null, recordedAt: at(-1) }),
    getSpeedLimitKmh: async () => 80,
    findRoutes: async () => [], saveRoute: async () => {}, deleteRoute: async () => {},
    insertPositions: async (tripId, legId, userId, points) => { calls.inserted = { tripId, legId, userId, points }; return calls.accept ?? points.length; },
    getTrackPoints: async (tripId, since, limit) => { calls.track = { tripId, since, limit }; return [{ legId: '10', latitude: '11.02', longitude: '106.35', accuracyM: null, speedMps: null, headingDeg: null, recordedAt: at(-1) }]; },
    deletePositionsOlderThan: async (days, batch) => { (calls.purges ||= []).push({ days, batch }); return (calls.purges.length === 1 ? batch : 3); },
    ...overrides,
  };
}
const driver = { id: '6', role: Role.DRIVER_ESCORT };

test('GET map: scope like trip detail; Specialist sees GPS (decision #4); customers are rejected', async () => {
  const service = new TrackingService(mapRepo());
  const map = await service.getTripMap(driver, '100');
  assert.equal(map.position.source, 'GPS');
  assert.equal(map.speedLimitKmh, 80);
  assert.equal((await service.getTripMap({ id: '7', role: Role.SPECIALIST }, '100')).position.source, 'GPS');
  assert.equal((await service.getTripMap({ id: '2', role: Role.MANAGER }, '100')).legs.length, 1);
  await assert.rejects(() => service.getTripMap({ id: '9', role: Role.DRIVER_ESCORT }, '100'), e => e.getStatus() === 404);
  await assert.rejects(() => service.getTripMap({ id: '4', role: Role.COORDINATOR }, '100'), e => e.getStatus() === 404);
  await assert.rejects(() => service.getTripMap({ id: '1', role: Role.CUSTOMER }, '100'), e => e.getStatus() === 403);
  await assert.rejects(() => service.getTripMap(driver, 'abc'), e => e.getStatus() === 400);
});

test('POST positions: validation, assignment, IN_TRANSIT, running non-air leg; duplicates are counted not rejected', async () => {
  const point = (minutes = -1, extra = {}) => ({ latitude: 11.02, longitude: 106.35, recordedAt: at(minutes).toISOString(), ...extra });
  const calls = {};
  const service = new TrackingService(mapRepo({}, calls));
  const result = await service.recordPositions(driver, '100', { points: [point(-2, { speedMps: 17.8, accuracyM: 12, headingDeg: 310 }), point(-1)] });
  assert.deepEqual(result, { legId: '10', accepted: 2, duplicates: 0 });
  assert.equal(calls.inserted.userId, '6');
  assert.equal(calls.inserted.legId, '10');
  assert.equal(calls.inserted.points[0].speedMps, 17.8);
  assert.ok(calls.inserted.points[1].recordedAt instanceof Date);

  const resend = {};
  const again = await new TrackingService(mapRepo({}, Object.assign(resend, { accept: 0 }))).recordPositions(driver, '100', { points: [point(-2), point(-1)] });
  assert.deepEqual(again, { legId: '10', accepted: 0, duplicates: 2 });

  const bad = body => assert.rejects(() => service.recordPositions(driver, '100', body), e => e.getStatus() === 400);
  await bad({ points: [] });
  await bad({ points: Array.from({ length: 21 }, (_, i) => point(-i - 1)) });
  await bad({ points: [point(-1, { latitude: 91 })] });
  await bad({ points: [point(-1, { longitude: -181 })] });
  await bad({ points: [{ latitude: 0, longitude: 0, recordedAt: at(-1).toISOString() }] });
  await bad({ points: [point(5)] }); // tương lai
  await bad({ points: [point(-25 * 60)] }); // cũ hơn 24 giờ
  await bad({ points: [point(-1, { speedMps: -1 })] });
  await bad({ points: [point(-1, { extra: 1 })] });
  await bad({ points: [{ latitude: '11', longitude: 106.35, recordedAt: at(-1).toISOString() }] });

  await assert.rejects(() => service.recordPositions({ id: '3', role: Role.COORDINATOR }, '100', { points: [point()] }), e => e.getStatus() === 403);
  await assert.rejects(() => service.recordPositions({ id: '8', role: Role.DRIVER_ESCORT }, '100', { points: [point()] }), e => e.getStatus() === 403 && /Chỉ tài xế của chuyến/.test(e.message), 'ESCORT không gửi GPS');
  await assert.rejects(() => service.recordPositions({ id: '9', role: Role.DRIVER_ESCORT }, '100', { points: [point()] }), e => e.getStatus() === 404);
  const conflict = repo => assert.rejects(() => new TrackingService(mapRepo(repo)).recordPositions(driver, '100', { points: [point()] }), e => e.getStatus() === 409);
  await conflict({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'W', orderStatus: OrderStatus.READY, plannedBy: '3' }) });
  await conflict({ findTrip: async () => ({ id: '100', orderId: '50', orderCode: 'W', orderStatus: OrderStatus.DELIVERED, plannedBy: '3' }) });
  await conflict({ getTripMapLegs: async () => [legRow({ status: LegStatus.COMPLETED }), legRow({ id: '11', seqNo: 2 })] });
  await new TrackingService(mapRepo({ getTripMapLegs: async () => [legRow({ status: LegStatus.MOVING, vehicleType: 'HEAVY' })] })).recordPositions(driver, '100', { points: [point()] });
});

test('GET positions: same scope as the map, since filter, at most 500 points', async () => {
  const calls = {};
  const service = new TrackingService(mapRepo({}, calls));
  const points = await service.getTrackPoints({ id: '7', role: Role.SPECIALIST }, '100', { since: at(-10).toISOString() });
  assert.deepEqual(points, [{ lat: 11.02, lng: 106.35, speedKmh: null, recordedAt: points[0].recordedAt, legId: '10' }]);
  assert.equal(calls.track.limit, 500);
  assert.ok(calls.track.since instanceof Date);
  await service.getTrackPoints(driver, '100', {});
  assert.equal(calls.track.since, null);
  await assert.rejects(() => service.getTrackPoints(driver, '100', { since: 'yesterday' }), e => e.getStatus() === 400);
  await assert.rejects(() => service.getTrackPoints({ id: '1', role: Role.CUSTOMER }, '100', {}), e => e.getStatus() === 403);
});

test('position retention: deletes in batches older than TRACK_POSITION_RETENTION_DAYS; start/stop do not overlap', async () => {
  const previous = process.env.TRACK_POSITION_RETENTION_DAYS;
  process.env.TRACK_POSITION_RETENTION_DAYS = '7';
  try {
    const calls = {};
    const service = new TrackingService(mapRepo({}, calls));
    const removed = await service.purgeOldPositions();
    assert.equal(removed, 5003, 'keeps deleting while a full batch comes back');
    assert.deepEqual(calls.purges, [{ days: 7, batch: 5000 }, { days: 7, batch: 5000 }]);
    process.env.TRACK_POSITION_RETENTION_DAYS = 'abc';
    const fallback = {};
    await new TrackingService(mapRepo({}, fallback)).purgeOldPositions();
    assert.equal(fallback.purges[0].days, 30, 'invalid value → default 30 days');

    let release;
    let runs = 0;
    const slow = new TrackingService(mapRepo({ deletePositionsOlderThan: () => { runs++; return new Promise(resolve => { release = () => resolve(0); }); } }));
    slow.startPositionRetentionJob();
    slow.startPositionRetentionJob();
    assert.equal(slow.purgeOldPositions(), slow.purgeOldPositions(), 'one run at a time');
    let stopped = false;
    const stopping = slow.stopPositionRetentionJob().then(() => { stopped = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(stopped, false, 'stop waits for the running delete');
    release();
    await stopping;
    assert.equal(runs, 1);
  } finally {
    if (previous === undefined) delete process.env.TRACK_POSITION_RETENTION_DAYS; else process.env.TRACK_POSITION_RETENTION_DAYS = previous;
  }
});

// Đường cong 1 km: các điểm cách nhau ~1 m, cong nhẹ; thêm "nhiễu" vài cm như dữ liệu GPS thật.
const curve = count => Array.from({ length: count }, (_, i) => {
  const t = i / (count - 1);
  return [106.5 + t * 0.01, 10.9 + 0.003 * Math.sin(t * Math.PI * 2) + (i % 2 ? 2e-7 : 0)];
});

test('Douglas-Peucker: keeps both ends and the shape within tolerance, drops redundant points', () => {
  const line = curve(5000);
  const simplified = geo.simplifyLine(line, 8);
  assert.deepEqual(simplified[0], line[0]);
  assert.deepEqual(simplified.at(-1), line.at(-1));
  assert.ok(simplified.length < 200, 'a smooth 1 km curve needs very few points: ' + simplified.length);
  // Mọi điểm gốc nằm cách tuyến đã giản lược không quá dung sai (cộng sai số làm tròn của phép chiếu phẳng).
  const worst = Math.max(...line.map(p => geo.projectOnLine(simplified, p).offsetKm * 1000));
  assert.ok(worst <= 8.5, 'max deviation ' + worst.toFixed(2) + ' m');
  const sharp = [[0, 0], [0.001, 0], [0.001, 0.001], [0.002, 0.001]];
  assert.deepEqual(geo.simplifyLine(sharp, 8), sharp, 'real corners are kept');
  assert.deepEqual(geo.simplifyLine([[0, 0], [0.5, 0.0000001], [1, 0]], 8), [[0, 0], [1, 0]], 'collinear middle point is dropped');
  assert.equal(geo.simplifyLine([[0, 0], [1, 1]], 8).length, 2);
  const huge = curve(60_000);
  assert.ok(geo.simplifyLine(huge, 8).length > 0, 'tens of thousands of points do not overflow the stack');
});

test('routes provider: overview=full, routes over 2000 points are simplified, small routes are stored untouched', async () => {
  const requested = [];
  const small = curve(1500);
  const smallStore = memoryStore();
  const keep = await new RoutesProvider(smallStore, { token: () => 'pk.test', fetch: async url => { requested.push(url); return directions(200, { code: 'Ok', routes: [{ geometry: { coordinates: small }, distance: 1200 }] })(); } })
    .route('1', '2', small[0], small.at(-1), 'ROAD');
  assert.equal(keep.coordinates.length, 1500, '≤ 2000 points: kept as Mapbox returned them');
  assert.equal(smallStore.calls.saved[0].coordinates.length, 1500);
  const many = curve(30_000);
  const store = memoryStore();
  const route = await new RoutesProvider(store, { token: () => 'pk.test', fetch: async url => { requested.push(url); return directions(200, { code: 'Ok', routes: [{ geometry: { coordinates: many }, distance: 1200 }] })(); } })
    .route('1', '2', many[0], many.at(-1), 'ROAD');
  assert.ok(route.coordinates.length <= MAX_POINTS, 'simplified to ' + route.coordinates.length);
  assert.deepEqual(route.coordinates[0], many[0]);
  assert.deepEqual(route.coordinates.at(-1), many.at(-1));
  assert.equal(store.calls.saved[0].coordinates.length, route.coordinates.length, 'the simplified line is what gets cached');
  assert.equal(route.distanceKm, 1.2, 'distance comes from Mapbox, not from the simplified line');
  assert.ok(requested.length === 2 && requested.every(url => url.includes('overview=full') && !url.includes('overview=simplified')));
  // Chặng dài hàng nghìn km nhiều khúc cua: nếu lượt 8 m vẫn còn trên 4.000 điểm thì có thêm lượt 25 m (nhẹ hơn, vẫn giữ hai đầu).
  const long = Array.from({ length: 40_000 }, (_, i) => [100 + i * 0.0006, 10 + Math.sin(i / 40) * 0.2]);
  const fine = geo.simplifyLine(long, 8);
  assert.ok(fine.length > 4_000, 'precondition: the 8 m pass alone is still heavy (' + fine.length + ')');
  const coarse = limitRoutePoints(long);
  assert.ok(coarse.length < fine.length, 'second pass lightens it: ' + coarse.length + ' < ' + fine.length);
  assert.deepEqual([coarse[0], coarse.at(-1)], [long[0], long.at(-1)]);
});

test('migration 1800000010000 drops only the ROAD (simplified) cache rows', async () => {
  const queries = [];
  await new RouteCacheFull1800000010000().up({ query: async sql => { queries.push(sql); } });
  assert.deepEqual(queries, ["DELETE FROM location_routes WHERE mode = 'ROAD'"]);
  await new RouteCacheFull1800000010000().down(); // không có gì để khôi phục, không được lỗi
});

test('map mode: LIGHT/MEDIUM/HEAVY routes are always ROAD or STRAIGHT (never AIR)', async () => {
  const trucks = [legRow({ id: '10', status: LegStatus.MOVING, actualDepartureAt: at(-30) }), legRow({ id: '11', seqNo: 2, fromId: '2', fromName: 'Mộc Bài', toId: '3', toName: 'Sân bay', toLat: '1.364400', toLng: '103.991500' })];
  const modes = async legs => (await new TrackingService(mapRepo({ getTripMapLegs: async () => legs })).getTripMap(driver, '100')).legs.map(leg => leg.mode);
  assert.deepEqual(await modes(trucks), ['STRAIGHT', 'STRAIGHT']);
  assert.deepEqual(await modes([...trucks, legRow({ id: '12', seqNo: 3, vehicleType: 'LIGHT' })]), ['STRAIGHT', 'STRAIGHT', 'STRAIGHT']);
  assert.deepEqual(await modes([trucks[0], legRow({ id: '11', seqNo: 2, vehicleType: 'HEAVY' })]), ['STRAIGHT', 'STRAIGHT']);
});
