// B13: thông tin thông quan chuyến quốc tế (bổ sung sau khi đặt, chặn chuyển chuyến khi thiếu, tài xế thấy mã). Chỉ chạy trên MySQL tạm (TEST_DB_*).
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=33073 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/order-customs.mysql.cjs
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { DataSource } = require('typeorm'); const { User } = require('../src/features/users/users.model');
const { OrdersService } = require('../src/features/orders/orders.service');
const { TripsRepository } = require('../src/features/trips/trips.repository'); const { TripsService } = require('../src/features/trips/trips.service');
const { TrackingRepository } = require('../src/features/tracking/tracking.repository'); const { TrackingService } = require('../src/features/tracking/tracking.service');
const createChecks = require('./checks.cjs');
const testDb = require('./mysql-options.cjs');
if (!process.env.TEST_DB_HOST) { console.error('Đặt TEST_DB_* trỏ tới MySQL tạm; test này không chạy trên DB dùng chung.'); process.exit(1); }
const options = { type: 'mysql', host: testDb.host, port: testDb.port, username: testDb.user, password: testDb.password, ssl: testDb.ssl, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User] };
const name = 'wdp_flow3_test_' + crypto.randomBytes(8).toString('hex'); let admin, db;
const checks = createChecks(); const { check } = checks;
const code = error => error.getResponse?.().code;

