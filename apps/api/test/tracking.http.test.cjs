const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
require('reflect-metadata');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');

const secret = 'http-test-secret-with-at-least-thirty-two-characters';
const roles = { 1: 'CUSTOMER', 2: 'MANAGER', 3: 'SPECIALIST', 4: 'COORDINATOR', 5: 'DRIVER_ESCORT', 6: 'ADMIN' };
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(16, 1)]);

async function fixture() {
  const calls = [];
  const record = name => async (account, ...args) => { calls.push({ name, role: account.role, args }); return { ok: name }; };
  const tracking = Object.fromEntries(
    ['getDriverTrips', 'getTripDetail', 'recordMilestone', 'completeIntermediateLeg', 'correctLeg', 'createHorseLog', 'getTripHorseLogs',
      'createIncident', 'getTripIncidents', 'updateIncident', 'createAlert', 'getTripAlerts', 'createCareActivity', 'getCareActivities',
      'updateHorseReport', 'deleteHorseReport', 'sendHorseReport', 'getCustomerHorseReports', 'viewHorseReport',
      'getOrderTimeline', 'getTripTimeline', 'getActiveTrips'].map(name => [name, record(name)])
  );
  tracking.getAttachmentFile = async () => ({ buffer: PNG, originalName: 'ảnh ngựa.png', fileType: 'PNG' });
  const users = { getById: async id => ({ id, role: roles[id], accountStatus: 'ACTIVE' }) };
  const tokens = new TokenService(secret);
  const services = { users, auth: {}, health: {}, orders: {}, notifications: {}, documents: {}, trips: {}, tracking };
  const server = createApp({ services, tokens, corsOrigin: 'http://localhost:5173', requestLimit: 1000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (url, { id, body, method = 'GET' } = {}) => fetch(base + url, {
    method,
    headers: {
      ...(id ? { Authorization: 'Bearer ' + tokens.sign({ sub: id, email: 't@example.com', role: roles[id] }) } : {}),
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  return { request, calls, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('Tracking HTTP routes: role gates, multipart photos and attachment headers', async t => {
  const f = await fixture();
  try {
    await t.test('anonymous and wrong roles are rejected before any service call', async () => {
      assert.equal((await f.request('/api/v1/tracking/driver/trips')).status, 401);
      const denied = [
        ['GET', '/api/v1/tracking/driver/trips', '4'],
        ['GET', '/api/v1/tracking/trips/1', '1'], // customers use the order timeline, never trip detail
        ['POST', '/api/v1/tracking/legs/1/milestones', '4'],
        ['POST', '/api/v1/tracking/legs/1/horse-logs', '1'],
        ['GET', '/api/v1/tracking/trips/1/horse-logs', '1'],
        ['POST', '/api/v1/tracking/trips/1/care-activities', '4'],
        ['POST', '/api/v1/tracking/trips/1/care-activities', '1'],
        ['GET', '/api/v1/tracking/trips/1/care-activities', '1'],
        ['POST', '/api/v1/tracking/trips/1/incidents', '4'],
        ['GET', '/api/v1/tracking/trips/1/incidents', '3'],
        ['PATCH', '/api/v1/tracking/incidents/1', '5'],
        ['PATCH', '/api/v1/tracking/incidents/1', '2'],
        ['POST', '/api/v1/tracking/trips/1/alerts', '2'],
        ['PATCH', '/api/v1/tracking/legs/1/correct', '5'],
        ['PATCH', '/api/v1/tracking/horse-logs/1', '1'],
        ['PATCH', '/api/v1/tracking/horse-logs/1', '4'],
        ['DELETE', '/api/v1/tracking/horse-logs/1', '2'],
        ['POST', '/api/v1/tracking/horse-logs/1/send', '1'],
        ['POST', '/api/v1/tracking/horse-logs/1/send', '4'],
        ['GET', '/api/v1/tracking/orders/1/horse-reports', '2'],
        ['GET', '/api/v1/tracking/orders/1/horse-reports', '4'],
        ['GET', '/api/v1/tracking/orders/1/horse-reports', '5'],
        ['POST', '/api/v1/tracking/orders/1/horse-reports/2/view', '5'],
        ['POST', '/api/v1/tracking/orders/1/horse-reports/2/view', '4'],
        ['GET', '/api/v1/tracking/orders/1/timeline', '2'],
        ['GET', '/api/v1/tracking/orders/1/timeline', '5'],
        ['GET', '/api/v1/tracking/trips/1/timeline', '1'],
        ['GET', '/api/v1/tracking/operations/active-trips', '5'],
        ['GET', '/api/v1/tracking/operations/active-trips', '6'],
        ['GET', '/api/v1/tracking/operations/active-trips', '1'],
      ];
      for (const [method, url, id] of denied) {
        const res = await f.request(url, { id, method, ...(method === 'GET' ? {} : { body: {} }) });
        assert.equal(res.status, 403, `${method} ${url} as ${roles[id]}`);
      }
      assert.equal(f.calls.length, 0);
    });

    await t.test('allowed roles reach the service with route params and JSON body', async () => {
      assert.equal((await f.request('/api/v1/tracking/driver/trips', { id: '5' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/trips/7/care-activities', { id: '5', method: 'POST', body: { activityType: 'REST' } })).status, 201);
      for (const id of ['2', '3', '4', '5']) assert.equal((await f.request('/api/v1/tracking/trips/7/care-activities?from=a&to=b', { id })).status, 200);
      const created = await f.request('/api/v1/tracking/legs/12/milestones', { id: '5', method: 'POST', body: { milestoneType: 'DEPARTED' } });
      assert.equal(created.status, 201);
      assert.equal((await f.request('/api/v1/tracking/incidents/9', { id: '4', method: 'PATCH', body: { status: 'ACKNOWLEDGED' } })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/trips/7/alerts', { id: '4', method: 'POST', body: { alertType: 'WEATHER', content: 'Mưa lớn' } })).status, 201);
      assert.equal((await f.request('/api/v1/tracking/trips/7/horse-logs', { id: '3' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/orders/8/timeline', { id: '1' })).status, 200);
      // Báo cáo sức khỏe: hộ tống sửa / xóa / gửi nháp (quyền người tạo kiểm trong service); khách đọc và đánh dấu đã xem
      assert.equal((await f.request('/api/v1/tracking/horse-logs/31', { id: '5', method: 'PATCH', body: { conditionStatus: 'STABLE' } })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/horse-logs/31', { id: '5', method: 'DELETE' })).status, 204);
      assert.equal((await f.request('/api/v1/tracking/horse-logs/31/send', { id: '5', method: 'POST' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/orders/8/horse-reports', { id: '1' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/orders/8/horse-reports/31/view', { id: '1', method: 'POST' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/attachments/1', { id: '1' })).status, 200, 'khách mở được route ảnh (quyền kiểm trong service)');
      assert.deepEqual(f.calls.find(call => call.name === 'viewHorseReport').args, ['8', '31']);
      assert.equal(f.calls.find(call => call.name === 'deleteHorseReport').args[0], '31');
      assert.equal((await f.request('/api/v1/tracking/trips/7/timeline', { id: '3' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/operations/active-trips', { id: '2' })).status, 200);
      assert.equal((await f.request('/api/v1/tracking/operations/active-trips', { id: '4' })).status, 200);
      assert.equal(f.calls.find(call => call.name === 'getOrderTimeline').args[0], '8');
      assert.equal(f.calls.find(call => call.name === 'getTripTimeline').args[0], '7');
      const milestone = f.calls.find(call => call.name === 'recordMilestone');
      assert.deepEqual(milestone.args, ['12', { milestoneType: 'DEPARTED' }]);
      assert.equal(f.calls.find(call => call.name === 'updateIncident').args[0], '9');
      assert.equal(f.calls.find(call => call.name === 'createAlert').args[0], '7');
    });

    await t.test('multipart horse log passes fields and photos; JSON-only request passes no files', async () => {
      f.calls.length = 0;
      const form = new FormData();
      form.set('horseId', '21');
      form.set('conditionStatus', 'STABLE');
      form.set('loggedAt', new Date().toISOString());
      form.append('photos', new Blob([PNG], { type: 'image/png' }), 'a.png');
      form.append('photos', new Blob([PNG], { type: 'image/png' }), 'b.png');
      assert.equal((await f.request('/api/v1/tracking/legs/12/horse-logs', { id: '5', method: 'POST', body: form })).status, 201);
      const withPhotos = f.calls.find(call => call.name === 'createHorseLog');
      assert.equal(withPhotos.args[1].horseId, '21');
      assert.equal(withPhotos.args[2].length, 2);
      assert.equal(withPhotos.args[2][0].originalname, 'a.png');

      f.calls.length = 0;
      assert.equal((await f.request('/api/v1/tracking/trips/7/incidents', { id: '5', method: 'POST', body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng bánh xe' } })).status, 201);
      assert.deepEqual(f.calls[0].args[2], []);
    });

    await t.test('more than 3 photos and oversize photos are rejected by the upload layer', async () => {
      f.calls.length = 0;
      const four = new FormData();
      for (let i = 0; i < 4; i++) four.append('photos', new Blob([PNG], { type: 'image/png' }), `p${i}.png`);
      const tooMany = await f.request('/api/v1/tracking/trips/7/incidents', { id: '5', method: 'POST', body: four });
      assert.ok([400, 413].includes(tooMany.status), 'status ' + tooMany.status);

      const big = new FormData();
      big.append('photos', new Blob([Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])], { type: 'image/png' }), 'big.png');
      assert.equal((await f.request('/api/v1/tracking/legs/12/horse-logs', { id: '5', method: 'POST', body: big })).status, 413);
      assert.equal(f.calls.length, 0);
    });

    await t.test('attachment download is private, typed and not sniffable', async () => {
      const res = await f.request('/api/v1/tracking/attachments/5', { id: '5' });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/png');
      assert.equal(res.headers.get('cache-control'), 'private, no-store');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.match(res.headers.get('content-disposition'), /^inline;/);
      assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
    });
  } finally {
    await f.close();
  }
});

test('Map/GPS routes: role gates, skipped by the per-IP limiter, limited per user instead', async () => {
  const calls = [];
  const record = name => async (account, ...args) => { calls.push({ name, id: String(account.id), args }); return { ok: name }; };
  const tracking = { getTripMap: record('getTripMap'), recordPositions: record('recordPositions'), getTrackPoints: record('getTrackPoints'), getDriverTrips: record('getDriverTrips') };
  const users = { getById: async id => ({ id, role: roles[id], accountStatus: 'ACTIVE' }) };
  const tokens = new TokenService(secret);
  const services = { users, auth: {}, health: {}, orders: {}, notifications: {}, documents: {}, trips: {}, tracking };
  // Giới hạn chung theo IP rất thấp (3/phút) để thấy rõ đường bản đồ/GPS không bị tính vào đó.
  const server = createApp({ services, tokens, corsOrigin: 'http://localhost:5173', requestLimit: 3 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const auth = id => ({ Authorization: 'Bearer ' + tokens.sign({ sub: id, email: 't@example.com', role: roles[id] }) });
  const get = (url, id) => fetch(base + url, { headers: auth(id) });
  const post = (url, id, body) => fetch(base + url, { method: 'POST', headers: { ...auth(id), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/api/v1/tracking/trips/1/map')).status, 401);
    assert.equal((await get('/api/v1/tracking/trips/1/map', '1')).status, 403, 'customer');
    assert.equal((await get('/api/v1/tracking/trips/1/positions', '1')).status, 403, 'customer');
    assert.equal((await post('/api/v1/tracking/trips/1/positions', '4', { points: [] })).status, 403, 'coordinator cannot send GPS');
    assert.equal((await post('/api/v1/tracking/trips/7/positions', '5', { points: [{ latitude: 1 }] })).status, 201);
    assert.deepEqual(calls.at(-1), { name: 'recordPositions', id: '5', args: ['7', { points: [{ latitude: 1 }] }] });
    assert.equal((await get('/api/v1/tracking/trips/7/positions?since=2026-10-20T01:00:00.000Z', '3')).status, 200);
    assert.deepEqual([calls.at(-1).args[0], { ...calls.at(-1).args[1] }], ['7', { since: '2026-10-20T01:00:00.000Z' }]);

    // Đã quá 3 request/phút theo IP nhưng bản đồ vẫn trả 200; các route khác thì 429.
    for (let i = 0; i < 5; i++) assert.equal((await get('/api/v1/tracking/trips/1/map', '2')).status, 200);
    for (let i = 0; i < 3; i++) assert.equal((await get('/api/v1/tracking/driver/trips', '5')).status, 200, 'map/GPS calls above were not counted');
    assert.equal((await get('/api/v1/tracking/driver/trips', '5')).status, 429, 'per-IP limiter still guards other routes');

    // Giới hạn theo người dùng: 60 lần xem bản đồ/phút cho mỗi tài khoản; tài khoản khác không bị ảnh hưởng.
    let manager = 0;
    for (let i = 0; i < 60; i++) if ((await get('/api/v1/tracking/trips/1/map', '2')).status === 200) manager++;
    assert.equal(manager, 55, '60 per minute for this user (5 already used above)');
    assert.equal((await get('/api/v1/tracking/trips/1/map', '2')).status, 429);
    assert.equal((await get('/api/v1/tracking/trips/1/map', '4')).status, 200, 'another user is not affected');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
});
