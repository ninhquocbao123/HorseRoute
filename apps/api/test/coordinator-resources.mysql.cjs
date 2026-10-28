// Integration test for the current vehicle/crew schema. Creates and drops only a random test database.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict');
const { once } = require('node:events');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { User } = require('../src/features/users/users.model');
const { createServices } = require('../src/shared/config/services');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const { TrackingRepository } = require('../src/features/tracking/tracking.repository');
const options = require('./mysql-options.cjs');

const name = 'wdp_flow3_test_' + crypto.randomBytes(8).toString('hex');
let admin, db, server, created = false, passed = 0;
const check = async (label, fn) => { await fn(); passed++; console.log('PASS ' + label); };

async function main() {
  admin = await mysql.createConnection(options);
  assert.match(name, /^wdp_flow3_test_[0-9a-f]{16}$/);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  created = true;
  db = new DataSource({ type: 'mysql', host: options.host, port: options.port, username: options.user,
    password: options.password, ssl: options.ssl, database: name, timezone: 'Z', supportBigNumbers: true,
    bigNumberStrings: true, entities: [User], extra: { multipleStatements: true, connectionLimit: 20 } });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);

  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'customer@resource.test','!','Customer','CUSTOMER','ACTIVE'),
    (2,'manager@resource.test','!','Manager','MANAGER','ACTIVE'),
    (3,'coordinator@resource.test','!','Coordinator','COORDINATOR','ACTIVE'),
    (4,'other@resource.test','!','Other Coordinator','COORDINATOR','ACTIVE'),
    (10,'driver-busy@resource.test','!','Driver Busy','DRIVER_ESCORT','ACTIVE'),
    (11,'driver-free@resource.test','!','Driver Free','DRIVER_ESCORT','ACTIVE'),
    (12,'escort-free@resource.test','!','Escort Free','DRIVER_ESCORT','ACTIVE'),
    (13,'missing-profile@resource.test','!','Missing Profile','DRIVER_ESCORT','ACTIVE'),
    (14,'locked@resource.test','!','Locked Crew','DRIVER_ESCORT','LOCKED')`);
  await q(`INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES
    (10,'DRIVER','AVAILABLE'),(11,'DRIVER','AVAILABLE'),(12,'ESCORT','AVAILABLE'),(14,'ESCORT','AVAILABLE')`);
  await q(`INSERT INTO locations(id,name,location_type,country,timezone) VALUES
    (1,'Depot A','REST_STOP','VN','Asia/Ho_Chi_Minh'),(2,'Depot B','REST_STOP','VN','Asia/Ho_Chi_Minh')`);
  await q(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES
    (20,'LIGHT',2,'LIGHT-20','AVAILABLE'),(21,'MEDIUM',5,'MEDIUM-21','RESERVED'),(22,'HEAVY',9,'HEAVY-22','IN_TRANSIT')`);

  for (const [id, code, status] of [[100,'TARGET-100','APPROVED'],[101,'BUSY-101','READY'],[102,'ADJ-102','APPROVED'],[103,'RACE-103','PREPARING'],[104,'RACE-104','PREPARING']]) {
    await q('INSERT INTO orders(id,order_code,customer_id,status) VALUES (?,?,1,?)', [id, code, status]);
  }
  await q(`INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by) VALUES
    (100,100,'DRAFT','2031-01-01 01:00:00','2031-01-01 03:00:00',3),
    (101,101,'APPROVED','2031-01-01 02:00:00','2031-01-01 04:00:00',3),
    (102,102,'DRAFT','2031-01-01 04:00:00','2031-01-01 05:00:00',3),
    (103,103,'PENDING_APPROVAL','2031-01-02 01:00:00','2031-01-02 03:00:00',3),
    (104,104,'PENDING_APPROVAL','2031-01-02 01:00:00','2031-01-02 03:00:00',3)`);
  await q(`INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES
    (1000,100,1,1,2,21,'2031-01-01 01:00:00','2031-01-01 03:00:00'),
    (1001,101,1,1,2,20,'2031-01-01 02:00:00','2031-01-01 04:00:00'),
    (1002,102,1,1,2,20,'2031-01-01 04:00:00','2031-01-01 05:00:00'),
    (1003,103,1,1,2,20,'2031-01-02 01:00:00','2031-01-02 03:00:00'),
    (1004,104,1,1,2,20,'2031-01-02 01:00:00','2031-01-02 03:00:00')`);
  await q("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (100,1,'H100','P100'),(101,1,'H101','P101'),(102,1,'H102','P102'),(103,1,'H103','P103'),(104,1,'H104','P104')");
  await q("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (101,10,'DRIVER',3,UTC_TIMESTAMP())");

  const tokens = new TokenService('resource-integration-secret-at-least-thirty-two-characters');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const token = id => tokens.sign({ sub: String(id), email: 'resource@test.local', role: 'ADMIN' });
  async function call(method, path, actor = 3, body) {
    const headers = actor ? { Authorization: 'Bearer ' + token(actor) } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const leg = (vehicleId, start, end, id) => ({ ...(id ? { id } : {}), fromLocationId: '1', toLocationId: '2', vehicleId,
    plannedDepartureAt: start, plannedArrivalAt: end });

  await check('schema keeps LIGHT/MEDIUM/HEAVY, license_plate, status, IDs and FK', async () => {
    const columns = await q("SELECT column_name,column_type FROM information_schema.columns WHERE table_schema=? AND table_name='vehicles'", [name]);
    const normalized = columns.map(column => ({ name: column.column_name ?? column.COLUMN_NAME, type: column.column_type ?? column.COLUMN_TYPE }));
    assert.ok(normalized.some(c => c.name === 'license_plate'));
    assert.ok(normalized.some(c => c.name === 'status' && c.type.includes('AVAILABLE')));
    assert.ok(normalized.some(c => c.name === 'vehicle_type' && c.type.includes("'LIGHT','MEDIUM','HEAVY'")));
    assert.equal((await q('SELECT license_plate FROM vehicles WHERE id=21'))[0].license_plate, 'MEDIUM-21');
    assert.equal(String((await q('SELECT vehicle_id FROM legs WHERE id=1000'))[0].vehicle_id), '21');
  });

  await check('trip detail, plan options and tracking SQL use the current columns', async () => {
    const detail = await call('GET', '/trips/100');
    assert.equal(detail.status, 200); assert.equal(detail.data.legs[0].vehicleCode, 'MEDIUM-21');
    assert.equal(detail.data.legs[0].vehicleStatus, 'RESERVED');
    const optionsResponse = await call('GET', '/trips/100/plan-options');
    assert.equal(optionsResponse.status, 200);
    assert.deepEqual(optionsResponse.data.vehicles.map(v => v.vehicleType).sort(), ['HEAVY','LIGHT','MEDIUM']);
    assert.equal(optionsResponse.data.vehicles.find(v => v.id === '22').selectable, false);
    assert.equal(optionsResponse.data.vehicles.find(v => v.id === '21').selectable, null, 'self resource is eligible but draft schedule is not evaluated');
    const tracked = await new TrackingRepository(db).getTripVehicles('100');
    assert.equal(tracked[0].code, 'MEDIUM-21');
  });

  await check('active API rejects legacy vehicle types and enforces capacities', async () => {
    assert.equal((await call('POST', '/vehicles', 3, { plateOrCode: 'OLD', vehicleType: 'TRUCK', capacityStalls: 4 })).status, 400);
    assert.equal((await call('POST', '/vehicles', 3, { plateOrCode: 'NEW-L', vehicleType: 'LIGHT', capacityStalls: 3 })).status, 400);
    const createdVehicle = await call('POST', '/vehicles', 3, { plateOrCode: 'NEW-L', vehicleType: 'LIGHT', capacityStalls: 2 });
    assert.equal(createdVehicle.status, 201); assert.equal(createdVehicle.data.status, 'AVAILABLE');
  });

  await check('crew options expose profile/status blockers without hiding missing profiles', async () => {
    const response = await call('GET', '/trips/100/assignment-options');
    assert.equal(response.status, 200);
    const missing = response.data.items.find(item => item.id === '13');
    assert.equal(missing.selectable, false); assert.equal(missing.crewType, null);
    assert.equal(missing.blockingReasons[0].code, 'MISSING_CREW_PROFILE');
    assert.ok(!response.data.items.some(item => item.id === '14'), 'locked accounts are not offered');
  });

  await check('assignment write rechecks role/profile, schedule and supports multiple valid people', async () => {
    const mismatch = await call('PUT', '/trips/100/assignments', 3, { assignments: [{ userId: '11', role: 'ESCORT' }, { userId: '12', role: 'DRIVER' }] });
    assert.equal(mismatch.status, 400);
    const overlap = await call('PUT', '/trips/100/assignments', 3, { assignments: [{ userId: '10', role: 'DRIVER' }, { userId: '12', role: 'ESCORT' }] });
    assert.equal(overlap.status, 400);
    const valid = await call('PUT', '/trips/100/assignments', 3, { assignments: [{ userId: '11', role: 'DRIVER' }, { userId: '12', role: 'ESCORT' }] });
    assert.equal(valid.status, 200); assert.equal(valid.data.crewReadiness.complete, true);
    const outsider = await call('GET', '/trips/100/assignments', 4);
    assert.equal(outsider.status, 404);
  });

  await check('draft save allows self resource and adjacent time, but blocks approved overlap', async () => {
    const self = await call('PUT', '/trips/100/plan', 3, { legs: [leg('21','2031-01-01T01:00:00.000Z','2031-01-01T03:00:00.000Z','1000')] });
    assert.equal(self.status, 200, JSON.stringify(self.data));
    const overlap = await call('PUT', '/trips/100/plan', 3, { legs: [leg('20','2031-01-01T02:30:00.000Z','2031-01-01T03:30:00.000Z','1000')] });
    assert.equal(overlap.status, 400);
    const adjacent = await call('PUT', '/trips/102/plan', 3, { legs: [leg('20','2031-01-01T04:00:00.000Z','2031-01-01T05:00:00.000Z','1002')] });
    assert.equal(adjacent.status, 200, JSON.stringify(adjacent.data));
  });

  await check('two concurrent approvals cannot reserve overlapping use of one vehicle', async () => {
    const responses = await Promise.all([
      call('POST', '/trips/103/review-plan', 2, { decision: 'APPROVED' }),
      call('POST', '/trips/104/review-plan', 2, { decision: 'APPROVED' }),
    ]);
    assert.deepEqual(responses.map(response => response.status).sort(), [200,409]);
  });

  await check('auth and scope remain enforced', async () => {
    assert.equal((await call('GET', '/trips/100', null)).status, 401);
    assert.equal((await call('GET', '/trips/100', 4)).status, 404);
    assert.equal((await call('GET', '/trips/100', 1)).status, 403);
  });
  console.log(`${passed} coordinator resource integration checks passed on isolated database ${name}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
