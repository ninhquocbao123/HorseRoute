import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient, ApiError } from "../src/api/http.ts";
import {
  applyPending,
  canResumeDraft,
  customerNoteError,
  validDate,
  driverAction,
  isReplayConflict,
  nextStop,
  pastClock,
  queueWireFields,
  careDetail,
  careSummaryLine,
  paymentAction,
  depositTimeLeft,
  placeName,
  shouldStopTracking,
  tripTimeline,
  profilePayload,
  emptyProfile,
} from "../src/live-domain.ts";
test("calendar rejects overflow", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
});
test("login network errors do not warn about duplicate business data", async () => {
  const request = createApiClient({
    baseUrl: "https://example.test", getToken: () => null,
    fetcher: async () => { throw new Error("offline"); },
  });
  await assert.rejects(request("/auth/login", { method: "POST", anonymous: true }),
    (error: Error) => error.message.includes("máy chủ đăng nhập") && !error.message.includes("trùng dữ liệu"));
});
test("profile preserves revision without metadata", () => {
  const p = profilePayload({ ...emptyProfile, revision: 3, id: "1" } as any);
  assert.equal(p.revision, 3);
  assert.equal("id" in p, false);
});
test("escort cannot submit driver milestones", () => {
  assert.equal(driverAction({ crewRole: "ESCORT" } as any), null);
});
test("authenticated request", async () => {
  const req = createApiClient({
    baseUrl: "https://example.test",
    getToken: () => "token",
    fetcher: async (_, init) => {
      assert.equal((init!.headers as any).Authorization, "Bearer token");
      return Response.json({ id: "123" });
    },
  });
  assert.deepEqual(await req("/orders"), { id: "123" });
});
test("failed writes are never automatically retried", async () => {
  let count = 0;
  const req = createApiClient({
    baseUrl: "https://example.test",
    getToken: () => null,
    fetcher: async () => {
      count++;
      throw new Error("offline");
    },
  });
  await assert.rejects(req("/orders", { method: "POST", body: {} }), ApiError);
  assert.equal(count, 1);
});
test("stale unauthorized response preserves newer session", async () => {
  let token = "old";
  let expired = false;
  const req = createApiClient({
    baseUrl: "https://example.test",
    getToken: () => token,
    onUnauthorized: () => {
      expired = true;
    },
    fetcher: async () => {
      token = "new";
      return Response.json({ message: "Expired" }, { status: 401 });
    },
  });
  await assert.rejects(req("/orders"), ApiError);
  assert.equal(expired, false);
});
test("stop check-ins are one tap; start, customs and delivery need a confirm", () => {
  const leg = (seqNo: number, status: string, extra: object = {}) => ({
    id: `l${seqNo}`, seqNo, status, fromLocationName: `Điểm ${seqNo}`,
    toLocationName: `Điểm ${seqNo + 1}`, toLocationType: "STOP",
    milestones: [], waypointCheckins: [], ...extra,
  });
  const trip = (orderStatus: string, legs: object[]) =>
    ({ crewRole: "DRIVER", planStatus: "APPROVED", orderStatus, legs }) as any;
  const start = driverAction(trip("READY", [leg(1, "NOT_STARTED"), leg(2, "NOT_STARTED")]))!;
  assert.equal(start.confirm, true);
  assert.equal(start.needsChecklist, true);
  const arrive = driverAction(trip("IN_TRANSIT", [leg(1, "MOVING"), leg(2, "NOT_STARTED")]))!;
  assert.equal(arrive.body.milestoneType, "ARRIVED_AT_STOP");
  assert.equal(arrive.confirm, false);
  const leave = driverAction(trip("IN_TRANSIT", [leg(1, "COMPLETED"), leg(2, "NOT_STARTED")]))!;
  assert.equal(leave.body.milestoneType, "DEPARTED");
  assert.equal(leave.confirm, false);
  const customs = driverAction(trip("IN_TRANSIT", [leg(1, "AT_STOP", { toLocationType: "BORDER" }), leg(2, "NOT_STARTED")]))!;
  assert.equal(customs.body.milestoneType, "CUSTOMS_CLEARED");
  assert.equal(customs.confirm, true);
  const deliver = driverAction(trip("IN_TRANSIT", [leg(1, "COMPLETED"), leg(2, "AT_STOP")]))!;
  assert.equal(deliver.body.milestoneType, "DELIVERED");
  assert.equal(deliver.confirm, true);
});
test("profile without birth date omits the field the server rejects when empty", () => {
  const p = profilePayload({ ...emptyProfile, name: "Sao Mai" });
  assert.equal("birthDate" in p, false);
  assert.equal(
    profilePayload({ ...emptyProfile, birthDate: "2018-01-01" }).birthDate,
    "2018-01-01",
  );
});
test("report to customer needs a customer note", () => {
  assert.ok(customerNoteError(true, "  "));
  assert.equal(customerNoteError(true, "Ngựa ổn"), null);
  assert.equal(customerNoteError(false, ""), null);
});
test("local draft resumes only while the order is still editable", () => {
  assert.equal(canResumeDraft("DRAFT"), true);
  assert.equal(canResumeDraft("NEED_INFO"), true);
  for (const status of ["PENDING", "APPROVED", "REJECTED", "DELIVERED"])
    assert.equal(canResumeDraft(status), false);
});
test("milestone just sent keeps the screen moving and never rewinds server state", () => {
  const leg = (status: string, milestones: string[], waypointCheckins: object[] = []) => ({
    id: "l1", seqNo: 1, status, waypointCheckins,
    milestones: milestones.map((milestoneType) => ({ milestoneType })),
  });
  const trip = (l: object) =>
    ({ legs: [l], orderStatus: "IN_TRANSIT", horses: [] }) as any;
  const sent = (milestoneType: string) => ({
    kind: "milestone", status: "QUEUED", legId: "l1", milestoneType, body: {},
  });
  // Máy chủ chưa kịp trả mốc mới: màn vẫn đi tiếp.
  const stale = applyPending(trip(leg("MOVING", ["DEPARTED"])), [sent("ARRIVED_AT_STOP")]);
  assert.equal(stale.legs[0].status, "AT_STOP");
  // Máy chủ đã có mốc và đã đi xa hơn: mốc cũ không kéo lùi trạng thái.
  const fresh = applyPending(trip(leg("AT_STOP", ["DEPARTED", "ARRIVED_AT_STOP"])), [sent("DEPARTED")]);
  assert.equal(fresh.legs[0].status, "AT_STOP");
  assert.equal(fresh.legs[0].milestones.length, 2);
  // Check-in đã gửi không làm nút hỏi lại đúng điểm dừng đó.
  const checkin = { kind: "checkin", status: "QUEUED", legId: "l1", waypointId: "s1", body: {} };
  const once = applyPending(trip(leg("MOVING", ["DEPARTED"], [{ waypointId: "s1" }])), [checkin]);
  assert.equal(once.legs[0].waypointCheckins.length, 1);
});
test("expired quote blocks payment only until the deposit is covered", () => {
  const past = "2026-01-01T00:00:00.000Z";
  const future = "2026-12-01T00:00:00.000Z";
  const now = Date.parse("2026-06-01T00:00:00.000Z");
  const order = { status: "APPROVED" };
  const quote = { total: 300, deposit: 100 };
  const expired = paymentAction(order, { ...quote, expires_at: past, paid: 0 }, now);
  assert.equal(expired.kind, "none");
  assert.match(String(expired.note), /hết hạn/);
  assert.equal(paymentAction({ status: "PREPARING" }, { ...quote, expires_at: past, paid: 100 }, now).kind, "pay");
  assert.equal(paymentAction(order, { ...quote, expires_at: future, paid: 0 }, now).kind, "pay");
  assert.equal(paymentAction(order, { ...quote, expires_at: null, paid: 0 }, now).kind, "pay");
});
test("paymentAction picks the right instalment, amount and urgency", () => {
  const quote = { total: 300, deposit: 100, expires_at: null };
  const deposit = paymentAction({ status: "APPROVED" }, { ...quote, paid: 40 });
  assert.deepEqual([deposit.kind, deposit.kind === "pay" && deposit.type, deposit.kind === "pay" && deposit.amount], ["pay", "DEPOSIT", 60]);
  const balance = paymentAction({ status: "READY" }, { ...quote, paid: 100 });
  assert.deepEqual([balance.kind === "pay" && balance.type, balance.kind === "pay" && balance.amount, balance.kind === "pay" && balance.urgent], ["BALANCE", 200, false]);
  const arrived = paymentAction({ status: "IN_TRANSIT", arrivedAtDelivery: 1 }, { ...quote, paid: 100 });
  assert.equal(arrived.kind === "pay" && arrived.urgent, true);
  assert.match(arrived.note ?? "", /Tài xế đang đợi/);
  // MySQL trả EXISTS dạng chữ: "0" là chưa tới, "1" là đã tới.
  const moving = paymentAction({ status: "IN_TRANSIT", arrivedAtDelivery: "0" }, { ...quote, paid: 100 });
  assert.equal(moving.kind === "pay" && moving.urgent, false);
  assert.doesNotMatch(moving.note ?? "", /Xe đã tới/);
  assert.equal(paymentAction({ status: "IN_TRANSIT", arrivedAtDelivery: "1" }, { ...quote, paid: 100 }).kind === "pay", true);
  assert.equal(paymentAction({ status: "DELIVERED" }, { ...quote, paid: 100 }).kind, "pay");
  const paid = paymentAction({ status: "IN_TRANSIT" }, { ...quote, paid: 300 });
  assert.deepEqual([paid.kind, paid.note], ["none", "Đã thanh toán đủ"]);
  assert.equal(paymentAction({ status: "CANCELLED" }, { ...quote, paid: 0 }).kind, "none");
});
test("placeName drops local names but keeps every part of the address", () => {
  assert.equal(placeName("43, Manorom · มโนรมย์, Chai Nat · ชัยนาท"), "43, Manorom, Chai Nat");
  assert.equal(placeName("2 Lý Thường Kiệt, Quận 11"), "2 Lý Thường Kiệt, Quận 11");
  assert.equal(placeName("Kho Thủ Đức"), "Kho Thủ Đức");
  assert.equal(placeName("· "), "· ");
});
test("careDetail and careSummaryLine match the web wording", () => {
  const base = { feedDescription: null, amountLiters: null, durationMinutes: null, note: null };
  assert.equal(careDetail({ ...base, activityType: "WATER", amountLiters: 12 }), "12 L");
  assert.equal(careDetail({ ...base, activityType: "FEED", feedDescription: "Cỏ khô", note: "Ăn hết" }), "Cỏ khô · Ăn hết");
  assert.equal(careDetail({ ...base, activityType: "REST", durationMinutes: 30 }), "30 phút");
  assert.equal(careSummaryLine({ meals: 2, waterLiters: 24, rests: 1, restMinutes: 30 }), "2 bữa ăn · 24 L nước · 1 lần nghỉ chân (30 phút)");
  assert.equal(careSummaryLine({ meals: 0, waterLiters: 0, rests: 0, restMinutes: 0 }), "0 bữa ăn · 0 L nước · 0 lần nghỉ chân");
});
test("applyPending shows delivered only after the server accepted it", () => {
  const trip = {
    id: "1", orderStatus: "IN_TRANSIT",
    legs: [{ id: "l1", seqNo: 1, status: "AT_STOP", milestones: [], waypointCheckins: [] }],
  } as never;
  const item = { kind: "milestone", status: "QUEUED", legId: "l1", milestoneType: "DELIVERED", body: {} };
  assert.equal(applyPending(trip, [item]).orderStatus, "IN_TRANSIT");
  assert.equal(applyPending(trip, [{ ...item, sent: true }]).orderStatus, "DELIVERED");
});
test("picking a clock time past midnight means yesterday, never the current time", () => {
  const now = new Date(2026, 10, 5, 0, 30, 15);
  const yesterday = pastClock(23, 50, now);
  assert.equal(yesterday.getDate(), 4);
  assert.equal(yesterday.getHours(), 23);
  // Chọn lại sau khi đã lùi ngày thì quay về hôm nay.
  assert.equal(pastClock(0, 10, now).getDate(), 5);
  assert.ok(pastClock(0, 30, now).getTime() <= now.getTime());
  assert.equal(pastClock(0, 30, now).getDate(), 5);
});
test("queue sends a stable id for records and queuedAt for backdated events", () => {
  const createdAt = Date.parse("2026-11-05T01:00:00.000Z");
  const queuedAt = "2026-11-05T01:00:00.000Z";
  assert.deepEqual(queueWireFields({ id: "q1", kind: "incident", createdAt, timeField: null }), { clientRequestId: "q1" });
  assert.deepEqual(queueWireFields({ id: "q1", kind: "care", createdAt, timeField: "performedAt" }), { clientRequestId: "q1", queuedAt });
  assert.deepEqual(queueWireFields({ id: "q1", kind: "horseLog", createdAt, timeField: "loggedAt" }), { clientRequestId: "q1" });
  assert.deepEqual(queueWireFields({ id: "q1", kind: "milestone", createdAt, timeField: "occurredAt" }), { queuedAt });
});
test("409 after a lost response means the milestone arrived", () => {
  const lost = { kind: "milestone", lastFailure: "Network request failed" };
  assert.equal(isReplayConflict(lost, 409), true);
  assert.equal(isReplayConflict({ ...lost, kind: "checkin" }, 409), true);
  assert.equal(isReplayConflict({ ...lost, kind: "complete" }, 409), true);
  // Lần gửi đầu mà 409 là bị từ chối thật.
  assert.equal(isReplayConflict({ kind: "milestone" }, 409), false);
  assert.equal(isReplayConflict(lost, 400), false);
  assert.equal(isReplayConflict({ ...lost, kind: "incident" }, 409), false);
});
test("opening a delivered trip does not stop GPS of the trip in progress", () => {
  assert.equal(shouldStopTracking("running", "delivered"), false);
  assert.equal(shouldStopTracking("running", "running"), true);
  assert.equal(shouldStopTracking(null, "delivered"), true);
});
test("driver route shows rest stops of a single-leg trip in order", () => {
  const clock = (iso: string | null | undefined) => iso ?? "--";
  const map = {
    stops: [
      { locationId: "o", name: "Đi", locationType: "ORIGIN" },
      { locationId: "r1", name: "Nghỉ 1", locationType: "REST_STOP" },
      { locationId: "r2", name: "Nghỉ 2", locationType: "REST_STOP" },
      { locationId: "d", name: "Đến", locationType: "DESTINATION" },
    ],
  } as any;
  const trip = (status: string, checkins: object[], orderStatus = "IN_TRANSIT") =>
    ({
      orderStatus,
      legs: [{
        id: "l", seqNo: 1, status, fromLocationName: "Đi", toLocationName: "Đến",
        plannedDepartureAt: "pd", plannedArrivalAt: "pa", actualDepartureAt: "ad", actualArrivalAt: "aa",
        waypointCheckins: checkins, milestones: [],
      }],
    }) as any;
  const moving = tripTimeline(trip("MOVING", [{ waypointId: "r1", occurredAt: "t1" }]), map, clock);
  assert.deepEqual(moving.stops.map((x) => x.name), ["Đi", "Nghỉ 1", "Nghỉ 2", "Đến"]);
  assert.equal(moving.stops[1].time, "Đến t1");
  assert.equal(moving.stops[2].time, "Chưa đến");
  assert.equal(moving.active, 2);
  assert.equal(tripTimeline(trip("NOT_STARTED", []), map, clock).active, 0);
  assert.equal(tripTimeline(trip("AT_STOP", []), map, clock).active, 3);
  assert.equal(tripTimeline(trip("COMPLETED", [], "DELIVERED"), map, clock).active, 4);
  // Chưa tải được bản đồ: vẫn hiện hai đầu tuyến.
  assert.equal(tripTimeline(trip("MOVING", []), null, clock).stops.length, 2);
  assert.deepEqual(tripTimeline({ legs: [], orderStatus: "READY" } as any, null, clock), { active: 0, stops: [] });
});
test("planned leave time at a stop comes from the next leg, none at the last stop", () => {
  const leg = (seqNo: number, status: string) => ({
    id: `l${seqNo}`, seqNo, status, toLocationName: `Điểm ${seqNo}`,
    plannedDepartureAt: `dep${seqNo}`, waypointCheckins: [],
  });
  assert.equal(nextStop({ legs: [leg(1, "AT_STOP"), leg(2, "NOT_STARTED")] } as any)!.at, "dep2");
  assert.equal(nextStop({ legs: [leg(1, "COMPLETED"), leg(2, "AT_STOP")] } as any)!.at, null);
});
test("trip without legs is not reported as delivered", () => {
  const out = applyPending({ legs: [], orderStatus: "READY", horses: [] } as any, []);
  assert.equal(out.orderStatus, "READY");
});

