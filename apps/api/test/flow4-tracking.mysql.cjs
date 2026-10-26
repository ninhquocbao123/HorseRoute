// Flow 4 integration test: real MySQL, real services, real HTTP. Creates and drops only a randomly named test database.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33061 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/flow4-tracking.mysql.cjs
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('node:assert/strict');
const { once } = require('node:events');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { createServices } = require('../src/shared/config/services');
const { TrackingService } = require('../src/features/tracking/tracking.service');
const { TrackingRepository } = require('../src/features/tracking/tracking.repository');
const { User } = require('../src/features/users/users.model');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const options = require('./mysql-options.cjs');

const name = 'wdp_flow4_test_' + require('crypto').randomBytes(8).toString('hex');
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-flow4-'));
process.env.DOCUMENT_STORAGE_DIR = storageDir;
process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
// Không bao giờ gọi Mapbox thật trong test: thiếu token → tuyến STRAIGHT, không cache.
delete process.env.MAPBOX_ACCESS_TOKEN;

let admin, db, server, created = false, passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }

const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(64, 7)]);
const minutesAgo = m => new Date(Date.now() - m * 60 * 1000).toISOString();
const ids = { customer: '1', manager: '2', coordA: '3', coordB: '4', driver: '6', specialist: '7', customer2: '8', driver2: '9', escort: '10' };

