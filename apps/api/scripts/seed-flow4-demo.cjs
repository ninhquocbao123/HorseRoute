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
const { calculateEstimate } = require('@my-project/shared');

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
    migrations: [path.join(__dirname, '../src/database/migrations/*.ts')],
  });
  await db.initialize();
  // Schema: chạy đúng các migration mà `pnpm db:setup` chạy, nên DB demo luôn khớp code hiện tại.
  const migrated = await db.runMigrations({ transaction: 'each' });
  console.log(`Đã chạy ${migrated.length} migration.`);
  const runner = db.createQueryRunner();
  await runner.connect();
  let accounts;
  try {

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
    // Hồ sơ tổ lái: điều phối chỉ chọn được người có crew_profiles đúng loại.
    await runner.query(`INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (5,'DRIVER','AVAILABLE'),(6,'ESCORT','AVAILABLE'),(11,'DRIVER','AVAILABLE')`);

    // Địa điểm có tọa độ; tuyến đường bộ giữa các cặp liên tiếp được ghi sẵn vào cache location_routes (mode ROAD, hình học xấp xỉ quốc lộ)
    // nên demo không cần gọi dịch vụ tính tuyến. Cặp không có cache (vd. 1→3) rơi về đường thẳng ước lượng.
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
    // Mỗi chuyến chưa xong dùng một xe riêng (một xe chỉ thuộc một chuyến đang hoạt động); xe 9 để điều phối thử phân công.
    await runner.query(`INSERT INTO vehicles(id,vehicle_type,capacity_stalls,license_plate,status) VALUES
      (5,'MEDIUM',4,'51C-123.45','AVAILABLE'),(6,'LIGHT',2,'51D-678.90','AVAILABLE'),(7,'LIGHT',2,'51E-246.80','AVAILABLE'),
      (8,'MEDIUM',6,'51F-135.79','AVAILABLE'),(9,'HEAVY',9,'51G-864.20','AVAILABLE')`);

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
        // Giống và ngày sinh (cho thẻ ngựa E1: "Thoroughbred · 5 tuổi").
        const breed = ['Thoroughbred', 'Arabian', 'Quarter Horse'][(hid - 21) % 3];
        const birth = new Date(); birth.setFullYear(birth.getFullYear() - (3 + ((hid - 21) % 5))); birth.setMonth(0, 15);
        await runner.query('INSERT INTO horses(id,order_id,owner_id,name,passport_no,breed,birth_date) VALUES (?,?,?,?,?,?,?)', [hid, id, customer, horseNames[(hid - 21) % horseNames.length], `DEMO-PP-${hid}`, breed, birth.toISOString().slice(0, 10)]);
      }
      return ids;
    };
    // Xe chạy xuyên suốt chuyến (trip_vehicles), tổ lái gắn với xe đó (trip_assignments.trip_vehicle_id).
    const addTrip = async (id, orderId, plan, plannedBy, dep, arr, crew, vehicle, horseCount) => {
      await runner.query(
        'INSERT INTO trips(id,order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, orderId, plan, dep, arr, plannedBy, plan === 'APPROVED' ? 2 : null, plan === 'APPROVED' ? new Date() : null]
      );
      const tripVehicle = (await runner.query('INSERT INTO trip_vehicles(trip_id,vehicle_id,horse_count) VALUES (?,?,?)', [id, vehicle, horseCount])).insertId;
      for (const [user, role] of crew) {
        await runner.query('INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at,trip_vehicle_id) VALUES (?,?,?,?,UTC_TIMESTAMP(),?)', [id, user, role, plannedBy, tripVehicle]);
      }
    };
    // Báo giá đã duyệt tính bằng bảng giá hiện hành và biên nhận theo mức đã trả: 'none', 'deposit' hoặc 'full'.
    const [pricing] = await runner.query("SELECT id,config FROM pricing_versions WHERE status='PUBLISHED' ORDER BY id DESC LIMIT 1");
    const pricingConfig = typeof pricing.config === 'string' ? JSON.parse(pricing.config) : pricing.config;
    const addQuote = async (orderId, horseCount, vehicleClass, paid, approvedAt) => {
      const input = { distanceKm: 501, vehicleClass, horseCount, durationDays: 2, insurance: 'NONE', feed: 'STANDARD', extraStall: false,
        international: true, water: 'EVERY_2_HOURS', waterRounds: 0 };
      const estimate = calculateEstimate(pricingConfig, input, String(pricing.id));
      const quote = (await runner.query(
        `INSERT INTO order_quotes(order_id,pricing_version_id,status,input,items,subtotal,adjustment,adjustment_reason,vat_percent,vat_amount,total,deposit,deposit_percent,validity_hours,expires_at,created_by,approved_by,approved_at)
         VALUES (?,?,'APPROVED',?,?,?,0,'',0,0,?,?,?,?,?,2,2,?)`,
        [orderId, pricing.id, JSON.stringify(input), JSON.stringify(estimate.items), estimate.total, estimate.total, estimate.deposit, estimate.depositPercent,
          estimate.quoteValidityHours, new Date(approvedAt.getTime() + estimate.quoteValidityHours * 3600000), approvedAt])).insertId;
      await runner.query('UPDATE orders SET reviewed_at=?, reviewed_by=2 WHERE id=?', [approvedAt, orderId]);
      const receipts = paid === 'full' ? [['DEPOSIT', estimate.deposit], ['BALANCE', estimate.total - estimate.deposit]] : paid === 'deposit' ? [['DEPOSIT', estimate.deposit]] : [];
      for (const [kind, amount] of receipts) {
        await runner.query(
          "INSERT INTO order_receipts(order_id,quote_id,amount,method,source,reference,received_at,recorded_by) VALUES (?,?,?,'BANK_TRANSFER','MANUAL',?,?,2)",
          [orderId, quote, amount, `DEMO-${orderId}-${kind}`, new Date(approvedAt.getTime() + 3600000)]);
      }
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
    const [h1, h2, h3] = await addOrder(100, 'WDP-DEMO-F4-A', 7, 'IN_TRANSIT', 3, { date: hoursFromNow(-7) });
    await addTrip(200, 100, 'APPROVED', 4, hoursFromNow(-7), hoursFromNow(8), crew, 5, 3);
    // Mới đặt cọc: tới điểm giao tài xế sẽ thấy "Chờ khách thanh toán" cho tới khi khách trả nốt.
    await addQuote(100, 3, 'MEDIUM', 'deposit', hoursFromNow(-72));
    const l1 = await addLeg(200, 1, 1, 2, 5, hoursFromNow(-7), hoursFromNow(-5), 'COMPLETED', hoursFromNow(-7), hoursFromNow(-4.4));
    await milestone(l1, 'DEPARTED', hoursFromNow(-7)); await milestone(l1, 'ARRIVED_AT_STOP', hoursFromNow(-5)); await milestone(l1, 'CUSTOMS_CLEARED', hoursFromNow(-4.4));
    const l2 = await addLeg(200, 2, 2, 3, 5, hoursFromNow(-4), hoursFromNow(3), 'MOVING', hoursFromNow(-4));
    await milestone(l2, 'DEPARTED', hoursFromNow(-4));
    await addLeg(200, 3, 3, 4, 5, hoursFromNow(4), hoursFromNow(8));
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
    // Cảnh báo điều phối + thông báo IN_APP tương ứng cho từng người nhận, đúng như API thật (notifyCrewAndManagers: quản lý, crew, khách của đơn).
    // Toast của tài xế/hộ tống chỉ hiện cho cảnh báo có thông báo chưa đọc, nên seed phải tạo cả hai.
    const alertLabel = { TRAFFIC: 'giao thông', WEATHER: 'thời tiết' };
    for (const [type, content, sentAt] of [
      ['TRAFFIC', 'Kẹt xe nhẹ khoảng km 38 trên QL22, nên giảm tốc và giữ khoảng cách.', hoursFromNow(-1)],
      ['WEATHER', 'Mưa lớn dự báo từ 16:00 tại Phnom Penh, kiểm tra bạt che khoang ngựa.', hoursFromNow(-0.3)],
    ]) {
      await runner.query('INSERT INTO alerts(trip_id,alert_type,content,sent_by,sent_at) VALUES (200,?,?,4,?)', [type, content, sentAt]);
      for (const recipient of [2, 5, 6, 7]) {
        await runner.query(
          "INSERT INTO notifications(recipient_id,event_type,content,related_type,related_id,channel,is_read,created_at) VALUES (?,'TRIP_ALERT',?,'TRIP',200,'IN_APP',0,?)",
          [recipient, `Cảnh báo ${alertLabel[type]} chuyến 200 (đơn WDP-DEMO-F4-A): ${content}`, sentAt]);
      }
    }
    await runner.query("INSERT INTO horse_logs(horse_id,leg_id,condition_status,note,logged_at,created_by) VALUES (?,?,'STABLE','Cả ba ngựa uống nước đủ, ăn uống bình thường, không có dấu hiệu căng thẳng.',?,6)", [h1, l2, hoursFromNow(-0.2)]);
    // Nhật ký chăm sóc (hộ tống 6 ghi hôm nay) và báo cáo sức khỏe (1 đã gửi cho khách, 1 nháp) — migration EscortHorseCare.
    const care = async (horse, type, at, fields = {}) => {
      const result = await runner.query(
        `INSERT INTO horse_care_activities(trip_id,leg_id,horse_id,activity_type,feed_description,amount_liters,duration_minutes,note,performed_at,created_by,corrects_activity_id)
         VALUES (200,?,?,?,?,?,?,?,?,6,?)`,
        [l2, horse, type, fields.feed ?? null, fields.liters ?? null, fields.minutes ?? null, fields.note ?? null, hoursFromNow(at), fields.corrects ?? null]
      );
      return result.insertId;
    };
    await care(h1, 'FEED', -3.2, { feed: 'Cỏ khô 4 kg + yến mạch 1,5 kg' });
    await care(h2, 'FEED', -3.1, { feed: 'Cỏ khô 4 kg + yến mạch 1,5 kg' });
    await care(h1, 'WATER', -3, { liters: 10 });
    const wrongWater = await care(h2, 'WATER', -2.9, { liters: 80, note: 'Nhập nhầm' });
    await care(h2, 'WATER', -2.8, { liters: 8, corrects: wrongWater }); // đính chính bản nhập nhầm 80 L → 8 L
    await care(null, 'REST', -2, { minutes: 20, note: 'Dừng nghỉ chân trước cửa khẩu' });
    await care(h1, 'FEED', -0.6, { feed: 'Cỏ khô 3 kg + cà rốt' });
    await runner.query(
      `INSERT INTO horse_logs(horse_id,leg_id,condition_status,note,logged_at,created_by,body_temp_c,heart_rate_bpm,appetite,customer_note,report_status,send_to_customer,sent_at)
       VALUES (?,?,'OFF_FEED','Ăn ít khẩu phần trưa, đã theo dõi thêm.',?,6,37.9,44,'REDUCED','Ngựa ăn ít khẩu phần trưa, đứng vững, không đổ mồ hôi. Hộ tống sẽ theo dõi thêm.','SENT',1,?)`,
      [h2, l2, hoursFromNow(-0.5), hoursFromNow(-0.45)]);
    await runner.query(
      `INSERT INTO horse_logs(horse_id,leg_id,condition_status,logged_at,created_by,body_temp_c,heart_rate_bpm,appetite,customer_note,report_status,send_to_customer)
       VALUES (?,?,'STABLE',?,6,37.6,36,'NORMAL','Đang soạn báo cáo cho ngựa thứ ba…','DRAFT',0)`,
      [h3, l2, hoursFromNow(-0.1)]);
    await runner.query(
      `INSERT INTO incidents(trip_id,leg_id,incident_type,description,urgency,status,reported_by,reported_at,received_by,handling_note,severity,sub_type,damage_target)
       VALUES (200,?,'LONG_TRAFFIC_JAM','Kẹt xe khoảng 40 phút trước cửa khẩu Mộc Bài.','NORMAL','ACKNOWLEDGED',5,?,4,'Đã báo cửa khẩu, chờ thông quan.','YELLOW','RUSH_HOUR','VEHICLE')`,
      [l1, hoursFromNow(-4.8)]);

    // ── Chuyến READY sắp tới của cùng tài xế (dữ liệu "sai quy tắc một chuyến hoạt động": UI hiện dòng "Còn 1 chuyến sắp tới") ──
    await addOrder(103, 'WDP-DEMO-F4-NEXT', 8, 'READY', 2, { date: hoursFromNow(26) });
    await addTrip(205, 103, 'APPROVED', 4, hoursFromNow(26), hoursFromNow(32), crew, 6, 2);
    await addQuote(103, 2, 'LIGHT', 'deposit', hoursFromNow(-48));
    await addLeg(205, 1, 1, 2, 6, hoursFromNow(26), hoursFromNow(28));
    await addLeg(205, 2, 2, 3, 6, hoursFromNow(29), hoursFromNow(32));

    // ── Lịch sử: 4 chuyến ĐÃ GIAO của tài xế 5 + hộ tống 6 (5, 12, 20, 35 ngày trước) ──
    // H4: hai tài khoản đổi vai (6 làm tài xế, 5 làm hộ tống) để thử lịch sử lọc theo vai trò: tài xế 5 và hộ tống 6 chỉ thấy H1–H3.
    const swapped = [[6, 'DRIVER'], [5, 'ESCORT']];
    const history = [[110, 210, 'WDP-DEMO-F4-H1', 5, 1, false], [111, 211, 'WDP-DEMO-F4-H2', 12, 3, true], [112, 212, 'WDP-DEMO-F4-H3', 20, 2, false], [113, 213, 'WDP-DEMO-F4-H4', 35, 1, false, swapped]];
    const delivered = {};
    for (const [orderId, tripId, code, daysAgo, horses, withIncident, tripCrew = crew] of history) {
      const start = hoursFromNow(-daysAgo * 24);
      const at = h => new Date(start.getTime() + h * 3600000);
      const horseIds = await addOrder(orderId, code, orderId % 2 ? 8 : 7, 'DELIVERED', horses, { date: start });
      // Xe 6 chỉ chở được 2 ngựa, chuyến 3 ngựa dùng xe 5.
      const vehicle = horses > 2 ? 5 : tripId % 2 ? 6 : 5;
      await addTrip(tripId, orderId, 'APPROVED', 4, start, at(9), tripCrew, vehicle, horses);
      await addQuote(orderId, horses, vehicle === 5 ? 'MEDIUM' : 'LIGHT', 'full', at(-72));
      const a = await addLeg(tripId, 1, 1, 2, vehicle, start, at(2.5), 'COMPLETED', start, at(2.4));
      await milestone(a, 'DEPARTED', start); await milestone(a, 'ARRIVED_AT_STOP', at(2.4)); await milestone(a, 'CUSTOMS_CLEARED', at(3));
      const b = await addLeg(tripId, 2, 2, 3, vehicle, at(3.5), at(9), 'COMPLETED', at(3.5), at(8.8));
      await milestone(b, 'DEPARTED', at(3.5)); await milestone(b, 'DELIVERED', at(8.8));
      delivered[tripId] = { horseIds, legA: a, legB: b, start };
      if (withIncident) {
        await runner.query(
          `INSERT INTO incidents(trip_id,leg_id,incident_type,description,urgency,status,reported_by,reported_at,received_by,handling_note,closed_at,severity,sub_type,damage_target)
           VALUES (?,?,'HORSE_MEDICAL','Một ngựa có dấu hiệu bỏ ăn, hộ tống kiểm tra thân nhiệt.','HIGH','CLOSED',6,?,4,'Bác sĩ thú y kiểm tra tại trạm, ngựa ổn định.',?,'ORANGE','OFF_FEED_DEHYDRATION','HORSE')`,
          [tripId, b, at(5), at(7)]);
      }
    }

    // ── Hoạt động chăm sóc của chuyến hộ tống đã giao (thử chọn ngày + phân trang ở Lịch sử hộ tống) ──
    const careDone = async (tripId, horse, type, when, fields = {}) => {
      const trip = delivered[tripId];
      const result = await runner.query(
        `INSERT INTO horse_care_activities(trip_id,leg_id,horse_id,activity_type,feed_description,amount_liters,duration_minutes,note,performed_at,created_by,corrects_activity_id)
         VALUES (?,?,?,?,?,?,?,?,?,6,?)`,
        [tripId, trip.legB, horse, type, fields.feed ?? null, fields.liters ?? null, fields.minutes ?? null, fields.note ?? null, when, fields.corrects ?? null]
      );
      return result.insertId;
    };
    const atLocal = (from, dayOffset, hour, minute = 0) => { const d = new Date(from); d.setDate(d.getDate() + dayOffset); d.setHours(hour, minute, 0, 0); return d; };
    // H2 (3 ngựa, 12 ngày trước): ngày 1 có 13 hoạt động hiển thị (cần 2 trang), ngày 2 có 4.
    {
      const { horseIds, start } = delivered[211];
      for (const [n, horse] of horseIds.entries()) await careDone(211, horse, 'FEED', atLocal(start, 0, 6, n * 5), { feed: 'Cỏ khô 4 kg + yến mạch 1,5 kg' });
      for (const [n, horse] of horseIds.entries()) {
        if (n === 1) {
          const wrong = await careDone(211, horse, 'WATER', atLocal(start, 0, 7, 10), { liters: 80, note: 'Nhập nhầm' });
          await careDone(211, horse, 'WATER', atLocal(start, 0, 7, 12), { liters: 8, corrects: wrong }); // đính chính 80 L → 8 L
        } else await careDone(211, horse, 'WATER', atLocal(start, 0, 7, 10 + n), { liters: 10 });
      }
      for (const [n, horse] of horseIds.entries()) await careDone(211, horse, 'FEED', atLocal(start, 0, 12, n * 5), { feed: 'Cỏ khô 3 kg + cà rốt' });
      for (const [n, horse] of horseIds.entries()) await careDone(211, horse, 'WATER', atLocal(start, 0, 13, n * 5), { liters: 12 });
      await careDone(211, null, 'REST', atLocal(start, 0, 15), { minutes: 20, note: 'Nghỉ chân giữa chặng' });
      for (const [n, horse] of horseIds.entries()) await careDone(211, horse, 'FEED', atLocal(start, 1, 7, n * 5), { feed: 'Yến mạch 2 kg' });
      await careDone(211, null, 'REST', atLocal(start, 1, 9), { minutes: 30 });
    }
    // H1 (1 ngựa, 5 ngày trước): ít hoạt động + 1 báo cáo sức khỏe đã gửi và đã được khách xem.
    {
      const { horseIds, start, legA } = delivered[210];
      await careDone(210, horseIds[0], 'FEED', atLocal(start, 0, 8), { feed: 'Cỏ khô 3 kg' });
      await careDone(210, horseIds[0], 'WATER', atLocal(start, 0, 9), { liters: 9.5 });
      await careDone(210, null, 'REST', atLocal(start, 0, 11), { minutes: 15 });
      await runner.query(
        `INSERT INTO horse_logs(horse_id,leg_id,condition_status,logged_at,created_by,body_temp_c,heart_rate_bpm,appetite,customer_note,report_status,send_to_customer,sent_at,customer_viewed_at)
         VALUES (?,?,'STABLE',?,6,37.5,34,'NORMAL','Ngựa khỏe, ăn uống bình thường suốt chặng đầu.','SENT',1,?,?)`,
        [horseIds[0], legA, atLocal(start, 0, 10), atLocal(start, 0, 10, 5), atLocal(start, 0, 10, 40)]);
    }

    // ── Đơn khác dùng thử cô lập quyền ──
    await addOrder(101, 'WDP-DEMO-F4-B', 8, 'READY', 1, { date: hoursFromNow(24) });
    await addTrip(201, 101, 'APPROVED', 12, hoursFromNow(0), hoursFromNow(9), [[11, 'DRIVER']], 7, 1);
    await addQuote(101, 1, 'LIGHT', 'deposit', hoursFromNow(-48));
    await addLeg(201, 1, 1, 3, 7, hoursFromNow(0), hoursFromNow(9));
    await addOrder(102, 'WDP-DEMO-F4-C', 7, 'PREPARING', 1, { date: hoursFromNow(24) });
    await addTrip(202, 102, 'PENDING_APPROVAL', 4, hoursFromNow(0), hoursFromNow(9), [], 8, 1);
    await addQuote(102, 1, 'MEDIUM', 'deposit', hoursFromNow(-48));
    await addLeg(202, 1, 1, 3, 8, hoursFromNow(0), hoursFromNow(9));

    // ── Đơn mới chờ quản lý tiếp nhận (đầu luồng): đủ thông tin đặt chuyến để quản lý tính giá, ngựa có hồ sơ của khách ──
    const contact = (name, address, city, ward, country) => ({ name, phone: '0912345678', address, city, ward, identityNumber: '079204000001', country });
    const booking = {
      sender: contact('Khách Hàng Demo', 'Khu chuồng ngựa Demo', 'Tỉnh Tây Ninh', 'Phường Tân Ninh', 'VN'),
      recipient: contact('Trại Ngựa Phnom Penh', 'Trạm nghỉ Phnom Penh', 'Phnom Penh', 'Chamkar Mon', 'KH'),
      pickupTime: '08:00 – 10:00', vehicleClass: 'LIGHT', vehicleCapacity: 2, distanceKm: 240, durationDays: 1, insurance: 'NONE', feed: 'STANDARD',
      extraStall: false, water: 'EVERY_2_HOURS', waterRounds: 0, border: 'Cửa khẩu Mộc Bài', documentLanguage: '', customsCode: '', importPermit: '',
      paymentMethod: 'BANK', termsAccepted: true,
    };
    const [newHorse] = await addOrder(104, 'WDP-DEMO-F4-NEW', 7, 'PENDING', 1, { date: hoursFromNow(24 * 7) });
    await runner.query('UPDATE orders SET booking_details=? WHERE id=104', [JSON.stringify(booking)]);
    const [horse] = await runner.query('SELECT name,passport_no,breed FROM horses WHERE id=?', [newHorse]);
    await runner.query('INSERT INTO customer_horse_profiles(owner_id,name,passport_no,payload) VALUES (7,?,?,?)',
      [horse.name, horse.passport_no, JSON.stringify({ name: horse.name, passportNo: horse.passport_no, breed: horse.breed })]);

    // Trạng thái xe và tổ lái khớp với các chuyến đang hoạt động, như API tự ghi khi chuyển trạng thái.
    await runner.query("UPDATE vehicles SET status='IN_TRANSIT' WHERE id=5");
    await runner.query("UPDATE vehicles SET status='RESERVED' WHERE id IN (6,7,8)");
    await runner.query("UPDATE crew_profiles SET work_status='IN_TRIP' WHERE user_id IN (5,6)");
    await runner.query("UPDATE crew_profiles SET work_status='RESERVED' WHERE user_id=11");
  } finally {
    await runner.release();
    await db.destroy();
  }

  console.log(`\nĐã tạo database demo "${DB_NAME}" trên ${host}:${port}.\n`);
  console.log(`Mật khẩu của TẤT CẢ tài khoản: ${PASSWORD}\n`);
  console.table(accounts.map(([, email, fullName, role]) => ({ email, 'họ tên': fullName, 'vai trò': role })));
  console.log('Dữ liệu mẫu (tài xế demo: driver@example.com; hộ tống demo: escort@example.com):');
  console.log('  • WDP-DEMO-F4-A      IN_TRANSIT, chuyến #200: chặng 1 xong, chặng 2 đang chạy (GPS LIVE), 2 cảnh báo điều phối, ghi chú hộ tống, 1 sự cố vàng, 7 hoạt động chăm sóc hôm nay (có 1 bản đính chính), 1 báo cáo sức khỏe đã gửi khách + 1 nháp');
  console.log('  • WDP-DEMO-F4-NEXT   READY, chuyến #205 khởi hành sau ~26 giờ (cùng tài xế → dòng "Còn 1 chuyến sắp tới")');
  console.log('  • WDP-DEMO-F4-H1..H4 DELIVERED (5/12/20/35 ngày trước) → trang Lịch sử giao hàng');
  console.log('  • WDP-DEMO-F4-B      READY, tài xế khác (driver2@example.com) → thử cô lập quyền;  WDP-DEMO-F4-C  PREPARING, kế hoạch chờ duyệt\n');
}

main().catch(error => { console.error(error); process.exit(1); });
