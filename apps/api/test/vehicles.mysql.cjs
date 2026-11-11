// Flow 3 - Vehicles integration test: real MySQL, real services, real HTTP. Creates and drops only a randomly named test database.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33061 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/vehicles.mysql.cjs
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
let admin, db, server, created = false;
const checks = require('./checks.cjs')(), check = checks.check;
const ids = { customer: '1', manager: '2', coord: '3', driver: '6' };

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
    (3,'coord@t.local','!','Điều Phối','COORDINATOR','ACTIVE'),(6,'driver@t.local','!','Tài Xế','DRIVER_ESCORT','ACTIVE')`);
  await q(`INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status)
    VALUES (50,'WDP-VEH-50',1,'A','VN','B','SG','2026-10-20','PREPARING'),(51,'WDP-VEH-51',1,'A','VN','B','SG','2026-10-21','PREPARING')`);
  await q(`INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (21,50,1,'Bạch Mã','V-21'),(22,50,1,'Hắc Mã','V-22')`);
  await q(`INSERT INTO locations(id,name,location_type,country,timezone) VALUES (1,'Kho','REST_STOP','VN','Asia/Ho_Chi_Minh'),(3,'Sân bay','AIRPORT','SG','Asia/Singapore')`);
  // Xe 5 đã được giữ cho chuyến 100 (5 ngựa), xe 6 và 7 còn rảnh.
  await q(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES
    (5,'MEDIUM',6,'XE-USED','RESERVED'),(6,'MEDIUM',4,'XE-FREE','AVAILABLE'),(7,'LIGHT',2,'XE-SPARE','AVAILABLE')`);
  await q(`INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by) VALUES
    (100,50,'APPROVED',UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 5 HOUR,3),(101,51,'DRAFT',UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 5 HOUR,3)`);
  await q(`INSERT INTO trip_vehicles(trip_id,vehicle_id,horse_count) VALUES (100,5,5)`);
  await q(`INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES (10,100,1,1,3,5,UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 5 HOUR)`);

  const tokens = new TokenService('vehicles-integration-secret-at-least-thirty-two-characters');
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
  const audits = (id) => q("SELECT action, old_value AS oldValue, new_value AS newValue FROM audit_logs WHERE entity_type='VEHICLE' AND entity_id=? ORDER BY id", [id]);
  const valid = { plateOrCode: '51C-123.45', vehicleType: 'MEDIUM', capacityStalls: 4 };
  const used = { plateOrCode: 'XE-USED', vehicleType: 'MEDIUM', capacityStalls: 6, status: 'RESERVED' };

  await check('Authentication and roles: anonymous 401, driver/customer 403, manager reads but cannot write', async () => {
    await expectStatus(401, 'GET', '/vehicles');
    for (const as of [ids.driver, ids.customer]) await expectStatus(403, 'GET', '/vehicles', { as });
    assert.equal((await expectStatus(200, 'GET', '/vehicles', { as: ids.manager })).total, 3);
    assert.equal((await expectStatus(200, 'GET', '/vehicles/5', { as: ids.manager })).plateOrCode, 'XE-USED');
    await expectStatus(403, 'POST', '/vehicles', { as: ids.manager, body: valid });
    await expectStatus(403, 'PUT', '/vehicles/6', { as: ids.manager, body: { ...valid, status: 'AVAILABLE' } });
    await expectStatus(403, 'DELETE', '/vehicles/6', { as: ids.manager });
    assert.equal(await count('SELECT COUNT(*) AS n FROM vehicles'), 3, 'manager changed nothing');
  });

  await check('Create validates type, capacity per type and plate, trims, rejects duplicates case-insensitively and writes an audit entry', async () => {
    for (const body of [
      { ...valid, vehicleType: 'TRUCK' }, { ...valid, capacityStalls: 0 }, { ...valid, capacityStalls: 10 }, { ...valid, capacityStalls: 4.5 },
      { ...valid, capacityStalls: '4' }, { ...valid, plateOrCode: '   ' }, { ...valid, plateOrCode: 'X'.repeat(31) }, { ...valid, extra: 1 },
      { ...valid, status: 'AVAILABLE' }, { ...valid, vehicleType: 'LIGHT', capacityStalls: 4 }, { ...valid, vehicleType: 'HEAVY', capacityStalls: 6 },
    ]) {
      const r = await call('POST', '/vehicles', { as: ids.coord, body });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.ok(r.data.fields, 'field errors are returned');
    }
    const created = await expectStatus(201, 'POST', '/vehicles', { as: ids.coord, body: { ...valid, plateOrCode: '  51c-123.45  ' } });
    assert.deepEqual({ ...created, id: undefined }, { id: undefined, plateOrCode: '51c-123.45', vehicleType: 'MEDIUM', capacityStalls: 4, status: 'AVAILABLE', legCount: 0, inActiveUse: false });
    await expectStatus(409, 'POST', '/vehicles', { as: ids.coord, body: { ...valid, plateOrCode: '51C-123.45' } });
    const log = await audits(created.id);
    assert.equal(log.length, 1);
    assert.equal(log[0].action, 'CREATE');
    assert.equal(log[0].oldValue, null);
    assert.equal(JSON.parse(log[0].newValue).plateOrCode, '51c-123.45');
    assert.equal(await count("SELECT COUNT(*) AS n FROM vehicles WHERE license_plate='51C-123.45'"), 1);
  });

  await check('List: sorted, paginated, filters by status and searches plate text literally', async () => {
    const all = await expectStatus(200, 'GET', '/vehicles', { as: ids.coord });
    assert.equal(all.total, 4);
    assert.deepEqual(all.items.map(v => v.plateOrCode), ['51c-123.45', 'XE-FREE', 'XE-SPARE', 'XE-USED']);
    const page2 = await expectStatus(200, 'GET', '/vehicles?page=2&limit=3', { as: ids.coord });
    assert.deepEqual(page2.items.map(v => v.plateOrCode), ['XE-USED']);
    assert.deepEqual((await expectStatus(200, 'GET', '/vehicles?status=RESERVED', { as: ids.coord })).items.map(v => v.plateOrCode), ['XE-USED']);
    assert.equal((await expectStatus(200, 'GET', '/vehicles?status=AVAILABLE', { as: ids.coord })).total, 3);
    assert.deepEqual((await expectStatus(200, 'GET', '/vehicles?q=xe-f', { as: ids.coord })).items.map(v => v.plateOrCode), ['XE-FREE']);
    assert.equal((await expectStatus(200, 'GET', '/vehicles?q=%25', { as: ids.coord })).total, 0, '% is not a wildcard');
    await expectStatus(400, 'GET', '/vehicles?limit=1000', { as: ids.coord });
    await expectStatus(400, 'GET', '/vehicles?status=inactive', { as: ids.coord });
    const inUse = all.items.find(v => v.plateOrCode === 'XE-USED');
    assert.equal(inUse.legCount, 2, 'one leg and one trip vehicle reference it');
    assert.equal(inUse.inActiveUse, true);
  });

  await check('Update: 404, missing status 400, duplicate 409, manual status other than AVAILABLE 409, success is audited', async () => {
    const body = { plateOrCode: 'XE-FREE', vehicleType: 'MEDIUM', capacityStalls: 6, status: 'AVAILABLE' };
    await expectStatus(404, 'PUT', '/vehicles/999', { as: ids.coord, body });
    await expectStatus(400, 'PUT', '/vehicles/6', { as: ids.coord, body: { ...body, status: undefined } });
    await expectStatus(409, 'PUT', '/vehicles/6', { as: ids.coord, body: { ...body, plateOrCode: 'XE-USED' } });
    await expectStatus(409, 'PUT', '/vehicles/6', { as: ids.coord, body: { ...body, status: 'RESERVED' } });
    const updated = await expectStatus(200, 'PUT', '/vehicles/6', { as: ids.coord, body });
    assert.equal(updated.capacityStalls, 6);
    assert.equal(updated.status, 'AVAILABLE');
    const [entry] = await audits('6');
    assert.equal(entry.action, 'UPDATE');
    assert.equal(JSON.parse(entry.oldValue).capacityStalls, 4);
    assert.equal(JSON.parse(entry.newValue).capacityStalls, 6);
  });

  await check('A vehicle held by an active trip keeps its status and cannot shrink below the horses it carries; free again after delivery', async () => {
    const before = await q('SELECT * FROM vehicles WHERE id=5');
    const auditCount = await count('SELECT COUNT(*) AS n FROM audit_logs');
    const freed = await call('PUT', '/vehicles/5', { as: ids.coord, body: { ...used, status: 'AVAILABLE' } });
    assert.equal(freed.status, 409);
    assert.match(freed.data.message, /WDP-VEH-50/);
    const small = await call('PUT', '/vehicles/5', { as: ids.coord, body: { ...used, capacityStalls: 4 } });
    assert.equal(small.status, 409);
    assert.match(small.data.message, /5 ngựa/);
    assert.deepEqual(await q('SELECT * FROM vehicles WHERE id=5'), before, 'rejected updates change nothing');
    assert.equal(await count('SELECT COUNT(*) AS n FROM audit_logs'), auditCount, 'and write no audit entry');
    await expectStatus(200, 'PUT', '/vehicles/5', { as: ids.coord, body: { ...used, plateOrCode: 'XE-USED' } });
    await q("UPDATE orders SET status='DELIVERED' WHERE id=50");
    const done = await expectStatus(200, 'PUT', '/vehicles/5', { as: ids.coord, body: { ...used, status: 'AVAILABLE' } });
    assert.equal(done.status, 'AVAILABLE');
    assert.equal(done.inActiveUse, false);
    await q("UPDATE orders SET status='PREPARING' WHERE id=50");
    await q("UPDATE vehicles SET status='RESERVED' WHERE id=5");
  });

  await check('Plan options list every vehicle; a vehicle held by another active trip is not selectable', async () => {
    const own = await expectStatus(200, 'GET', '/trips/100/plan-options', { as: ids.coord });
    assert.deepEqual(own.vehicles.map(v => v.plateOrCode).sort(), ['51c-123.45', 'XE-FREE', 'XE-SPARE', 'XE-USED']);
    assert.equal(own.vehicles.find(v => v.plateOrCode === 'XE-USED').selectable, true, 'a trip may keep its own vehicle');
    const other = await expectStatus(200, 'GET', '/trips/101/plan-options', { as: ids.coord });
    const held = other.vehicles.find(v => v.plateOrCode === 'XE-USED');
    assert.equal(held.selectable, false);
    assert.deepEqual(held.currentTrips.map(t => t.orderCode), ['WDP-VEH-50']);
    assert.equal(other.vehicles.find(v => v.plateOrCode === 'XE-FREE').selectable, true);
  });

  await check('Delete: used vehicle is refused, unused vehicle is removed with an audit entry', async () => {
    await expectStatus(409, 'DELETE', '/vehicles/5', { as: ids.coord });
    assert.equal(await count('SELECT COUNT(*) AS n FROM vehicles WHERE id=5'), 1);
    await expectStatus(204, 'DELETE', '/vehicles/7', { as: ids.coord });
    await expectStatus(404, 'DELETE', '/vehicles/7', { as: ids.coord });
    await expectStatus(404, 'GET', '/vehicles/7', { as: ids.coord });
    const last = (await audits('7')).pop();
    assert.equal(last.action, 'DELETE');
    assert.equal(last.newValue, null);
    assert.equal(JSON.parse(last.oldValue).plateOrCode, 'XE-SPARE');
    await expectStatus(400, 'DELETE', '/vehicles/abc', { as: ids.coord });
  });

  checks.done();
  console.log(`${checks.passed} Vehicles integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
