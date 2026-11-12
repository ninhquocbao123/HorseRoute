// Tự lập lộ trình, quy tắc nghỉ khi gửi duyệt (B5) và điểm cửa khẩu khi check-in. Chỉ chạy trên MySQL tạm (TEST_DB_*).
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33071 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/route-autoplan.mysql.cjs
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { DataSource } = require('typeorm'); const { User } = require('../src/features/users/users.model');
const { TripsRepository } = require('../src/features/trips/trips.repository'); const { TripsService } = require('../src/features/trips/trips.service');
const { TrackingRepository } = require('../src/features/tracking/tracking.repository');
const { TripFleet1800000015000 } = require('../src/database/migrations/1800000015000-TripFleet');
const { TripRoutePlan1800000013000 } = require('../src/database/migrations/1800000013000-TripRoutePlan');
const { RepresentativeTripLeg1800000016000 } = require('../src/database/migrations/1800000016000-RepresentativeTripLeg');
const { issueRouteToken, routeInputKey } = require('../src/features/trips/trip-route-plan');
const { distanceM } = require('../src/features/trips/route-autoplan');
const createChecks = require('./checks.cjs');
const testDb = require('./mysql-options.cjs');
if (!process.env.TEST_DB_HOST) { console.error('Đặt TEST_DB_* trỏ tới MySQL tạm; test này không chạy trên DB dùng chung.'); process.exit(1); }
const options = { type: 'mysql', host: testDb.host, port: testDb.port, username: testDb.user, password: testDb.password, ssl: testDb.ssl, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User] };
const name = 'wdp_flow3_test_' + crypto.randomBytes(8).toString('hex'); let admin, db;
const checks = createChecks(); const { check } = checks; const done = () => checks.done();

/** Bản đồ giả: OSRM trả đường thẳng qua các điểm (50 km/h), Photon reverse trả một tên huyện. */
function fakeMaps() {
  const original = global.fetch;
  global.fetch = async url => {
    const href = String(url);
    const json = body => ({ ok: true, status: 200, json: async () => body, body: new Response(JSON.stringify(body)).body });
    if (href.includes('/reverse')) return json({ features: [{ properties: { district: 'Huyện Giả' } }] });
    if (!href.includes('/route/')) return json({ features: [] });
    const points = decodeURIComponent(new URL(href).pathname.split('/').pop()).split(';').map(p => p.split(',').map(Number));
    const legs = [], coordinates = [];
    for (let i = 1; i < points.length; i++) {
      const d = distanceM(points[i - 1], points[i]); legs.push({ distance: d, duration: d / (50 / 3.6) });
      for (let k = 0; k < 20; k++) coordinates.push([points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k / 20, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k / 20]);
    }
    coordinates.push(points.at(-1));
    return json({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates }, distance: legs.reduce((s, l) => s + l.distance, 0), duration: legs.reduce((s, l) => s + l.duration, 0), legs }], waypoints: points.map(() => ({ distance: 0 })) });
  };
  return () => { global.fetch = original; };
}

