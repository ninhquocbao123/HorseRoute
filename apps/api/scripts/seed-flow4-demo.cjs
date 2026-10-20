// Tạo database demo CỤC BỘ cho Flow 4 (schema + tài khoản đăng nhập được + chuyến mẫu) để thử giao diện.
// An toàn: chỉ chạy với MySQL trên máy này; từ chối mọi host khác, và chỉ đụng tới database `wdp_flow4_demo`.
//
//   DEMO_DB_PORT=33061 DEMO_DB_PASSWORD=demo node scripts/seed-flow4-demo.cjs
//
// Biến môi trường (đều tuỳ chọn): DEMO_DB_HOST (127.0.0.1), DEMO_DB_PORT (3306), DEMO_DB_USER (root), DEMO_DB_PASSWORD.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { DataSource } = require('typeorm');
const { User } = require('../src/features/users/users.model');

const DB_NAME = 'wdp_flow4_demo';
const PASSWORD = 'Demo@12345';
const host = process.env.DEMO_DB_HOST || '127.0.0.1';
const port = Number(process.env.DEMO_DB_PORT || 3306);
const user = process.env.DEMO_DB_USER || 'root';
const password = process.env.DEMO_DB_PASSWORD ?? '';

if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
  console.error(`Từ chối chạy: script này chỉ dùng cho MySQL cục bộ (host hiện tại: ${host}).`);
  process.exit(1);
}

const hoursFromNow = h => new Date(Date.now() + h * 3600 * 1000);

