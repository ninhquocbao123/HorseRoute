// Test-only HTTP provider + real MySQL. Never loads .env or connects to the user's DB.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { User } = require('../src/features/users/users.model');
const { createServices } = require('../src/shared/config/services');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const { TripRoutePlan1800000013000 } = require('../src/database/migrations/1800000013000-TripRoutePlan');
const { TripFleet1800000015000 } = require('../src/database/migrations/1800000015000-TripFleet');
const { RepresentativeTripLeg1800000016000 } = require('../src/database/migrations/1800000016000-RepresentativeTripLeg');

module.exports = async function fixture() {
  const socketPath = process.env.ROUTE_TEST_MYSQL_SOCKET;
  assert.match(socketPath || '', /^\/tmp\/horseroute-acceptance-mysql-[A-Za-z0-9]+\/mysql\.sock$/);
  const name = 'wdp_flow3_test_' + crypto.randomBytes(8).toString('hex');
  const admin = await mysql.createConnection({ socketPath, user: 'root' });
  await admin.query('CREATE DATABASE ' + name + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  const db = new DataSource({ type: 'mysql', username: 'root', database: name, timezone: 'Z',
    supportBigNumbers: true, bigNumberStrings: true, entities: [User],
    migrations: [TripRoutePlan1800000013000, TripFleet1800000015000, RepresentativeTripLeg1800000016000],
    extra: { socketPath, connectionLimit: 10 } });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, args) => db.query(sql, args);
  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'customer@acceptance.test','!','Khách kiểm thử','CUSTOMER','ACTIVE'),
    (2,'manager@acceptance.test','!','Quản lý kiểm thử','MANAGER','ACTIVE'),
    (3,'coordinator@acceptance.test','!','Điều phối kiểm thử','COORDINATOR','ACTIVE'),
    (4,'other@acceptance.test','!','Điều phối khác','COORDINATOR','ACTIVE'),
    (5,'driver@acceptance.test','!','Tài xế thử','DRIVER_ESCORT','ACTIVE'),
    (6,'escort@acceptance.test','!','Lơ xe thử','DRIVER_ESCORT','ACTIVE')`);
  await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (5,'DRIVER','AVAILABLE'),(6,'ESCORT','AVAILABLE')");
  await q("INSERT INTO locations(id,name,location_type,country,timezone) VALUES (1,'Điểm thử A','REST_STOP','VN','Asia/Ho_Chi_Minh'),(2,'Điểm thử B','REST_STOP','VN','Asia/Ho_Chi_Minh')");
  await q("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (1,'LIGHT',4,'TEST-ONLY','AVAILABLE')");
  for (const id of [100, 101, 102, 103, 104, 105, 106, 107]) {
    await q("INSERT INTO orders(id,order_code,customer_id,origin_address,destination_address,status) VALUES (?,?,1,'Hồ Hoàn Kiếm, Hà Nội','Công viên Thống Nhất, Hà Nội','APPROVED')", [id, 'TEST-' + id]);
    await q("INSERT INTO trips(id,order_id,planned_by,plan_status,planned_departure_at,planned_arrival_at) VALUES (?,?,3,'DRAFT','2031-01-01 01:00:00','2031-01-01 03:00:00')", [id, id]);
    await q("INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES (?,?,1,1,2,1,'2031-01-01 01:00:00','2031-01-01 03:00:00')", [id, id]);
    await q("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,1,'Ngựa thử',?)", [id, 'TEST-' + id]);
  }
  await q("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (100,5,'DRIVER',3,UTC_TIMESTAMP())");
  await q("INSERT INTO location_routes(from_location_id,to_location_id,mode,coordinates,distance_m,duration_s,fetched_at) VALUES (1,2,'ROAD',?,1000,120,UTC_TIMESTAMP())", [JSON.stringify([[105.85,21.03],[105.84,21.01]])]);
  // Only tables that neither schema migrations nor route-plan saves are expected to alter.
  const tables = ['orders','locations','location_routes','vehicles','crew_profiles'];
  const snapshot = async () => Object.fromEntries(await Promise.all(tables.map(async t => [t, JSON.stringify(await q('SELECT * FROM ' + t + ' ORDER BY 1'))])));
  const before = await snapshot();
  const tripsBefore = await q('SELECT * FROM trips ORDER BY id');
  assert.equal((await q("SHOW COLUMNS FROM trips LIKE 'route_plan%'")).length, 0);
  assert.equal(await db.showMigrations(), true);
  const migrations = await db.runMigrations({ transaction: 'none' });
  assert.deepEqual(migrations.map(m => m.name), [
    'TripRoutePlan1800000013000',
    'TripFleet1800000015000',
    'RepresentativeTripLeg1800000016000',
  ]);
  assert.deepEqual(await snapshot(), before);
  const after = await q('SELECT * FROM trips ORDER BY id');
  assert.deepEqual(after.map(({route_plan,route_plan_revision,...rest}) => { assert.equal(route_plan,null); assert.equal(route_plan_revision,0); return rest; }), tripsBefore);
  assert.equal(Number((await q('SELECT COUNT(*) AS total FROM trip_vehicles'))[0].total), 8);
  assert.ok((await q('SELECT trip_vehicle_id FROM trip_assignments WHERE trip_id=100'))[0].trip_vehicle_id);
  assert.equal(await db.showMigrations(), false);
  console.log('PASS route/fleet/representative-leg migrations on isolated MySQL: ' + name + '; old rows preserved');

  const control = { delay: 0, searchDelay: 0, mode: 'ok' };
  const provider = http.createServer(async (req,res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const isSearch = url.pathname === '/search';
    const delay = isSearch ? control.searchDelay : control.delay;
    const mode = control.mode;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    res.setHeader('Content-Type','application/json');
    if (mode === 'error') { res.writeHead(503); res.end('{}'); return; }
    if (mode === 'malformed') { res.end('{}'); return; }
    if (isSearch) {
      const query = url.searchParams.get('q') || '';
      const coordinates = query.includes('Thống') ? [105.841,21.011] : query.includes('nghỉ') ? [105.849,21.021] : [105.854,21.029];
      res.end(JSON.stringify({ features: query === 'empty' ? [] : [{ id: 'public-' + coordinates.join('-'),
        geometry: { type:'Point', coordinates }, properties: { full_address: query + ' — fixture kiểm thử' } }] }));
    } else {
      const points = url.pathname.slice('/directions/'.length).split(';').map(p => p.split(',').map(Number));
      const mid = [(points[0][0] + points.at(-1)[0])/2, (points[0][1] + points.at(-1)[1])/2];
      res.end(JSON.stringify({ code:'Ok', routes:[0,1].map(i => ({ geometry: { type:'LineString', coordinates:[points[0], [mid[0] + i * .005, mid[1]], ...points.slice(1)] }, distance:3000, duration:600+i*60 })) }));
    }
  }).listen(0,'127.0.0.1');
  await once(provider,'listening');
  process.env.MAPBOX_ACCESS_TOKEN = 'fixture-not-a-real-key';
  process.env.ROUTE_PREVIEW_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.MAPBOX_GEOCODING_URL = 'http://127.0.0.1:' + provider.address().port + '/search';
  process.env.MAPBOX_DIRECTIONS_URL = 'http://127.0.0.1:' + provider.address().port + '/directions/';
  const tokens = new TokenService(crypto.randomBytes(32).toString('hex'));
  const app = createApp({ services:createServices(db,tokens),tokens,corsOrigin:'http://127.0.0.1:5178',requestLimit:10000 });
  const server = app.listen(13478,'127.0.0.1'); await once(server,'listening');
  const token = id => tokens.sign({ sub:String(id),email:'test@acceptance.test',role:'COORDINATOR' });
  const base = 'http://127.0.0.1:13478/api/v1';
  const call = async (method,path,actor=3,body) => {
    const res = await fetch(base+path,{method,headers:{...(actor?{Authorization:'Bearer '+token(actor)}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return { status:res.status,data:await res.json() };
  };
  return { name,db,q,call,token,control,snapshot,close:async()=>{
    await Promise.all([server,provider].map(s=>new Promise(resolve=>{s.close(resolve);s.closeAllConnections();})));
    await db.destroy(); await admin.end();
    // Keep the isolated schema for inspection; no DROP or user DB modifications.
  }};
};
