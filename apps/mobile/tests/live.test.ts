import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient, ApiError } from "../src/api/http.ts";
import {
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
