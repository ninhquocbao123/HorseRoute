// Tạo database demo CỤC BỘ cho Flow 4 (schema + tài khoản đăng nhập được + chuyến mẫu) để thử giao diện.
// An toàn: chỉ chạy với MySQL trên máy này; từ chối mọi host khác, và chỉ đụng tới database `wdp_flow4_demo*` (mặc định `wdp_flow4_demo`, đổi bằng DEMO_DB_NAME để có bản riêng).
//
//   DEMO_DB_PORT=33062 DEMO_DB_PASSWORD=demo node scripts/seed-flow4-demo.cjs   (xem docs/demo-local.md)
//
// Biến môi trường (đều tuỳ chọn): DEMO_DB_HOST (127.0.0.1), DEMO_DB_PORT (3306), DEMO_DB_USER (root), DEMO_DB_PASSWORD, DEMO_DB_NAME.
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { DataSource } = require('typeorm');
const { User } = require('../src/features/users/users.model');

const DB_NAME = process.env.DEMO_DB_NAME || 'wdp_flow4_demo';
if (!/^wdp_flow4_demo\w*$/.test(DB_NAME)) { console.error('DEMO_DB_NAME phải bắt đầu bằng wdp_flow4_demo.'); process.exit(1); }
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
    // Schema: cùng nguồn với test tích hợp (fixtures/schema.sql) + TOÀN BỘ migration sau bản dump (kể cả của Pricing/Customer/Specialist/Payment),
    // chạy theo thứ tự timestamp rồi tên file giống TypeORM. Init bị bỏ vì schema.sql đã thay nó.
    const source = fs.readFileSync(path.join(__dirname, '../test/fixtures/schema.sql'), 'utf8');
    const statements = source.match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g);
    if (!statements?.length) throw new Error('Không đọc được schema.sql');
    await runner.query('SET FOREIGN_KEY_CHECKS=0');
    for (const statement of statements) await runner.query(statement);
    const migrationDir = path.join(__dirname, '../src/database/migrations');
    const files = fs.readdirSync(migrationDir).filter(f => /^18\d+-.+\.ts$/.test(f)).sort();
    for (const file of files) {
      const mod = require(path.join(migrationDir, file));
      const Migration = Object.values(mod).find(value => typeof value === 'function');
      await new Migration().up(runner);
    }
    await runner.query('SET FOREIGN_KEY_CHECKS=1');
    console.log(`Đã chạy ${files.length} migration: ${files.map(f => f.replace('.ts', '')).join(', ')}`);

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

    // Địa điểm có tọa độ; tuyến đường bộ giữa các cặp liên tiếp được ghi sẵn vào cache location_routes (mode ROAD, hình học xấp xỉ quốc lộ)
    // nên demo KHÔNG cần token Mapbox. Cặp không có cache (vd. 1→3) rơi về đường thẳng ước lượng.
    await runner.query(`INSERT INTO locations(id,name,location_type,country,timezone,latitude,longitude) VALUES
      (1,'Kho Long An','REST_STOP','VN','Asia/Ho_Chi_Minh',10.638,106.47),(2,'Cửa khẩu Mộc Bài','BORDER','VN','Asia/Ho_Chi_Minh',11.076,106.158),
      (3,'Trạm nghỉ Phnom Penh','REST_STOP','KH','Asia/Phnom_Penh',11.5564,104.9282),(4,'Cảng Sihanoukville','REST_STOP','KH','Asia/Phnom_Penh',10.6418,103.5236)`);
    const R12 = [[106.47, 10.638], [106.42, 10.70], [106.38, 10.78], [106.31, 10.86], [106.25, 10.95], [106.20, 11.02], [106.158, 11.076]];
    const R23 = [[106.158, 11.076], [106.0, 11.06], [105.85, 11.10], [105.70, 11.20], [105.50, 11.28], [105.30, 11.35], [105.15, 11.45], [105.0, 11.50], [104.9282, 11.5564]];
    const R34 = [[104.9282, 11.5564], [104.85, 11.45], [104.70, 11.30], [104.50, 11.15], [104.30, 10.95], [104.10, 10.85], [103.85, 10.75], [103.65, 10.65], [103.5236, 10.6418]];
    for (const [from, to, line, meters, seconds] of [[1, 2, R12, 64000, 4200], [2, 3, R23, 205000, 10800], [3, 4, R34, 232000, 12600]]) {
      await runner.query('INSERT INTO location_routes(from_location_id,to_location_id,mode,coordinates,distance_m,duration_s,fetched_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP())',
        [from, to, 'ROAD', JSON.stringify(line), meters, seconds]);
    }
    await runner.query(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,plate_or_code,is_active) VALUES (5,'TRUCK',4,'51C-123.45',1),(6,'TRUCK',2,'51D-678.90',1)`);

    const horseNames = ['Bạch Mã', 'Hắc Mã', 'Xích Thố', 'Ô Vân', 'Tuyết Sơn', 'Thiên Lý', 'Phong Vân', 'Kim Sa', 'Hồng Ngọc', 'Thanh Long'];
    let horseId = 21;
    const addOrder = async (id, code, customer, status, horses, extra = {}) => {
      await runner.query(
        `INSERT INTO orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status,recipient_name,recipient_phone)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [id, code, customer, 'Long An, Việt Nam', 'VN', 'Phnom Penh, Campuchia', 'KH', (extra.date ?? hoursFromNow(24)).toISOString().slice(0, 10), status, 'Trần Quốc Huy', '0912345678']
      );
      const ids = [];
      for (let n = 0; n < horses; n++) {
        const hid = horseId++;
        ids.push(hid);
        await runner.query('INSERT INTO horses(id,order_id,owner_id,name,passport_no) VALUES (?,?,?,?,?)', [hid, id, customer, horseNames[(hid - 21) % horseNames.length], `DEMO-PP-${hid}`]);
      }
      return ids;
    };
    const addTrip = async (id, orderId, plan, plannedBy, dep, arr, crew) => {
      await runner.query(
        'INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, orderId, plan, dep, arr, plannedBy, plan === 'APPROVED' ? 2 : null, plan === 'APPROVED' ? new Date() : null]
      );
      for (const [user, role] of crew) await runner.query('INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at) VALUES (?,?,?,?,UTC_TIMESTAMP())', [id, user, role, plannedBy]);
    };
    let legSeq = 300;
    const addLeg = async (tripId, seq, from, to, vehicle, dep, arr, status = 'NOT_STARTED', actualDep = null, actualArr = null) => {
      const id = ++legSeq;
      await runner.query(
        'INSERT INTO legs(id,trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at,status,actual_departure_at,actual_arrival_at,updated_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [id, tripId, seq, from, to, vehicle, dep, arr, status, actualDep, actualArr, actualDep ? 5 : null, actualDep ? (actualArr ?? actualDep) : null]
      );
      return id;
    };
    const milestone = (legId, type, at, user = 5) => runner.query('INSERT INTO leg_milestones(leg_id,milestone_type,occurred_at,recorded_by) VALUES (?,?,?,?)', [legId, type, at, user]);
    const crew = [[5, 'DRIVER'], [6, 'ESCORT']];

    // ── Chuyến ĐANG CHẠY (tài xế 5 + hộ tống 6): chặng 1 xong, chặng 2 (đường bộ, qua cửa khẩu sang Campuchia) đang chạy, chặng 3 chưa đi ──
    const [h1] = await addOrder(100, 'WDP-DEMO-F4-A', 7, 'IN_TRANSIT', 3, { date: hoursFromNow(-7) });
    await addTrip(200, 100, 'APPROVED', 4, hoursFromNow(-7), hoursFromNow(8), crew);
    const l1 = await addLeg(200, 1, 1, 2, 5, hoursFromNow(-7), hoursFromNow(-5), 'COMPLETED', hoursFromNow(-7), hoursFromNow(-4.4));
    await milestone(l1, 'DEPARTED', hoursFromNow(-7)); await milestone(l1, 'ARRIVED_AT_STOP', hoursFromNow(-5)); await milestone(l1, 'CUSTOMS_CLEARED', hoursFromNow(-4.4));
    const l2 = await addLeg(200, 2, 2, 3, 6, hoursFromNow(-4), hoursFromNow(3), 'MOVING', hoursFromNow(-4));
    await milestone(l2, 'DEPARTED', hoursFromNow(-4));
    await addLeg(200, 3, 3, 4, 6, hoursFromNow(4), hoursFromNow(8));
    // GPS: 14 điểm dọc tuyến chặng 2, mỗi 4 phút, điểm cuối cách đây ~1 phút (tín hiệu LIVE).
    const hav = ([a, b], [c, d]) => { const r = x => x * Math.PI / 180; const h = Math.sin(r(d - b) / 2) ** 2 + Math.cos(r(b)) * Math.cos(r(d)) * Math.sin(r(c - a) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
    const total = R23.slice(1).reduce((sum, p, i) => sum + hav(R23[i], p), 0);
    const along = fraction => {
      let target = fraction * total;
      for (let i = 1; i < R23.length; i++) {
        const seg = hav(R23[i - 1], R23[i]);
        if (target <= seg) { const t = target / seg; return [R23[i - 1][0] + (R23[i][0] - R23[i - 1][0]) * t, R23[i - 1][1] + (R23[i][1] - R23[i - 1][1]) * t]; }
        target -= seg;
      }
      return R23[R23.length - 1];
    };
    for (let n = 0; n < 14; n++) {
      const [lng, lat] = along(0.08 + n * 0.022);
      await runner.query(
        'INSERT INTO trip_positions(trip_id,leg_id,user_id,latitude,longitude,accuracy_m,speed_mps,heading_deg,recorded_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [200, l2, 5, lat.toFixed(6), lng.toFixed(6), 8, (15 + (n % 3)).toFixed(2), 285, new Date(Date.now() - (13 - n) * 4 * 60000 - 60000)]
      );
    }
    await runner.query("INSERT INTO alerts(trip_id,alert_type,content,sent_by,sent_at) VALUES (200,'TRAFFIC','Kẹt xe nhẹ khoảng km 38 trên QL22, nên giảm tốc và giữ khoảng cách.',4,?),(200,'WEATHER','Mưa lớn dự báo từ 16:00 tại Phnom Penh, kiểm tra bạt che khoang ngựa.',4,?)",
      [hoursFromNow(-1), hoursFromNow(-0.3)]);
    await runner.query("INSERT INTO horse_logs(horse_id,leg_id,condition_status,note,logged_at,created_by) VALUES (?,?,'STABLE','Cả ba ngựa uống nước đủ, ăn uống bình thường, không có dấu hiệu căng thẳng.',?,6)", [h1, l2, hoursFromNow(-0.2)]);
    await runner.query(
      `INSERT INTO incidents(trip_id,leg_id,incident_type,description,urgency,status,reported_by,reported_at,received_by,handling_note,severity,sub_type,damage_target)
       VALUES (200,?,'LONG_TRAFFIC_JAM','Kẹt xe khoảng 40 phút trước cửa khẩu Mộc Bài.','NORMAL','ACKNOWLEDGED',5,?,4,'Đã báo cửa khẩu, chờ thông quan.','YELLOW','RUSH_HOUR','VEHICLE')`,
      [l1, hoursFromNow(-4.8)]);

    // ── Chuyến READY sắp tới của cùng tài xế (dữ liệu "sai quy tắc một chuyến hoạt động": UI hiện dòng "Còn 1 chuyến sắp tới") ──
    await addOrder(103, 'WDP-DEMO-F4-NEXT', 8, 'READY', 2, { date: hoursFromNow(26) });
    await addTrip(205, 103, 'APPROVED', 4, hoursFromNow(26), hoursFromNow(32), crew);
    await addLeg(205, 1, 1, 2, 5, hoursFromNow(26), hoursFromNow(28));
    await addLeg(205, 2, 2, 3, 5, hoursFromNow(29), hoursFromNow(32));

    // ── Lịch sử: 4 chuyến ĐÃ GIAO của tài xế 5 + hộ tống 6 (5, 12, 20, 35 ngày trước) ──
    const history = [[110, 210, 'WDP-DEMO-F4-H1', 5, 1, false], [111, 211, 'WDP-DEMO-F4-H2', 12, 3, true], [112, 212, 'WDP-DEMO-F4-H3', 20, 2, false], [113, 213, 'WDP-DEMO-F4-H4', 35, 1, false]];
    for (const [orderId, tripId, code, daysAgo, horses, withIncident] of history) {
      const start = hoursFromNow(-daysAgo * 24);
      const at = h => new Date(start.getTime() + h * 3600000);
      await addOrder(orderId, code, orderId % 2 ? 8 : 7, 'DELIVERED', horses, { date: start });
      await addTrip(tripId, orderId, 'APPROVED', 4, start, at(9), crew);
      const vehicle = tripId % 2 ? 6 : 5;
      const a = await addLeg(tripId, 1, 1, 2, vehicle, start, at(2.5), 'COMPLETED', start, at(2.4));
      await milestone(a, 'DEPARTED', start); await milestone(a, 'ARRIVED_AT_STOP', at(2.4)); await milestone(a, 'CUSTOMS_CLEARED', at(3));
      const b = await addLeg(tripId, 2, 2, 3, vehicle, at(3.5), at(9), 'COMPLETED', at(3.5), at(8.8));
      await milestone(b, 'DEPARTED', at(3.5)); await milestone(b, 'DELIVERED', at(8.8));
      if (withIncident) {
        await runner.query(
          `INSERT INTO incidents(trip_id,leg_id,incident_type,description,urgency,status,reported_by,reported_at,received_by,handling_note,closed_at,severity,sub_type,damage_target)
           VALUES (?,?,'HORSE_MEDICAL','Một ngựa có dấu hiệu bỏ ăn, hộ tống kiểm tra thân nhiệt.','HIGH','CLOSED',6,?,4,'Bác sĩ thú y kiểm tra tại trạm, ngựa ổn định.',?,'ORANGE','OFF_FEED_DEHYDRATION','HORSE')`,
          [tripId, b, at(5), at(7)]);
      }
    }

    // ── Đơn khác dùng thử cô lập quyền ──
    await addOrder(101, 'WDP-DEMO-F4-B', 8, 'READY', 1, { date: hoursFromNow(24) });
    await addTrip(201, 101, 'APPROVED', 12, hoursFromNow(0), hoursFromNow(9), [[11, 'DRIVER']]);
    await addLeg(201, 1, 1, 3, 5, hoursFromNow(0), hoursFromNow(9));
    await addOrder(102, 'WDP-DEMO-F4-C', 7, 'PREPARING', 1, { date: hoursFromNow(24) });
    await addTrip(202, 102, 'PENDING_APPROVAL', 4, hoursFromNow(0), hoursFromNow(9), []);
    await addLeg(202, 1, 1, 3, 5, hoursFromNow(0), hoursFromNow(9));
  } finally {
    await runner.release();
    await db.destroy();
  }

  console.log(`\nĐã tạo database demo "${DB_NAME}" trên ${host}:${port}.\n`);
  console.log(`Mật khẩu của TẤT CẢ tài khoản: ${PASSWORD}\n`);
  console.table(accounts.map(([, email, fullName, role]) => ({ email, 'họ tên': fullName, 'vai trò': role })));
  console.log('Dữ liệu mẫu (tài xế demo: driver@example.com; hộ tống demo: escort@example.com):');
  console.log('  • WDP-DEMO-F4-A      IN_TRANSIT, chuyến #200: chặng 1 xong, chặng 2 đang chạy (GPS LIVE), 2 cảnh báo điều phối, ghi chú hộ tống, 1 sự cố vàng');
  console.log('  • WDP-DEMO-F4-NEXT   READY, chuyến #205 khởi hành sau ~26 giờ (cùng tài xế → dòng "Còn 1 chuyến sắp tới")');
  console.log('  • WDP-DEMO-F4-H1..H4 DELIVERED (5/12/20/35 ngày trước) → trang Lịch sử giao hàng');
  console.log('  • WDP-DEMO-F4-B      READY, tài xế khác (driver2@example.com) → thử cô lập quyền;  WDP-DEMO-F4-C  PREPARING, kế hoạch chờ duyệt\n');
}

main().catch(error => { console.error(error); process.exit(1); });
