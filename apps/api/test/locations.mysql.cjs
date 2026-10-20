// Flow 3 - Locations integration test: real MySQL, real services, real HTTP. Creates and drops only a randomly named test database.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33061 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/locations.mysql.cjs
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { createServices } = require('../src/shared/config/services');
const { User } = require('../src/features/users/users.model');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const options = require('./mysql-options.cjs');

const name = 'wdp_flow3_test_' + require('crypto').randomBytes(8).toString('hex');
let admin, db, server, created = false, passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }
const ids = { customer: '1', manager: '2', coord: '3', specialist: '4', driver: '6' };

async function main() {
  admin = await mysql.createConnection(options);
  assert.match(name, /^wdp_flow3_test_[0-9a-f]{16}$/);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({
    type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name,
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { multipleStatements: true, connectionLimit: 20 },
  });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);
  const count = async (sql, params) => Number((await q(sql, params))[0].n);

  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'customer@t.local','!','Khách','CUSTOMER','ACTIVE'),(2,'manager@t.local','!','Quản Lý','MANAGER','ACTIVE'),
    (3,'coord@t.local','!','Điều Phối','COORDINATOR','ACTIVE'),(4,'specialist@t.local','!','Chuyên Viên','SPECIALIST','ACTIVE'),
    (6,'driver@t.local','!','Tài Xế','DRIVER_ESCORT','ACTIVE')`);
  await q(`INSERT INTO locations(id,name,location_type,country,timezone,latitude,longitude) VALUES
    (1,'Kho Long An','REST_STOP','VN','Asia/Ho_Chi_Minh',10.638,106.47),(2,'Cửa khẩu Mộc Bài','BORDER','VN','Asia/Ho_Chi_Minh',11.076,106.158),
    (3,'Sân bay Changi','AIRPORT','SG','Asia/Singapore',1.3644,103.9915),(4,'Điểm chưa ghim','REST_STOP','VN','Asia/Ho_Chi_Minh',NULL,NULL),
    (5,'Cửa khẩu Bavet','BORDER','KH','Asia/Phnom_Penh',11.074,106.1545)`);
  await q(`INSERT INTO quarantine_rules(id,origin_country,destination_country,border_location_id,updated_by,updated_at) VALUES (1,'VN','KH',5,2,UTC_TIMESTAMP())`);
  await q(`INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status)
    VALUES (50,'WDP-LOC-50',1,'A','VN','B','SG','2026-10-20','PREPARING')`);
  await q(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (5,'TRUCK',4,'XE-1',1)`);
  await q(`INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by) VALUES (100,50,'APPROVED',UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 9 HOUR,3)`);
  await q(`INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES
    (10,100,1,1,2,5,UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 3 HOUR),(11,100,2,2,3,5,UTC_TIMESTAMP() + INTERVAL 4 HOUR,UTC_TIMESTAMP() + INTERVAL 9 HOUR)`);
  await q(`INSERT INTO location_routes(from_location_id,to_location_id,mode,coordinates) VALUES
    (1,2,'ROAD','[[106.47,10.638],[106.158,11.076]]'),(3,1,'STRAIGHT','[[103.9915,1.3644],[106.47,10.638]]')`);

  const tokens = new TokenService('locations-integration-secret-at-least-thirty-two-characters');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  async function call(method, suffix, { as, body } = {}) {
    const headers = as ? { Authorization: 'Bearer ' + tokens.sign({ sub: as, email: 't@t.local', role: 'ADMIN' }) } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + suffix, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  const expectStatus = async (status, method, suffix, opts) => {
    const r = await call(method, suffix, opts);
    assert.equal(r.status, status, `${method} ${suffix} as ${opts?.as} -> ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    return r.data;
  };
  const audits = (id) => q("SELECT action, old_value AS oldValue, new_value AS newValue FROM audit_logs WHERE entity_type='LOCATION' AND entity_id=? ORDER BY id", [id]);
  const routes = () => q('SELECT CAST(from_location_id AS CHAR) AS f, CAST(to_location_id AS CHAR) AS t FROM location_routes ORDER BY id');
  const sp = { as: ids.specialist };
  const valid = { name: 'Trạm nghỉ Trảng Bàng', locationType: 'REST_STOP', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', address: 'QL22, Trảng Bàng', latitude: 11.03, longitude: 106.36 };
  const body2 = { name: 'Cửa khẩu Mộc Bài', locationType: 'BORDER', country: 'VN', timezone: 'Asia/Ho_Chi_Minh', address: null, latitude: 11.076, longitude: 106.158 };

  await check('Authentication and roles: anonymous 401, driver/customer 403, coordinator and manager read but cannot write', async () => {
    await expectStatus(401, 'GET', '/locations');
    for (const as of [ids.driver, ids.customer]) {
      await expectStatus(403, 'GET', '/locations', { as });
      await expectStatus(403, 'GET', '/locations/1', { as });
    }
    for (const as of [ids.manager, ids.coord, ids.specialist]) assert.equal((await expectStatus(200, 'GET', '/locations', { as })).total, 5);
    for (const as of [ids.manager, ids.coord]) {
      await expectStatus(403, 'POST', '/locations', { as, body: valid });
      await expectStatus(403, 'PUT', '/locations/4', { as, body: valid });
      await expectStatus(403, 'DELETE', '/locations/4', { as });
    }
    assert.equal(await count('SELECT COUNT(*) AS n FROM locations'), 5, 'readers changed nothing');
  });

  await check('Create validates every field, normalizes input, requires coordinates and writes an audit entry', async () => {
    for (const body of [
      { ...valid, locationType: 'PORT' }, { ...valid, country: 'XX' }, { ...valid, country: 'VNM' }, { ...valid, timezone: '+07:00' },
      { ...valid, timezone: 'asia/ho_chi_minh' }, { ...valid, timezone: 'Mars/Olympus' }, { ...valid, latitude: undefined }, { ...valid, longitude: null },
      { ...valid, latitude: 91 }, { ...valid, longitude: -180.5 }, { ...valid, latitude: '11.03' }, { ...valid, latitude: 0, longitude: 0 },
      { ...valid, name: '   ' }, { ...valid, name: 'X'.repeat(151) }, { ...valid, address: 'A'.repeat(256) }, { ...valid, legCount: 0 },
    ]) {
      const r = await call('POST', '/locations', { ...sp, body });
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 120));
      assert.ok(r.data.fields, 'field errors returned');
    }
    assert.equal(await count('SELECT COUNT(*) AS n FROM locations'), 5);
    const made = await expectStatus(201, 'POST', '/locations', { ...sp, body: { ...valid, name: '  Trạm nghỉ Trảng Bàng ', country: 'vn', address: '', latitude: 11.0312345678, longitude: 106.3600004 } });
    assert.equal(made.name, 'Trạm nghỉ Trảng Bàng');
    assert.equal(made.country, 'VN');
    assert.equal(made.address, null);
    assert.equal(made.latitude, 11.031235);
    assert.equal(made.longitude, 106.36);
    assert.deepEqual([made.legCount, made.ruleCount, made.inActiveUse], [0, 0, false]);
    const [entry] = await audits(made.id);
    assert.equal(entry.action, 'CREATE');
    assert.equal(entry.oldValue, null);
    assert.equal(JSON.parse(entry.newValue).latitude, 11.031235);
    const utc = await expectStatus(201, 'POST', '/locations', { ...sp, body: { ...valid, name: 'Trạm UTC', timezone: 'UTC', address: undefined } });
    assert.equal(utc.timezone, 'UTC');
    await expectStatus(204, 'DELETE', '/locations/' + utc.id, sp);
  });

  await check('Duplicates: same name in the same country is 409 regardless of case and accents; other countries are fine', async () => {
    for (const nameVariant of ['Trạm nghỉ Trảng Bàng', 'TRẠM NGHỈ TRẢNG BÀNG', 'Tram nghi Trang Bang']) {
      const r = await call('POST', '/locations', { ...sp, body: { ...valid, name: nameVariant } });
      assert.equal(r.status, 409, nameVariant);
      assert.match(r.data.message, /cùng tên/);
    }
    const abroad = await expectStatus(201, 'POST', '/locations', { ...sp, body: { ...valid, country: 'KH', timezone: 'Asia/Phnom_Penh' } });
    await expectStatus(204, 'DELETE', '/locations/' + abroad.id, sp);
  });

  await check('List: sorted by name, filters by type/country/coordinates/name, paginates, reports usage counts', async () => {
    const all = await expectStatus(200, 'GET', '/locations?limit=100', sp);
    assert.equal(all.total, 6);
    assert.deepEqual(all.items.map(l => l.name), (await q('SELECT name FROM locations ORDER BY name, id')).map(r => r.name));
    const byId = Object.fromEntries(all.items.map(l => [l.id, l]));
    assert.deepEqual([byId[1].legCount, byId[2].legCount, byId[3].legCount, byId[5].ruleCount], [1, 2, 1, 1]);
    assert.deepEqual([byId[2].inActiveUse, byId[5].inActiveUse], [true, false]);
    assert.deepEqual([byId[4].latitude, byId[4].longitude], [null, null]);
    assert.equal(typeof byId[3].latitude, 'number');
    assert.deepEqual((await expectStatus(200, 'GET', '/locations?coordinates=missing', sp)).items.map(l => l.id), ['4']);
    assert.equal((await expectStatus(200, 'GET', '/locations?coordinates=present', sp)).total, 5);
    assert.deepEqual((await expectStatus(200, 'GET', '/locations?locationType=BORDER&country=kh', sp)).items.map(l => l.id), ['5']);
    assert.deepEqual((await expectStatus(200, 'GET', '/locations?q=changi', sp)).items.map(l => l.id), ['3']);
    assert.equal((await expectStatus(200, 'GET', '/locations?q=%25', sp)).total, 0, '% is not a wildcard');
    const page2 = await expectStatus(200, 'GET', '/locations?limit=4&page=2', sp);
    assert.deepEqual([page2.items.length, page2.total, page2.page], [2, 6, 2]);
    for (const query of ['?limit=1000', '?coordinates=some', '?locationType=PORT', '?country=XX', '?sort=name']) await expectStatus(400, 'GET', '/locations' + query, sp);
    assert.equal((await expectStatus(200, 'GET', '/locations/2', { as: ids.manager })).name, 'Cửa khẩu Mộc Bài');
    await expectStatus(404, 'GET', '/locations/999', sp);
    await expectStatus(400, 'GET', '/locations/abc', sp);
  });

  await check('Update: 404, 400 without coordinates, duplicate 409; success audits old/new and clears only routes of moved locations', async () => {
    await expectStatus(404, 'PUT', '/locations/999', { ...sp, body: valid });
    await expectStatus(400, 'PUT', '/locations/4', { ...sp, body: { ...valid, latitude: undefined, longitude: undefined } });
    await expectStatus(409, 'PUT', '/locations/4', { ...sp, body: { ...valid, name: 'kho long an' } });
    const pinned = await expectStatus(200, 'PUT', '/locations/4', { ...sp, body: { ...valid, name: 'Điểm đã ghim', latitude: 10.9, longitude: 106.5 } });
    assert.deepEqual([pinned.latitude, pinned.longitude], [10.9, 106.5]);
    const [entry] = await audits('4');
    assert.equal(entry.action, 'UPDATE');
    assert.equal(JSON.parse(entry.oldValue).latitude, null);
    assert.equal(JSON.parse(entry.newValue).name, 'Điểm đã ghim');
    await expectStatus(200, 'PUT', '/locations/2', { ...sp, body: { ...body2, address: 'QL22, Bến Cầu' } });
    assert.equal((await routes()).length, 2, 'same coordinates keep the route cache');
    await expectStatus(200, 'PUT', '/locations/2', { ...sp, body: { ...body2, latitude: 11.0758, longitude: 106.1612 } });
    assert.deepEqual(await routes(), [{ f: '3', t: '1' }], 'moving location 2 drops only its routes');
  });

  await check('Type is locked while in an approved plan of an unfinished order or used as a quarantine border; other fields stay editable', async () => {
    const before = await q('SELECT * FROM locations WHERE id IN (2,5) ORDER BY id');
    const auditCount = await count('SELECT COUNT(*) AS n FROM audit_logs');
    const inPlan = await call('PUT', '/locations/2', { ...sp, body: { ...body2, locationType: 'REST_STOP' } });
    assert.equal(inPlan.status, 409);
    assert.match(inPlan.data.message, /kế hoạch đã duyệt/);
    const bavet = { name: 'Cửa khẩu Bavet', locationType: 'BORDER', country: 'KH', timezone: 'Asia/Phnom_Penh', latitude: 11.074, longitude: 106.1545 };
    const inRule = await call('PUT', '/locations/5', { ...sp, body: { ...bavet, locationType: 'REST_STOP' } });
    assert.equal(inRule.status, 409);
    assert.match(inRule.data.message, /quy định kiểm dịch/);
    assert.deepEqual(await q('SELECT * FROM locations WHERE id IN (2,5) ORDER BY id'), before, 'rejected updates change nothing');
    assert.equal(await count('SELECT COUNT(*) AS n FROM audit_logs'), auditCount, 'and write no audit entry');
    assert.equal((await expectStatus(200, 'PUT', '/locations/5', { ...sp, body: { ...bavet, address: 'Svay Rieng' } })).address, 'Svay Rieng');
    await q("UPDATE orders SET status='DELIVERED' WHERE id=50");
    const done = await expectStatus(200, 'PUT', '/locations/2', { ...sp, body: { ...body2, locationType: 'REST_STOP', latitude: 11.0758, longitude: 106.1612 } });
    assert.deepEqual([done.locationType, done.inActiveUse], ['REST_STOP', false]);
    await expectStatus(200, 'PUT', '/locations/2', { ...sp, body: { ...body2, latitude: 11.0758, longitude: 106.1612 } });
    await q("UPDATE orders SET status='PREPARING' WHERE id=50");
  });

  await check('Delete: refused while legs or quarantine rules reference it; unused location removed with its routes and an audit entry', async () => {
    for (const id of ['1', '2', '5']) {
      const r = await call('DELETE', '/locations/' + id, sp);
      assert.equal(r.status, 409, id);
    }
    assert.equal(await count('SELECT COUNT(*) AS n FROM locations WHERE id IN (1,2,5)'), 3);
    const temp = await expectStatus(201, 'POST', '/locations', { ...sp, body: { ...valid, name: 'Điểm tạm' } });
    await q("INSERT INTO location_routes(from_location_id,to_location_id,mode,coordinates) VALUES (?,1,'ROAD','[]')", [temp.id]);
    await expectStatus(204, 'DELETE', '/locations/' + temp.id, sp);
    await expectStatus(404, 'DELETE', '/locations/' + temp.id, sp);
    await expectStatus(404, 'GET', '/locations/' + temp.id, sp);
    assert.equal(await count('SELECT COUNT(*) AS n FROM location_routes WHERE from_location_id=?', [temp.id]), 0, 'route cache cascades');
    const last = (await audits(temp.id)).pop();
    assert.equal(last.action, 'DELETE');
    assert.equal(last.newValue, null);
    assert.equal(JSON.parse(last.oldValue).name, 'Điểm tạm');
    await expectStatus(400, 'DELETE', '/locations/abc', sp);
  });

  await check('Flow 3 stays in sync: plan-options returns numeric coordinates (null when unpinned) and reflects edits immediately', async () => {
    await q('UPDATE locations SET latitude=NULL, longitude=NULL WHERE id=4');
    let options = await expectStatus(200, 'GET', '/trips/100/plan-options', { as: ids.coord });
    const byId = Object.fromEntries(options.locations.map(l => [l.id, l]));
    assert.deepEqual([byId[3].latitude, byId[3].longitude], [1.3644, 103.9915]);
    assert.deepEqual([byId[4].latitude, byId[4].longitude], [null, null]);
    await expectStatus(200, 'PUT', '/locations/4', { ...sp, body: { ...valid, name: 'Điểm đã ghim', latitude: 10.95, longitude: 106.55 } });
    options = await expectStatus(200, 'GET', '/trips/100/plan-options', { as: ids.coord });
    assert.equal(options.locations.find(l => l.id === '4').latitude, 10.95);
  });

  console.log(`${passed} Locations integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
