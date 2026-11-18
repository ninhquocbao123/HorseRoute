import { test } from "node:test";
import assert from "node:assert/strict";
import { isIncidentNotice, noticeTitle, routeNotice } from "../src/notice-route.ts";

test("yêu cầu bổ sung giấy tờ mở thẳng màn nộp lại của đúng con ngựa", () => {
  assert.deepEqual(
    routeNotice("CUSTOMER", {
      event_type: "DOCUMENT_SUPPLEMENT",
      related_type: "DOCUMENT",
      related_id: "9",
      order_id: "100",
      horse_id: "21",
      document_id: "9",
    }),
    { screen: "doc-resubmit", id: "21", orderId: "100", documentId: "9" },
  );
});

test("thông báo hành trình và sự cố mở màn theo dõi, đơn khác mở chi tiết đơn", () => {
  assert.deepEqual(routeNotice("CUSTOMER", { event_type: "ORDER_LEG_PROGRESS", related_type: "ORDER", related_id: "100" }), { screen: "tracking", id: "100" });
  assert.deepEqual(routeNotice("CUSTOMER", { event_type: "INCIDENT_REPORTED", related_type: "ORDER", related_id: "100" }), { screen: "tracking", id: "100" });
  assert.deepEqual(routeNotice("CUSTOMER", { event_type: "QUOTE_APPROVED", related_type: "ORDER", related_id: "7" }), { screen: "order", id: "7" });
  assert.equal(routeNotice("CUSTOMER", { event_type: "X" }), null);
  assert.deepEqual(routeNotice("DRIVER_ESCORT", { event_type: "TRIP_ALERT", related_type: "TRIP", related_id: "200" }), { screen: "trip", tripId: "200" });
});

test("phân loại sự cố và tiêu đề", () => {
  assert.ok(isIncidentNotice("INCIDENT_REPORTED"));
  assert.ok(isIncidentNotice("HORSE_REPORT_ALERT"));
  assert.ok(!isIncidentNotice("ORDER_LEG_PROGRESS"));
  assert.equal(noticeTitle("DOCUMENT_SUPPLEMENT"), "Yêu cầu bổ sung giấy tờ");
  assert.equal(noticeTitle(undefined), "Thông báo mới");
});
