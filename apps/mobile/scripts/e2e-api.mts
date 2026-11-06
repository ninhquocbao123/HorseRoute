/**
 * Kiểm thử API bằng đúng payload của mobile (dùng trực tiếp driverAction, orderPayload, profilePayload).
 * Tự tạo dữ liệu thử rồi ghi thẳng vào DB, nên CHỈ chạy trên MySQL dùng một lần, không bao giờ trên DB chung.
 *
 * Cách chạy: dựng MySQL và API theo docs/mobile-design/09-test-va-sua-loi.md mục 2, rồi trong apps/mobile:
 *   E2E_DB_PORT=33077 E2E_DB_PASSWORD=... node --experimental-strip-types scripts/e2e-api.mts
 * Biến E2E_API_URL (mặc định http://127.0.0.1:3000/api/v1).
 * API giới hạn 100 yêu cầu/phút theo IP nên script gọi cách quãng.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { estimateInput, newDraft, orderBody } from "../src/booking-domain.ts";
import {
  applyPending,
  canResumeDraft,
  driverAction,
  isReplayConflict,
  orderPayload,
  paymentAction,
  profilePayload,
  emptyProfile,
} from "../src/live-domain.ts";

const apiRequire = createRequire(new URL("../../api/package.json", import.meta.url));
const mysql = apiRequire("mysql2/promise");
const bcrypt = apiRequire("bcrypt");

const API = (process.env.E2E_API_URL || "http://127.0.0.1:3000/api/v1").replace(/\/$/, "");
const DB_PORT = Number(process.env.E2E_DB_PORT);
if (!DB_PORT || DB_PORT === 3306 || !process.env.E2E_DB_PASSWORD) {
  console.error("Cần E2E_DB_PORT (khác 3306) và E2E_DB_PASSWORD của MySQL dùng một lần.");
  process.exit(2);
}
const db = await mysql.createConnection({
  host: "127.0.0.1",
  port: DB_PORT,
  user: "root",
  password: process.env.E2E_DB_PASSWORD,
  database: process.env.E2E_DB_NAME || "wdp",
  timezone: "Z",
});

/** Mật khẩu chỉ dùng cho tài khoản thử trong DB dùng một lần. */
const PASSWORD = "E2e-test-123";
const tag = randomBytes(3).toString("hex");
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(64, 7)]);
const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const pace = () => new Promise((r) => setTimeout(r, 620));
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params))[0] as any;
const count = async (sql: string, params: unknown[] = []) => Number((await q(sql, params))[0].n);

