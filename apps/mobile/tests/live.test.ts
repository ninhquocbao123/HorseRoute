import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient, ApiError } from "../src/api/http.ts";
import {
  applyPending,
  canResumeDraft,
  customerNoteError,
  validDate,
  driverAction,
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
test("trip without legs is not reported as delivered", () => {
  const out = applyPending({ legs: [], orderStatus: "READY", horses: [] } as any, []);
  assert.equal(out.orderStatus, "READY");
});
