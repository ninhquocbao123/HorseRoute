import { test } from "node:test";
import assert from "node:assert/strict";
import { journeyEvents, journeyStep, upcomingStops } from "../src/journey.ts";

const leg = (seqNo: number, status: string, from: string, to: string, milestones: [string, string][], checkins: [string, string][] = []) => ({
  seqNo, status, fromLocationName: from, toLocationName: to, plannedArrivalAt: `2026-11-19T0${seqNo + 5}:00:00.000Z`,
  milestones: milestones.map(([milestoneType, occurredAt]) => ({ milestoneType, occurredAt })),
  waypointCheckins: checkins.map(([label, occurredAt], i) => ({ waypointId: String(i), label, occurredAt, borderStage: null })),
}) as never;

const timeline = {
  orderStatus: "IN_TRANSIT",
  legs: [
    leg(1, "COMPLETED", "Long An", "Mộc Bài", [["DEPARTED", "2026-11-19T01:00:00Z"], ["ARRIVED_AT_STOP", "2026-11-19T03:00:00Z"]]),
    leg(2, "MOVING", "Mộc Bài", "Phnom Penh", [["DEPARTED", "2026-11-19T04:00:00Z"]], [["Trạm Bavet", "2026-11-19T05:00:00Z"]]),
    leg(3, "NOT_STARTED", "Phnom Penh", "Sihanoukville", []),
  ],
} as never;

test("mốc mới nhất trên cùng, câu chữ giống web", () => {
  const events = journeyEvents(timeline);
  assert.deepEqual(events.map((e) => e.title), [
    "Xe đã đến điểm dừng Trạm Bavet",
    "Xe đã rời Mộc Bài",
    "Xe đã đến Mộc Bài",
    "Tài xế đã bắt đầu chuyến đi",
  ]);
});

test("ảnh gắn vào mốc gần nhất trước lúc chụp, kèm nơi chụp", () => {
  const events = journeyEvents(timeline, [
    { id: "p1", at: "2026-11-19T05:10:00Z" },
    { id: "p2", at: "2026-11-19T03:30:00Z" },
    { id: "p0", at: "2026-11-19T00:30:00Z" },
  ]);
  assert.deepEqual(events[0].photos.map((p) => p.id), ["p1"]);
  assert.equal(events[0].photos[0].place, "Trạm Bavet");
  assert.deepEqual(events[2].photos.map((p) => p.id), ["p2"]);
  assert.deepEqual(events[3].photos.map((p) => p.id), ["p0"]);
});

test("điểm sắp tới và bước tiến trình", () => {
  assert.deepEqual(upcomingStops(timeline).map((s) => s.name), ["Phnom Penh", "Sihanoukville"]);
  assert.equal(journeyStep(timeline), 2);
  assert.equal(journeyStep({ orderStatus: "DELIVERED", legs: [] } as never), 4);
});
