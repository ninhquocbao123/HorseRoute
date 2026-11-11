// A4 - Hủy đơn và hoàn cọc: MySQL thật, HTTP thật. Chỉ tạo và xóa một database tên ngẫu nhiên.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/order-cancel.mysql.cjs
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
const { ManagerService } = require('../src/features/manager/manager.service');
const options = require('./mysql-options.cjs');

const name = 'wdp_flow1_test_' + require('crypto').randomBytes(8).toString('hex');
let admin, db, server, created = false;
const checks = require('./checks.cjs')(), check = checks.check;
const ids = { manager: '1', customer: '2', other: '3', coordinator: '4', driver: '5', escort: '6' };

async function main() {
  admin = await mysql.createConnection(options);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({
    type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name,
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { connectionLimit: 20 },
  });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);
  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'m@t.local','!','Quản Lý','MANAGER','ACTIVE'),(2,'c@t.local','!','Khách','CUSTOMER','ACTIVE'),(3,'o@t.local','!','Khách Khác','CUSTOMER','ACTIVE'),
    (4,'co@t.local','!','Điều Phối','COORDINATOR','ACTIVE'),(5,'d@t.local','!','Tài Xế','DRIVER_ESCORT','ACTIVE'),(6,'e@t.local','!','Hộ Tống','DRIVER_ESCORT','ACTIVE')`);
  await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (5,'DRIVER','RESERVED'),(6,'ESCORT','RESERVED')");
  const order = async (id, status) => {
    await q('INSERT INTO orders(id,order_code,customer_id,status,origin_country,destination_country,origin_address,destination_address,reviewed_at) VALUES (?,?,2,?,?,?,?,?,UTC_TIMESTAMP())',
      [id, 'CAN-' + id, status, 'VN', 'VN', 'TP.HCM', 'Hà Nội']);
    await q('INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,2,?,?)', [id, 'Ngựa ' + id, 'P-' + id]);
  };
  for (const [id, status] of [[10, 'PENDING'], [11, 'NEED_INFO'], [12, 'APPROVED'], [13, 'PREPARING'], [14, 'IN_TRANSIT'], [15, 'DRAFT'], [16, 'READY']]) await order(id, status);
  // Đơn 13 đã cọc và có chuyến giữ xe 7, tài xế 5, hộ tống 6.
  const manager = new ManagerService(db), m = { id: ids.manager, role: 'MANAGER' };
  const input = { distanceKm: 50, vehicleClass: 'LIGHT', horseCount: 1, durationDays: 1, insurance: 'NONE', feed: 'STANDARD', extraStall: false, international: false, water: 'EVERY_2_HOURS', waterRounds: 0 };
  await q("UPDATE orders SET status='APPROVED' WHERE id=13");
  const quote = await manager.create(m, '13', { input, adjustment: 0, reason: '', vatPercent: 8 });
  await manager.review(m, quote.id, { revision: 1, decision: 'APPROVED', note: '' });
  const [approved] = await q("SELECT id,deposit FROM order_quotes WHERE order_id=13 AND status='APPROVED'");
  await manager.receipt(m, String(approved.id), { amount: Number(approved.deposit), reference: 'CAN-DEP-13', receivedAt: new Date().toISOString() });
  assert.equal((await q('SELECT status FROM orders WHERE id=13'))[0].status, 'PREPARING');
  await q("INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES (7,'LIGHT',2,'CAN-07','RESERVED')");
  await q("INSERT INTO trips(id,order_id,plan_status,planned_by) VALUES (130,13,'APPROVED',4),(160,16,'APPROVED',4)");
  await q('INSERT INTO trip_vehicles(id,trip_id,vehicle_id,horse_count) VALUES (1300,130,7,1)');
  await q("INSERT INTO trip_assignments(trip_id,trip_vehicle_id,user_id,role,assigned_by,assigned_at) VALUES (130,1300,5,'DRIVER',4,UTC_TIMESTAMP()),(130,1300,6,'ESCORT',4,UTC_TIMESTAMP())");
  await q("INSERT INTO payment_sessions(session_code,order_id,quote_id,customer_id,payment_type,payment_method,amount,status) VALUES ('S-13',13,?,2,'BALANCE','BANK_TRANSFER',1000,'PENDING')", [approved.id]);
  // Đơn 16 READY nhưng chặng đã ghi xuất phát: không hủy được.
  await q("INSERT INTO locations(id,name,location_type,country,timezone) VALUES (1,'Điểm A','REST_STOP','VN','Asia/Ho_Chi_Minh'),(2,'Điểm B','REST_STOP','VN','Asia/Ho_Chi_Minh')");
  await q("INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,planned_departure_at,planned_arrival_at,status,actual_departure_at) VALUES (160,1,1,2,UTC_TIMESTAMP(),UTC_TIMESTAMP() + INTERVAL 5 HOUR,'MOVING',UTC_TIMESTAMP())");

  const tokens = new TokenService('order-cancel-integration-secret-at-least-thirty-two');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  const cancel = async (orderId, as, body = {}) => {
    const res = await fetch(`${base}/orders/${orderId}/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.sign({ sub: as, email: 't@t.local', role: 'X' }) }, body: JSON.stringify(body) });
    return { status: res.status, data: await res.json() };
  };
  const status = async id => (await q('SELECT status FROM orders WHERE id=?', [id]))[0].status;

  await check('Khách tự hủy đơn chờ duyệt, cần bổ sung; không hủy được đơn đã duyệt, đơn nháp, đơn của người khác; không tự đặt tiền hoàn', async () => {
    assert.equal((await cancel(10, ids.other)).status, 404);
    assert.equal((await cancel(10, ids.customer, { refundAmount: 0 })).status, 400);
    const ok = await cancel(10, ids.customer, { reason: 'Đổi lịch đua' });
    assert.deepEqual([ok.status, ok.data.status, ok.data.refund], [200, 'CANCELLED', 0]);
    assert.equal(await status(10), 'CANCELLED');
    assert.equal((await cancel(11, ids.customer)).status, 200, 'không bắt buộc lý do với khách');
    assert.equal((await cancel(12, ids.customer)).status, 409);
    assert.equal((await cancel(15, ids.customer)).status, 409);
    assert.equal((await cancel(10, ids.customer)).status, 409, 'đã hủy rồi');
    const [note] = await q("SELECT recipient_id r FROM notifications WHERE event_type='ORDER_CANCELLED' AND related_id=10");
    assert.equal(String(note.r), ids.manager, 'quản lý được báo');
  });

  await check('Quản lý hủy cần lý do; điều phối, tài xế không hủy được; xe đã xuất phát hoặc đang chạy thì không hủy', async () => {
    assert.equal((await cancel(12, ids.coordinator, { reason: 'Thử quyền' })).status, 403);
    assert.equal((await cancel(12, ids.driver, { reason: 'Thử quyền' })).status, 403);
    assert.equal((await cancel(12, ids.manager, { reason: 'abc' })).status, 400);
    assert.equal((await cancel(14, ids.manager, { reason: 'Khách đổi ý' })).status, 409);
    assert.equal((await cancel(16, ids.manager, { reason: 'Khách đổi ý' })).status, 409);
    assert.equal(await status(16), 'READY');
    const ok = await cancel(12, ids.manager, { reason: 'Khách không liên lạc được' });
    assert.deepEqual([ok.status, ok.data.paid, ok.data.refund], [200, 0, 0]);
    assert.equal(Number((await q('SELECT COUNT(*) n FROM order_refunds WHERE order_id=12'))[0].n), 0, 'chưa thu tiền thì không ghi hoàn');
  });

  await check('Đơn đã cọc: phải nhập số hoàn, không vượt số đã thu; hủy xong trả xe và tổ lái, hủy phiên thanh toán, ghi hoàn tiền, báo khách và tổ lái', async () => {
    const paid = Number(approved.deposit);
    const missing = await cancel(13, ids.manager, { reason: 'Khách hủy vì ngựa bệnh' });
    assert.equal(missing.status, 400); assert.ok(missing.data.fields.refundAmount);
    assert.equal((await cancel(13, ids.manager, { reason: 'Khách hủy vì ngựa bệnh', refundAmount: paid + 1 })).status, 400);
    const ok = await cancel(13, ids.manager, { reason: 'Khách hủy vì ngựa bệnh, hoàn 70% cọc', refundAmount: Math.round(paid * 0.7) });
    assert.deepEqual([ok.status, ok.data.paid, ok.data.refund], [200, paid, Math.round(paid * 0.7)]);
    assert.equal((await q('SELECT status FROM vehicles WHERE id=7'))[0].status, 'AVAILABLE');
    assert.deepEqual((await q('SELECT work_status s FROM crew_profiles ORDER BY user_id')).map(r => r.s), ['AVAILABLE', 'AVAILABLE']);
    assert.equal((await q("SELECT status FROM payment_sessions WHERE session_code='S-13'"))[0].status, 'CANCELLED');
    const [refund] = await q('SELECT amount,paid_before,reason FROM order_refunds WHERE order_id=13');
    assert.deepEqual([Number(refund.amount), Number(refund.paid_before)], [Math.round(paid * 0.7), paid]);
    const notified = (await q("SELECT recipient_id r FROM notifications WHERE event_type='ORDER_CANCELLED' AND related_id=13 ORDER BY recipient_id")).map(r => String(r.r));
    assert.deepEqual(notified, [ids.customer, ids.coordinator, ids.driver, ids.escort]);
    const [audit] = await q("SELECT old_value o,new_value n,reason FROM audit_logs WHERE entity_type='ORDER' AND entity_id=13 AND action='CANCEL'");
    assert.equal(JSON.parse(audit.n).refund, Math.round(paid * 0.7));
    const detail = await (await fetch(`${base}/orders/13`, { headers: { Authorization: 'Bearer ' + tokens.sign({ sub: ids.customer, email: 'c@t.local', role: 'CUSTOMER' }) } })).json();
    assert.equal(detail.refund.amount, Math.round(paid * 0.7));
  });

  await check('Doanh thu: tiền thu trong kỳ đã trừ tiền hoàn', async () => {
    const now = new Date();
    const report = await manager.revenue(m, { year: String(now.getFullYear()), month: String(now.getMonth() + 1) });
    assert.equal(Number(report.collected), Number(approved.deposit) - Math.round(Number(approved.deposit) * 0.7));
  });

  checks.done();
  console.log(`${checks.passed} order cancel integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