async function main() {
  const admin = await mysql.createConnection({ host, port, user, password });
  await admin.query('DROP DATABASE IF EXISTS `' + DB_NAME + '`');
  await admin.query('CREATE DATABASE `' + DB_NAME + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await admin.end();

  const db = new DataSource({
    type: 'mysql', host, port, username: user, password, database: DB_NAME, timezone: 'Z',
    supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { multipleStatements: true },
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  let accounts;
  try {
    // Schema: cùng nguồn với test tích hợp (fixtures/schema.sql) + các migration sau bản dump.
    const source = fs.readFileSync(path.join(__dirname, '../test/fixtures/schema.sql'), 'utf8');
    const statements = source.match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g);
    if (!statements?.length) throw new Error('Không đọc được schema.sql');
    await runner.query('SET FOREIGN_KEY_CHECKS=0');
    for (const statement of statements) await runner.query(statement);
    const { OrderRequirements1800000004000 } = require('../src/database/migrations/1800000004000-OrderRequirements');
    const { LocationCoordinates1800000005000 } = require('../src/database/migrations/1800000005000-LocationCoordinates');
    const { TrackMap1800000006000 } = require('../src/database/migrations/1800000006000-TrackMap');
    for (const Migration of [OrderRequirements1800000004000, LocationCoordinates1800000005000, TrackMap1800000006000]) await new Migration().up(runner);
    await runner.query('SET FOREIGN_KEY_CHECKS=1');

    const hash = await bcrypt.hash(PASSWORD, 10);
    accounts = [
      [1, 'admin@example.com', 'Quản Trị Demo', 'ADMIN', null, null],
      [2, 'manager@example.com', 'Quản Lý Demo', 'MANAGER', null, null],
      [3, 'specialist@example.com', 'Chuyên Viên Demo', 'SPECIALIST', null, null],
      [4, 'coordinator@example.com', 'Điều Phối Demo', 'COORDINATOR', null, null],
      [5, 'driver@example.com', 'Tài Xế Demo', 'DRIVER_ESCORT', null, null],
      [6, 'escort@example.com', 'Hộ Tống Demo', 'DRIVER_ESCORT', null, null],
      [7, 'customer@example.com', 'Khách Hàng Demo', 'CUSTOMER', 'CLUB', 'Khu chuồng ngựa Demo, Long An'],
      [8, 'customer2@example.com', 'Khách Hàng Hai', 'CUSTOMER', 'INDIVIDUAL', 'Trang trại Demo, Tây Ninh'],
      [11, 'driver2@example.com', 'Tài Xế Khác', 'DRIVER_ESCORT', null, null],
      [12, 'coordinator2@example.com', 'Điều Phối Khác', 'COORDINATOR', null, null],
    ];
    for (const [id, email, fullName, role, customerType, address] of accounts) {
      await runner.query(
        'INSERT INTO users(id,email,password_hash,full_name,role,account_status,customer_type,address,phone) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, email, hash, fullName, role, 'ACTIVE', customerType, address ?? 'Địa chỉ demo', '0901234567']
      );
    }

    // Tọa độ xấp xỉ cho bản đồ: chặng 1 đi đường bộ; chặng 2 (xe tải qua biển) rơi về đường thẳng ước lượng.
    await runner.query(`INSERT INTO locations(id,name,location_type,country,timezone,latitude,longitude) VALUES
      (1,'Kho Long An','REST_STOP','VN','Asia/Ho_Chi_Minh',10.638,106.47),(2,'Cửa khẩu Mộc Bài','BORDER','VN','Asia/Ho_Chi_Minh',11.076,106.158),
      (3,'Sân bay Changi','AIRPORT','SG','Asia/Singapore',1.3644,103.9915)`);
    await runner.query(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (5,'TRUCK',4,'51C-123.45',1)`);

    // Đơn A: READY, chuyến APPROVED, 2 chặng (chặng 1 đến CỬA KHẨU), Driver + Escort được phân công. Dùng cho luồng chính.
    const orders = [
      [100, 'WDP-DEMO-F4-A', 7, 'READY'],
      [101, 'WDP-DEMO-F4-B', 8, 'READY'],      // khách khác + chuyến của điều phối viên khác: dùng thử cô lập quyền
      [102, 'WDP-DEMO-F4-C', 7, 'PREPARING'],  // kế hoạch chưa duyệt: khách chưa thấy lịch trình
    ];
    for (const [id, code, customer, status] of orders) {
      await runner.query(
        `INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, code, customer, 'Long An, Việt Nam', 'VN', 'Singapore', 'SG', hoursFromNow(24).toISOString().slice(0, 10), status]
      );
    }
    await runner.query(`INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES
      (21,100,7,'Bạch Mã','DEMO-PP-21'),(22,100,7,'Hắc Mã','DEMO-PP-22'),(23,100,7,'Xích Thố','DEMO-PP-23'),
      (24,101,8,'Ô Vân','DEMO-PP-24'),(25,102,7,'Tuyết Sơn','DEMO-PP-25')`);

    const trips = [[200, 100, 'APPROVED', 4], [201, 101, 'APPROVED', 12], [202, 102, 'PENDING_APPROVAL', 4]];
    for (const [id, orderId, plan, plannedBy] of trips) {
      await runner.query(
        'INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, orderId, plan, hoursFromNow(0), hoursFromNow(9), plannedBy, plan === 'APPROVED' ? 2 : null, plan === 'APPROVED' ? new Date() : null]
      );
    }
    const legs = [
      [301, 200, 1, 1, 2, hoursFromNow(0), hoursFromNow(3)],
      [302, 200, 2, 2, 3, hoursFromNow(4), hoursFromNow(9)],
      [303, 201, 1, 1, 3, hoursFromNow(0), hoursFromNow(9)],
      [304, 202, 1, 1, 3, hoursFromNow(0), hoursFromNow(9)],
    ];
    for (const [id, tripId, seq, from, to, dep, arr] of legs) {
      await runner.query(
        'INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES (?,?,?,?,?,5,?,?)',
        [id, tripId, seq, from, to, dep, arr]
      );
    }
    await runner.query(`INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES
      (200,5,'DRIVER',4,UTC_TIMESTAMP()),(200,6,'ESCORT',4,UTC_TIMESTAMP()),(201,11,'DRIVER',12,UTC_TIMESTAMP())`);
  } finally {
    await runner.release();
    await db.destroy();
  }

  console.log(`\nĐã tạo database demo "${DB_NAME}" trên ${host}:${port}.\n`);
  console.log(`Mật khẩu của TẤT CẢ tài khoản: ${PASSWORD}\n`);
  console.table(accounts.map(([, email, fullName, role]) => ({ email, 'họ tên': fullName, 'vai trò': role })));
  console.log('Dữ liệu mẫu:');
  console.log('  • WDP-DEMO-F4-A  (Khách Hàng Demo)  READY, chuyến #200 đã duyệt, 3 ngựa, 2 chặng (chặng 1 đến cửa khẩu), Tài Xế Demo + Hộ Tống Demo, Điều Phối Demo');
  console.log('  • WDP-DEMO-F4-B  (Khách Hàng Hai)   READY, chuyến #201 của Điều Phối Khác, tài xế Tài Xế Khác  → thử cô lập quyền');
  console.log('  • WDP-DEMO-F4-C  (Khách Hàng Demo)  PREPARING, kế hoạch chờ duyệt → khách chưa thấy lịch trình\n');
}

main().catch(error => { console.error(error); process.exit(1); });
