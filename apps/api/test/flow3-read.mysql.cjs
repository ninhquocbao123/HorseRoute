// Creates and drops only a randomly named test database. Never uses DB_NAME.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
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
async function main() {
  admin = await mysql.createConnection(options);
  assert.match(name, /^wdp_flow3_test_[0-9a-f]{16}$/);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({ type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { multipleStatements: true } });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  await db.query(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'customer@test.local','!','Customer','CUSTOMER','ACTIVE'),(2,'manager@test.local','!','Manager','MANAGER','ACTIVE'),
    (3,'a@test.local','!','Coordinator A','COORDINATOR','ACTIVE'),(4,'b@test.local','!','Coordinator B','COORDINATOR','ACTIVE'),
    (5,'admin@test.local','!','Admin','ADMIN','ACTIVE'),(6,'driver@test.local','!','Driver','DRIVER_ESCORT','ACTIVE'),(7,'specialist@test.local','!','Specialist','SPECIALIST','ACTIVE')`);
  for (const id of ['9007199254740993', '9007199254740994', '9007199254740995']) {
    await db.query("INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status) VALUES (?,?,1,'A','VN','B','SG','2026-10-20','APPROVED')", [id, 'O' + id]);
    await db.query('INSERT INTO trips(id,order_id,planned_by) VALUES (?,?,?)', [id, id, id.endsWith('4') ? '4' : '3']);
  }
  await db.query("INSERT INTO locations(id,name,location_type,country,timezone) VALUES (9007199254740993,'B','REST_STOP','VN','Asia/Ho_Chi_Minh'),(9007199254740994,'A','AIRPORT','SG','Asia/Singapore')");
  await db.query("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (9007199254740993,'TRUCK',4,'B-ACTIVE',1),(9007199254740994,'TRUCK',2,'A-INACTIVE',0),(9007199254740995,'CRATE',1,'A-ACTIVE',1)");
  // Insert seq 2 first so the test does not accidentally rely on primary-key order.
  await db.query(`INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES
    (9007199254740993,9007199254740993,2,9007199254740994,9007199254740993,NULL,'2026-10-20 04:00:00','2026-10-20 05:00:00'),
    (9007199254740994,9007199254740993,1,9007199254740993,9007199254740994,9007199254740994,'2026-10-20 01:00:00','2026-10-20 03:00:00')`);
  await db.query("UPDATE trips SET planned_departure_at='2026-10-20 01:00:00',planned_arrival_at='2026-10-20 05:00:00' WHERE id=9007199254740993");
  const tokens = new TokenService('trips-integration-secret-at-least-thirty-two-characters');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 1000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/trips';
  const request = (suffix = '', id = '3') => fetch(base + suffix, { headers: id ? { Authorization: 'Bearer ' + tokens.sign({ sub: id, email: 'test@test.local', role: 'ADMIN' }) } : {} });
  const read = async (suffix, id) => { const res = await request(suffix, id); assert.equal(res.status, 200); return res.json(); };
  await check('Coordinator list and total use ownership; stable paging and out-of-range page', async () => {
    const a = await read('?limit=1'); assert.equal(a.total, 2); assert.deepEqual(a.items.map(t => t.id), ['9007199254740995']);
    assert.deepEqual((await read('?limit=1&page=2')).items.map(t => t.id), ['9007199254740993']);
    const empty = await read('?page=10'); assert.deepEqual(empty.items, []); assert.equal(empty.total, 2);
    const b = await read('', '4'); assert.equal(b.total, 1); assert.equal(b.items[0].id, '9007199254740994');
  });
  await check('Foreign and missing Trips return 404 for detail and options', async () => {
    for (const id of ['9007199254740994', '999', '18446744073709551615']) for (const suffix of ['', '/plan-options']) assert.equal((await request('/' + id + suffix)).status, 404);
  });
  await check('Manager can read all Trips and options', async () => {
    const all = await read('', '2'); assert.equal(all.total, 3);
    for (const trip of all.items) for (const suffix of ['', '/plan-options']) await read('/' + trip.id + suffix, '2');
  });
  await check('Every endpoint requires token and rejects all other roles using database role', async () => {
    for (const suffix of ['', '/9007199254740993', '/9007199254740993/plan-options']) {
      assert.equal((await request(suffix, null)).status, 401);
      for (const id of ['1', '5', '6', '7']) assert.equal((await request(suffix, id)).status, 403);
    }
  });
  await check('Empty Trip has legs [] and nullable dates', async () => {
    const trip = await read('/9007199254740995'); assert.deepEqual(trip.legs, []); assert.equal(trip.plannedDepartureAt, null); assert.equal(trip.plannedArrivalAt, null);
  });
  await check('Leg ordering, exact BIGINT IDs, UTC, nullable and inactive vehicles', async () => {
    const trip = await read('/9007199254740993');
    assert.equal(trip.id, '9007199254740993'); assert.equal(trip.orderId, trip.id); assert.equal(trip.plannedBy, '3');
    assert.equal(trip.plannedDepartureAt, '2026-10-20T01:00:00.000Z');
    assert.deepEqual(trip.legs.map(l => l.seqNo), [1, 2]);
    assert.equal(trip.legs[0].id, '9007199254740994'); assert.equal(trip.legs[0].fromLocationId, '9007199254740993');
    assert.equal(trip.legs[0].vehicleId, '9007199254740994'); assert.equal(trip.legs[0].vehicleActive, false);
    assert.equal(trip.legs[0].plannedDepartureAt, '2026-10-20T01:00:00.000Z');
    for (const key of ['vehicleId', 'vehicleCode', 'vehicleActive']) assert.equal(trip.legs[1][key], null);
    assert.equal(trip.approvedBy, null); assert.equal('actualDepartureAt' in trip.legs[0], false);
  });
  await check('Options come from SQL, sorted and active-only; database changes appear immediately', async () => {
    const suffix = '/9007199254740993/plan-options', opts = await read(suffix);
    assert.deepEqual(opts.locations.map(l => l.name), ['A', 'B']);
    assert.deepEqual(opts.vehicles.map(v => v.plateOrCode), ['A-ACTIVE', 'B-ACTIVE']);
    assert.ok(opts.vehicles.every(v => v.isActive === true)); assert.equal(opts.vehicles[1].id, '9007199254740993');
    await db.query("UPDATE vehicles SET is_active=0 WHERE id=9007199254740993");
    assert.equal((await read(suffix)).vehicles.length, 1);
    await db.query('UPDATE vehicles SET is_active=0'); assert.deepEqual((await read(suffix)).vehicles, []);
  });
  await check('Invalid ID and query return 400 with requestId', async () => {
    for (const suffix of ['/0', '/abc', '/18446744073709551616', '?limit=101', '?plannedBy=4', '?page=9007199254740992']) {
      const res = await request(suffix); assert.equal(res.status, 400); const body = await res.json(); assert.equal(body.requestId, res.headers.get('X-Request-ID'));
    }
  });
  await require('./trips-plan-checks.cjs')({ db, base, tokens, read, check });
  await require('./trips-submit-checks.cjs')({ db, base, tokens, read, check });
  await require('./trips-review-checks.cjs')({ db, base, tokens, read, check });
  await require('./trips-crew-checks.cjs')({ db, base, tokens, read, check });
  console.log(`${passed} Flow 3 read/save/submit/review/crew integration checks passed`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