test("N4: hết đếm ngược đặt cọc khi đã cọc đủ; còn nhắc khi chưa cọc hoặc cọc thiếu", () => {
  const now = Date.parse("2026-11-11T10:00:00Z");
  const expires_at = "2026-11-12T07:10:00Z";
  const left = 21 * 3600000 + 10 * 60000;
  assert.equal(depositTimeLeft({ deposit: 300, paid: 0, expires_at }, now), left);
  assert.equal(depositTimeLeft({ deposit: 300, paid: 100, expires_at }, now), left);
  assert.equal(depositTimeLeft({ deposit: 300, paid: 300, expires_at }, now), null);
  assert.equal(depositTimeLeft({ deposit: 300, paid: "1000", expires_at }, now), null);
  assert.equal(depositTimeLeft({ deposit: 300, paid: null, expires_at: null }, now), null);
});

test("A2: lỗi API giữ mã máy đọc được, đăng nhập tài khoản chưa xác minh trả EMAIL_NOT_VERIFIED", async () => {
  const req = createApiClient({
    baseUrl: "https://example.test",
    getToken: () => null,
    fetcher: async () => Response.json({ statusCode: 403, message: "Email chưa được xác minh.", code: "EMAIL_NOT_VERIFIED" }, { status: 403 }),
  });
  await assert.rejects(req("/auth/login", { method: "POST", anonymous: true, body: {} }),
    (error: ApiError) => error instanceof ApiError && error.status === 403 && error.code === "EMAIL_NOT_VERIFIED");
  const plain = createApiClient({ baseUrl: "https://example.test", getToken: () => null, fetcher: async () => Response.json({ message: "Sai" }, { status: 400 }) });
  await assert.rejects(plain("/x"), (error: ApiError) => error.code === undefined);
});

