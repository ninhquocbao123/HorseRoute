const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { routePlanWriteSchema, routeInputKey, issueRouteToken, verifyRouteToken, MAX_ROUTE_COORDINATES } = require('../src/features/trips/trip-route-plan');
const { searchAddresses, previewRoutes } = require('../src/features/trips/trip-map-provider');

process.env.JWT_SECRET ||= 'route-plan-test-secret-with-at-least-thirty-two-characters';
const waypoints = [
  { id: 'origin', kind: 'ORIGIN', label: 'Hà Nội', latitude: 21.0285, longitude: 105.8542, note: '' },
  { id: 'stop-1', kind: 'REST_STOP', label: 'Đà Nẵng', latitude: 16.0544, longitude: 108.2022, note: 'Nghỉ và kiểm tra ngựa' },
  { id: 'destination', kind: 'DESTINATION', label: 'TP. Hồ Chí Minh', latitude: 10.7769, longitude: 106.7009, note: '' },
];
const route = {
  geometry: { type: 'LineString', coordinates: [[105.8542, 21.0285], [108.2022, 16.0544], [106.7009, 10.7769]] },
  distanceM: 1600000, durationS: 108000, provider: 'mapbox', calculatedAt: new Date().toISOString(), inputKey: routeInputKey(waypoints),
};

test('route plan schema preserves ordered endpoints, rest notes and a bounded route', () => {
  const result = routePlanWriteSchema.safeParse({ revision: 0, routePlan: { version: 1, waypoints, selectedRoute: route }, verificationToken: 'signed-preview' });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.routePlan.waypoints.map(point => point.kind), ['ORIGIN', 'REST_STOP', 'DESTINATION']);
});

test('invalid order, duplicate ids, coordinates and oversized geometry are rejected', () => {
  const body = points => ({ revision: 0, routePlan: { version: 1, waypoints: points, selectedRoute: null }, verificationToken: null });
  assert.equal(routePlanWriteSchema.safeParse(body([waypoints[2], waypoints[0]])).success, false);
  assert.equal(routePlanWriteSchema.safeParse(body([waypoints[0], { ...waypoints[2], id: 'origin' }])).success, false);
  assert.equal(routePlanWriteSchema.safeParse(body([{ ...waypoints[0], latitude: 91 }, waypoints[2]])).success, false);
  const tooLarge = { ...route, geometry: { type: 'LineString', coordinates: Array.from({ length: MAX_ROUTE_COORDINATES + 1 }, () => [106, 10]) } };
  assert.equal(routePlanWriteSchema.safeParse({ revision: 0, routePlan: { version: 1, waypoints, selectedRoute: tooLarge }, verificationToken: 'x' }).success, false);
});