async function main() {
  admin = await mysql.createConnection(options);
  assert.match(name, /^wdp_flow4_test_[0-9a-f]{16}$/);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({
    type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name,
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { multipleStatements: true, connectionLimit: 20 },
  });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);
  const count = async (sql, params) => Number((await q(sql, params))[0].n);

  // ── Fixtures ────────────────────────────────────────────────────────────────
  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status,phone) VALUES
    (1,'customer@t.local','!','Khách Một','CUSTOMER','ACTIVE',NULL),(2,'manager@t.local','!','Quản Lý','MANAGER','ACTIVE',NULL),
    (3,'coorda@t.local','!','Điều Phối A','COORDINATOR','ACTIVE','0900000003'),(4,'coordb@t.local','!','Điều Phối B','COORDINATOR','ACTIVE',NULL),
    (6,'driver@t.local','!','Tài Xế','DRIVER_ESCORT','ACTIVE','0900000006'),(7,'specialist@t.local','!','Chuyên Viên','SPECIALIST','ACTIVE',NULL),
    (8,'customer2@t.local','!','Khách Hai','CUSTOMER','ACTIVE',NULL),(9,'driver2@t.local','!','Tài Xế Hai','DRIVER_ESCORT','ACTIVE',NULL),
    (10,'escort@t.local','!','Hộ Tống','DRIVER_ESCORT','ACTIVE',NULL)`);
  await q(`INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status,recipient_name,recipient_phone) VALUES
    (50,'WDP-F4-50',1,'A','VN','B','SG','2026-10-20','READY','Người Nhận SG','+6560000050'),(51,'WDP-F4-51',8,'A','VN','B','SG','2026-10-20','READY',NULL,NULL)`);
  await q(`INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (21,50,1,'Bạch Mã','T-21'),(22,50,1,'Hắc Mã','T-22'),(23,51,8,'Xích Thố','T-23')`);
  await q(`INSERT INTO locations(id,name,location_type,country,timezone,latitude,longitude) VALUES
    (1,'Kho HCM','REST_STOP','VN','Asia/Ho_Chi_Minh',10.850000,106.600000),(2,'Cửa khẩu','BORDER','VN','Asia/Ho_Chi_Minh',11.076000,106.158000),
    (3,'Sân bay đích','AIRPORT','SG','Asia/Singapore',1.364400,103.991500)`);
  await q(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (5,'TRUCK',4,'XE-01',1)`);
  await q(`INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by) VALUES
    (100,50,'APPROVED',UTC_TIMESTAMP() - INTERVAL 3 HOUR,UTC_TIMESTAMP() + INTERVAL 3 HOUR,3),(101,51,'APPROVED',UTC_TIMESTAMP() - INTERVAL 3 HOUR,UTC_TIMESTAMP() + INTERVAL 3 HOUR,4)`);
  await q(`INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES
    (10,100,1,1,2,5,UTC_TIMESTAMP() - INTERVAL 3 HOUR,UTC_TIMESTAMP() - INTERVAL 1 HOUR),
    (11,100,2,2,3,5,UTC_TIMESTAMP() - INTERVAL 1 HOUR,UTC_TIMESTAMP() + INTERVAL 2 HOUR),
    (12,101,1,1,3,5,UTC_TIMESTAMP() - INTERVAL 3 HOUR,UTC_TIMESTAMP() + INTERVAL 2 HOUR)`);
  await q(`INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES
    (100,6,'DRIVER',3,UTC_TIMESTAMP()),(100,10,'ESCORT',3,UTC_TIMESTAMP()),(101,9,'DRIVER',4,UTC_TIMESTAMP())`);

  const tokens = new TokenService('flow4-integration-secret-at-least-thirty-two-characters');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/tracking';

  async function call(method, suffix, { as, body } = {}) {
    const headers = as ? { Authorization: 'Bearer ' + tokens.sign({ sub: as, email: 't@t.local', role: 'ADMIN' }) } : {};
    if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + suffix, { method, headers, ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) });
    const type = res.headers.get('content-type') || '';
    const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, res };
  }
  const expectStatus = async (status, method, suffix, opts) => { const r = await call(method, suffix, opts); assert.equal(r.status, status, `${method} ${suffix} as ${opts?.as} -> ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); return r.data; };
  const depart = (at, as = ids.driver) => call('POST', '/legs/10/milestones', { as, body: { milestoneType: 'DEPARTED', occurredAt: at } });
  const milestone = (legId, type, at) => call('POST', `/legs/${legId}/milestones`, { as: ids.driver, body: { milestoneType: type, occurredAt: minutesAgo(at) } });
  const photoForm = fields => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    form.append('photos', new Blob([PNG], { type: 'image/png' }), 'ngua.png');
    return form;
  };
  const stored = () => fs.readdirSync(storageDir).length;
  const failOn = async table => q(`CREATE TRIGGER trg_f4_fail BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='forced failure'`);
  const clearTrigger = () => q('DROP TRIGGER IF EXISTS trg_f4_fail');
  const snapshot = async () => ({
    order: (await q('SELECT status FROM orders WHERE id=50'))[0].status,
    legs: await q('SELECT id,status,actual_departure_at AS dep,actual_arrival_at AS arr FROM legs WHERE trip_id=100 ORDER BY id'),
    milestones: await count('SELECT COUNT(*) AS n FROM leg_milestones'),
    audits: await count('SELECT COUNT(*) AS n FROM audit_logs'),
    notifications: await count('SELECT COUNT(*) AS n FROM notifications'),
  });


  // ── Báo cáo sức khỏe ngựa: tiện ích dùng cho 3 check (READY / IN_TRANSIT / DELIVERED) ─────────────
  const reportForm = (fields, photos = 0, captions = []) => {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
    for (const caption of captions) form.append('captions', caption);
    for (let index = 0; index < photos; index++) form.append('photos', new Blob([PNG], { type: 'image/png' }), `p${index}.png`);
    return form;
  };
  const baseReport = (extra = {}) => ({ horseId: '21', conditionStatus: 'OFF_FEED', loggedAt: minutesAgo(5), reportStatus: 'DRAFT', customerNote: 'Silver ăn ít khẩu phần trưa', sendToCustomer: true, ...extra });
  /** Xóa báo cáo (và ảnh, thông báo của chúng) để các check cũ phía sau không bị lệch số liệu. `keepDrafts` giữ nháp. */
  const purgeReports = async ({ keepDrafts = false } = {}) => {
    const where = `report_status IS NOT NULL${keepDrafts ? " AND report_status <> 'DRAFT'" : ''}`;
    const files = await q(`SELECT storage_path AS p FROM attachments WHERE horse_log_id IN (SELECT id FROM horse_logs WHERE ${where})`);
    await q(`DELETE FROM attachments WHERE horse_log_id IN (SELECT id FROM horse_logs WHERE ${where})`);
    for (const file of files) fs.rmSync(path.join(storageDir, file.p), { force: true });
    await q(`UPDATE horse_logs SET corrects_log_id = NULL WHERE ${where}`);
    await q(`DELETE FROM horse_logs WHERE ${where}`);
    await q("DELETE FROM notifications WHERE event_type LIKE 'HORSE_REPORT%'");
  };

  await check('Authentication and role gates: anonymous 401, customer cannot read internal trip data, wrong roles 403', async () => {
    await expectStatus(401, 'GET', '/driver/trips');
    await expectStatus(403, 'GET', '/driver/trips', { as: ids.coordA });
    await expectStatus(403, 'GET', '/trips/100', { as: ids.customer });
    await expectStatus(403, 'POST', '/legs/10/milestones', { as: ids.coordA, body: { milestoneType: 'DEPARTED', occurredAt: minutesAgo(1) } });
    await expectStatus(403, 'PATCH', '/incidents/1', { as: ids.manager, body: { status: 'ACKNOWLEDGED' } });
    await expectStatus(403, 'GET', '/operations/active-trips', { as: ids.customer });
  });

  await check('Scope: unassigned driver, other coordinator and other customer cannot reach trip 100 data', async () => {
    await expectStatus(403, 'POST', '/legs/10/milestones', { as: ids.driver2, body: { milestoneType: 'DEPARTED', occurredAt: minutesAgo(1) } });
    await expectStatus(404, 'GET', '/trips/100', { as: ids.driver2 });
    await expectStatus(404, 'GET', '/trips/100', { as: ids.coordB });
    await expectStatus(404, 'GET', '/trips/100/timeline', { as: ids.coordB });
    await expectStatus(404, 'GET', '/orders/50/timeline', { as: ids.customer2 });
    await expectStatus(404, 'GET', '/orders/999999/timeline', { as: ids.customer });
    const own = await expectStatus(200, 'GET', '/trips/100', { as: ids.coordA });
    assert.equal(own.horses.length, 2);
    assert.equal(own.legs[1].toLocationType, 'AIRPORT');
    const driverView = await expectStatus(200, 'GET', '/trips/100', { as: ids.driver });
    assert.deepEqual(driverView.crew.map(c => [c.userId, c.role, c.phone]), [['6', 'DRIVER', '0900000006'], ['10', 'ESCORT', null]]);
    assert.deepEqual(driverView.vehicles, [{ id: '5', code: 'XE-01', type: 'TRUCK', capacityStalls: 4 }]);
    assert.deepEqual(driverView.coordinator, { name: 'Điều Phối A', phone: '0900000003' });
    assert.deepEqual(driverView.customer, { name: 'Khách Một' });
    assert.deepEqual(driverView.recipient, { name: 'Người Nhận SG', phone: '+6560000050' });
    assert.equal(driverView.emergencyHotline, '1900 1080', 'HOTLINE from migration 1800000008000');
    await q("DELETE FROM system_parameters WHERE param_code='HOTLINE'");
    try { assert.equal((await expectStatus(200, 'GET', '/trips/100', { as: ids.driver })).emergencyHotline, null, 'no HOTLINE row → null'); }
    finally { await q("INSERT INTO system_parameters(param_code,param_value,description) VALUES ('HOTLINE','1900 1080','test')"); }
    const specialistView = await expectStatus(200, 'GET', '/trips/100', { as: ids.specialist });
    assert.deepEqual(specialistView.crew.map(c => [c.userId, c.phone]), [['6', null], ['10', null]]);
    assert.deepEqual(specialistView.coordinator, { name: 'Điều Phối A', phone: null });
    assert.deepEqual(specialistView.recipient, { name: 'Người Nhận SG', phone: null });
    assert.equal((await expectStatus(200, 'GET', '/driver/trips', { as: ids.driver })).length, 1);
    assert.equal((await expectStatus(200, 'GET', '/driver/trips', { as: ids.driver2 }))[0].id, '101');
  });

  await check('Customer sees the READY order timeline without internal fields', async () => {
    const t = await expectStatus(200, 'GET', '/orders/50/timeline', { as: ids.customer });
    assert.equal(t.orderStatus, 'READY');
    assert.equal(t.legs.length, 2);
    assert.ok(t.legs.every(l => l.status === 'NOT_STARTED' && !('id' in l) && !('vehicleCode' in l)));
    assert.equal(t.lastUpdatedAt, null);
  });

  await check('Time and sequence rules are enforced by the API (future, stale, jump, wrong leg type, non-last DELIVERED)', async () => {
    const before = await snapshot();
    assert.equal((await depart(new Date(Date.now() + 10 * 60 * 1000).toISOString())).status, 400);
    assert.equal((await depart(minutesAgo(200))).status, 400);
    assert.equal((await milestone(10, 'ARRIVED_AT_STOP', 1)).status, 409);
    assert.equal((await milestone(10, 'CUSTOMS_CLEARED', 1)).status, 409);
    assert.equal((await milestone(10, 'DELIVERED', 1)).status, 400);
    assert.equal((await call('POST', '/legs/11/milestones', { as: ids.driver, body: { milestoneType: 'DEPARTED', occurredAt: minutesAgo(1) } })).status, 409, 'leg 2 cannot start before leg 1 completes');
    assert.equal((await call('POST', '/legs/10/complete', { as: ids.driver, body: { occurredAt: minutesAgo(1) } })).status, 409);
    assert.deepEqual(await snapshot(), before, 'rejected requests change nothing');
  });

  await check('Role split: ESCORT cannot record milestones / complete legs / send GPS; DRIVER cannot write horse logs', async () => {
    const before = await snapshot();
    const logs = await count('SELECT COUNT(*) AS n FROM horse_logs');
    const positions = await count('SELECT COUNT(*) AS n FROM trip_positions');
    for (const [method, url, body] of [
      ['POST', '/legs/10/milestones', { milestoneType: 'DEPARTED', occurredAt: minutesAgo(1) }],
      ['POST', '/legs/10/complete', { occurredAt: minutesAgo(1) }],
      ['POST', '/trips/100/positions', { points: [{ latitude: 10.9, longitude: 106.4, recordedAt: minutesAgo(1) }] }],
    ]) {
      const res = await expectStatus(403, method, url, { as: ids.escort, body });
      assert.match(JSON.stringify(res), /Chỉ tài xế của chuyến mới được ghi mốc\/gửi vị trí/);
    }
    const driverLog = await expectStatus(403, 'POST', '/legs/10/horse-logs', { as: ids.driver, body: { horseId: '21', conditionStatus: 'STABLE', loggedAt: minutesAgo(1) } });
    assert.match(JSON.stringify(driverLog), /Nhật ký ngựa do hộ tống ghi/);
    assert.deepEqual(await snapshot(), before, 'rejected requests change nothing');
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), logs);
    assert.equal(await count('SELECT COUNT(*) AS n FROM trip_positions'), positions);
  });

  await check('Care activities (order READY): escort writes FEED/WATER/REST, DRIVER 403, correction hides the old row, summary and range rules, rollback', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'READY');
    const post = (body, as = ids.escort) => call('POST', '/trips/100/care-activities', { as, body });
    const feed = await expectStatus(201, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'FEED', horseId: '21', feedDescription: 'Cỏ khô 3 kg + cà rốt', performedAt: minutesAgo(30) } });
    assert.equal(feed.legId, null, 'chưa xuất phát: legId null');
    assert.equal(feed.horseName, 'Bạch Mã');
    assert.equal(feed.createdByName, 'Hộ Tống');
    const water = await expectStatus(201, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '22', amountLiters: 80, performedAt: minutesAgo(20) } });
    assert.equal(water.amountLiters, 80);
    const rest = await expectStatus(201, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'REST', horseId: null, durationMinutes: 20, note: 'Dừng nghỉ', performedAt: minutesAgo(10) } });
    assert.equal(rest.horseId, null);
    assert.equal(rest.horseName, null);

    // Quyền: tài xế của chuyến 403, người không phân công 404, điều phối / khách 403
    const body = { activityType: 'FEED', horseId: '21', feedDescription: 'x', performedAt: minutesAgo(1) };
    await expectStatus(403, 'POST', '/trips/100/care-activities', { as: ids.driver, body });
    await expectStatus(404, 'POST', '/trips/100/care-activities', { as: ids.driver2, body });
    await expectStatus(403, 'POST', '/trips/100/care-activities', { as: ids.coordA, body });
    await expectStatus(403, 'POST', '/trips/100/care-activities', { as: ids.customer, body });
    await expectStatus(401, 'POST', '/trips/100/care-activities', { body });
    // Dữ liệu sai: loại / trường, ngựa ngoài đơn, tương lai, quá cửa sổ nhập bù
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '21', performedAt: minutesAgo(1) } });
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'REST', durationMinutes: 20, amountLiters: 5, performedAt: minutesAgo(1) } });
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { ...body, horseId: '23' } });
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { ...body, performedAt: new Date(Date.now() + 600_000).toISOString() } });
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { ...body, performedAt: minutesAgo(600) } });
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_care_activities'), 3, 'bản ghi bị từ chối không để lại dòng');

    // Đính chính: sai ngựa / loại 400; đúng thì bản cũ bị ẩn; đính chính bản đã bị đính chính 409
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '21', amountLiters: 8, correctsActivityId: water.id, performedAt: minutesAgo(5) } });
    await expectStatus(400, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'FEED', horseId: '22', feedDescription: 'x', correctsActivityId: water.id, performedAt: minutesAgo(5) } });
    const fixed = await expectStatus(201, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '22', amountLiters: 8, correctsActivityId: water.id, performedAt: minutesAgo(5) } });
    assert.equal(fixed.correctsActivityId, water.id);
    await expectStatus(409, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '22', amountLiters: 9, correctsActivityId: water.id, performedAt: minutesAgo(4) } });

    // Đọc: mọi vai trò nội bộ trong phạm vi; danh sách mới nhất trước, bản gốc đã đính chính bị ẩn; summary đúng
    const list = await expectStatus(200, 'GET', '/trips/100/care-activities', { as: ids.coordA });
    assert.deepEqual(list.activities.map(item => item.id), [fixed.id, rest.id, feed.id], 'mới nhất trước, bản gốc 80 L bị ẩn');
    assert.equal(list.activities.some(item => item.id === water.id), false);
    assert.deepEqual(list.summary, { waterLiters: 8, meals: 1, rests: 1, restMinutes: 20, lastFeedAtByHorse: { 21: feed.performedAt } });
    for (const as of [ids.driver, ids.escort, ids.manager, ids.specialist]) assert.equal((await expectStatus(200, 'GET', '/trips/100/care-activities', { as })).activities.length, 3);
    await expectStatus(403, 'GET', '/trips/100/care-activities', { as: ids.customer });
    await expectStatus(404, 'GET', '/trips/100/care-activities', { as: ids.coordB });
    await expectStatus(404, 'GET', '/trips/100/care-activities', { as: ids.driver2 });
    await expectStatus(401, 'GET', '/trips/100/care-activities');
    // Khoảng from/to: lọc theo performed_at; thiếu một đầu / ngược / quá 7 ngày 400
    const range = (from, to) => `/trips/100/care-activities?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const recent = await expectStatus(200, 'GET', range(minutesAgo(15), new Date(Date.now() + 60_000).toISOString()), { as: ids.escort });
    assert.deepEqual(recent.activities.map(item => item.id), [fixed.id, rest.id], 'chỉ các bản trong khoảng');
    assert.deepEqual(recent.summary, { waterLiters: 8, meals: 0, rests: 1, restMinutes: 20, lastFeedAtByHorse: { 21: feed.performedAt } }, 'lần cho ăn 30 phút trước nằm ngoài from/to vẫn được trả');
    await expectStatus(400, 'GET', `/trips/100/care-activities?from=${encodeURIComponent(minutesAgo(15))}`, { as: ids.escort });
    await expectStatus(400, 'GET', range(minutesAgo(1), minutesAgo(15)), { as: ids.escort });
    await expectStatus(400, 'GET', range(minutesAgo(9 * 24 * 60), minutesAgo(1)), { as: ids.escort });

    // Audit trong cùng transaction; lỗi audit → rollback, không để lại hoạt động
    assert.equal(await count("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type = 'CARE_ACTIVITY' AND action = 'CREATE_CARE_ACTIVITY'"), 4);
    const rows = await count('SELECT COUNT(*) AS n FROM horse_care_activities');
    await failOn('audit_logs');
    try { await expectStatus(500, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { ...body, performedAt: minutesAgo(2) } }); } finally { await clearTrigger(); }
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_care_activities'), rows, 'rollback: không còn dòng hoạt động');
  });

  await check('Health report (order READY): validation, draft → edit → send, visibility, notifications, customer view, correction, rollback', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'READY');
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), 0);
    const files = stored();
    // Dữ liệu sai / sai quyền / sai chặng: không để lại dòng hay tệp mồ côi
    for (const [status, fields, photos, as, url] of [
      [400, baseReport({ bodyTempC: 50 }), 0, ids.escort], [400, baseReport({ heartRateBpm: 500 }), 0, ids.escort],
      [400, baseReport({ reportStatus: 'SENT' }), 0, ids.escort], // OFF_FEED gửi thiếu ảnh
      [400, baseReport({ reportStatus: 'SENT', customerNote: '' }), 1, ids.escort], // gửi khách thiếu ghi chú
      [400, { horseId: '21', conditionStatus: 'STABLE', loggedAt: minutesAgo(5), customerNote: 'x' }, 0, ids.escort], // trường báo cáo thiếu reportStatus
      [400, baseReport({ horseId: '23' }), 0, ids.escort],
      [409, baseReport(), 0, ids.escort, '/legs/11/horse-logs'], // đơn READY chỉ ghi vào chặng đầu
      [403, baseReport(), 0, ids.driver], [403, baseReport(), 0, ids.driver2], [403, baseReport(), 0, ids.coordA],
    ]) {
      await expectStatus(status, 'POST', url ?? '/legs/10/horse-logs', { as, body: reportForm(fields, photos) });
    }
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), 0);
    assert.equal(stored(), files, 'ảnh của request bị từ chối không còn trên đĩa');

    // Tạo nháp (1 ảnh có nhãn). Thiếu ảnh / ghi chú vẫn lưu được nháp.
    const draft = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ bodyTempC: 37.8, heartRateBpm: 38, appetite: 'REDUCED', note: 'Nội bộ: theo dõi thêm' }), 1, ['Toàn thân']) });
    assert.deepEqual([draft.reportStatus, draft.sentAt, draft.sendToCustomer, draft.bodyTempC, draft.heartRateBpm, draft.appetite], ['DRAFT', null, true, 37.8, 38, 'REDUCED']);
    assert.equal(draft.attachments[0].caption, 'Toàn thân');
    const lone = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ horseId: '22', conditionStatus: 'STRESSED', customerNote: '' }), 0) });
    assert.equal(lone.attachments.length, 0);
    assert.equal(await count('SELECT COUNT(*) AS n FROM notifications WHERE event_type LIKE \'HORSE_REPORT%\''), 0, 'nháp không thông báo');

    // Ai thấy nháp: chỉ người tạo (API đọc, timeline, ảnh)
    assert.deepEqual((await expectStatus(200, 'GET', '/trips/100/horse-logs', { as: ids.escort })).map(item => item.id), [draft.id, lone.id]);
    for (const as of [ids.driver, ids.coordA, ids.manager, ids.specialist]) {
      assert.equal((await expectStatus(200, 'GET', '/trips/100/horse-logs', { as })).length, 0, `nháp ẩn với ${as}`);
      assert.equal((await expectStatus(200, 'GET', '/trips/100/timeline', { as })).horseLogs.length, 0);
    }
    assert.equal((await expectStatus(200, 'GET', '/trips/100/timeline', { as: ids.escort })).horseLogs.length, 2);
    const draftPhoto = draft.attachments[0].id;
    assert.equal((await call('GET', `/attachments/${draftPhoto}`, { as: ids.escort })).status, 200);
    for (const as of [ids.driver, ids.coordA, ids.manager, ids.specialist, ids.customer]) assert.equal((await call('GET', `/attachments/${draftPhoto}`, { as })).status, 404, `ảnh nháp ẩn với ${as}`);
    assert.deepEqual(await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer }), []);

    // Sửa nháp: đổi nội dung, bỏ ảnh cũ, thêm ảnh mới; quyền và giới hạn
    const patch = (as, fields, photos = 0, captions = []) => call('PATCH', `/horse-logs/${draft.id}`, { as, body: reportForm(fields, photos, captions) });
    const edited = { conditionStatus: 'CLIMATE_CHANGE', loggedAt: minutesAgo(4), customerNote: 'Trời nóng, đã bổ sung nước', bodyTempC: 38.2, sendToCustomer: true };
    assert.equal((await patch(ids.driver, edited)).status, 403);
    assert.equal((await patch(ids.driver2, edited)).status, 404);
    assert.equal((await patch(ids.customer, edited)).status, 403);
    assert.equal((await patch(ids.escort, { ...edited, bodyTempC: 99 })).status, 400);
    assert.equal((await patch(ids.escort, edited, 3)).status, 400, 'vượt 3 ảnh');
    assert.equal((await call('PATCH', `/horse-logs/${draft.id}`, { as: ids.escort, body: reportForm({ ...edited, removeAttachmentIds: '99999' }) })).status, 400, 'ảnh không thuộc báo cáo');
    assert.equal(stored(), files + 1, 'các request lỗi không thêm / xóa tệp');
    const removeForm = reportForm(edited, 1, ['Chân & móng']);
    removeForm.append('removeAttachmentIds', draftPhoto);
    const editedLog = await expectStatus(200, 'PATCH', `/horse-logs/${draft.id}`, { as: ids.escort, body: removeForm });
    assert.deepEqual([editedLog.conditionStatus, editedLog.bodyTempC, editedLog.heartRateBpm, editedLog.appetite, editedLog.note], ['CLIMATE_CHANGE', 38.2, null, null, null], 'PATCH thay toàn bộ nội dung, trường vắng bị xóa');
    assert.deepEqual(editedLog.attachments.map(item => item.caption), ['Chân & móng']);
    assert.equal(stored(), files + 1, 'ảnh cũ bị xóa khỏi đĩa, ảnh mới được lưu');
    assert.equal((await call('GET', `/attachments/${draftPhoto}`, { as: ids.escort })).status, 404);

    // Gửi: nháp thiếu ảnh 400; thông báo lỗi giữa chừng thì rollback; gửi thành công thông báo đúng người, đúng liên kết
    await expectStatus(400, 'POST', `/horse-logs/${lone.id}/send`, { as: ids.escort, body: {} });
    await expectStatus(403, 'POST', `/horse-logs/${draft.id}/send`, { as: ids.driver, body: {} });
    await expectStatus(404, 'POST', `/horse-logs/${draft.id}/send`, { as: ids.driver2, body: {} });
    await expectStatus(404, 'POST', '/horse-logs/999999/send', { as: ids.escort, body: {} });
    const before = await snapshot();
    await failOn('notifications');
    try { await expectStatus(500, 'POST', `/horse-logs/${draft.id}/send`, { as: ids.escort, body: {} }); } finally { await clearTrigger(); }
    assert.deepEqual(await snapshot(), before, 'rollback: không đổi trạng thái, không thông báo, không audit');
    assert.deepEqual((await q('SELECT report_status AS s, sent_at AS at FROM horse_logs WHERE id = ?', [draft.id]))[0], { s: 'DRAFT', at: null });
    const sent = await expectStatus(200, 'POST', `/horse-logs/${draft.id}/send`, { as: ids.escort });
    assert.equal(sent.reportStatus, 'SENT');
    assert.ok(sent.sentAt);
    const notices = await q("SELECT recipient_id AS r, event_type AS e, related_type AS t, related_id AS id FROM notifications WHERE event_type LIKE 'HORSE_REPORT%' ORDER BY recipient_id");
    assert.deepEqual(notices.map(n => [Number(n.r), n.e, n.t, Number(n.id)]), [[1, 'HORSE_REPORT', 'ORDER', 50], [3, 'HORSE_REPORT_ALERT', 'TRIP', 100]]);
    assert.equal(await count("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'SEND_HORSE_REPORT'"), 1);
    // Bất biến: gửi lại / sửa / xóa → 409
    await expectStatus(409, 'POST', `/horse-logs/${draft.id}/send`, { as: ids.escort, body: {} });
    await expectStatus(409, 'PATCH', `/horse-logs/${draft.id}`, { as: ids.escort, body: reportForm(edited) });
    await expectStatus(409, 'DELETE', `/horse-logs/${draft.id}`, { as: ids.escort });
    assert.equal(await count('SELECT COUNT(*) AS n FROM notifications WHERE event_type LIKE \'HORSE_REPORT%\''), 2, 'không thông báo đôi');
    // Sau khi gửi, mọi người đọc nội bộ đều thấy bản đã gửi; nháp còn lại vẫn ẩn
    for (const as of [ids.driver, ids.coordA, ids.manager, ids.specialist]) assert.deepEqual((await expectStatus(200, 'GET', '/trips/100/horse-logs', { as })).map(item => item.id), [draft.id]);

    // Khách: đúng JSON hợp đồng, ảnh, đơn người khác 404, vai trò khác 403
    const reports = await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer });
    assert.equal(reports.length, 1);
    const report = reports[0];
    assert.deepEqual(Object.keys(report).sort(), ['appetite', 'bodyTempC', 'conditionStatus', 'customerNote', 'escortName', 'heartRateBpm', 'horseId', 'horseName', 'id', 'loggedAt', 'photos', 'sentAt', 'viewedAt']);
    assert.deepEqual([report.id, report.horseName, report.conditionStatus, report.bodyTempC, report.customerNote, report.escortName, report.viewedAt], [draft.id, 'Bạch Mã', 'CLIMATE_CHANGE', 38.2, 'Trời nóng, đã bổ sung nước', 'Hộ Tống', null]);
    assert.deepEqual(report.photos.map(({ caption, fileType }) => ({ caption, fileType })), [{ caption: 'Chân & móng', fileType: 'PNG' }]);
    await expectStatus(404, 'GET', '/orders/50/horse-reports', { as: ids.customer2 });
    for (const as of [ids.escort, ids.driver, ids.coordA, ids.manager]) await expectStatus(403, 'GET', '/orders/50/horse-reports', { as });
    const photoId = report.photos[0].id;
    const asCustomer = await call('GET', `/attachments/${photoId}`, { as: ids.customer });
    assert.equal(asCustomer.status, 200);
    assert.deepEqual(asCustomer.data, PNG);
    assert.equal((await call('GET', `/attachments/${photoId}`, { as: ids.customer2 })).status, 404);
    // Đánh dấu đã xem: idempotent, đơn người khác 404, báo cáo không thuộc đơn 404
    await expectStatus(404, 'POST', `/orders/50/horse-reports/${draft.id}/view`, { as: ids.customer2 });
    await expectStatus(404, 'POST', `/orders/50/horse-reports/${lone.id}/view`, { as: ids.customer });
    await expectStatus(403, 'POST', `/orders/50/horse-reports/${draft.id}/view`, { as: ids.escort });
    const first = await expectStatus(200, 'POST', `/orders/50/horse-reports/${draft.id}/view`, { as: ids.customer });
    const second = await expectStatus(200, 'POST', `/orders/50/horse-reports/${draft.id}/view`, { as: ids.customer });
    assert.ok(first.viewedAt);
    assert.equal(second.viewedAt, first.viewedAt, 'lần sau giữ nguyên thời điểm đầu');
    assert.equal((await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer }))[0].viewedAt, first.viewedAt);
    assert.equal((await expectStatus(200, 'GET', '/trips/100/horse-logs', { as: ids.coordA }))[0].customerViewedAt, first.viewedAt);

    // Đính chính: khách chỉ thấy bản mới nhất; bản đính chính chỉ nội bộ thì khách vẫn thấy bản trước
    await expectStatus(400, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'SENT', conditionStatus: 'STABLE', correctsLogId: lone.id, horseId: '21' })) }); // lone là nháp của ngựa khác
    const fix = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'SENT', conditionStatus: 'STABLE', customerNote: 'Đã ổn định lại', correctsLogId: draft.id })) });
    assert.equal(fix.correctsLogId, draft.id);
    assert.deepEqual((await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer })).map(item => item.id), [fix.id], 'bản gốc bị ẩn với khách');
    assert.equal((await expectStatus(200, 'GET', '/trips/100/horse-logs', { as: ids.coordA })).length, 2, 'điều phối vẫn thấy cả chuỗi');
    await expectStatus(409, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'SENT', conditionStatus: 'STABLE', customerNote: 'x', correctsLogId: draft.id })) });
    const internal = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'SENT', conditionStatus: 'STABLE', sendToCustomer: false, customerNote: '', correctsLogId: fix.id })) });
    assert.equal(internal.sendToCustomer, false);
    assert.deepEqual((await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer })).map(item => item.id), [fix.id], 'bản sửa chỉ nội bộ không thay thế bản khách đang xem');
    assert.deepEqual((await q("SELECT recipient_id AS r, event_type AS e FROM notifications WHERE event_type LIKE 'HORSE_REPORT%' ORDER BY id")).map(n => [Number(n.r), n.e]), [[1, 'HORSE_REPORT'], [3, 'HORSE_REPORT_ALERT'], [1, 'HORSE_REPORT']], 'STABLE không báo điều phối, không gửi khách thì không báo khách');

    // Xóa nháp: xóa dòng, ảnh và tệp; sau đó dọn dữ liệu của check này
    const again = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport(), 2, ['a', 'b']) });
    const withFiles = stored();
    await expectStatus(403, 'DELETE', `/horse-logs/${again.id}`, { as: ids.driver });
    await expectStatus(204, 'DELETE', `/horse-logs/${again.id}`, { as: ids.escort });
    assert.equal(stored(), withFiles - 2);
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs WHERE id = ?', [again.id]), 0);
    assert.equal(await count('SELECT COUNT(*) AS n FROM attachments WHERE horse_log_id = ?', [again.id]), 0);
    await purgeReports();
    assert.equal(stored(), files);
  });

  await check('Retroactive window T comes from system_parameters.LEG_BACK', async () => {
    await q("INSERT INTO system_parameters(param_code,param_value,description) VALUES ('LEG_BACK','30','test')");
    assert.equal((await depart(minutesAgo(45))).status, 400);
    await q("DELETE FROM system_parameters WHERE param_code='LEG_BACK'");
    await q("INSERT INTO system_parameters(param_code,param_value,description) VALUES ('LEG_BACK','abc','invalid')");
    assert.equal((await call('GET', '/driver/trips', { as: ids.driver })).status, 200, 'invalid parameter falls back to the default');
    await q("DELETE FROM system_parameters WHERE param_code='LEG_BACK'");
  });

  await check('Rollback: a failing notification insert undoes the leg, order, milestone and audit changes', async () => {
    const before = await snapshot();
    await failOn('notifications');
    try {
      const res = await depart(minutesAgo(60));
      assert.equal(res.status, 500);
    } finally { await clearTrigger(); }
    assert.deepEqual(await snapshot(), before);
  });

  await check('Flow 3 data is re-validated before the first departure and only transport (NORMAL) horses are tracked', async () => {
    const before = await snapshot();
    // Error bodies no longer carry `blockers`; each reason is spelled out in the 409 message.
    const blockedWith = async (reason, mutate, restore) => {
      await q(mutate);
      try {
        const r = await depart(minutesAgo(1));
        assert.equal(r.status, 409, reason + ' -> ' + JSON.stringify(r.data).slice(0, 200));
        assert.match(r.data.message, reason, 'reason reported: ' + r.data.message);
        assert.equal(r.data.blockers, undefined);
      } finally { await q(restore); }
    };
    await blockedWith(/xe không còn hoạt động/, 'UPDATE vehicles SET is_active=0 WHERE id=5', 'UPDATE vehicles SET is_active=1 WHERE id=5');
    await blockedWith(/Xe không đủ chỗ/, 'UPDATE vehicles SET capacity_stalls=1 WHERE id=5', 'UPDATE vehicles SET capacity_stalls=4 WHERE id=5');
    await blockedWith(/ngựa đang bị đánh dấu/, "UPDATE horses SET order_status='FLAGGED' WHERE id=22", "UPDATE horses SET order_status='NORMAL' WHERE id=22");
    await blockedWith(/Chưa có người hộ tống hợp lệ/, "UPDATE users SET account_status='LOCKED' WHERE id=10", "UPDATE users SET account_status='ACTIVE' WHERE id=10");
    assert.deepEqual(await snapshot(), before, 'a blocked departure changes nothing');
    await q("UPDATE horses SET order_status='REMOVED' WHERE id=22");
    try {
      const trip = await expectStatus(200, 'GET', '/driver/trips', { as: ids.driver });
      assert.equal(trip.length, 1);
      const detail = await expectStatus(200, 'GET', '/trips/100', { as: ids.coordA });
      assert.deepEqual(detail.horses.map(h => h.name), ['Bạch Mã'], 'removed horse is not part of the transport');
    } finally { await q("UPDATE horses SET order_status='NORMAL' WHERE id=22"); }
    await q("UPDATE trips SET plan_status='PENDING_APPROVAL' WHERE id=100");
    try { assert.equal((await expectStatus(200, 'GET', '/driver/trips', { as: ids.driver })).length, 0, 'unapproved plan is not shown to the crew'); }
    finally { await q("UPDATE trips SET plan_status='APPROVED' WHERE id=100"); }
  });

  await check('Concurrent departures: exactly one wins, order moves to IN_TRANSIT once, UTC time stored exactly', async () => {
    const at = minutesAgo(60).replace(/\.\d{3}Z$/, '.000Z');
    const results = await Promise.all([depart(at), depart(at), depart(at)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409, 409]);
    assert.equal(await count("SELECT COUNT(*) AS n FROM leg_milestones WHERE leg_id=10 AND milestone_type='DEPARTED'"), 1);
    const [row] = await q("SELECT DATE_FORMAT(occurred_at,'%Y-%m-%dT%H:%i:%s.000Z') AS at FROM leg_milestones WHERE leg_id=10");
    assert.equal(row.at, at);
    const snap = await snapshot();
    assert.equal(snap.order, 'IN_TRANSIT');
    assert.equal(snap.legs[0].status, 'MOVING');
    assert.equal(await count("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='ORDER' AND action='STATUS_CHANGE'"), 1);
    const notified = await q("SELECT recipient_id AS r, event_type AS e FROM notifications ORDER BY recipient_id, event_type");
    assert.deepEqual(notified.map(n => `${n.r}:${n.e}`), ['1:ORDER_IN_TRANSIT', '3:LEG_MILESTONE_UPDATED']);
    const dup = await depart(minutesAgo(59));
    assert.equal(dup.status, 409, 'recording the same milestone again is a conflict');
  });

  await check('Horse log: validation, ownership, photo stored and served only inside the trip scope', async () => {
    const good = { horseId: '21', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn sáng', loggedAt: minutesAgo(5) };
    await expectStatus(400, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: { ...good, conditionStatus: 'SICK' } });
    await expectStatus(400, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: { ...good, horseId: '23' } });
    await expectStatus(403, 'POST', '/legs/10/horse-logs', { as: ids.driver2, body: good });
    await expectStatus(403, 'POST', '/legs/10/horse-logs', { as: ids.driver, body: good }); // nhật ký ngựa do hộ tống ghi, tài xế của chuyến không được
    await expectStatus(400, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: { ...good, correctsLogId: '999' } });
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), 0);

    const created = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: photoForm({ ...good }) });
    assert.equal(created.attachments.length, 1);
    assert.equal(created.attachments[0].fileType, 'PNG');
    assert.equal(stored(), 1);
    const attachmentId = created.attachments[0].id;

    const asManager = await call('GET', `/attachments/${attachmentId}`, { as: ids.manager });
    assert.equal(asManager.status, 200);
    assert.equal(asManager.res.headers.get('content-type'), 'image/png');
    assert.equal(asManager.res.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(asManager.data, PNG);
    assert.equal((await call('GET', `/attachments/${attachmentId}`, { as: ids.specialist })).status, 200);
    assert.equal((await call('GET', `/attachments/${attachmentId}`, { as: ids.coordA })).status, 200);
    assert.equal((await call('GET', `/attachments/${attachmentId}`, { as: ids.coordB })).status, 404);
    assert.equal((await call('GET', `/attachments/${attachmentId}`, { as: ids.driver2 })).status, 404);
    assert.equal((await call('GET', `/attachments/${attachmentId}`, { as: ids.customer })).status, 404, 'khách mở route ảnh nhưng ảnh nhật ký cũ không phải của họ');

    // Correction points to the original, same horse and trip; the log itself is immutable (no PUT/PATCH/DELETE).
    const corrected = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: { horseId: '21', conditionStatus: 'STABLE', loggedAt: minutesAgo(2), correctsLogId: created.id } });
    assert.equal(corrected.correctsLogId, created.id);
    await expectStatus(400, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: { horseId: '22', conditionStatus: 'STABLE', loggedAt: minutesAgo(1), correctsLogId: created.id } });
    for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal((await call(method, `/legs/10/horse-logs/${created.id}`, { as: ids.driver, body: {} })).status, 404);
    const logs = await expectStatus(200, 'GET', '/trips/100/horse-logs', { as: ids.specialist });
    assert.equal(logs.length, 2);
    assert.deepEqual(logs.map(item => item.createdByCrewRole), ['ESCORT', 'ESCORT'], 'nhật ký ghi bởi hộ tống mang createdByCrewRole = ESCORT');
    await expectStatus(404, 'GET', '/trips/100/horse-logs', { as: ids.driver2 });
  });

  await check('Care activities (order IN_TRANSIT): legId follows the running leg', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'IN_TRANSIT');
    const running = (await q("SELECT CAST(id AS CHAR) AS id FROM legs WHERE trip_id = 100 AND status IN ('MOVING','AT_STOP') ORDER BY seq_no LIMIT 1"))[0].id;
    const made = await expectStatus(201, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'WATER', horseId: '21', amountLiters: 12.5, performedAt: minutesAgo(1) } });
    assert.equal(made.legId, running);
    const list = await expectStatus(200, 'GET', '/trips/100/care-activities', { as: ids.escort });
    assert.equal(list.activities[0].id, made.id);
    assert.equal(list.summary.waterLiters, 20.5, '8 L đã đính chính + 12,5 L');
  });

  await check('Rollback: failing attachment insert leaves no horse log and removes the stored photo', async () => {
    const files = stored();
    const logs = await count('SELECT COUNT(*) AS n FROM horse_logs');
    await failOn('attachments');
    try {
      await expectStatus(500, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: photoForm({ horseId: '22', conditionStatus: 'STABLE', loggedAt: minutesAgo(1) }) });
    } finally { await clearTrigger(); }
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), logs);
    assert.equal(stored(), files, 'no orphan file after rollback');
  });

  await check('Health report (order IN_TRANSIT): only a started leg; sent report reaches the customer; one draft is kept for the DELIVERED check', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'IN_TRANSIT');
    const legStatus = id => q('SELECT status FROM legs WHERE id = ?', [id]).then(rows => rows[0].status);
    assert.equal(await legStatus(11), 'NOT_STARTED');
    await expectStatus(409, 'POST', '/legs/11/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'DRAFT' })) });
    const sent = await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'SENT', conditionStatus: 'STRESSED' }), 1, ['Trong khoang']) });
    assert.equal(sent.reportStatus, 'SENT');
    const reports = await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer });
    assert.deepEqual(reports.map(item => item.id), [sent.id], 'nhật ký cũ không lẫn vào danh sách của khách');
    assert.deepEqual((await q("SELECT recipient_id AS r, event_type AS e FROM notifications WHERE event_type LIKE 'HORSE_REPORT%' ORDER BY recipient_id")).map(n => [Number(n.r), n.e]), [[1, 'HORSE_REPORT'], [3, 'HORSE_REPORT_ALERT']]);
    assert.equal((await call('GET', `/attachments/${reports[0].photos[0].id}`, { as: ids.customer })).status, 200);
    // Ảnh của nhật ký cũ / sự cố không bao giờ mở cho khách
    const legacyPhoto = (await q("SELECT a.id FROM attachments a JOIN horse_logs h ON h.id = a.horse_log_id WHERE h.report_status IS NULL LIMIT 1"))[0].id;
    assert.equal((await call('GET', `/attachments/${legacyPhoto}`, { as: ids.customer })).status, 404);
    await purgeReports();
    await expectStatus(201, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ conditionStatus: 'STABLE' }), 1, ['Toàn thân']) });
    assert.equal(await count("SELECT COUNT(*) AS n FROM horse_logs WHERE report_status = 'DRAFT'"), 1);
  });

  await check('Incident: HORSE_MEDICAL is HIGH and notifies managers and the trip coordinator; dashboard counts open incidents', async () => {
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'HORSE_MEDICAL', description: 'Đau bụng', severity: 'RED', damageTarget: 'HORSE' } });
    await expectStatus(404, 'POST', '/trips/100/incidents', { as: ids.driver2, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', severity: 'ORANGE', damageTarget: 'VEHICLE' } });
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', legId: '12', severity: 'ORANGE', damageTarget: 'VEHICLE' } });
    // D2 (bước F): thiếu mức độ / đối tượng hư hại, loại con sai loại, tọa độ thiếu cặp → 400, không tạo bản ghi.
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', damageTarget: 'VEHICLE' } });
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', severity: 'RED' } });
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', subType: 'COLIC', severity: 'ORANGE', damageTarget: 'VEHICLE' } });
    await expectStatus(400, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'VEHICLE_BREAKDOWN', description: 'Hỏng xe nặng', latitude: 10.5, severity: 'ORANGE', damageTarget: 'VEHICLE' } });
    assert.equal(await count('SELECT COUNT(*) AS n FROM incidents'), 0);
    const incident = await expectStatus(201, 'POST', '/trips/100/incidents', { as: ids.driver, body: photoForm({ incidentType: 'HORSE_MEDICAL', description: 'Ngựa đau bụng', horseId: '21', legId: '10', severity: 'YELLOW', damageTarget: 'HORSE', subType: 'COLIC' }) });
    assert.equal(incident.urgency, 'HIGH');
    assert.equal(incident.status, 'NEW');
    assert.equal(incident.attachments.length, 1);
    const [row] = await q('SELECT urgency, status FROM incidents WHERE id=?', [incident.id]);
    assert.deepEqual({ ...row }, { urgency: 'HIGH', status: 'NEW' });
    const recipients = await q("SELECT recipient_id AS r FROM notifications WHERE event_type='INCIDENT_REPORTED' ORDER BY recipient_id");
    assert.deepEqual(recipients.map(r => r.r), ['2', '3']);
    // Ca D2 đầy đủ: vị trí GPS + mô tả vị trí, 2 ảnh có nhãn (field `captions` lặp theo thứ tự ảnh).
    const located = new FormData();
    for (const [key, value] of Object.entries({ incidentType: 'LONG_TRAFFIC_JAM', description: 'Kẹt xe 40 phút', severity: 'ORANGE', damageTarget: 'VEHICLE', subType: 'ROAD_WORKS', latitude: '18.342100', longitude: '105.905700', locationText: 'Km 742 QL1A, Hà Tĩnh' })) located.set(key, value);
    located.append('captions', 'Toàn xe');
    located.append('captions', 'Lốp sau');
    located.append('photos', new Blob([PNG], { type: 'image/png' }), 'xe.png');
    located.append('photos', new Blob([PNG], { type: 'image/png' }), 'lop.png');
    const minor = await expectStatus(201, 'POST', '/trips/100/incidents', { as: ids.escort, body: located });
    assert.equal(minor.urgency, 'NORMAL', 'ORANGE + VEHICLE is NORMAL');
    assert.deepEqual([minor.severity, minor.subType, minor.damageTarget, minor.latitude, minor.longitude, minor.locationText],
      ['ORANGE', 'ROAD_WORKS', 'VEHICLE', 18.3421, 105.9057, 'Km 742 QL1A, Hà Tĩnh']);
    const [locatedRow] = await q('SELECT severity, sub_type AS subType, damage_target AS damageTarget, CAST(latitude AS CHAR) AS lat, CAST(longitude AS CHAR) AS lng, location_text AS locationText FROM incidents WHERE id=?', [minor.id]);
    assert.deepEqual({ ...locatedRow }, { severity: 'ORANGE', subType: 'ROAD_WORKS', damageTarget: 'VEHICLE', lat: '18.342100', lng: '105.905700', locationText: 'Km 742 QL1A, Hà Tĩnh' });
    const captions = await q('SELECT caption FROM attachments WHERE incident_id=? ORDER BY id', [minor.id]);
    assert.deepEqual(captions.map(r => r.caption), ['Toàn xe', 'Lốp sau']);
    const [medicalRow] = await q('SELECT severity, sub_type AS subType, damage_target AS damageTarget, latitude FROM incidents WHERE id=?', [incident.id]);
    assert.deepEqual({ ...medicalRow }, { severity: 'YELLOW', subType: 'COLIC', damageTarget: 'HORSE', latitude: null }, 'HORSE_MEDICAL stays HIGH even when YELLOW');

    const dash = await expectStatus(200, 'GET', '/operations/active-trips', { as: ids.manager });
    assert.deepEqual(dash.summary, { inTransit: 1, openIncidents: 2, overdueTrips: 1 });
    assert.equal(dash.items[0].highUrgencyOpenIncidents, 1);
    assert.equal(dash.items[0].currentLeg.seqNo, 1);
    assert.equal((await expectStatus(200, 'GET', '/operations/active-trips', { as: ids.specialist })).items.length, 1);
    assert.equal((await expectStatus(200, 'GET', '/operations/active-trips', { as: ids.coordA })).items.length, 1);
    assert.equal((await expectStatus(200, 'GET', '/operations/active-trips', { as: ids.coordB })).items.length, 0, 'coordinator B has no active trip of his own');

    await expectStatus(403, 'GET', '/trips/100/incidents', { as: ids.specialist });
    assert.equal((await expectStatus(200, 'GET', '/trips/100/incidents', { as: ids.manager })).length, 2);
    const specialistView = await expectStatus(200, 'GET', '/trips/100/timeline', { as: ids.specialist });
    assert.deepEqual(specialistView.incidents, []);
    assert.equal((await expectStatus(200, 'GET', '/trips/100/timeline', { as: ids.manager })).incidents.length, 2);
    assert.equal((await call('GET', `/attachments/${incident.attachments[0].id}`, { as: ids.specialist })).status, 404, 'incident photos hidden from specialist');
    assert.equal((await call('GET', `/attachments/${incident.attachments[0].id}`, { as: ids.driver })).status, 200);
    globalThis.__incident = incident.id;
  });

  await check('Incident handling: only the owning coordinator; close requires a note; one-way flow with audit and reporter notice', async () => {
    const id = globalThis.__incident;
    await expectStatus(404, 'PATCH', `/incidents/${id}`, { as: ids.coordB, body: { status: 'ACKNOWLEDGED' } });
    await expectStatus(400, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'CLOSED' } });
    await expectStatus(400, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'CLOSED', handlingNote: '   ' } });
    const ack = await expectStatus(200, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'ACKNOWLEDGED' } });
    assert.equal(ack.status, 'ACKNOWLEDGED');
    await expectStatus(409, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'ACKNOWLEDGED' } });
    const closed = await expectStatus(200, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'CLOSED', handlingNote: 'Đã đưa ngựa tới thú y' } });
    assert.equal(closed.status, 'CLOSED');
    const [row] = await q('SELECT status, received_by AS receiver, handling_note AS note, closed_at AS closed FROM incidents WHERE id=?', [id]);
    assert.equal(row.status, 'CLOSED');
    assert.equal(row.receiver, '3');
    assert.equal(row.note, 'Đã đưa ngựa tới thú y');
    assert.ok(row.closed);
    await expectStatus(409, 'PATCH', `/incidents/${id}`, { as: ids.coordA, body: { status: 'CLOSED', handlingNote: 'lần hai' } });
    assert.equal(await count("SELECT COUNT(*) AS n FROM audit_logs WHERE entity_type='INCIDENT' AND entity_id=?", [id]), 3);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE recipient_id=6 AND event_type IN ('INCIDENT_ACKNOWLEDGED','INCIDENT_CLOSED')"), 2);
  });

  await check('Alert: owning coordinator only; stored with author; crew, managers and the order customer notified', async () => {
    const body = { alertType: 'WEATHER', content: 'Mưa lớn trên tuyến, giảm tốc độ' };
    await expectStatus(403, 'POST', '/trips/100/alerts', { as: ids.manager, body });
    await expectStatus(404, 'POST', '/trips/100/alerts', { as: ids.coordB, body });
    await expectStatus(400, 'POST', '/trips/100/alerts', { as: ids.coordA, body: { alertType: 'FIRE', content: 'Nội dung hợp lệ' } });
    const alert = await expectStatus(201, 'POST', '/trips/100/alerts', { as: ids.coordA, body });
    assert.equal(alert.sentBy, '3');
    assert.equal(alert.sentByName, 'Điều Phối A');
    const recipients = await q("SELECT recipient_id AS r FROM notifications WHERE event_type='TRIP_ALERT' ORDER BY recipient_id");
    assert.deepEqual(recipients.map(r => r.r), ['1', '2', '6', '10']);
    assert.equal((await expectStatus(200, 'GET', '/trips/100/alerts', { as: ids.driver })).length, 1);
  });

  await check('Map + GPS: scope, STRAIGHT without Mapbox token, VMAX, batched positions are idempotent, GPS replaces the estimate, retention purge', async () => {
    const pointAt = (minutes, extra = {}) => ({ latitude: 10.95, longitude: 106.4, recordedAt: minutesAgo(minutes), ...extra });
    await expectStatus(403, 'GET', '/trips/100/map', { as: ids.customer });
    await expectStatus(404, 'GET', '/trips/100/map', { as: ids.driver2 });
    await expectStatus(404, 'GET', '/trips/100/map', { as: ids.coordB });
    const before = await expectStatus(200, 'GET', '/trips/100/map', { as: ids.driver });
    assert.deepEqual(before.stops.map(stop => [stop.locationId, stop.lat, stop.lng]), [['1', 10.85, 106.6], ['2', 11.076, 106.158], ['3', 1.3644, 103.9915]]);
    assert.deepEqual(before.legs.map(leg => [leg.id, leg.status, leg.mode, leg.coordinates.length]), [['10', 'MOVING', 'STRAIGHT', 2], ['11', 'NOT_STARTED', 'STRAIGHT', 2]]);
    assert.ok(before.totalKm > 1000, 'HCM → border → Singapore');
    assert.equal(before.speedLimitKmh, 80, 'VMAX from migration 1800000009000');
    assert.equal(before.latestPosition, null);
    assert.equal(before.position.source, 'ESTIMATED');
    assert.match(before.position.label, /^Ước tính theo kế hoạch, không phải GPS/);
    assert.ok(before.warnings.some(w => w.startsWith('Chặng 1: chưa có tuyến đường bộ')));
    assert.equal(await count('SELECT COUNT(*) AS n FROM location_routes'), 0, 'no token: nothing cached, retried once a token exists');
    assert.equal((await expectStatus(200, 'GET', '/trips/100/map', { as: ids.specialist })).legs.length, 2);
    await q("DELETE FROM system_parameters WHERE param_code='VMAX'");
    try { assert.equal((await expectStatus(200, 'GET', '/trips/100/map', { as: ids.manager })).speedLimitKmh, null, 'no VMAX row → null'); }
    finally { await q("INSERT INTO system_parameters(param_code,param_value,description) VALUES ('VMAX','80','test')"); }

    // Gửi vị trí: chỉ người được phân công, chuyến đang chạy, dữ liệu hợp lệ
    await expectStatus(403, 'POST', '/trips/100/positions', { as: ids.coordA, body: { points: [pointAt(1)] } });
    await expectStatus(404, 'POST', '/trips/100/positions', { as: ids.driver2, body: { points: [pointAt(1)] } });
    await expectStatus(409, 'POST', '/trips/101/positions', { as: ids.driver2, body: { points: [pointAt(1)] } }); // đơn 51 vẫn READY
    await expectStatus(400, 'POST', '/trips/100/positions', { as: ids.driver, body: { points: [pointAt(-5)] } });
    await expectStatus(400, 'POST', '/trips/100/positions', { as: ids.driver, body: { points: [pointAt(1, { latitude: 91 })] } });
    await expectStatus(400, 'POST', '/trips/100/positions', { as: ids.driver, body: { points: Array.from({ length: 21 }, (_, i) => pointAt(i + 1)) } });
    const batch = { points: [pointAt(2, { speedMps: 15, accuracyM: 8 }), pointAt(1, { latitude: 10.96, longitude: 106.39, speedMps: 17.8, headingDeg: 300 })] };
    assert.deepEqual(await expectStatus(201, 'POST', '/trips/100/positions', { as: ids.driver, body: batch }), { legId: '10', accepted: 2, duplicates: 0 });
    assert.deepEqual(await expectStatus(201, 'POST', '/trips/100/positions', { as: ids.driver, body: batch }), { legId: '10', accepted: 0, duplicates: 2 }, 'resend after a network error is idempotent');
    // Hộ tống không được gửi GPS; "cùng giây, người gửi khác" kiểm bằng một tài xế thứ hai của chuyến (user 11, bỏ phân công ngay sau đó)
    await expectStatus(403, 'POST', '/trips/100/positions', { as: ids.escort, body: { points: [pointAt(1)] } });
    await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status,phone) VALUES (11,'driver3@t.local','!','Tài Xế Ba','DRIVER_ESCORT','ACTIVE',NULL)`);
    await q(`INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (100,11,'DRIVER',3,UTC_TIMESTAMP())`);
    assert.deepEqual(await expectStatus(201, 'POST', '/trips/100/positions', { as: '11', body: { points: [pointAt(1)] } }), { legId: '10', accepted: 1, duplicates: 0 }, 'same second, different sender');
    await q('DELETE FROM trip_assignments WHERE trip_id = 100 AND user_id = 11');
    const stored = await q('SELECT CAST(user_id AS CHAR) AS u, CAST(leg_id AS CHAR) AS l, CAST(latitude AS CHAR) AS lat, speed_mps AS s FROM trip_positions ORDER BY recorded_at, user_id');
    assert.deepEqual(stored.map(r => [r.u, r.l, r.lat]), [['6', '10', '10.950000'], ['6', '10', '10.960000'], ['11', '10', '10.950000']]);

    const after = await expectStatus(200, 'GET', '/trips/100/map', { as: ids.coordA });
    assert.equal(after.position.source, 'GPS');
    assert.equal(after.latestPosition.freshness, 'LIVE');
    assert.ok(after.remainingKm > 0 && after.remainingKm < after.totalKm);
    const track = await expectStatus(200, 'GET', '/trips/100/positions', { as: ids.manager });
    assert.equal(track.length, 3);
    assert.ok(Date.parse(track[0].recordedAt) <= Date.parse(track[2].recordedAt), 'oldest first');
    assert.equal(track.find(p => p.lat === 10.96).speedKmh, 64.1);
    assert.equal((await expectStatus(200, 'GET', `/trips/100/positions?since=${encodeURIComponent(minutesAgo(1.5))}`, { as: ids.specialist })).length, 2);
    await expectStatus(403, 'GET', '/trips/100/positions', { as: ids.customer });

    // Migration 1800000010000: cache tuyến ROAD (bản simplified cũ) bị xóa, STRAIGHT ("không có đường bộ") giữ nguyên.
    await q("INSERT INTO location_routes(from_location_id,to_location_id,mode,coordinates) VALUES (1,2,'ROAD','[[106.6,10.85],[106.158,11.076]]'),(2,3,'STRAIGHT','[[106.158,11.076],[103.9915,1.3644]]')");
    const { RouteCacheFull1800000010000 } = require('../src/database/migrations/1800000010000-RouteCacheFull');
    const runner = db.createQueryRunner();
    try { await new RouteCacheFull1800000010000().up(runner); } finally { await runner.release(); }
    assert.deepEqual((await q('SELECT mode FROM location_routes ORDER BY id')).map(r => r.mode), ['STRAIGHT']);
    await q('DELETE FROM location_routes');

    // Dọn dữ liệu cá nhân cũ hơn TRACK_POSITION_RETENTION_DAYS (mặc định 30)
    await q("INSERT INTO trip_positions(trip_id,leg_id,user_id,latitude,longitude,recorded_at) VALUES (100,10,6,10.9,106.4,UTC_TIMESTAMP() - INTERVAL 31 DAY)");
    assert.equal(await new TrackingService(new TrackingRepository(db)).purgeOldPositions(), 1);
    assert.equal(await count('SELECT COUNT(*) AS n FROM trip_positions'), 3, 'recent points kept');
  });

  await check('Leg flow with border: complete is blocked until customs, last leg only via DELIVERED, order becomes DELIVERED', async () => {
    assert.equal((await milestone(10, 'ARRIVED_AT_STOP', 50)).status, 201);
    assert.equal((await call('POST', '/legs/10/complete', { as: ids.driver, body: { occurredAt: minutesAgo(48) } })).status, 409, 'border needs customs first');
    assert.equal((await milestone(10, 'CUSTOMS_CLEARED', 45)).status, 201);
    const touched = (await q('SELECT updated_by AS actor FROM legs WHERE id=10'))[0];
    assert.equal(touched.actor, '6', 'customs touches the leg author');
    assert.equal((await call('POST', '/legs/10/complete', { as: ids.driver, body: { occurredAt: minutesAgo(40) } })).status, 200);
    assert.equal((await call('POST', '/legs/10/complete', { as: ids.driver, body: { occurredAt: minutesAgo(39) } })).status, 409, 'already completed');

    assert.equal((await call('POST', '/legs/11/complete', { as: ids.driver, body: { occurredAt: minutesAgo(1) } })).status, 400, 'the last leg never uses intermediate completion');
    assert.equal((await milestone(11, 'DEPARTED', 35)).status, 201);
    assert.equal((await milestone(11, 'ARRIVED_AT_STOP', 30)).status, 201);
    const last = await call('POST', '/legs/11/complete', { as: ids.driver, body: { occurredAt: minutesAgo(25) } });
    assert.equal(last.status, 400, 'last leg cannot use intermediate completion');
    const early = await milestone(11, 'DELIVERED', 31);
    assert.equal(early.status, 400, 'DELIVERED cannot be earlier than arrival');
    const delivered = await milestone(11, 'DELIVERED', 20);
    assert.equal(delivered.status, 201);
    assert.equal(delivered.data.orderStatus, 'DELIVERED');
    const snap = await snapshot();
    assert.equal(snap.order, 'DELIVERED');
    assert.deepEqual(snap.legs.map(l => l.status), ['COMPLETED', 'COMPLETED']);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE recipient_id=1 AND event_type='ORDER_DELIVERED'"), 1);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE recipient_id=1 AND event_type='ORDER_LEG_PROGRESS'"), 4);
    await expectStatus(409, 'POST', '/trips/100/incidents', { as: ids.driver, body: { incidentType: 'LONG_TRAFFIC_JAM', description: 'Sau khi giao', severity: 'YELLOW', damageTarget: 'VEHICLE' } });
    await expectStatus(409, 'POST', '/trips/100/positions', { as: ids.driver, body: { points: [{ latitude: 1.36, longitude: 103.99, recordedAt: minutesAgo(1) }] } });
    assert.equal((await expectStatus(200, 'GET', '/trips/100/map', { as: ids.manager })).remainingKm, 0, 'delivered → nothing left');
    await expectStatus(409, 'POST', '/trips/100/alerts', { as: ids.coordA, body: { alertType: 'TRAFFIC', content: 'Sau khi giao hàng' } });
  });

  await check('Customer and internal timelines after delivery: last update author, milestones and no active trip left', async () => {
    const t = await expectStatus(200, 'GET', '/orders/50/timeline', { as: ids.customer });
    assert.equal(t.orderStatus, 'DELIVERED');
    assert.deepEqual(t.legs.map(l => l.status), ['COMPLETED', 'COMPLETED']);
    assert.deepEqual(t.legs[0].milestones.map(m => m.milestoneType), ['DEPARTED', 'ARRIVED_AT_STOP', 'CUSTOMS_CLEARED']);
    assert.equal(t.legs[1].latestMilestone, 'DELIVERED');
    assert.equal(t.lastUpdatedByName, 'Tài Xế');
    assert.ok(t.lastUpdatedAt);
    assert.ok(t.legs.every(l => l.isOverdue === false));
    const trip = await expectStatus(200, 'GET', '/trips/100/timeline', { as: ids.manager });
    assert.equal(trip.legs[1].milestones.at(-1).recordedByName, 'Tài Xế');
    assert.equal(trip.horseLogs.length, 2);
    assert.equal(trip.alerts.length, 1);
    const dash = await expectStatus(200, 'GET', '/operations/active-trips', { as: ids.manager });
    assert.deepEqual(dash.summary, { inTransit: 0, openIncidents: 1, overdueTrips: 0 }, 'the unclosed minor incident keeps the trip listed');
  });

  await check('Care activities (order DELIVERED): writing is blocked with 409, reading still works', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'DELIVERED');
    const before = await count('SELECT COUNT(*) AS n FROM horse_care_activities');
    await expectStatus(409, 'POST', '/trips/100/care-activities', { as: ids.escort, body: { activityType: 'FEED', horseId: '21', feedDescription: 'Sau khi giao', performedAt: minutesAgo(1) } });
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_care_activities'), before);
    assert.ok((await expectStatus(200, 'GET', '/trips/100/care-activities', { as: ids.escort })).activities.length > 0);
  });

  await check('Health report (order DELIVERED): writing and sending are blocked, a leftover draft can still be deleted', async () => {
    assert.equal((await q("SELECT status FROM orders WHERE id=50"))[0].status, 'DELIVERED');
    const draft = (await q("SELECT CAST(id AS CHAR) AS id FROM horse_logs WHERE report_status = 'DRAFT'"))[0].id;
    await expectStatus(409, 'POST', '/legs/10/horse-logs', { as: ids.escort, body: reportForm(baseReport({ reportStatus: 'DRAFT' })) });
    await expectStatus(409, 'PATCH', `/horse-logs/${draft}`, { as: ids.escort, body: reportForm({ conditionStatus: 'STABLE', loggedAt: minutesAgo(1) }) });
    await expectStatus(409, 'POST', `/horse-logs/${draft}/send`, { as: ids.escort, body: {} });
    assert.deepEqual(await expectStatus(200, 'GET', '/orders/50/horse-reports', { as: ids.customer }), [], 'khách vẫn đọc được (rỗng vì chưa có bản gửi)');
    const files = stored();
    await expectStatus(204, 'DELETE', `/horse-logs/${draft}`, { as: ids.escort });
    assert.equal(stored(), files - 1);
    assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs WHERE report_status IS NOT NULL'), 0);
  });

  await check('Correction: reason required, ownership, sequence rules; milestones and order stay consistent with audit trail', async () => {
    const reason = 'Tài xế báo nhầm điểm đến';
    await expectStatus(400, 'PATCH', '/legs/11/correct', { as: ids.coordA, body: { status: 'AT_STOP' } });
    await expectStatus(400, 'PATCH', '/legs/11/correct', { as: ids.coordA, body: { status: 'AT_STOP', reason: '   ' } });
    await expectStatus(400, 'PATCH', '/legs/11/correct', { as: ids.coordA, body: { status: 'COMPLETED', reason } });
    await expectStatus(403, 'PATCH', '/legs/11/correct', { as: ids.coordB, body: { status: 'AT_STOP', reason } });
    await expectStatus(403, 'PATCH', '/legs/11/correct', { as: ids.driver, body: { status: 'AT_STOP', reason } });
    await expectStatus(409, 'PATCH', '/legs/10/correct', { as: ids.coordA, body: { status: 'MOVING', reason } });

    const back = await expectStatus(200, 'PATCH', '/legs/11/correct', { as: ids.coordA, body: { status: 'AT_STOP', reason } });
    assert.equal(back.orderStatus, 'IN_TRANSIT');
    assert.equal(await count("SELECT COUNT(*) AS n FROM leg_milestones WHERE leg_id=11 AND milestone_type='DELIVERED'"), 0);
    assert.equal((await q('SELECT status FROM orders WHERE id=50'))[0].status, 'IN_TRANSIT');
    const [audit] = await q("SELECT old_value AS o, new_value AS n, reason AS r FROM audit_logs WHERE action='CORRECT_LEG_STATUS' ORDER BY id DESC LIMIT 1");
    assert.equal(audit.r, reason);
    assert.match(audit.o, /DELIVERED/);
    assert.match(audit.n, /AT_STOP/);
    assert.equal(await count("SELECT COUNT(*) AS n FROM notifications WHERE event_type='LEG_CORRECTED' AND recipient_id IN (1,2,3,6,10)"), 5);

    const again = await expectStatus(200, 'PATCH', '/legs/11/correct', { as: ids.manager, body: { status: 'COMPLETED', reason: 'Giao thực tế đã xong' } });
    assert.equal(again.orderStatus, 'DELIVERED');
    assert.equal(await count("SELECT COUNT(*) AS n FROM leg_milestones WHERE leg_id=11 AND milestone_type='DELIVERED'"), 1);

    const reset = await expectStatus(200, 'PATCH', '/legs/11/correct', { as: ids.coordA, body: { status: 'NOT_STARTED', reason: 'Chưa xuất phát chặng 2' } });
    assert.equal(reset.orderStatus, 'IN_TRANSIT', 'leg 1 is still completed');
    const [leg2] = await q('SELECT status, actual_departure_at AS dep, actual_arrival_at AS arr FROM legs WHERE id=11');
    assert.deepEqual({ ...leg2 }, { status: 'NOT_STARTED', dep: null, arr: null });
    assert.equal(await count('SELECT COUNT(*) AS n FROM leg_milestones WHERE leg_id=11'), 0);

    const home = await expectStatus(200, 'PATCH', '/legs/10/correct', { as: ids.coordA, body: { status: 'NOT_STARTED', reason: 'Chưa xuất phát' } });
    assert.equal(home.orderStatus, 'READY');
    assert.equal(await count('SELECT COUNT(*) AS n FROM leg_milestones WHERE leg_id IN (10,11)'), 0);

    await q("UPDATE orders SET status='CANCELLED' WHERE id=50");
    await expectStatus(409, 'PATCH', '/legs/10/correct', { as: ids.coordA, body: { status: 'MOVING', reason } });
    await q("UPDATE orders SET status='READY' WHERE id=50");
  });

  await check('Foreign trip is isolated from trip 100 activity', async () => {
    const other = await expectStatus(200, 'GET', '/trips/101/timeline', { as: ids.coordB });
    assert.equal(other.horseLogs.length, 0);
    assert.equal(other.incidents.length, 0);
    assert.equal(other.legs[0].status, 'NOT_STARTED');
    await expectStatus(404, 'GET', '/trips/101/timeline', { as: ids.coordA });
    await expectStatus(404, 'GET', '/trips/101/incidents', { as: ids.driver });
  });

  await check('EscortHorseCare migration: columns, tables, CHECKs and index; old rows untouched; re-runnable; down() then up(); hasHistory sees care activities', async () => {
    const { EscortHorseCare1800000013000 } = require('../src/database/migrations/1800000013000-EscortHorseCare');
    const { TripsRepository } = require('../src/features/trips/trips.repository');
    const migration = new EscortHorseCare1800000013000();
    const newColumns = ['body_temp_c', 'heart_rate_bpm', 'appetite', 'customer_note', 'report_status', 'send_to_customer', 'sent_at', 'customer_viewed_at'];
    const columns = async () => (await q('SHOW COLUMNS FROM horse_logs')).map(column => column.Field);
    const tableExists = async () => (await q("SHOW TABLES LIKE 'horse_care_activities'")).length === 1;
    const checkNames = async table => (await q("SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'", [table])).map(row => row.name).sort();
    const expectedLogChecks = ['ck_horse_logs_hr', 'ck_horse_logs_sent', 'ck_horse_logs_temp', 'ck_horse_logs_viewed'];
    const expectedCareChecks = ['ck_care_feed', 'ck_care_horse', 'ck_care_rest', 'ck_care_water'];
    const rejected = sql => assert.rejects(() => q(sql), /check constraint/i, sql);
    const log = fields => `INSERT INTO horse_logs(horse_id,leg_id,condition_status,logged_at,created_by,${Object.keys(fields).join(',')}) VALUES (21,10,'STABLE',UTC_TIMESTAMP(),10,${Object.values(fields).join(',')})`;
    const care = values => `INSERT INTO horse_care_activities(trip_id,leg_id,horse_id,activity_type,feed_description,amount_liters,duration_minutes,performed_at,created_by) VALUES (100,10,${values},UTC_TIMESTAMP(),10)`;

    // Sau load-schema: đã có cột, bảng, CHECK, chỉ mục; nhật ký cũ (tạo bởi các check trước) giữ nguyên là "không phải báo cáo"
    for (const column of newColumns) assert.ok((await columns()).includes(column), 'missing ' + column);
    assert.ok(await tableExists());
    assert.deepEqual(await checkNames('horse_logs'), expectedLogChecks);
    assert.deepEqual(await checkNames('horse_care_activities'), expectedCareChecks);
    assert.equal((await q("SHOW INDEX FROM horse_logs WHERE Key_name = 'idx_horse_logs_report'")).length, 3);
    const old = (await q('SELECT COUNT(*) AS n, SUM(report_status IS NULL AND send_to_customer = 0 AND sent_at IS NULL AND customer_viewed_at IS NULL AND body_temp_c IS NULL) AS clean FROM horse_logs'))[0];
    assert.ok(Number(old.n) > 0 && Number(old.n) === Number(old.clean), 'old horse_logs rows have no report data');

    // CHECK của horse_logs
    await rejected(log({ body_temp_c: 50 }));
    await rejected(log({ body_temp_c: 20 }));
    await rejected(log({ heart_rate_bpm: 500 }));
    await rejected(log({ heart_rate_bpm: 5 }));
    await rejected(log({ report_status: "'SENT'" })); // đã gửi mà thiếu sent_at
    await rejected(log({ report_status: "'DRAFT'", customer_viewed_at: 'UTC_TIMESTAMP()' })); // chỉ SENT mới có "khách đã xem"
    await q(log({ body_temp_c: 37.8, heart_rate_bpm: 38, appetite: "'REDUCED'", customer_note: "'ổn'", report_status: "'SENT'", send_to_customer: 1, sent_at: 'UTC_TIMESTAMP()', customer_viewed_at: 'UTC_TIMESTAMP()' }));
    await q(log({ report_status: "'DRAFT'" }));

    // CHECK của horse_care_activities
    await rejected(care("NULL,'FEED','Cỏ',NULL,NULL")); // FEED thiếu ngựa
    await rejected(care("21,'FEED','Cỏ',5,NULL")); // FEED không được có lít
    await rejected(care("21,'WATER',NULL,NULL,NULL")); // WATER thiếu lượng
    await rejected(care("21,'WATER',NULL,500,NULL")); // quá 200 L
    await rejected(care("21,'WATER','Cỏ',10,NULL")); // WATER không được có khẩu phần
    await rejected(care("NULL,'REST',NULL,NULL,NULL")); // REST thiếu số phút
    await rejected(care("NULL,'REST',NULL,NULL,0"));
    await rejected(care("NULL,'REST',NULL,NULL,2000"));
    await q(care("21,'FEED','Cỏ khô 3 kg + cà rốt',NULL,NULL"));
    await q(care("22,'WATER',NULL,10.5,NULL"));
    await q(care("NULL,'REST',NULL,NULL,20")); // cả đoàn
    await assert.rejects(() => q("INSERT INTO horse_care_activities(trip_id,horse_id,activity_type,feed_description,performed_at,created_by) VALUES (999,21,'FEED','x',UTC_TIMESTAMP(),10)"), /foreign key/i, 'FK trip');
    await assert.rejects(() => q("INSERT INTO horse_care_activities(trip_id,horse_id,activity_type,feed_description,performed_at,created_by,corrects_activity_id) VALUES (100,21,'FEED','x',UTC_TIMESTAMP(),10,99999)"), /foreign key/i, 'FK corrects');
    const original = (await q("SELECT id FROM horse_care_activities WHERE activity_type = 'WATER' LIMIT 1"))[0].id;
    await q("INSERT INTO horse_care_activities(trip_id,horse_id,activity_type,amount_liters,performed_at,created_by,corrects_activity_id) VALUES (100,22,'WATER',9.5,UTC_TIMESTAMP(),10,?)", [original]);

    // hasHistory: chuyến chỉ có hoạt động chăm sóc cũng được coi là đã có lịch sử (khóa kế hoạch)
    const trips = new TripsRepository(db);
    assert.equal(await trips.hasHistory('101'), false);
    await q("INSERT INTO horse_care_activities(trip_id,leg_id,horse_id,activity_type,feed_description,performed_at,created_by) VALUES (101,12,23,'FEED','Cỏ khô',UTC_TIMESTAMP(),9)");
    assert.equal(await trips.hasHistory('101'), true);
    await q('DELETE FROM horse_care_activities WHERE trip_id = 101');
    assert.equal(await trips.hasHistory('101'), false);

    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      // Chạy lại nhiều lần không lỗi, không nhân đôi
      await migration.up(runner);
      await migration.up(runner);
      assert.deepEqual(await checkNames('horse_logs'), expectedLogChecks);
      assert.deepEqual(await checkNames('horse_care_activities'), expectedCareChecks);
      // down(): bỏ cột/bảng mới, nhật ký cũ giữ nguyên; up() lại như trước
      const logs = await count('SELECT COUNT(*) AS n FROM horse_logs');
      await migration.down(runner);
      assert.ok(!(await tableExists()));
      for (const column of newColumns) assert.ok(!(await columns()).includes(column), 'still has ' + column);
      assert.deepEqual(await checkNames('horse_logs'), []);
      assert.equal((await q("SHOW INDEX FROM horse_logs WHERE Key_name = 'idx_horse_logs_report'")).length, 0);
      assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs'), logs, 'down() keeps every horse_logs row');
      await migration.down(runner); // down() chạy lại cũng không lỗi
      await migration.up(runner);
      for (const column of newColumns) assert.ok((await columns()).includes(column), 'missing after up ' + column);
      assert.ok(await tableExists());
      assert.deepEqual(await checkNames('horse_logs'), expectedLogChecks);
      assert.equal(await count('SELECT COUNT(*) AS n FROM horse_logs WHERE send_to_customer = 0'), logs, 'old rows default to send_to_customer = 0 again');
    } finally { await runner.release(); }
  });

  console.log(`${passed} Flow 4 tracking integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
  fs.rmSync(storageDir, { recursive: true, force: true });
});
