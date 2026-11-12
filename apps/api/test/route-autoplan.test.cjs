const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const {
  DEFAULT_AUTOPLAN_PARAMS: P, autoplanParams, routeTimeline, placeRestStops, computeSchedule, longestContinuousDrive, customerDeparture, distanceM,
} = require('../src/features/trips/route-autoplan');
const { routeWaypointsSchema } = require('../src/features/trips/trip-route-plan');

process.env.JWT_SECRET ||= 'route-autoplan-test-secret-with-at-least-thirty-two-chars';

/** Tuyến thẳng theo kinh tuyến, mỗi tọa độ cách nhau ~1,1 km; `hours` giờ OSRM (xe con). */
function straightRoute(hours, start = [106, 10]) {
  const coords = [];
  for (let i = 0; i <= 400; i++) coords.push([start[0], start[1] + i * 0.01]);
  const length = distanceM(coords[0], coords.at(-1));
  return { coords, legs: [{ distanceM: length, durationS: hours * 3600 }] };
}
const truckMinutes = hours => hours * 60 * P.truckFactor;

test('tham số đọc từ system_parameters, giá trị vô lý giữ mặc định', () => {
  assert.deepEqual(autoplanParams([]), P);
  const custom = autoplanParams([{ code: 'REST_TGT', value: '200' }, { code: 'TRUCK_FACT', value: '1.4' }, { code: 'ETA_BUFFER', value: 'abc' }]);
  assert.equal(custom.restTargetMin, 200); assert.equal(custom.truckFactor, 1.4); assert.equal(custom.etaBufferMin, 60);
  // Mốc nhắm nằm ngoài [sớm nhất, trễ nhất] thì cả bộ mốc nghỉ quay về mặc định.
  const broken = autoplanParams([{ code: 'REST_TGT', value: '300' }]);
  assert.equal(broken.restTargetMin, 210); assert.equal(broken.restLatestMin, 240);
});

test('tuyến ngắn không cần điểm nghỉ', () => {
  const { coords, legs } = straightRoute(2);
  const times = routeTimeline(coords, legs, P.truckFactor);
  assert.equal(Math.round(times.at(-1)), truckMinutes(2));
  assert.deepEqual(placeRestStops(coords, times, [], [], P), []);
});

test('tuyến 8 giờ: nghỉ sau khoảng 3h30, không đoạn nào quá 4 giờ', () => {
  const { coords, legs } = straightRoute(8); // 600 phút xe tải
  const times = routeTimeline(coords, legs, P.truckFactor);
  const rests = placeRestStops(coords, times, [], [], P);
  assert.equal(rests.length, 2);
  assert.ok(Math.abs(rests[0].atMin - 210) < 3, `điểm nghỉ đầu ở ${rests[0].atMin}`);
  const marks = [0, ...rests.map(r => r.atMin), times.at(-1)];
  for (let i = 1; i < marks.length; i++) assert.ok(marks[i] - marks[i - 1] <= P.restLatestMin + 1);
  assert.equal(rests[0].catalogId, null);
  assert.match(rests[0].label, /Điểm nghỉ sau 3 giờ 30 phút lái xe/);
});

test('ưu tiên trạm trong danh mục gần tuyến, bỏ qua trạm xa hơn 3 km', () => {
  const { coords, legs } = straightRoute(6);
  const times = routeTimeline(coords, legs, P.truckFactor);
  const at = minutes => coords[times.findIndex(t => t >= minutes)];
  const near = at(190), far = at(205);
  const catalog = [
    { id: '7', name: 'Trạm dừng nghỉ Km 190', latitude: near[1], longitude: near[0] + 0.01 }, // ~1,1 km lệch tuyến
    { id: '8', name: 'Trạm quá xa', latitude: far[1], longitude: far[0] + 0.1 }, // ~11 km
  ];
  const rests = placeRestStops(coords, times, [], catalog, P);
  assert.equal(rests[0].catalogId, '7');
  assert.equal(rests[0].label, 'Trạm dừng nghỉ Km 190');
});

test('dừng ở cửa khẩu tính là một lần nghỉ', () => {
  const { coords, legs } = straightRoute(6); // 450 phút
  const times = routeTimeline(coords, legs, P.truckFactor);
  const rests = placeRestStops(coords, times, [200], [], P);
  // Đến cửa khẩu ở phút 200 (≤ 240) nên không nghỉ trước đó; còn 250 phút sau cửa khẩu nên nghỉ thêm một lần.
  assert.equal(rests.length, 1);
  assert.ok(Math.abs(rests[0].atMin - 410) < 3);
});