test('preview token is bound to trip, input and full normalized route', () => {
  const token = issueRouteToken('42', route);
  assert.doesNotThrow(() => verifyRouteToken(token, '42', route));
  assert.throws(() => verifyRouteToken(token, '43', route));
  assert.throws(() => verifyRouteToken(token, '42', { ...route, distanceM: route.distanceM + 1 }));
  const [body, signature] = token.split('.');
  const tampered = `${body}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
  assert.throws(() => verifyRouteToken(tampered, '42', route));
});

test('route input key ignores note-only edits but changes with coordinate/order edits', () => {
  assert.equal(routeInputKey(waypoints), routeInputKey(waypoints.map(point => ({ ...point, note: point.note + ' updated' }))));
  assert.notEqual(routeInputKey(waypoints), routeInputKey(waypoints.map((point, index) => index === 1 ? { ...point, latitude: point.latitude + 0.001 } : point)));
  assert.notEqual(routeInputKey(waypoints), routeInputKey([waypoints[0], waypoints[2], waypoints[1]]));
});

test('Photon search biases towards Vietnam, sends no unsupported language and normalizes results', async () => {
  let called;
  let init;
  const items = await searchAddresses('8 Nguyễn Tất Thành', async (url, options) => {
    called = new URL(url); init = options;
    return new Response(JSON.stringify({ features: [
      { properties: { osm_type: 'N', osm_id: 12, name: 'Sở GD&ĐT', housenumber: '8', street: 'Nguyễn Tất Thành', city: 'Buôn Ma Thuột', state: 'Đắk Lắk', country: 'Việt Nam' }, geometry: { type: 'Point', coordinates: [108.04, 12.68] } },
      { properties: { street: 'Nguyễn Tất Thành', city: 'Nguyễn Tất Thành' }, geometry: { type: 'Point', coordinates: [108, 12] } },
    ] }), { status: 200 });
  });
  assert.equal(called.searchParams.get('lang'), 'default', 'Photon rejects lang=vi with HTTP 400; default keeps the names written in OpenStreetMap');
  assert.equal(called.searchParams.get('limit'), '5');
  assert.equal(called.searchParams.has('countrycode'), false, 'international trips can search abroad');
  assert.equal(init.headers['User-Agent'], 'HorseRoute/1.0');
  assert.deepEqual(items, [
    { id: 'N12', label: 'Sở GD&ĐT, 8 Nguyễn Tất Thành, Buôn Ma Thuột, Đắk Lắk, Việt Nam', latitude: 12.68, longitude: 108.04 },
    { id: '108,12', label: 'Nguyễn Tất Thành', latitude: 12, longitude: 108 },
  ]);
});

test('invalid provider responses never become empty results or signed unsaveable routes', async () => {
  const reply = body => async () => new Response(JSON.stringify(body));
  for (const body of [{}, { features: null }, { features: [{ geometry: { type: 'Point', coordinates: [200, 10] }, properties: { name: 'Bad' } }] }, { features: [{ geometry: { type: 'Point', coordinates: [106, 10] }, properties: { city: 'No name' } }] }]) {
    await assert.rejects(searchAddresses('public place', reply(body)), e => e.getStatus() === 503);
  }
  assert.deepEqual(await searchAddresses('no results', reply({ features: [] })), []);
  for (const candidate of [
    { geometry: { type: 'Polygon', coordinates: route.geometry.coordinates }, distance: 100, duration: 100 },
    { geometry: { type: 'LineString', coordinates: [[190, 10], [106, 11]] }, distance: 100, duration: 100 },
    { geometry: route.geometry, distance: 100000001, duration: 100 },
    { geometry: route.geometry, distance: 100, duration: -1 },
  ]) await assert.rejects(previewRoutes('42', waypoints, reply({ code: 'Ok', routes: [candidate] })), e => e.getStatus() === 503);
});

test('long geometry is simplified without truncation and the signed result passes save schema', async () => {
  const coordinates = Array.from({ length: 6001 }, (_, i) => [105 + i * 0.0001, 20 + i * 0.0001]);
  const results = await previewRoutes('42', waypoints, async () => new Response(JSON.stringify({
    code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates }, distance: 100000, duration: 10000 }],
  })));
  const { verificationToken, ...stored } = results[0];
  assert.deepEqual(stored.geometry.coordinates[0], coordinates[0]);
  assert.deepEqual(stored.geometry.coordinates.at(-1), coordinates.at(-1));
  assert(stored.geometry.coordinates.length <= MAX_ROUTE_COORDINATES);
  assert(routePlanWriteSchema.safeParse({ revision: 0, routePlan: { version: 1, waypoints, selectedRoute: stored }, verificationToken }).success);
  verifyRouteToken(verificationToken, '42', stored);
});

test('expired token is rejected without weakening signed trip/input/digest checks', () => {
  const now = Date.now;
  let token;
  try { Date.now = () => now() - 16 * 60000; token = issueRouteToken('42', route); }
  finally { Date.now = now; }
  assert.throws(() => verifyRouteToken(token, '42', route), /hết hạn/);
});

test('OSRM no-road answers (HTTP 400) become a clear 400, other failures stay 503', async () => {
  const reply = (status, body) => async () => new Response(JSON.stringify(body), { status });
  for (const code of ['NoRoute', 'NoSegment']) {
    await assert.rejects(previewRoutes('42', waypoints, reply(400, { code })), e => e.getStatus() === 400 && /Không tìm thấy đường bộ/.test(e.message));
  }
  await assert.rejects(previewRoutes('42', waypoints, reply(400, { code: 'InvalidQuery' })), e => e.getStatus() === 503);
  await assert.rejects(previewRoutes('42', waypoints, reply(500, {})), e => e.getStatus() === 503);
  await assert.rejects(previewRoutes('42', waypoints, reply(429, {})), e => e.getStatus() === 503 && /giới hạn/.test(e.message));
});

test('a waypoint OSRM snapped too far from any road is rejected by name, never signed', async () => {
  const body = distances => ({ code: 'Ok', waypoints: distances.map(distance => ({ distance })), routes: [{ geometry: route.geometry, distance: route.distanceM, duration: route.durationS }] });
  const far = waypoints.map((_, index) => (index === 1 ? 292534 : 10));
  await assert.rejects(previewRoutes('42', waypoints, async () => new Response(JSON.stringify(body(far)))), e => e.getStatus() === 400 && e.message.includes(waypoints[1].label));
  const near = await previewRoutes('42', waypoints, async () => new Response(JSON.stringify(body(waypoints.map(() => 4900)))));
  assert.equal(near[0].provider, 'osrm');
});

test('routes saved before the switch (provider mapbox) can still be read and saved', () => {
  assert.equal(route.provider, 'mapbox');
  assert(routePlanWriteSchema.safeParse({ revision: 0, routePlan: { version: 1, waypoints, selectedRoute: route }, verificationToken: null }).success);
  assert.equal(routePlanWriteSchema.safeParse({ revision: 0, routePlan: { version: 1, waypoints, selectedRoute: { ...route, provider: 'other' } }, verificationToken: null }).success, false);
});

test('turning a map service off fails clearly instead of calling the public server', async () => {
  const saved = [process.env.MAP_ROUTING_URL, process.env.MAP_GEOCODING_URL];
  process.env.MAP_ROUTING_URL = ''; process.env.MAP_GEOCODING_URL = '';
  try {
    const never = async () => { throw new Error('must not fetch'); };
    await assert.rejects(previewRoutes('42', waypoints, never), e => e.getStatus() === 503 && /tắt/.test(e.message));
    await assert.rejects(searchAddresses('Hà Nội', never), e => e.getStatus() === 503 && /tắt/.test(e.message));
  } finally {
    for (const [key, value] of [['MAP_ROUTING_URL', saved[0]], ['MAP_GEOCODING_URL', saved[1]]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('OSRM routing mock returns signed alternatives bound to exact waypoint input', async () => {
  const result = await previewRoutes('42', waypoints, async url => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('alternatives'), '2');
    assert.equal(parsed.searchParams.has('access_token'), false);
    assert.equal(parsed.searchParams.get('geometries'), 'geojson');
    return new Response(JSON.stringify({ code: 'Ok', routes: [{ geometry: route.geometry, distance: route.distanceM, duration: route.durationS }] }), { status: 200 });
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].inputKey, routeInputKey(waypoints));
  const { verificationToken, ...stored } = result[0];
  assert.doesNotThrow(() => verifyRouteToken(verificationToken, '42', stored));
});