(async () => {
  try {
    admin = await new DataSource({ ...options, database: 'mysql' }).initialize();
    await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    db = await new DataSource({ ...options, database: name, migrations: [require('path').resolve(__dirname, '../src/database/migrations/*.ts')] }).initialize();
    await db.runMigrations({ transaction: 'each' });
    const q = (s, p) => db.query(s, p);
    await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (1,'customer@test','x','Khách','CUSTOMER','ACTIVE'),(2,'other@test','x','Khách khác','CUSTOMER','ACTIVE'),
      (3,'coord@test','x','Điều phối','COORDINATOR','ACTIVE'),(4,'manager@test','x','Quản lý','MANAGER','ACTIVE'),(5,'spec@test','x','Chuyên viên','SPECIALIST','ACTIVE'),(7,'driver@test','x','Tài xế','DRIVER_ESCORT','ACTIVE')`);
    const booking = JSON.stringify({ pickupTime: '07:00 – 09:00', border: 'Hữu Nghị', customsCode: '', importPermit: '' });
    await q(`INSERT INTO orders(id,order_code,customer_id,status,origin_address,destination_address,origin_country,destination_country,desired_departure_date,booking_details) VALUES
      (100,'B13-INT',1,'PREPARING','Hà Nội','Nam Ninh','VN','CN','2099-03-10',?),(101,'B13-DOM',1,'PREPARING','Hà Nội','Đà Nẵng','VN','VN','2099-03-10','{}'),(102,'B13-DRAFT',1,'DRAFT','Hà Nội','Bangkok','VN','TH',NULL,'{}')`, [booking]);
    await q(`INSERT INTO trips(id,order_id,plan_status,planned_by) VALUES(100,100,'APPROVED',3),(101,101,'APPROVED',3)`);
    const orders = new OrdersService(db);
    const customer = { id: '1', role: 'CUSTOMER' }, manager = { id: '4', role: 'MANAGER' };

    await check('khách bổ sung số tờ khai sau khi đặt; chuyên viên sửa được; khách khác, đơn trong nước, đơn nháp thì không', async () => {
      const saved = await orders.updateCustoms(customer, '100', { customsCode: 'TK-1023', importPermit: '', border: 'Hữu Nghị' });
      assert.deepEqual(saved, { id: '100', customsCode: 'TK-1023', importPermit: '', border: 'Hữu Nghị' });
      await orders.updateCustoms({ id: '5', role: 'SPECIALIST' }, '100', { customsCode: 'TK-1023', importPermit: 'GP-88', border: 'Hữu Nghị' });
      const [{ b }] = await q(`SELECT booking_details b FROM orders WHERE id=100`);
      const stored = typeof b === 'string' ? JSON.parse(b) : b;
      assert.deepEqual([stored.customsCode, stored.importPermit, stored.pickupTime], ['TK-1023', 'GP-88', '07:00 – 09:00'], 'giữ các trường khác của booking_details');
      assert.equal(Number((await q(`SELECT COUNT(*) n FROM audit_logs WHERE entity_id=100 AND action='UPDATE_CUSTOMS'`))[0].n), 2);
      assert.match((await q(`SELECT content FROM notifications WHERE recipient_id=3 AND event_type='ORDER_CUSTOMS_UPDATED' ORDER BY id LIMIT 1`))[0].content, /B13-INT đã có số tờ khai hải quan TK-1023/);
      await assert.rejects(() => orders.updateCustoms({ id: '2', role: 'CUSTOMER' }, '100', { customsCode: 'X', importPermit: '', border: '' }), /Không tìm thấy đơn/);
      await assert.rejects(() => orders.updateCustoms(customer, '101', { customsCode: 'X', importPermit: '', border: '' }), /Chỉ chuyến quốc tế/);
      await assert.rejects(() => orders.updateCustoms(customer, '102', { customsCode: 'X', importPermit: '', border: '' }), /không sửa được/);
      await assert.rejects(() => orders.updateCustoms(customer, '100', { customsCode: 'X'.repeat(81), importPermit: '', border: '' }));
      await assert.rejects(() => orders.updateCustoms({ id: '7', role: 'DRIVER_ESCORT' }, '100', { customsCode: 'X', importPermit: '', border: '' }), /Không đủ quyền/);
    });

    await check('chuyển chuyến quốc tế thiếu số tờ khai: 409 CUSTOMS_REQUIRED; nêu lý do thì qua bước này; chuyến trong nước không bị hỏi', async () => {
      const trips = new TripsService(new TripsRepository(db));
      await q(`UPDATE orders SET booking_details=JSON_SET(booking_details,'$.customsCode','') WHERE id=100`);
      // Bỏ qua bước cọc (A5) bằng lý do để chỉ xét thông quan.
      await assert.rejects(() => trips.releaseToDriver(manager, '100', { depositWaiverReason: 'Khách quen' }), error => code(error) === 'CUSTOMS_REQUIRED');
      await assert.rejects(() => trips.releaseToDriver(manager, '100', { depositWaiverReason: 'Khách quen', customsWaiverReason: 'abc' }), error => error.getStatus?.() === 400);
      // Có lý do: qua bước thông quan, dừng ở kiểm tra kế hoạch (chuyến mẫu chưa có lộ trình) và giao dịch hoàn tác nên chưa ghi audit.
      await assert.rejects(() => trips.releaseToDriver(manager, '100', { depositWaiverReason: 'Khách quen', customsWaiverReason: 'Tờ khai nộp tại cửa khẩu' }), error => code(error) !== 'CUSTOMS_REQUIRED' && code(error) !== 'DEPOSIT_REQUIRED');
      await assert.rejects(() => trips.releaseToDriver(manager, '101', { depositWaiverReason: 'Khách quen' }), error => code(error) !== 'CUSTOMS_REQUIRED');
      const readiness = await trips.readiness(manager, '100');
      assert.deepEqual(readiness.customs, { required: true, customsCode: null, satisfied: false });
      assert.deepEqual((await trips.readiness(manager, '101')).customs, { required: false, customsCode: null, satisfied: true });
      await q(`UPDATE orders SET booking_details=JSON_SET(booking_details,'$.customsCode','TK-1023') WHERE id=100`);
      assert.deepEqual((await trips.readiness(manager, '100')).customs, { required: true, customsCode: 'TK-1023', satisfied: true });
      await assert.rejects(() => trips.releaseToDriver(manager, '100', { depositWaiverReason: 'Khách quen' }), error => code(error) !== 'CUSTOMS_REQUIRED');
    });

    await check('tài xế thấy số tờ khai, giấy phép nhập khẩu, cửa khẩu; chuyến trong nước không có mục thông quan', async () => {
      await q(`INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (100,7,'DRIVER',3,UTC_TIMESTAMP()),(101,7,'DRIVER',3,UTC_TIMESTAMP())`);
      const tracking = new TrackingService(new TrackingRepository(db), undefined, { emitToUsers() {} });
      const driver = { id: '7', role: 'DRIVER_ESCORT' };
      assert.deepEqual((await tracking.getTripDetail(driver, '100')).customs, { customsCode: 'TK-1023', importPermit: 'GP-88', border: 'Hữu Nghị' });
      assert.equal((await tracking.getTripDetail(driver, '101')).customs, null);
    });
    checks.done();
  } finally {
    if (db?.isInitialized) await db.destroy();
    if (admin?.isInitialized) { await admin.query('DROP DATABASE IF EXISTS `' + name + '`'); await admin.destroy(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