test('lịch: bốc ngựa, nghỉ, cửa khẩu, dự phòng; tuyến dài thì nghỉ qua đêm', () => {
  const depart = new Date('2026-11-20T01:00:00.000Z');
  const short = computeSchedule([{ kind: 'ORIGIN' }, { kind: 'REST_STOP' }, { kind: 'BORDER', borderStage: 'ARRIVED' }, { kind: 'BORDER', borderStage: 'CLEARED' }, { kind: 'DESTINATION' }], [200, 150, 10, 100], depart, P);
  assert.equal(short.breakdown.driveMin, 460);
  assert.equal(short.breakdown.restMin, 30); assert.equal(short.breakdown.borderMin, 30); assert.equal(short.breakdown.overnightMin, 0);
  // 30 bốc ngựa + 460 lái + 30 nghỉ + 30 cửa khẩu = 550 phút; cộng 60 dự phòng.
  assert.equal(short.rawArrivalAt, new Date(depart.getTime() + 550 * 60_000).toISOString());
  assert.equal(short.arrivalAt, new Date(depart.getTime() + 610 * 60_000).toISOString());
  assert.equal(short.maxContinuousMin, 200);
  assert.deepEqual(short.warnings, []);

  // 6 đoạn 210 phút: lái tới điểm nghỉ thứ hai đã 420 phút, đi tiếp sẽ 630 > 600 nên nghỉ qua đêm ở đó.
  const long = computeSchedule([{ kind: 'ORIGIN' }, ...Array(5).fill({ kind: 'REST_STOP' }), { kind: 'DESTINATION' }], Array(6).fill(210), depart, P);
  const nights = long.stops.filter(s => s.overnight);
  assert.equal(nights.length, 2);
  assert.equal(nights[0].index, 2); assert.equal(nights[0].dwellMin, P.overnightMin);
  assert.equal(long.breakdown.overnightMin, 2 * (P.overnightMin - P.restDwellMin));
  const total = (Date.parse(long.rawArrivalAt) - depart.getTime()) / 60_000;
  assert.equal(total, P.loadingMin + 1260 + long.breakdown.restMin + long.breakdown.overnightMin);
});

test('cảnh báo khi lái liên tục quá 4 giờ, báo chặn khi quá 6 giờ', () => {
  const depart = new Date('2026-11-20T01:00:00.000Z');
  assert.match(computeSchedule([{ kind: 'ORIGIN' }, { kind: 'DESTINATION' }], [300], depart, P).warnings[0], /theo luật/);
  assert.match(computeSchedule([{ kind: 'ORIGIN' }, { kind: 'DESTINATION' }], [400], depart, P).warnings[0], /không gửi duyệt được/);
});

test('đoạn lái liên tục dài nhất của lộ trình đã lưu', () => {
  const { coords } = straightRoute(8);
  const point = i => ({ latitude: coords[i][1], longitude: coords[i][0] });
  const stops = [{ kind: 'ORIGIN', ...point(0) }, { kind: 'REST_STOP', ...point(100) }, { kind: 'BORDER', borderStage: 'CLEARED', ...point(150) }, { kind: 'DESTINATION', ...point(400) }];
  // 8 giờ xe con × 1,25 = 600 phút; điểm nghỉ ở 1/4 tuyến, điểm đã qua cửa khẩu không tính là nghỉ → đoạn dài nhất 450 phút.
  assert.equal(longestContinuousDrive(stops, coords, 8 * 3600, P.truckFactor), 450);
});

test('giờ xuất phát lấy theo ngày và đầu khung giờ của khách (giờ Việt Nam)', () => {
  assert.equal(customerDeparture('2026-11-20', '08:00 – 10:00').toISOString(), '2026-11-20T01:00:00.000Z');
  assert.equal(customerDeparture('2026-11-20', '14h30').toISOString(), '2026-11-20T07:30:00.000Z');
  assert.equal(customerDeparture('2026-11-20', '').toISOString(), '2026-11-20T01:00:00.000Z');
  assert.equal(customerDeparture(null, '08:00'), null);
});