(async () => {
  try {
    admin = await new DataSource({ ...options, database: 'mysql' }).initialize();
    await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    db = await new DataSource({ ...options, database: name }).initialize();
    await require('./load-schema.cjs')(db, { except: ['TripRoutePlan1800000013000', 'TripFleet1800000015000', 'RepresentativeTripLeg1800000016000'] });
    const runner = db.createQueryRunner(); await new TripRoutePlan1800000013000().up(runner); await new TripFleet1800000015000().up(runner); await new RepresentativeTripLeg1800000016000().up(runner); await runner.release();
    const q = (s, p) => db.query(s, p);
    await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (1,'customer@test','x','Customer','CUSTOMER','ACTIVE'),(3,'coord@test','x','Coordinator','COORDINATOR','ACTIVE'),(5,'other@test','x','Other','COORDINATOR','ACTIVE')`);
    const booking = JSON.stringify({ pickupTime: '07:00 – 09:00', sender: { country: 'VN' }, recipient: { country: 'CN' } });
    await q(`INSERT INTO orders(id,order_code,customer_id,status,origin_address,destination_address,origin_country,destination_country,desired_departure_date,booking_details) VALUES
      (100,'AUTO100',1,'APPROVED','Hà Nội','Nam Ninh','VN','CN','2099-03-10',?),(101,'AUTO101',1,'APPROVED','A','B','VN','VN',NULL,NULL)`, [booking]);
    await q(`INSERT INTO trips(id,order_id,plan_status,planned_by) VALUES(100,100,'DRAFT',3),(101,101,'DRAFT',3)`);
    await q(`INSERT INTO system_parameters(param_code,param_value) VALUES('ETA_BUFFER','90')`).catch(() => q(`UPDATE system_parameters SET param_value='90' WHERE param_code='ETA_BUFFER'`));
    const svc = new TripsService(new TripsRepository(db)), actor = { id: '3', role: 'COORDINATOR' };
    process.env.ROUTE_PREVIEW_SECRET = 'autoplan-test-route-secret-with-at-least-32-characters';

    await check('tự lập lộ trình đơn sang Trung Quốc: giờ đi theo đơn, cửa khẩu, tham số từ system_parameters, lưu được', async () => {
      const restore = fakeMaps();
      try {
        const result = await svc.autoRoutePlan(actor, '100', { origin: { latitude: 21.0285, longitude: 105.8542 }, destination: { latitude: 22.817, longitude: 108.366 } });
        assert.equal(result.departure.source, 'CUSTOMER');
        assert.equal(result.departure.at, '2099-03-10T00:00:00.000Z');
        assert.equal(result.params.etaBufferMin, 90);
        assert.equal(result.schedule.breakdown.bufferMin, 90);
        assert.equal(result.corridor.chosen, 'CN_HUU_NGHI');
        assert.deepEqual(result.waypoints.filter(w => w.kind === 'BORDER').map(w => w.borderStage), ['ARRIVED', 'CLEARED']);
        const { verificationToken, ...route } = result.route;
        const saved = await svc.saveRoutePlan(actor, '100', { revision: 0, routePlan: { version: 1, waypoints: result.waypoints, selectedRoute: route }, verificationToken });
        assert.equal(saved.routePlan.waypoints.length, result.waypoints.length);
        // Giờ xuất phát điều phối viên nhập thay cho ngày khách chọn.
        const later = await svc.autoRoutePlan(actor, '100', { plannedDepartureAt: '2099-03-11T02:00:00.000Z', waypoints: result.waypoints });
        assert.equal(later.departure.source, 'INPUT');
        assert.equal(later.waypoints.length, result.waypoints.length);
      } finally { restore(); }
    });

    await check('chỉ điều phối viên phụ trách mới tự lập được; đơn thiếu ngày đi thì báo nhập giờ xuất phát', async () => {
      const restore = fakeMaps();
      try {
        await assert.rejects(() => svc.autoRoutePlan({ id: '5', role: 'COORDINATOR' }, '100', {}), /Không tìm thấy chuyến/);
        await assert.rejects(() => svc.autoRoutePlan({ id: '1', role: 'CUSTOMER' }, '100', {}), /Chỉ Coordinator/);
        const result = await svc.autoRoutePlan(actor, '101', { origin: { latitude: 10.77, longitude: 106.7 }, destination: { latitude: 10.95, longitude: 106.82 } });
        assert.equal(result.departure.source, 'MISSING');
        assert.equal(result.schedule, null);
        assert.match(result.warnings[0], /chưa có ngày khởi hành/);
      } finally { restore(); }
    });

    await check('B5: gửi duyệt bị chặn khi có đoạn lái liên tục quá 6 giờ không có điểm nghỉ', async () => {
      const points = [{ id: 'o', kind: 'ORIGIN', label: 'A', latitude: 10, longitude: 106, note: '' }, { id: 'd', kind: 'DESTINATION', label: 'B', latitude: 12, longitude: 108, note: '' }];
      // 6 giờ xe con × 1,25 = 450 phút > 360.
      const route = { geometry: { type: 'LineString', coordinates: [[106, 10], [107, 11], [108, 12]] }, distanceM: 300000, durationS: 6 * 3600, provider: 'osrm', calculatedAt: new Date().toISOString(), inputKey: routeInputKey(points) };
      await svc.saveRoutePlan(actor, '101', { revision: 0, routePlan: { version: 1, waypoints: points, selectedRoute: route }, verificationToken: issueRouteToken('101', route) });
      await svc.savePlan(actor, '101', { plannedDepartureAt: '2099-01-01T01:00:00Z', plannedArrivalAt: '2099-01-02T03:00:00Z', routePlanRevision: 1 });
      // Chưa phân công xe nên vẫn bị chặn sau quy tắc nghỉ; ở đây chỉ cần thấy quy tắc nghỉ chặn trước.
      await assert.rejects(() => svc.submitPlan(actor, '101', {}), error => error.getResponse?.().code === 'REST_RULE');
      const withRest = [points[0], { id: 'r', kind: 'REST_STOP', label: 'Nghỉ', latitude: 11, longitude: 107, note: '' }, points[1]];
      const route2 = { ...route, inputKey: routeInputKey(withRest) };
      await svc.saveRoutePlan(actor, '101', { revision: 1, routePlan: { version: 1, waypoints: withRest, selectedRoute: route2 }, verificationToken: issueRouteToken('101', route2) });
      await svc.savePlan(actor, '101', { plannedDepartureAt: '2099-01-01T01:00:00Z', plannedArrivalAt: '2099-01-02T03:00:00Z', routePlanRevision: 2 });
      await assert.rejects(() => svc.submitPlan(actor, '101', {}), error => error.getResponse?.().code !== 'REST_RULE');
    });

    await check('tài xế check-in cả hai phía cửa khẩu; khách thấy giai đoạn cửa khẩu', async () => {
      const tracking = new TrackingRepository(db);
      const stops = await tracking.getRestStops('100');
      const gate = stops.filter(s => s.kind === 'BORDER');
      assert.deepEqual(gate.map(s => s.borderStage), ['ARRIVED', 'CLEARED']);
      const [leg] = await q(`SELECT CAST(id AS CHAR) id FROM legs WHERE trip_id=100`).then(rows => rows.length ? rows : q(`INSERT INTO legs(trip_id,seq_no,planned_departure_at,planned_arrival_at,status) VALUES(100,1,'2099-03-10 00:00:00','2099-03-11 00:00:00','NOT_STARTED')`).then(() => q(`SELECT CAST(id AS CHAR) id FROM legs WHERE trip_id=100`)));
      await tracking.insertWaypointCheckin(leg.id, gate[0].id, gate[0].label, '2099-03-10T05:00:00.000Z', '3');
      await tracking.insertWaypointCheckin(leg.id, gate[1].id, gate[1].label, '2099-03-10T05:40:00.000Z', '3');
      const rows = await tracking.getWaypointCheckins([leg.id]);
      assert.deepEqual(rows.map(r => [r.kind, r.borderStage]), [['BORDER', 'ARRIVED'], ['BORDER', 'CLEARED']]);
      assert.match(rows[1].label, /đã qua cửa khẩu$/);
    });
    done();
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) { await admin.query('DROP DATABASE IF EXISTS `' + name + '`'); await admin.destroy(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