let passed = 0;
const failures: string[] = [];
const notes: string[] = [];
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${(e as Error).message.split("\n").slice(0, 3).join(" | ")}`);
  }
}

type Reply = { status: number; data: any };
async function call(method: string, path: string, token: string | null, body?: unknown): Promise<Reply> {
  await pace();
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, {
    method,
    headers,
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {}
  return { status: res.status, data };
}
const ok = (r: Reply, ...allowed: number[]) => {
  const want = allowed.length ? allowed : [200, 201];
  assert.ok(want.includes(r.status), `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 240)}`);
  return r.data;
};
const rejected = (r: Reply) => {
  assert.ok(r.status >= 400 && r.status < 500, `Mong bị từ chối, nhận HTTP ${r.status}`);
  return r.data;
};
const form = (fields: Record<string, unknown>, photos = 1) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, String(v));
  for (let i = 0; i < photos; i++) f.append("photos", new Blob([PNG], { type: "image/png" }), `p${i}.png`);
  return f;
};

/* ---------------- Dữ liệu ---------------- */
const hash = await bcrypt.hash(PASSWORD, 4);
const mkUser = async (name: string, role: string, phone: string | null = "0900000000") =>
  String(
    (
      await q(
        "INSERT INTO users(email,password_hash,full_name,role,account_status,phone) VALUES (?,?,?,?,'ACTIVE',?)",
        [`e2e.${name}.${tag}@wdp.test`, hash, `${name} ${tag}`, role, phone],
      )
    ).insertId,
  );
const login = async (email: string) =>
  ok(await call("POST", "/auth/login", null, { email, password: PASSWORD })).accessToken as string;
const coord = await mkUser("coord", "COORDINATOR");
const driver = await mkUser("driver", "DRIVER_ESCORT");
const escort = await mkUser("escort", "DRIVER_ESCORT");
const driver2 = await mkUser("driver2", "DRIVER_ESCORT");
const escort2 = await mkUser("escort2", "DRIVER_ESCORT");
await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','AVAILABLE'),(?,'ESCORT','AVAILABLE'),(?,'DRIVER','AVAILABLE'),(?,'ESCORT','AVAILABLE')", [driver, escort, driver2, escort2]);
const owner = await mkUser("owner", "CUSTOMER");
const loc = async (name: string, type: string) =>
  String((await q("INSERT INTO locations(name,location_type,country,timezone,latitude,longitude) VALUES (?,?,'VN','Asia/Ho_Chi_Minh',10.8,106.6)", [name, type])).insertId);
const [locA, locB, locC] = [await loc(`A ${tag}`, "REST_STOP"), await loc(`Cửa khẩu ${tag}`, "BORDER"), await loc(`C ${tag}`, "REST_STOP")];

async function mkTrip(code: string, driverId: string, escortId: string, stops: [string, string][], routePlan: unknown = null) {
  const orderId = String((await q(
    "INSERT INTO orders(order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status,recipient_name,recipient_phone) VALUES (?,?,'A','VN','B','VN',CURDATE(),'READY','Người nhận','0900000099')",
    [code, owner],
  )).insertId);
  const horse = String((await q("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,?,?,?)", [orderId, owner, `Ngựa ${code}`, `P-${code}`])).insertId);
  const tripId = String((await q(
    "INSERT INTO trips(order_id,plan_status,planned_departure_at,planned_arrival_at,planned_by,route_plan) VALUES (?, 'APPROVED', UTC_TIMESTAMP()-INTERVAL 2 DAY, UTC_TIMESTAMP()+INTERVAL 3 HOUR, ?, ?)",
    [orderId, coord, routePlan ? JSON.stringify(routePlan) : null],
  )).insertId);
  const vehicle = String((await q("INSERT INTO vehicles(vehicle_type,capacity_stalls,license_plate,status) VALUES ('LIGHT',2,?,'AVAILABLE')", [`E${code}`.slice(0, 30)])).insertId);
  const tv = String((await q("INSERT INTO trip_vehicles(trip_id,vehicle_id,horse_count) VALUES (?,?,1)", [tripId, vehicle])).insertId);
  await q("INSERT INTO trip_assignments(trip_id,user_id,role,assigned_by,assigned_at,trip_vehicle_id) VALUES (?,?,'DRIVER',?,UTC_TIMESTAMP(),?),(?,?,'ESCORT',?,UTC_TIMESTAMP(),?)", [tripId, driverId, coord, tv, tripId, escortId, coord, tv]);
  const legs: string[] = [];
  for (const [i, [from, to]] of stops.entries())
    legs.push(String((await q(
      "INSERT INTO legs(trip_id,seq_no,from_location_id,to_location_id,vehicle_id,planned_departure_at,planned_arrival_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP()-INTERVAL 2 DAY,UTC_TIMESTAMP()+INTERVAL 3 HOUR)",
      [tripId, i + 1, from, to, vehicle],
    )).insertId));
  return { orderId, horse, tripId, legs };
}
const point = (id: string, kind: string, label: string) => ({ id, kind, label, latitude: 10.8, longitude: 106.6, note: "" });
const plan = {
  version: 1,
  waypoints: [point("orig", "ORIGIN", "Xuất phát"), point("rest1", "REST_STOP", "Điểm nghỉ Một"), point("rest2", "REST_STOP", "Điểm nghỉ Hai"), point("dest", "DESTINATION", "Điểm giao")],
  selectedRoute: null,
};
const single = await mkTrip(`S${tag}`, driver, escort, [[locA, locC]], plan);
const multi = await mkTrip(`M${tag}`, driver2, escort2, [[locA, locB], [locB, locC]]);

const tDriver = await login(`e2e.driver.${tag}@wdp.test`);
const tEscort = await login(`e2e.escort.${tag}@wdp.test`);
const tDriver2 = await login(`e2e.driver2.${tag}@wdp.test`);
const tCoord = await login(`e2e.coord.${tag}@wdp.test`);
const detail = async (id: string, token: string) => ok(await call("GET", `/tracking/trips/${id}`, token));
const mapOf = async (id: string, token: string) => ok(await call("GET", `/tracking/trips/${id}/map`, token));
/** Thực hiện hành động kế tiếp đúng như nút trên màn tài xế. */
async function nextAction(id: string, token: string, at = new Date().toISOString()) {
  const trip = await detail(id, token);
  const action = driverAction(trip, await mapOf(id, token));
  assert.ok(action, "Không có hành động kế tiếp");
  ok(await call("POST", action.path, token, { ...action.body, occurredAt: at }));
  return action;
}

/* ---------------- Khách hàng ---------------- */
console.log("\n== Khách hàng ==");
const email = `e2e.cus.${tag}@wdp.test`;
let tCus = "";
await check("đăng ký bằng payload của mobile rồi đăng nhập", async () => {
  ok(await call("POST", "/auth/register", null, { fullName: "Khách E2E", email, phone: "0912345678", address: "1 Lê Lợi", password: PASSWORD, customerType: "INDIVIDUAL" }), 200, 201);
  tCus = await login(email);
});
await check("đổi mật khẩu rồi đăng nhập bằng mật khẩu mới", async () => {
  const next = "E2e-test-456";
  ok(await call("POST", "/users/me/password", tCus, { currentPassword: PASSWORD, newPassword: next }), 200, 204);
  const r = await call("POST", "/auth/login", null, { email, password: PASSWORD });
  assert.ok(r.status >= 400, "Mật khẩu cũ vẫn đăng nhập được");
  tCus = ok(await call("POST", "/auth/login", null, { email, password: next })).accessToken;
});
const profileIds: string[] = [];
await check("[Lỗi 4] hồ sơ ngựa thiếu ngày sinh: tạo và sửa lại đều được", async () => {
  for (const name of ["Sao Mai", "Sao Hôm", "Sao Khuê"]) {
    const created = ok(await call("POST", "/customer/profiles", tCus, profilePayload({ ...emptyProfile, name, passportNo: `VN-${tag}-${name.length}${profileIds.length}` })));
    profileIds.push(String(created.id));
  }
  const list = ok(await call("GET", "/customer/profiles", tCus));
  const first = list.find((p: any) => String(p.id) === profileIds[0]);
  ok(await call("PUT", `/customer/profiles/${profileIds[0]}`, tCus, profilePayload({ ...first, coatColor: "Hồng" })));
});
await check("[Lỗi 4] API vẫn không nhận birthDate rỗng, nên mobile phải bỏ trường này", async () => {
  rejected(await call("POST", "/customer/profiles", tCus, { ...emptyProfile, name: "Rỗng", birthDate: "" }));
});
await check("trùng số hộ chiếu bị từ chối", async () => {
  ok(await call("POST", "/customer/profiles", tCus, profilePayload({ ...emptyProfile, name: "A", passportNo: `DUP-${tag}` })));
  rejected(await call("POST", "/customer/profiles", tCus, profilePayload({ ...emptyProfile, name: "B", passportNo: `DUP-${tag}` })));
});
await check("tải ảnh ngựa", async () => {
  const f = new FormData();
  f.append("kind", "PHOTO");
  f.append("slot", "other");
  f.append("file", new Blob([PNG], { type: "image/png" }), "ngua.png");
  ok(await call("POST", `/customer/profiles/${profileIds[0]}/files`, tCus, f));
});
const departure = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const basePayload = { originAddress: "1 Lê Lợi, Hà Nội", originCountry: "VN", destinationAddress: "2 Nguyễn Huệ, Hồ Chí Minh", destinationCountry: "VN", desiredDepartureDate: departure, specialRequirements: "" };
const contact = (name: string, phone: string) => ({ name, phone, address: "2 Nguyễn Huệ", city: "", ward: "", identityNumber: "", country: "VN" });
const booking = (recipientPhone: string) => ({
  sender: contact("Khách E2E", "0912345678"),
  recipient: contact("Người Nhận", recipientPhone),
  pickupTime: "", vehicleClass: "LIGHT", distanceKm: 100, durationDays: 1, insurance: "NONE", feed: "STANDARD", extraStall: false,
  water: "EVERY_2_HOURS", waterRounds: 0, border: "", documentLanguage: "", customsCode: "", importPermit: "", paymentMethod: "BANK", termsAccepted: true,
});
const profiles = async () => ok(await call("GET", "/customer/profiles", tCus));
let firstOrder = "";
await check("[Lỗi 3] đơn đã gửi không còn tiếp tục từ nháp; yêu cầu mới tạo đúng đơn mới", async () => {
  const body = { ...orderPayload(basePayload as any, [profileIds[0]], await profiles()), booking: booking("0987654321") };
  const created = ok(await call("POST", "/orders", tCus, { ...body, requestId: randomUUID() }));
  firstOrder = String(created.id);
  assert.equal(canResumeDraft(ok(await call("GET", `/orders/${firstOrder}`, tCus)).status), true);
  ok(await call("POST", `/orders/${firstOrder}/submit`, tCus));
  assert.equal(canResumeDraft(ok(await call("GET", `/orders/${firstOrder}`, tCus)).status), false);
  const second = ok(await call("POST", "/orders", tCus, { ...orderPayload(basePayload as any, [profileIds[1]], await profiles()), requestId: randomUUID() }));
  assert.notEqual(String(second.id), firstOrder);
  ok(await call("POST", `/orders/${second.id}/submit`, tCus));
  assert.equal(await count("SELECT COUNT(*) n FROM orders o JOIN users u ON u.id=o.customer_id WHERE u.email=? AND o.status='PENDING'", [email]), 2);
});
await check("[Mục 5] người nhận có tên, không SĐT: API từ chối khi gửi đơn (mobile phải chặn ở form)", async () => {
  const created = ok(await call("POST", "/orders", tCus, { ...orderPayload(basePayload as any, [profileIds[2]], await profiles()), booking: booking(""), requestId: randomUUID() }));
  rejected(await call("POST", `/orders/${created.id}/submit`, tCus));
  notes.push(`Đơn nháp ${created.id} còn lại do ca thử người nhận thiếu SĐT.`);
});

await check("[File 11] đơn từ form mobile: đủ booking, quản lý thấy đúng giá, duyệt và báo giá được, khách thấy trên danh sách", async () => {
  const profile = ok(await call("POST", "/customer/profiles", tCus, profilePayload({ ...emptyProfile, name: "Booking", breed: "Arabian", passportNo: `BK-${tag}` })));
  const list = await profiles();
  const contact2 = (name: string) => ({ name, phone: "0912 345.678", address: "Trại A", city: "Thành phố Hà Nội", ward: "Phường Ba Đình", identityNumber: "012345678901", country: "VN" });
  const draft = newDraft(randomUUID(), { fullName: "Khách", phone: "0912345678", address: "1 Lê Lợi" }, [String(profile.id)]);
  draft.date = departure;
  draft.booking = { ...draft.booking, sender: contact2("Người Gửi"), recipient: contact2("Người Nhận"), distanceKm: 1496, feed: "SPORT", insurance: "ARABIAN", extraStall: true, waterRounds: 2, termsAccepted: true };
  const created = ok(await call("POST", "/orders", tCus, { ...orderBody(draft, list), requestId: draft.requestId }));
  ok(await call("POST", `/orders/${created.id}/submit`, tCus));
  const [row] = await q("SELECT status, recipient_name, origin_address, booking_details FROM orders WHERE id=?", [created.id]);
  assert.equal(row.status, "PENDING");
  assert.equal(row.origin_address, "Trại A, Phường Ba Đình, Thành phố Hà Nội");
  const saved = typeof row.booking_details === "string" ? JSON.parse(row.booking_details) : row.booking_details;
  assert.equal(saved.distanceKm, 1496);
  assert.equal(saved.durationDays, 3);
  assert.equal(saved.feed, "SPORT");
  assert.equal(saved.recipient.identityNumber, "012345678901");
  assert.equal(saved.recipient.phone, "0912345678");
  const estimate = ok(await call("POST", "/pricing/estimate", tCus, estimateInput(draft, 1, 1496)));
  const crew = estimate.items.find((i: any) => i.code === "CREW");
  assert.equal(crew.quantity, 3);
  assert.ok(estimate.items.some((i: any) => i.code === "INSURANCE"));

  // Khách thấy đơn ở danh sách dùng chung với web.
  const workspace = ok(await call("GET", "/orders/customer-workspace", tCus));
  assert.ok(workspace.orders.some((o: any) => String(o.id) === String(created.id)), "Khách không thấy đơn");

  // Quản lý thấy đơn, tính được đúng giá khách đã thấy.
  const manager = await mkUser("manager", "MANAGER");
  assert.ok(manager);
  const tManager = await login(`e2e.manager.${tag}@wdp.test`);
  const intake = ok(await call("GET", "/manager/intake", tManager));
  const rows = Array.isArray(intake) ? intake : (intake.orders ?? intake.items ?? []);
  assert.ok(rows.some((o: any) => String(o.id) === String(created.id)), "Quản lý không thấy đơn");
  const context = ok(await call("GET", `/manager/orders/${created.id}/context`, tManager));
  assert.equal(context.estimateError, null);
  assert.equal(context.estimate.total, estimate.total, "Giá quản lý khác giá khách thấy");

  // Duyệt, lập và duyệt báo giá, khách xem được.
  ok(await call("POST", `/orders/${created.id}/review`, tManager, { decision: "APPROVED", coordinatorId: coord }));
  const quote = ok(await call("POST", `/manager/orders/${created.id}/quotes`, tManager, { input: context.input, adjustment: 0, reason: "", vatPercent: 10 }));
  const [draftQuote] = await q("SELECT revision FROM order_quotes WHERE id=?", [quote.id]);
  ok(await call("POST", `/manager/quotes/${quote.id}/review`, tManager, { revision: draftQuote.revision, decision: "APPROVED", note: "" }));
  const seen = ok(await call("GET", `/orders/${created.id}/quote`, tCus));
  assert.ok(Number(seen.total) > 0);
  assert.equal(ok(await call("GET", `/orders/${created.id}`, tCus)).status, "APPROVED");
});

/* ---------------- Tổ lái ---------------- */
console.log("\n== Tài xế và hộ tống ==");
await check("[Lỗi 5] chuyến một chặng: bắt đầu, check-in lần lượt, đến nơi, giao ngựa", async () => {
  ok(await call("POST", `/tracking/trips/${single.tripId}/care-activities`, tEscort, { activityType: "WATER", horseId: single.horse, amountLiters: 5, performedAt: minutesAgo(1) }));
  const start = await nextAction(single.tripId, tDriver);
  assert.equal(start.body.milestoneType, "DEPARTED");
  const trip = await detail(single.tripId, tDriver);
  assert.equal(trip.orderStatus, "IN_TRANSIT");
  // Mốc vừa gửi vẫn được giữ bằng applyPending: không kéo lùi dữ liệu máy chủ.
  const kept = applyPending(trip, [{ kind: "milestone", status: "QUEUED", legId: trip.legs[0].id, milestoneType: "DEPARTED", body: {} }]);
  assert.equal(kept.legs[0].milestones.length, trip.legs[0].milestones.length);
  const first = await nextAction(single.tripId, tDriver);
  assert.equal(first.kind, "checkin");
  assert.equal(first.waypointId, "rest1");
  const second = await nextAction(single.tripId, tDriver);
  assert.equal(second.waypointId, "rest2");
  assert.equal((await nextAction(single.tripId, tDriver)).body.milestoneType, "ARRIVED_AT_STOP");
});
await check("[Lỗi 2] báo cáo gửi khách thiếu ghi chú bị từ chối, có ghi chú thì nhận", async () => {
  const base = { horseId: single.horse, conditionStatus: "STABLE", loggedAt: minutesAgo(1), reportStatus: "SENT", sendToCustomer: "true", appetite: "NORMAL" };
  const path = `/tracking/legs/${single.legs[0]}/horse-logs`;
  rejected(await call("POST", path, tEscort, form(base)));
  ok(await call("POST", path, tEscort, form({ ...base, customerNote: "Ngựa ổn" })));
});
await check("[Mục 7] loại con sự cố bằng mã thật; mã không thuộc loại bị từ chối", async () => {
  const base = { incidentType: "VEHICLE_BREAKDOWN", severity: "ORANGE", damageTarget: "VEHICLE", description: "Nổ lốp sau bên phải" };
  const path = `/tracking/trips/${single.tripId}/incidents`;
  const created = ok(await call("POST", path, tDriver, form({ ...base, subType: "TIRE_BURST", legId: single.legs[0], latitude: "10.800000", longitude: "106.600000" })));
  assert.equal(created.subType, "TIRE_BURST");
  rejected(await call("POST", path, tDriver, form({ ...base, subType: "KHONG_CO" })));
});
await check("[Mục 7] tài xế và hộ tống xem được phản hồi của điều phối", async () => {
  const path = `/tracking/trips/${single.tripId}/incidents`;
  const [incident] = ok(await call("GET", path, tDriver));
  ok(await call("PATCH", `/tracking/incidents/${incident.id}`, tCoord, { status: "ACKNOWLEDGED", handlingNote: "Đội cứu hộ đang tới", waitMinutes: 30 }));
  for (const token of [tDriver, tEscort]) {
    const found = ok(await call("GET", path, token)).find((i: any) => i.id === incident.id);
    assert.equal(found.responses[0].note, "Đội cứu hộ đang tới");
    assert.ok(found.responses[0].expectedAt);
  }
});
await check("hộ tống báo sự cố y tế khẩn", async () => {
  const created = ok(await call("POST", `/tracking/trips/${single.tripId}/incidents`, tEscort, form({ incidentType: "HORSE_MEDICAL", severity: "RED", damageTarget: "HORSE", description: "Ngựa khó thở", horseId: single.horse })));
  assert.equal(created.urgency, "HIGH");
});
await check("giao ngựa ở chuyến một chặng", async () => {
  assert.equal((await nextAction(single.tripId, tDriver)).body.milestoneType, "DELIVERED");
  assert.equal((await detail(single.tripId, tDriver)).orderStatus, "DELIVERED");
});
await check("chuyến nhiều chặng qua cửa khẩu, thông quan rồi giao", async () => {
  const seen: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = await nextAction(multi.tripId, tDriver2);
    seen.push(a.kind === "complete" ? "complete" : String(a.body.milestoneType));
  }
  assert.deepEqual(seen, ["DEPARTED", "ARRIVED_AT_STOP", "CUSTOMS_CLEARED", "complete", "DEPARTED", "ARRIVED_AT_STOP"]);
  assert.equal(await count("SELECT COUNT(*) n FROM leg_milestones WHERE leg_id=?", [multi.legs[0]]), 3);
});

/* ---------------- G2, G3 ---------------- */
console.log("\n== G2 chống gửi trùng ==");
const g2 = await mkTrip(`G${tag}`, driver, escort, [[locA, locC]]);
const rid = (name: string) => `${name}-${tag}-${Date.now()}`;
ok(await call("POST", `/tracking/legs/${g2.legs[0]}/milestones`, tDriver, { milestoneType: "DEPARTED", occurredAt: minutesAgo(1) }));
await check("gửi lại sự cố cùng clientRequestId: một bản ghi, trả về bản đã có", async () => {
  const id = rid("inc");
  const fields = { incidentType: "LONG_TRAFFIC_JAM", severity: "YELLOW", damageTarget: "VEHICLE", description: "Tắc đường 2 giờ", clientRequestId: id };
  const a = ok(await call("POST", `/tracking/trips/${g2.tripId}/incidents`, tDriver, form(fields)));
  const notices = () => count("SELECT COUNT(*) n FROM notifications WHERE event_type='INCIDENT_REPORTED' AND related_id=?", [a.id]);
  const noticesAfterFirst = await notices();
  assert.ok(noticesAfterFirst >= 1);
  const b = ok(await call("POST", `/tracking/trips/${g2.tripId}/incidents`, tDriver, form(fields)));
  assert.equal(a.id, b.id);
  assert.equal(await count("SELECT COUNT(*) n FROM incidents WHERE trip_id=?", [g2.tripId]), 1);
  assert.equal(await count("SELECT COUNT(*) n FROM attachments WHERE incident_id=?", [a.id]), 1);
  assert.equal(await notices(), noticesAfterFirst);
});
await check("gửi lại báo cáo sức khỏe: một bản ghi", async () => {
  const fields = { horseId: g2.horse, conditionStatus: "STABLE", loggedAt: minutesAgo(1), reportStatus: "SENT", sendToCustomer: "true", customerNote: "Ổn", clientRequestId: rid("log") };
  const a = ok(await call("POST", `/tracking/legs/${g2.legs[0]}/horse-logs`, tEscort, form(fields)));
  const b = ok(await call("POST", `/tracking/legs/${g2.legs[0]}/horse-logs`, tEscort, form(fields)));
  assert.equal(a.id, b.id);
  assert.equal(await count("SELECT COUNT(*) n FROM horse_logs WHERE leg_id=?", [g2.legs[0]]), 1);
});
await check("gửi lại hoạt động chăm sóc: một bản ghi", async () => {
  const body = { activityType: "WATER", horseId: g2.horse, amountLiters: 5, performedAt: minutesAgo(1), clientRequestId: rid("care") };
  const a = ok(await call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, body));
  const b = ok(await call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, body));
  assert.equal(a.id, b.id);
  assert.equal(await count("SELECT COUNT(*) n FROM horse_care_activities WHERE trip_id=?", [g2.tripId]), 1);
});
await check("gửi đồng thời cùng clientRequestId: vẫn một bản ghi, không lỗi 5xx", async () => {
  const body = { activityType: "REST", durationMinutes: 15, performedAt: minutesAgo(1), clientRequestId: rid("race") };
  const replies = await Promise.all([1, 2, 3].map(() => call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, body)));
  replies.forEach((r) => ok(r));
  assert.equal(new Set(replies.map((r) => r.data.id)).size, 1);
});
await check("không gửi clientRequestId: giữ hành vi cũ, tạo bản ghi mới", async () => {
  const body = { activityType: "REST", durationMinutes: 10, performedAt: minutesAgo(1) };
  const a = ok(await call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, body));
  const b = ok(await call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, body));
  assert.notEqual(a.id, b.id);
});
await check("clientRequestId sai định dạng bị từ chối", async () => {
  rejected(await call("POST", `/tracking/trips/${g2.tripId}/care-activities`, tEscort, { activityType: "REST", durationMinutes: 10, performedAt: minutesAgo(1), clientRequestId: "x y" }));
});

console.log("\n== G3 cửa sổ ghi bù ==");
const driver3 = await mkUser("driver3", "DRIVER_ESCORT");
const escort3 = await mkUser("escort3", "DRIVER_ESCORT");
await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','AVAILABLE'),(?,'ESCORT','AVAILABLE')", [driver3, escort3]);
const tDriver3 = await login(`e2e.driver3.${tag}@wdp.test`);
const tEscort3 = await login(`e2e.escort3.${tag}@wdp.test`);
const g3 = await mkTrip(`H${tag}`, driver3, escort3, [[locA, locC]], plan);
const leg3 = `/tracking/legs/${g3.legs[0]}/milestones`;
await check("mốc 3 giờ trước: không có queuedAt thì vẫn bị từ chối theo LEG_BACK", async () => {
  rejected(await call("POST", leg3, tDriver3, { milestoneType: "DEPARTED", occurredAt: minutesAgo(180) }));
});
await check("mốc 25 giờ trước từ hàng chờ bị từ chối", async () => {
  rejected(await call("POST", leg3, tDriver3, { milestoneType: "DEPARTED", occurredAt: minutesAgo(1500), queuedAt: minutesAgo(1500) }));
});
await check("giờ xảy ra sau giờ vào hàng chờ bị từ chối", async () => {
  rejected(await call("POST", leg3, tDriver3, { milestoneType: "DEPARTED", occurredAt: minutesAgo(10), queuedAt: minutesAgo(60) }));
});
await check("mốc 3 giờ trước từ hàng chờ được nhận", async () => {
  ok(await call("POST", leg3, tDriver3, { milestoneType: "DEPARTED", occurredAt: minutesAgo(180), queuedAt: minutesAgo(180) }));
});
await check("check-in và ghi chăm sóc gần 3 giờ trước từ hàng chờ được nhận", async () => {
  ok(await call("POST", `/tracking/legs/${g3.legs[0]}/waypoints/rest1/checkin`, tDriver3, { occurredAt: minutesAgo(175), queuedAt: minutesAgo(175) }));
  ok(await call("POST", `/tracking/legs/${g3.legs[0]}/waypoints/rest2/checkin`, tDriver3, { occurredAt: minutesAgo(172), queuedAt: minutesAgo(172) }));
  ok(await call("POST", `/tracking/trips/${g3.tripId}/care-activities`, tEscort3, { activityType: "WATER", horseId: g3.horse, amountLiters: 3, performedAt: minutesAgo(170), queuedAt: minutesAgo(170) }));
});
await check("gửi lại mốc đã ghi trả 409 (mobile coi như đã gửi nếu lần trước mất phản hồi)", async () => {
  const body = { milestoneType: "ARRIVED_AT_STOP", occurredAt: minutesAgo(120), queuedAt: minutesAgo(120) };
  ok(await call("POST", leg3, tDriver3, body));
  const again = await call("POST", leg3, tDriver3, body);
  assert.equal(again.status, 409);
  assert.match(again.data.message, /đã được ghi nhận/);
});

/* ---------------- Thanh toán mô phỏng và điều kiện giao (kế hoạch 10) ---------------- */
console.log("\n== Thanh toán và giao ngựa ==");
const manager = await mkUser("paymgr", "MANAGER");
const coordOther = await mkUser("coordother", "COORDINATOR");
const tManager = await login(`e2e.paymgr.${tag}@wdp.test`);
const tCoordOther = await login(`e2e.coordother.${tag}@wdp.test`);
const tOwner = await login(`e2e.owner.${tag}@wdp.test`);
const TOTAL = 1000000;
const DEPOSIT = 300000;
/** Báo giá đã duyệt, ghi thẳng DB. Khóa ngoại bảng giá tạm tắt vì DB dùng một lần không có bảng giá mẫu. */
async function mkQuote(orderId: string, expiresAt: Date | null = new Date(Date.now() + 86400000)) {
  await q("SET FOREIGN_KEY_CHECKS=0");
  const id = String((await q(
    "INSERT INTO order_quotes(order_id,pricing_version_id,status,input,items,subtotal,adjustment_reason,vat_amount,total,deposit,deposit_percent,validity_hours,expires_at,created_by,approved_by,approved_at) VALUES (?,1,'APPROVED','{}','[]',?,'',0,?,?,30,48,?,?,?,UTC_TIMESTAMP(3))",
    [orderId, TOTAL, TOTAL, DEPOSIT, expiresAt, manager, manager],
  )).insertId);
  await q("SET FOREIGN_KEY_CHECKS=1");
  return id;
}
const paySim = async (orderId: string, paymentType: string, result = "SUCCESS") => {
  const session = ok(await call("POST", "/payments/sessions", tOwner, { orderId, paymentType, paymentMethod: "BANK_TRANSFER" }));
  return { session, done: await call("POST", `/payments/sessions/${session.sessionCode}/complete`, tOwner, { result }) };
};
const quoteOf = async (orderId: string) => ok(await call("GET", `/orders/${orderId}/quote`, tOwner));
const actionOf = async (orderId: string) => {
  const quote = await quoteOf(orderId);
  return paymentAction({ status: quote.order_status, arrivedAtDelivery: quote.arrived_at_delivery }, quote);
};
const notices = (userId: string, eventType: string, relatedId: string) =>
  count("SELECT COUNT(*) n FROM notifications WHERE recipient_id=? AND event_type=? AND related_id=?", [userId, eventType, relatedId]);
/** Đưa chặng đầu tới điểm giao, đúng thứ tự tài xế bấm. */
async function arrive(trip: { legs: string[] }, token: string) {
  ok(await call("POST", `/tracking/legs/${trip.legs[0]}/milestones`, token, { milestoneType: "DEPARTED", occurredAt: minutesAgo(30) }));
  ok(await call("POST", `/tracking/legs/${trip.legs[0]}/milestones`, token, { milestoneType: "ARRIVED_AT_STOP", occurredAt: minutesAgo(10) }));
}
const deliver = (trip: { legs: string[] }, token: string, extra = {}) =>
  call("POST", `/tracking/legs/${trip.legs[0]}/milestones`, token, { milestoneType: "DELIVERED", occurredAt: minutesAgo(1), ...extra });

await check("đơn APPROVED: đặt cọc mô phỏng, chuyển PREPARING, không tạo phiên trùng", async () => {
  const orderId = String((await q(
    "INSERT INTO orders(order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status) VALUES (?,?,'A','VN','B','VN',CURDATE(),'APPROVED')",
    [`P${tag}`, owner],
  )).insertId);
  await mkQuote(orderId);
  const action = await actionOf(orderId);
  assert.ok(action.kind === "pay" && action.type === "DEPOSIT" && action.amount === DEPOSIT);
  rejected(await call("POST", "/payments/sessions", tOwner, { orderId, paymentType: "BALANCE", paymentMethod: "CARD" }));
  const body = { orderId, paymentType: "DEPOSIT", paymentMethod: "CARD" };
  const first = ok(await call("POST", "/payments/sessions", tOwner, body));
  const second = ok(await call("POST", "/payments/sessions", tOwner, body));
  assert.equal(second.sessionCode, first.sessionCode);
  const failed = await paySim(orderId, "DEPOSIT", "FAILED");
  ok(failed.done);
  assert.equal(Number((await quoteOf(orderId)).paid), 0);
  ok((await paySim(orderId, "DEPOSIT")).done);
  const quote = await quoteOf(orderId);
  assert.equal(Number(quote.paid), DEPOSIT);
  assert.equal(quote.order_status, "PREPARING");
  const next = await actionOf(orderId);
  assert.ok(next.kind === "pay" && next.type === "BALANCE" && next.amount === TOTAL - DEPOSIT && !next.urgent);
});
await check("báo giá hết hạn: mobile không có nút, máy chủ từ chối đặt cọc", async () => {
  const orderId = String((await q(
    "INSERT INTO orders(order_code,customer_id,origin_address,origin_country,destination_address,destination_country,desired_departure_date,status) VALUES (?,?,'A','VN','B','VN',CURDATE(),'APPROVED')",
    [`X${tag}`, owner],
  )).insertId);
  await mkQuote(orderId, new Date(Date.now() - 3600000));
  assert.equal((await actionOf(orderId)).kind, "none");
  assert.equal((await call("POST", "/payments/sessions", tOwner, { orderId, paymentType: "DEPOSIT", paymentMethod: "CARD" })).status, 409);
  const home = ok(await call("GET", "/orders/customer-workspace", tOwner)).orders.find((o: any) => String(o.id) === orderId);
  assert.ok(home.quote_expires_at && Number(home.quote_deposit) === DEPOSIT, "Trang chủ cần hạn và tiền cọc để ẩn thẻ");
});

/** Tổ lái riêng cho mỗi chuyến: API không cho một người ở hai chuyến đang mở. */
async function mkCrew(name: string) {
  const d = await mkUser(`d${name}`, "DRIVER_ESCORT");
  const e = await mkUser(`e${name}`, "DRIVER_ESCORT");
  await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','AVAILABLE'),(?,'ESCORT','AVAILABLE')", [d, e]);
  return { d, e, tD: await login(`e2e.d${name}.${tag}@wdp.test`), tE: await login(`e2e.e${name}.${tag}@wdp.test`) };
}
const crewPaid = await mkCrew("paid");
const driver4 = crewPaid.d;
const tDriver4 = crewPaid.tD;
const tEscort4 = crewPaid.tE;
const paidTrip = await mkTrip(`Q${tag}`, driver4, crewPaid.e, [[locA, locC]]);
await mkQuote(paidTrip.orderId);
await check("chưa trả đủ: tổ lái chỉ thấy cờ, không thấy số tiền", async () => {
  ok((await paySim(paidTrip.orderId, "DEPOSIT")).done);
  for (const token of [tDriver4, tEscort4]) {
    const trip = await detail(paidTrip.tripId, token);
    assert.equal(trip.paymentCleared, false);
    assert.equal(trip.deliveryExceptionReason, null);
    assert.ok(!/"(total|paid|deposit|balance|amount)"/.test(JSON.stringify(trip)), "Lộ số tiền cho tổ lái");
  }
  rejected(await call("GET", `/tracking/orders/${paidTrip.orderId}/delivery-clearance`, tDriver4));
});
await check("xe tới mà chưa trả đủ: khách có thông báo và thẻ khẩn, tài xế bị 402, chặng vẫn AT_STOP", async () => {
  await arrive(paidTrip, tDriver4);
  assert.equal(await notices(owner, "PAYMENT_NEEDED_FOR_DELIVERY", paidTrip.orderId), 1);
  const action = await actionOf(paidTrip.orderId);
  assert.ok(action.kind === "pay" && action.urgent, "Khách phải thấy thẻ khẩn");
  const r = await deliver(paidTrip, tDriver4);
  assert.equal(r.status, 402);
  assert.match(r.data.message, /chưa thanh toán đủ/);
  const trip = await detail(paidTrip.tripId, tDriver4);
  assert.equal(trip.legs[0].status, "AT_STOP");
  assert.equal(trip.orderStatus, "IN_TRANSIT");
});
await check("402 không bị hàng chờ coi là mốc đã đến nơi", async () => {
  assert.equal(isReplayConflict({ kind: "milestone", lastFailure: "mất mạng" }, 402), false);
});
await check("hiệu chỉnh chặng không lách được quy tắc giao", async () => {
  assert.equal((await call("PATCH", `/tracking/legs/${paidTrip.legs[0]}/correct`, tCoord, { status: "COMPLETED", reason: "Thử lách" })).status, 402);
  assert.equal((await detail(paidTrip.tripId, tDriver4)).orderStatus, "IN_TRANSIT");
});
await check("khách trả đủ: tổ lái có thông báo, nút mở, giao được và ghi người nhận thực tế", async () => {
  ok((await paySim(paidTrip.orderId, "BALANCE")).done);
  assert.equal(await notices(driver4, "DELIVERY_CLEARED", paidTrip.tripId), 1);
  const trip = await detail(paidTrip.tripId, tDriver4);
  assert.equal(trip.paymentCleared, true);
  assert.equal(driverAction(trip, null)?.body.milestoneType, "DELIVERED");
  ok(await deliver(paidTrip, tDriver4, { actualRecipientName: "Trần Nhận Thay", actualRecipientPhone: "0911222333" }));
  const after = await detail(paidTrip.tripId, tDriver4);
  assert.equal(after.orderStatus, "DELIVERED");
  const m = after.legs[0].milestones.find((x: any) => x.milestoneType === "DELIVERED");
  assert.equal(m.actualRecipientName, "Trần Nhận Thay");
  assert.equal(m.actualRecipientPhone, "0911222333");
  assert.deepEqual((await actionOf(paidTrip.orderId)).note, "Đã thanh toán đủ");
});
await check("người nhận thực tế chỉ ghi ở mốc Đã giao", async () => {
  const crew = await mkCrew("rcpt");
  const other = await mkTrip(`R${tag}`, crew.d, crew.e, [[locA, locC]]);
  rejected(await call("POST", `/tracking/legs/${other.legs[0]}/milestones`, crew.tD, { milestoneType: "DEPARTED", occurredAt: minutesAgo(1), actualRecipientName: "Ai đó" }));
});
await check("quản lý ghi khoản thu đủ thì tài xế giao được", async () => {
  const crew = await mkCrew("cash");
  const trip = await mkTrip(`V${tag}`, crew.d, crew.e, [[locA, locC]]);
  const quoteId = await mkQuote(trip.orderId);
  await arrive(trip, crew.tD);
  assert.equal((await deliver(trip, crew.tD)).status, 402);
  ok(await call("POST", `/manager/quotes/${quoteId}/receipts`, tManager, { amount: TOTAL, reference: `TM-${tag}`, receivedAt: minutesAgo(1) }));
  assert.equal((await detail(trip.tripId, crew.tD)).paymentCleared, true);
  ok(await deliver(trip, crew.tD));
});
await check("đơn cũ không có báo giá duyệt thì không chặn", async () => {
  assert.equal((await detail(g3.tripId, tDriver3)).paymentCleared, true);
});

const crewDebt = await mkCrew("debt");
const debtTrip = await mkTrip(`D${tag}`, crewDebt.d, crewDebt.e, [[locA, locC]]);
await mkQuote(debtTrip.orderId);
const openPath = `/tracking/orders/${debtTrip.orderId}/delivery-exception`;
await check("sự cố giao ngựa: không cần ảnh và hư hại, sai loại con bị từ chối, loại khác vẫn bắt buộc", async () => {
  await arrive(debtTrip, crewDebt.tD);
  const base = { incidentType: "DELIVERY_ISSUE", severity: "ORANGE", description: "Gọi 3 lần không nghe máy" };
  const created = ok(await call("POST", `/tracking/trips/${debtTrip.tripId}/incidents`, crewDebt.tD, form({ ...base, subType: "RECIPIENT_UNREACHABLE" }, 0)));
  assert.equal(created.damageTarget, null);
  const seen = ok(await call("GET", `/tracking/incidents/${created.id}`, tCoord));
  assert.equal(seen.incidentType, "DELIVERY_ISSUE");
  rejected(await call("POST", `/tracking/trips/${debtTrip.tripId}/incidents`, crewDebt.tD, form({ ...base, subType: "COLIC" }, 0)));
  rejected(await call("POST", `/tracking/trips/${debtTrip.tripId}/incidents`, crewDebt.tD, form({ incidentType: "VEHICLE_BREAKDOWN", severity: "ORANGE", description: "Nổ lốp sau xe" }, 1)));
  rejected(await call("POST", `/tracking/trips/${debtTrip.tripId}/incidents`, crewDebt.tD, form({ incidentType: "VEHICLE_BREAKDOWN", severity: "ORANGE", damageTarget: "VEHICLE", description: "Nổ lốp sau xe" }, 0)));
});
await check("ngoại lệ: tổ lái, khách, điều phối không tự duyệt được; chưa duyệt thì không mở được", async () => {
  const body = { reason: "Khách tin cậy, trả trong 3 ngày" };
  for (const token of [crewDebt.tD, tOwner, tCoord]) assert.equal((await call("POST", openPath, token, body)).status, 403);
  assert.equal((await call("POST", `${openPath}/open`, crewDebt.tD)).status, 403);
  assert.equal((await call("POST", `${openPath}/open`, tCoord)).status, 409);
  assert.equal((await call("GET", `/tracking/orders/${debtTrip.orderId}/delivery-clearance`, tCoordOther)).status, 404);
  assert.equal((await deliver(debtTrip, crewDebt.tD)).status, 402);
});
await check("quản lý duyệt nhưng chưa mở thì tài xế vẫn bị chặn; điều phối ngoài chuyến không mở được", async () => {
  const c = ok(await call("POST", openPath, tManager, { reason: "Khách tin cậy, trả trong 3 ngày", dueAt: new Date(Date.now() + 3 * 86400000).toISOString() }));
  assert.equal(c.cleared, false);
  assert.equal(c.exception.status, "APPROVED");
  assert.equal((await call("POST", openPath, tManager, { reason: "Duyệt lần hai" })).status, 409);
  assert.equal((await deliver(debtTrip, crewDebt.tD)).status, 402);
  assert.equal((await call("POST", `${openPath}/open`, tCoordOther)).status, 404);
  assert.equal((await detail(debtTrip.tripId, crewDebt.tD)).deliveryExceptionReason, null);
});
await check("điều phối mở: tài xế thấy lý do, giao được; đơn vẫn còn nợ và khách vẫn trả được", async () => {
  const c = ok(await call("POST", `${openPath}/open`, tCoord));
  assert.equal(c.cleared, true);
  assert.equal(c.fullyPaid, false);
  assert.equal(await notices(crewDebt.d, "DELIVERY_EXCEPTION_OPENED", debtTrip.tripId), 1);
  const trip = await detail(debtTrip.tripId, crewDebt.tD);
  assert.equal(trip.paymentCleared, true);
  assert.match(trip.deliveryExceptionReason, /Khách tin cậy/);
  ok(await deliver(debtTrip, crewDebt.tD));
  assert.equal((await detail(debtTrip.tripId, crewDebt.tD)).orderStatus, "DELIVERED");
  const action = await actionOf(debtTrip.orderId);
  assert.equal(action.kind, "pay");
  const audit = await count("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='ORDER' AND entity_id=? AND action IN ('DELIVERY_EXCEPTION_APPROVED','DELIVERY_EXCEPTION_OPENED')", [debtTrip.orderId]);
  assert.equal(audit, 2);
});

/* ---------------- Nhật ký chăm sóc cho khách (kế hoạch 14) ---------------- */
console.log("\n== Nhật ký chăm sóc ==");
const crewCare = await mkCrew("care");
const careTrip = await mkTrip(`K${tag}`, crewCare.d, crewCare.e, [[locA, locC]]);
const carePath = `/tracking/trips/${careTrip.tripId}/care-activities`;
const careNotices = () => notices(owner, "CARE_ACTIVITY", careTrip.orderId);
await check("ghi chăm sóc: khách đọc được nhật ký và có đúng một thông báo", async () => {
  const id = randomUUID();
  const body = { activityType: "WATER", horseId: careTrip.horse, amountLiters: 12, performedAt: minutesAgo(5), clientRequestId: id };
  const first = ok(await call("POST", carePath, crewCare.tE, body));
  assert.equal(await careNotices(), 1);
  const list = ok(await call("GET", `/tracking/orders/${careTrip.orderId}/care-activities`, tOwner));
  assert.equal(list.activities.length, 1);
  assert.equal(list.summary.waterLiters, 12);
  const again = ok(await call("POST", carePath, crewCare.tE, body));
  assert.equal(again.id, first.id, "Gửi lại phải trả bản đã ghi");
  assert.equal(await careNotices(), 1, "Gửi lại không được tạo thêm thông báo");
});
await check("trong 30 phút: nhật ký vẫn đủ nhưng không thêm thông báo", async () => {
  ok(await call("POST", carePath, crewCare.tE, { activityType: "REST", durationMinutes: 30, performedAt: minutesAgo(4) }));
  assert.equal(await careNotices(), 1);
  const list = ok(await call("GET", `/tracking/orders/${careTrip.orderId}/care-activities`, tOwner));
  assert.equal(list.activities.length, 2);
});
await check("quá 30 phút: có thông báo mới; đính chính thì không", async () => {
  await q("UPDATE notifications SET created_at=UTC_TIMESTAMP()-INTERVAL 31 MINUTE WHERE recipient_id=? AND event_type='CARE_ACTIVITY' AND related_id=?", [owner, careTrip.orderId]);
  const fed = ok(await call("POST", carePath, crewCare.tE, { activityType: "FEED", horseId: careTrip.horse, feedDescription: "Cỏ khô", performedAt: minutesAgo(3) }));
  assert.equal(await careNotices(), 2);
  await q("UPDATE notifications SET created_at=UTC_TIMESTAMP()-INTERVAL 31 MINUTE WHERE recipient_id=? AND event_type='CARE_ACTIVITY' AND related_id=?", [owner, careTrip.orderId]);
  ok(await call("POST", carePath, crewCare.tE, { activityType: "FEED", horseId: careTrip.horse, feedDescription: "Cám viên", performedAt: minutesAgo(2), correctsActivityId: fed.id }));
  assert.equal(await careNotices(), 2, "Đính chính không được báo lại");
});
await check("tài khoản khách khác không đọc được nhật ký của đơn", async () => {
  const other = await mkUser("othercus", "CUSTOMER");
  assert.ok(other);
  const token = await login(`e2e.othercus.${tag}@wdp.test`);
  rejected(await call("GET", `/tracking/orders/${careTrip.orderId}/care-activities`, token));
});

console.log(`\nKết quả: ${passed} đạt, ${failures.length} lỗi.`);
failures.forEach((f) => console.log(`  - ${f}`));
notes.forEach((n) => console.log(`Ghi chú: ${n}`));
await db.end();
process.exit(failures.length ? 1 : 0);