test('điểm cửa khẩu phải đi theo cặp ARRIVED rồi CLEARED cùng mã', () => {
  const base = { note: '' };
  const origin = { ...base, id: 'o', kind: 'ORIGIN', label: 'Hà Nội', latitude: 21, longitude: 105.8 };
  const arrive = { ...base, id: 'a', kind: 'BORDER', borderStage: 'ARRIVED', gateCode: 'HUU_NGHI', label: 'Cửa khẩu Hữu Nghị', latitude: 21.97, longitude: 106.7 };
  const cleared = { ...base, id: 'c', kind: 'BORDER', borderStage: 'CLEARED', gateCode: 'HUU_NGHI', label: 'Hữu Nghị Quan', latitude: 21.98, longitude: 106.71 };
  const end = { ...base, id: 'd', kind: 'DESTINATION', label: 'Nam Ninh', latitude: 22.8, longitude: 108.3 };
  assert.equal(routeWaypointsSchema.safeParse([origin, arrive, cleared, end]).success, true);
  assert.equal(routeWaypointsSchema.safeParse([origin, arrive, end]).success, false);
  assert.equal(routeWaypointsSchema.safeParse([origin, { ...cleared, gateCode: 'MONG_CAI' }, end]).success, false);
  assert.equal(routeWaypointsSchema.safeParse([origin, { ...arrive, borderStage: undefined }, end]).success, false);
  assert.equal(routeWaypointsSchema.safeParse([origin, { ...origin, id: 'r', kind: 'REST_STOP', borderStage: 'ARRIVED' }, end]).success, false);
});

test('tự lập lộ trình sang Trung Quốc: chọn cửa khẩu gần nhất, chèn điểm nghỉ, tính giờ đến', async () => {
  const { buildAutoRoutePlan } = require('../src/features/trips/trip-autoplan');
  const original = global.fetch;
  const calls = [];
  // Bản đồ giả: OSRM trả đường thẳng qua các điểm, 50 km/h; Photon reverse trả tên huyện.
  global.fetch = async url => {
    const href = String(url); calls.push(href);
    const json = body => ({ ok: true, status: 200, json: async () => body, body: new Response(JSON.stringify(body)).body });
    if (href.includes('/reverse')) return json({ features: [{ properties: { district: 'Huyện Giả', state: 'Tỉnh Giả' } }] });
    const points = decodeURIComponent(new URL(href).pathname.split('/').pop()).split(';').map(p => p.split(',').map(Number));
    const legs = []; const coordinates = [];
    for (let i = 1; i < points.length; i++) {
      const d = distanceM(points[i - 1], points[i]);
      legs.push({ distance: d, duration: d / (50 / 3.6) });
      for (let k = 0; k < 20; k++) coordinates.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k / 20, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k / 20]);
    }
    coordinates.push(points.at(-1));
    const distance = legs.reduce((s, l) => s + l.distance, 0), duration = legs.reduce((s, l) => s + l.duration, 0);
    return json({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates }, distance, duration, legs }], waypoints: points.map(() => ({ distance: 0 })) });
  };
  try {
    const result = await buildAutoRoutePlan('9', { origin: { latitude: 21.0285, longitude: 105.8542 }, destination: { latitude: 22.817, longitude: 108.366 } }, {
      source: { originAddress: 'Hà Nội', destinationAddress: 'Nam Ninh', originCountry: 'VN', destinationCountry: 'CN', desiredDepartureDate: '2099-01-10', bookingDetails: { pickupTime: '07:00 – 09:00', recipient: { country: 'CN' } } },
      params: P, catalog: [],
    });
    const kinds = result.waypoints.map(w => w.borderStage ? `${w.kind}:${w.borderStage}` : w.kind);
    assert.equal(kinds[0], 'ORIGIN'); assert.equal(kinds.at(-1), 'DESTINATION');
    assert.ok(kinds.includes('BORDER:ARRIVED') && kinds.includes('BORDER:CLEARED'));
    assert.equal(result.corridor.chosen, 'CN_HUU_NGHI');
    assert.equal(result.corridor.options.length, 5);
    assert.equal(result.departure.source, 'CUSTOMER');
    assert.equal(result.departure.at, '2099-01-10T00:00:00.000Z');
    assert.ok(result.schedule.maxContinuousMin <= P.restLatestMin + 5, `đoạn dài nhất ${result.schedule.maxContinuousMin}`);
    assert.ok(result.route.verificationToken);
    assert.equal(routeWaypointsSchema.safeParse(result.waypoints).success, true);
    const generated = result.waypoints.filter(w => w.kind === 'REST_STOP');
    assert.ok(generated.length >= 1);
    assert.match(generated[0].label, /gần Huyện Giả, Tỉnh Giả/);
  } finally { global.fetch = original; }
});
