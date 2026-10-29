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

test('Mapbox provider uses permanent non-autocomplete geocoding and normalizes minimal results', async () => {
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  let called;
  const items = await searchAddresses('Hà Nội', async url => {
    called = new URL(url);
    return new Response(JSON.stringify({ features: [{ id: 'address.1', properties: { full_address: 'Hà Nội, Việt Nam' }, geometry: { type: 'Point', coordinates: [105.8542, 21.0285] } }] }), { status: 200 });
  });
  assert.equal(called.searchParams.get('permanent'), 'true');
  assert.equal(called.searchParams.get('autocomplete'), 'false');
  assert.deepEqual(items, [{ id: 'address.1', label: 'Hà Nội, Việt Nam', latitude: 21.0285, longitude: 105.8542 }]);
});

test('invalid provider responses never become empty results or signed unsaveable routes', async () => {
  const reply = body => async () => new Response(JSON.stringify(body));
  for (const body of [{}, { features: null }, { features: [{ geometry: { type: 'Point', coordinates: [200, 10] }, properties: { name: 'Bad' } }] }]) {
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

test('Mapbox routing mock returns signed alternatives bound to exact waypoint input', async () => {
  process.env.MAPBOX_ACCESS_TOKEN = 'test-token';
  const result = await previewRoutes('42', waypoints, async url => {
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get('alternatives'), 'true');
    assert.equal(parsed.searchParams.get('geometries'), 'geojson');
    return new Response(JSON.stringify({ code: 'Ok', routes: [{ geometry: route.geometry, distance: route.distanceM, duration: route.durationS }] }), { status: 200 });
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].inputKey, routeInputKey(waypoints));
  const { verificationToken, ...stored } = result[0];
  assert.doesNotThrow(() => verifyRouteToken(verificationToken, '42', stored));
});