test("B8: hàng chờ gửi không hiện lỗi kỹ thuật cho tài xế", async () => {
  const { queueFailureText } = await import("../src/live-domain.ts");
  assert.match(queueFailureText("java.net.ConnectException: Failed to connect to /10.0.2.2:3100"), /^Chưa kết nối được máy chủ/);
  assert.match(queueFailureText("Network request failed"), /^Chưa kết nối được máy chủ/);
  assert.match(queueFailureText("Request timed out"), /quá lâu/);
  assert.equal(queueFailureText("Máy chủ đang bảo trì, thử lại sau."), "Máy chủ đang bảo trì, thử lại sau.");
  assert.match(queueFailureText("HTTP 503"), /tạm thời chưa nhận/);
  assert.equal(queueFailureText(undefined), "");
});

test("ảnh trong chuyến: một lần ghi cho nhiều con chỉ hiện một ảnh, chú thích đủ tên; bản đã đính chính lấy ảnh mới", async () => {
  const { careGallery } = await import("../../../packages/shared/src/care-gallery.ts");
  const photo = (id: string, name = "IMG_1.jpg", at = "2026-11-13T09:21:05.000Z") => ({ id, originalName: name, fileType: "JPG", sizeBytes: 20480, uploadedAt: at, caption: null });
  const act = (id: string, horseName: string | null, photos: any[], extra: any = {}) =>
    ({ id, tripId: "1", legId: null, horseId: horseName ? id : null, horseName, activityType: "WATER", feedDescription: null, amountLiters: 10, durationMinutes: null, note: null,
      performedAt: "2026-11-13T09:21:00.000Z", createdBy: "6", createdByName: "Hộ tống", createdAt: "2026-11-13T09:21:05.000Z", correctsActivityId: null, photos, ...extra }) as any;
  const items = careGallery([
    act("1", "Winter Sonata", [photo("a")]),
    act("2", "Winter So", [photo("b", "IMG_1.jpg", "2026-11-13T09:21:06.000Z")]),
    act("3", "Winter So", [photo("c", "IMG_2.jpg")]),
    act("4", null, [photo("d", "old.jpg")]),
    act("5", null, [photo("e", "new.jpg")], { correctsActivityId: "4" }),
  ]);
  assert.deepEqual(items.map((i) => [i.photo.originalName, i.horseNames]), [
    ["IMG_1.jpg", ["Winter Sonata", "Winter So"]],
    ["IMG_2.jpg", ["Winter So"]],
    ["new.jpg", []],
  ]);
});
