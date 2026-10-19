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
let admin, db, server, created = false, passed = 0;
async function check(label, fn) { await fn(); passed++; console.log('PASS ' + label); }
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
    VALUES (50,'WDP-VEH-50',1,'A','VN','B','SG','2026-10-20','PREPARING')`);
  await q(`INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (21,50,1,'Bạch Mã','V-21'),(22,50,1,'Hắc Mã','V-22')`);
  await q(`INSERT INTO locations(id,name,location_type,country,timezone) VALUES (1,'Kho','REST_STOP','VN','Asia/Ho_Chi_Minh'),(3,'Sân bay','AIRPORT','SG','Asia/Singapore')`);
  await q(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES
    (5,'TRUCK',4,'XE-USED',1),(6,'TRUCK',4,'XE-FREE',1),(7,'CRATE',2,'XE-OFF',0)`);
  await q(`INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by) VALUES (100,50,'APPROVED',UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 5 HOUR,3)`);
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
  const valid = { plateOrCode: '51C-123.45', vehicleType: 'TRUCK', capacityStalls: 4 };

  await check('Authentication and roles: anonymous 401, driver/customer 403, manager reads but cannot write', async () => {
    await expectStatus(401, 'GET', '/vehicles');
    for (const as of [ids.driver, ids.customer]) await expectStatus(403, 'GET', '/vehicles', { as });
    assert.equal((await expectStatus(200, 'GET', '/vehicles', { as: ids.manager })).total, 3);
    assert.equal((await expectStatus(200, 'GET', '/vehicles/5', { as: ids.manager })).plateOrCode, 'XE-USED');
    await expectStatus(403, 'POST', '/vehicles', { as: ids.manager, body: valid });
    await expectStatus(403, 'PUT', '/vehicles/6', { as: ids.manager, body: { ...valid, isActive: true } });
    await expectStatus(403, 'DELETE', '/vehicles/6', { as: ids.manager });
    assert.equal(await count('SELECT COUNT(*) AS n FROM vehicles'), 3, 'manager changed nothing');
  });

  await check('Create validates input, trims, rejects duplicates case-insensitively and writes an audit entry', async () => {
    for (const body of [
      { ...valid, vehicleType: 'BOAT' }, { ...valid, capacityStalls: 0 }, { ...valid, capacityStalls: 101 }, { ...valid, capacityStalls: 1.5 },
      { ...valid, capacityStalls: '4' }, { ...valid, plateOrCode: '   ' }, { ...valid, plateOrCode: 'X'.repeat(31) }, { ...valid, extra: 1 }, { ...valid, isActive: false },
    ]) {
      const r = await call('POST', '/vehicles', { as: ids.coord, body });
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.ok(r.data.fields, 'field errors are returned');
    }
    const created = await expectStatus(201, 'POST', '/vehicles', { as: ids.coord, body: { ...valid, plateOrCode: '  51c-123.45  ' } });
    assert.deepEqual({ ...created, id: undefined }, { id: undefined, plateOrCode: '51c-123.45', vehicleType: 'TRUCK', capacityStalls: 4, isActive: true, legCount: 0, inActiveUse: false });
    await expectStatus(409, 'POST', '/vehicles', { as: ids.coord, body: { ...valid, plateOrCode: '51C-123.45' } });
    const log = await audits(created.id);
    assert.equal(log.length, 1);
    assert.equal(log[0].action, 'CREATE');
    assert.equal(log[0].oldValue, null);
    assert.equal(JSON.parse(log[0].newValue).plateOrCode, '51c-123.45');
    assert.equal(await count("SELECT COUNT(*) AS n FROM vehicles WHERE plate_or_code='51C-123.45'"), 1);
  });

  await check('List: sorted, paginated, filters by status and searches plate text literally', async () => {
    const all = await expectStatus(200, 'GET', '/vehicles', { as: ids.coord });
    assert.equal(all.total, 4);
    assert.deepEqual(all.items.map(v => v.plateOrCode), ['51c-123.45', 'XE-FREE', 'XE-OFF', 'XE-USED']);
    const page2 = await expectStatus(200, 'GET', '/vehicles?page=2&limit=3', { as: ids.coord });
    assert.deepEqual(page2.items.map(v => v.plateOrCode), ['XE-USED']);
    assert.deepEqual((await expectStatus(200, 'GET', '/vehicles?status=inactive', { as: ids.coord })).items.map(v => v.plateOrCode), ['XE-OFF']);
    assert.equal((await expectStatus(200, 'GET', '/vehicles?status=active', { as: ids.coord })).total, 3);
    assert.deepEqual((await expectStatus(200, 'GET', '/vehicles?q=xe-f', { as: ids.coord })).items.map(v => v.plateOrCode), ['XE-FREE']);
    assert.equal((await expectStatus(200, 'GET', '/vehicles?q=%25', { as: ids.coord })).total, 0, '% is not a wildcard');
    await expectStatus(400, 'GET', '/vehicles?limit=1000', { as: ids.coord });
    await expectStatus(400, 'GET', '/vehicles?status=other', { as: ids.coord });
    const used = all.items.find(v => v.plateOrCode === 'XE-USED');
    assert.equal(used.legCount, 1);
    assert.equal(used.inActiveUse, true);
  });

  await check('Update: 404, duplicate 409, success writes old and new values to the audit log, reactivation works', async () => {
    const body = { plateOrCode: 'XE-FREE', vehicleType: 'AIRCRAFT_HOLD', capacityStalls: 6, isActive: true };
    await expectStatus(404, 'PUT', '/vehicles/999', { as: ids.coord, body });
    await expectStatus(400, 'PUT', '/vehicles/6', { as: ids.coord, body: { ...body, isActive: undefined } });
    await expectStatus(409, 'PUT', '/vehicles/6', { as: ids.coord, body: { ...body, plateOrCode: 'XE-USED' } });
    const updated = await expectStatus(200, 'PUT', '/vehicles/6', { as: ids.coord, body });
    assert.equal(updated.vehicleType, 'AIRCRAFT_HOLD');
    assert.equal(updated.capacityStalls, 6);
    const [entry] = await audits('6');
    assert.equal(entry.action, 'UPDATE');
    assert.equal(JSON.parse(entry.oldValue).capacityStalls, 4);
    assert.equal(JSON.parse(entry.newValue).capacityStalls, 6);
    const reactivated = await expectStatus(200, 'PUT', '/vehicles/7', { as: ids.coord, body: { plateOrCode: 'XE-OFF', vehicleType: 'CRATE', capacityStalls: 2, isActive: true } });
    assert.equal(reactivated.isActive, true);
    await expectStatus(200, 'PUT', '/vehicles/7', { as: ids.coord, body: { plateOrCode: 'XE-OFF', vehicleType: 'CRATE', capacityStalls: 2, isActive: false } });
  });

  await check('A vehicle in an approved plan cannot be deactivated or shrunk below the horses it carries; allowed again after delivery', async () => {
    const before = await q('SELECT * FROM vehicles WHERE id=5');
    const auditCount = await count('SELECT COUNT(*) AS n FROM audit_logs');
    const body = { plateOrCode: 'XE-USED', vehicleType: 'TRUCK', capacityStalls: 4, isActive: true };
    const off = await call('PUT', '/vehicles/5', { as: ids.coord, body: { ...body, isActive: false } });
    assert.equal(off.status, 409);
    assert.match(off.data.message, /WDP-VEH-50/);
    const small = await call('PUT', '/vehicles/5', { as: ids.coord, body: { ...body, capacityStalls: 1 } });
    assert.equal(small.status, 409);
    assert.match(small.data.message, /2 ngựa/);
    assert.deepEqual(await q('SELECT * FROM vehicles WHERE id=5'), before, 'rejected updates change nothing');
    assert.equal(await count('SELECT COUNT(*) AS n FROM audit_logs'), auditCount, 'and write no audit entry');
    await expectStatus(200, 'PUT', '/vehicles/5', { as: ids.coord, body: { ...body, capacityStalls: 2 } });
    await q("UPDATE orders SET status='DELIVERED' WHERE id=50");
    const done = await expectStatus(200, 'PUT', '/vehicles/5', { as: ids.coord, body: { ...body, isActive: false } });
    assert.equal(done.isActive, false);
    assert.equal(done.inActiveUse, false);
    await expectStatus(200, 'PUT', '/vehicles/5', { as: ids.coord, body: { ...body, isActive: true } });
  });

  await check('Delete: used vehicle is refused, unused vehicle is removed with an audit entry', async () => {
    await expectStatus(409, 'DELETE', '/vehicles/5', { as: ids.coord });
    assert.equal(await count('SELECT COUNT(*) AS n FROM vehicles WHERE id=5'), 1);
    await expectStatus(204, 'DELETE', '/vehicles/7', { as: ids.coord });
    await expectStatus(404, 'DELETE', '/vehicles/7', { as: ids.coord });
    await expectStatus(404, 'GET', '/vehicles/7', { as: ids.coord });
    const [entry] = await audits('7');
    assert.deepEqual(entry.action, 'UPDATE');
    const last = (await audits('7')).pop();
    assert.equal(last.action, 'DELETE');
    assert.equal(last.newValue, null);
    assert.equal(JSON.parse(last.oldValue).plateOrCode, 'XE-OFF');
    await expectStatus(400, 'DELETE', '/vehicles/abc', { as: ids.coord });
  });

  await check('Flow 3 stays in sync: plan-options lists only active vehicles and reflects edits immediately', async () => {
    let options = await expectStatus(200, 'GET', '/trips/100/plan-options', { as: ids.coord });
    assert.deepEqual(options.vehicles.map(v => v.plateOrCode).sort(), ['51c-123.45', 'XE-FREE', 'XE-USED']);
    await expectStatus(200, 'PUT', '/vehicles/6', { as: ids.coord, body: { plateOrCode: 'XE-FREE', vehicleType: 'AIRCRAFT_HOLD', capacityStalls: 6, isActive: false } });
    options = await expectStatus(200, 'GET', '/trips/100/plan-options', { as: ids.coord });
    assert.deepEqual(options.vehicles.map(v => v.plateOrCode).sort(), ['51c-123.45', 'XE-USED']);
  });

  console.log(`${passed} Vehicles integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
