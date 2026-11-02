import { test } from "node:test";
import assert from "node:assert/strict";
import { serverHost } from "../src/server-address.ts";
test("emulator localhost maps to computer loopback", () => {
  assert.equal(serverHost("127.0.0.1:8085", "android"), "10.0.2.2");
  assert.equal(serverHost("localhost:8081", "android"), "10.0.2.2");
});
test("phone follows Metro address after Wi-Fi changes", () => {
  assert.equal(serverHost("192.168.1.4:8081", "android"), "192.168.1.4");
  assert.equal(serverHost("10.87.18.80:8081", "android"), "10.87.18.80");
});
test("missing host has platform-specific fallback", () => {
  assert.equal(serverHost(undefined, "android"), "10.0.2.2");
  assert.equal(serverHost(undefined, "ios"), "localhost");
});
