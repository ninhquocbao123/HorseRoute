import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScene,
  crewMapNotes,
  customerPositionText,
  mapColors,
  sceneStops,
  sceneVehicle,
} from "../src/map/map-scene.ts";
import { formatDuration, formatKm, restInfoOf, tripPhase, tripStats } from "../src/map/trip-stats.ts";

const colors = mapColors(
  { routeDone: "#1", routeAhead: "#2", routeAir: "#3", stop: "#4", stopRing: "#5", vehicle: "#6" },
  false,
);
const size = { width: 400, height: 600 };
const NOW = Date.parse("2026-11-06T05:00:00.000Z");
const leg = (over: Record<string, unknown> = {}) => ({
  id: "1",
  seqNo: 1,
  status: "NOT_STARTED",
  fromLocationId: "a",
  toLocationId: "b",
  mode: "ROAD",
  coordinates: [
    [106, 10],
    [107, 10],
  ],
  distanceKm: 100,
  plannedDepartureAt: "2026-11-06T01:00:00.000Z",
  plannedArrivalAt: "2026-11-06T09:00:00.000Z",
  actualDepartureAt: null,
  actualArrivalAt: null,
  isOverdue: false,
  ...over,
});
const baseMap = (over: Record<string, unknown> = {}): any => ({
  tripId: "9",
  orderCode: "WDP-1",
  orderStatus: "IN_TRANSIT",
  stops: [
    { locationId: "a", name: "Kho A", locationType: "REST_STOP", lat: 10, lng: 106 },
    { locationId: "b", name: "Trại B", locationType: "REST_STOP", lat: 10, lng: 107 },
  ],
  legs: [leg()],
  totalKm: 100,
  remainingKm: 100,
  position: null,
  latestPosition: null,
  speedLimitKmh: 80,
  warnings: [],
  ...over,
});
const fix = { lng: 106.5, lat: 10, at: "2026-11-06T04:59:50.000Z", headingDeg: 90, speedKmh: 60 };
const scene = (input: Record<string, unknown>) =>
  buildScene({ map: baseMap(), mode: "crew", running: true, colors, dark: false, size, ...input } as any);

test("điểm dừng: bỏ tọa độ thiếu và (0, 0), nhãn gửi/nhận chỉ ở hai đầu", () => {
  const stops = sceneStops(
    baseMap({
      stops: [
        { locationId: "a", name: "A", locationType: "X", lat: 10, lng: 106 },
        { locationId: "x", name: "Thiếu", locationType: "X", lat: null, lng: null },
        { locationId: "z", name: "Không", locationType: "X", lat: 0, lng: 0 },
        { locationId: "m", name: "Giữa", locationType: "X", lat: 10, lng: 106.5 },
        { locationId: "b", name: "B", locationType: "X", lat: 10, lng: 107 },
      ],
    }),
  );
  assert.deepEqual(stops.map((s) => s.id), ["a", "m", "b"]);
  assert.deepEqual(stops.map((s) => s.label), ["A · điểm gửi", null, "B · điểm nhận"]);
  assert.equal(sceneStops(baseMap(), true)[0].label, null, "thẻ nhỏ không có nhãn");
});

test("khách không bao giờ dùng GPS của máy hay vệt GPS", () => {
  const map = baseMap({
    position: { source: "ESTIMATED", lat: 10, lng: 106, asOf: "2026-11-06T01:00:00.000Z", legId: "1", label: "Đã xuất phát" },
  });
  const result = buildScene({
    map, mode: "customer", running: true, ownFix: fix,
    track: [{ lat: 11, lng: 106, speedKmh: 1, recordedAt: "x", legId: "1" }, { lat: 11, lng: 107, speedKmh: 1, recordedAt: "y", legId: "1" }],
    navigating: true, colors, dark: false, size,
  } as any);
  assert.equal(result.vehicle?.lng, 106);
  assert.equal(result.vehicle?.estimated, true);
  assert.deepEqual(result.offTrack, []);
  assert.equal(result.navigating, false);
});

test("khách: đoạn đậm là chặng đã đến, chưa đi thì nhạt", () => {
  const map = baseMap({ legs: [leg({ id: "1", status: "COMPLETED" }), leg({ id: "2", seqNo: 2, status: "MOVING" })] });
  const result = buildScene({ map, mode: "customer", running: true, colors, dark: false, size } as any);
  assert.equal(result.done.length, 1);
  assert.equal(result.route.length, 2);
  assert.equal(result.routeColor, "rest");
});

test("tài xế: GPS trên máy thắng khi mới hơn máy chủ, cũ hơn thì dùng máy chủ", () => {
  const position = { source: "GPS", lat: 10, lng: 106.2, asOf: "2026-11-06T04:59:00.000Z", legId: "1", label: null };
  assert.equal(sceneVehicle(baseMap({ position }), "crew", true, fix as any)?.lng, 106.5);
  const newer = { ...position, asOf: "2026-11-06T05:00:00.000Z" };
  assert.equal(sceneVehicle(baseMap({ position: newer }), "crew", true, fix as any)?.lng, 106.2);
});

test("tài xế: chuyến đã giao thì không hiện xe", () => {
  const map = baseMap({
    orderStatus: "DELIVERED",
    position: { source: "GPS", lat: 10, lng: 106, asOf: "2026-11-06T01:00:00.000Z", legId: "1", label: null },
  });
  assert.equal(sceneVehicle(map, "crew", false, null), null);
});

test("tài xế: đoạn đã đi cắt theo vị trí xe, chưa chạy thì tô màu kế hoạch", () => {
  const moving = baseMap({ legs: [leg({ status: "MOVING" })] });
  const running = scene({ map: moving, ownFix: fix });
  assert.equal(running.done.length, 1);
  assert.deepEqual(running.done[0].coordinates.at(-1), [106.5, 10]);
  const planned = scene({ running: false });
  assert.equal(planned.routeColor, "plan");
  assert.deepEqual(planned.done, []);
});

test("vệt GPS chỉ hiện khi lệch tuyến quá 300 m", () => {
  const moving = baseMap({ legs: [leg({ status: "MOVING" })] });
  const track = [{ lat: 10.1, lng: 106.4, speedKmh: 1, recordedAt: "x", legId: "1" }, { lat: 10.1, lng: 106.5, speedKmh: 1, recordedAt: "y", legId: "1" }];
  assert.deepEqual(scene({ map: moving, ownFix: fix, track }).offTrack, []);
  const off = { ...fix, lat: 10.1 };
  assert.equal(scene({ map: moving, ownFix: off, track }).offTrack.length, 2);
});

test("bám xe chỉ khi chuyến đang chạy; kéo tay thì ngừng bám", () => {
  assert.equal(scene({ running: false, navigating: true }).navigating, false);
  const on = scene({ navigating: true });
  assert.deepEqual([on.navigating, on.following], [true, true]);
  const moved = scene({ navigating: true, following: false });
  assert.deepEqual([moved.navigating, moved.following], [true, false]);
});

test("hướng xe: ưu tiên la bàn GPS, không có thì theo tuyến", () => {
  const moving = baseMap({ legs: [leg({ status: "MOVING" })] });
  assert.equal(scene({ map: moving, ownFix: { ...fix, headingDeg: 45 } }).bearing, 45);
  const byRoute = scene({ map: moving, ownFix: { ...fix, headingDeg: null } }).bearing;
  assert.ok(Math.abs(byRoute - 90) < 1, String(byRoute));
});

test("góc nhìn: không có điểm thì về Việt Nam, fitKey chỉ đổi khi có dữ liệu mới", () => {
  const empty = scene({ map: baseMap({ stops: [], legs: [] }) });
  assert.equal(empty.view.kind, "default");
  assert.equal(scene({}).view.kind, "bounds");
  const a = scene({ ownFix: fix }).fitKey;
  const b = scene({ ownFix: { ...fix, lng: 106.6 } }).fitKey;
  assert.equal(a, b, "xe chạy không làm bản đồ nhảy về toàn tuyến");
  assert.notEqual(a, scene({ map: baseMap({ legs: [leg(), leg({ id: "2" })] }) }).fitKey);
});

test("chữ cho khách bỏ tiền tố kỹ thuật", () => {
  const map = baseMap({ position: { source: "ESTIMATED", lat: 1, lng: 1, asOf: "x", legId: null, label: "Ước tính theo kế hoạch, không phải GPS: đang đến Mộc Bài" } });
  assert.equal(customerPositionText(map), "Đang đến Mộc Bài");
  assert.equal(customerPositionText(baseMap()), null);
});

test("ghi chú tài xế: thay cảnh báo thiếu tọa độ bằng câu hướng dẫn", () => {
  const notes = crewMapNotes(
    baseMap({
      warnings: ["Chưa có tọa độ cho Kho X", "Tuyến ước lượng"],
      stops: [{ locationId: "x", name: "Kho X", locationType: "X", lat: null, lng: null }],
    }),
  );
  assert.deepEqual(notes, ["Tuyến ước lượng", "Điểm Kho X chưa có tọa độ. Nhờ Specialist ghim trên màn Địa điểm."]);
});

test("ghi chú tài xế: nhiều chặng thiếu tuyến gộp một dòng", () => {
  const text = "chưa có tuyến đường bộ, đang vẽ đường thẳng ước lượng";
  assert.deepEqual(
    crewMapNotes(baseMap({ warnings: [`Chặng 1: ${text}`, `Chặng 2: ${text}`, "Khác"] })),
    [`Chặng 1, 2: ${text}`, "Khác"],
  );
  assert.deepEqual(crewMapNotes(baseMap({ warnings: [`Chặng 3: ${text}`] })), [`Chặng 3: ${text}`]);
});

const statLeg = (over: Record<string, unknown> = {}) => ({
  id: "1", seqNo: 1, status: "MOVING", toLocationName: "Mộc Bài",
  plannedDepartureAt: "2026-11-06T01:00:00.000Z", plannedArrivalAt: "2026-11-06T06:00:00.000Z",
  actualDepartureAt: "2026-11-06T02:30:00.000Z", ...over,
}) as any;

test("giai đoạn chuyến", () => {
  assert.equal(tripPhase([]).kind, "none");
  assert.equal(tripPhase([statLeg()]).kind, "moving");
  assert.equal(tripPhase([statLeg({ status: "AT_STOP" })]).kind, "stopped");
  assert.equal(tripPhase([statLeg({ status: "COMPLETED" })]).kind, "finished");
  assert.equal(tripPhase([statLeg({ status: "COMPLETED" }), statLeg({ id: "2", seqNo: 2, status: "NOT_STARTED" })]).kind, "between");
  assert.equal(tripPhase([statLeg({ status: "NOT_STARTED" })]).kind, "not_started");
});

test("tốc độ: GPS trên máy, vượt giới hạn có cảnh báo; GPS cũ không giữ số cũ", () => {
  const legs = [statLeg()];
  const own = tripStats({ legs, map: baseMap(), ownFix: { ...fix, speedKmh: 95 } as any, now: NOW }).speed;
  assert.deepEqual(own, { value: "95 km/h", sub: "vượt giới hạn 80 km/h", warn: true });
  const stale = { lat: 1, lng: 1, speedKmh: 60, accuracyM: 1, headingDeg: 0, recordedAt: "2026-11-06T04:45:00.000Z", legId: "1", freshness: "OLD" };
  const old = tripStats({ legs, map: baseMap({ latestPosition: stale }), ownFix: null, now: NOW }).speed;
  assert.deepEqual(old, { value: "—", sub: "GPS cũ 15 phút", warn: false });
  const none = tripStats({ legs, map: baseMap(), ownFix: null, now: NOW }).speed;
  assert.equal(none.sub, "Chưa có tín hiệu GPS");
  const parked = tripStats({ legs: [statLeg({ status: "AT_STOP" })], map: baseMap({ latestPosition: stale }), ownFix: null, now: NOW }).speed;
  assert.deepEqual(parked, { value: "0 km/h", sub: "đang dừng", warn: false });
});

test("số GPS trên máy quá 30 giây thì không dùng", () => {
  const oldFix = { ...fix, at: "2026-11-06T04:50:00.000Z", speedKmh: 99 };
  const stat = tripStats({ legs: [statLeg()], map: baseMap(), ownFix: oldFix as any, now: NOW }).speed;
  assert.equal(stat.value, "—");
});

test("đã chạy và trễ", () => {
  const onTime = tripStats({ legs: [statLeg()], map: null, ownFix: null, now: NOW }).elapsed;
  assert.equal(onTime.value, "2 giờ 30");
  assert.equal(onTime.warn, false);
  const late = tripStats({ legs: [statLeg({ plannedArrivalAt: "2026-11-06T04:00:00.000Z" })], map: null, ownFix: null, now: NOW }).elapsed;
  assert.deepEqual([late.sub, late.warn], ["trễ 1 giờ so với giờ đến dự kiến", true]);
});

test("B4: nghỉ tiếp tính từ lần nghỉ gần nhất, không tính theo giờ giao", () => {
  const stop = (locationId: string, name: string, locationType: string) => ({ locationId, name, locationType, lat: 0, lng: 0 });
  const map = baseMap({
    stops: [
      stop("o", "Hà Nội", "ORIGIN"),
      stop("r1", "Điểm nghỉ 1", "REST_STOP"),
      stop("g1", "Cửa khẩu Cầu Treo (Hà Tĩnh)", "BORDER"),
      stop("g2", "Cửa khẩu Nậm Phao – đã qua cửa khẩu", "BORDER"),
      stop("d", "Bangkok", "DESTINATION"),
    ],
  });
  // Xuất phát 02:30, bây giờ 05:00, chưa nghỉ: còn 1 giờ 30 tới lần nghỉ trễ nhất (4 giờ).
  const fresh = restInfoOf(map, 1, []);
  assert.deepEqual(fresh, { lastRestAt: null, restAhead: true });
  assert.equal(tripStats({ legs: [statLeg()], map, ownFix: null, rest: fresh, now: NOW }).elapsed.sub, "nghỉ chậm nhất sau 1 giờ 30");
  // Đã nghỉ 04:30 ở điểm nghỉ 1: đếm lại từ đó.
  const rested = restInfoOf(map, 1, [{ waypointId: "r1", occurredAt: "2026-11-06T04:30:00.000Z" }]);
  assert.equal(tripStats({ legs: [statLeg()], map, ownFix: null, rest: rested, now: NOW }).elapsed.sub, "nghỉ chậm nhất sau 3 giờ 30");
  // Phía "đã qua cửa khẩu" không phải lần nghỉ; tới cửa khẩu thì là lần nghỉ.
  const crossed = restInfoOf(map, 1, [
    { waypointId: "r1", occurredAt: "2026-11-06T03:00:00.000Z" },
    { waypointId: "g1", occurredAt: "2026-11-06T04:00:00.000Z" },
    { waypointId: "g2", occurredAt: "2026-11-06T04:40:00.000Z" },
  ]);
  assert.deepEqual(crossed, { lastRestAt: "2026-11-06T04:00:00.000Z", restAhead: false });
  // Hết điểm nghỉ: hiện giờ tới nơi, không ghi "nghỉ tiếp".
  assert.match(tripStats({ legs: [statLeg()], map, ownFix: null, rest: crossed, now: NOW }).elapsed.sub, /^tới nơi dự kiến /);
  // Lái quá 4 giờ thì cảnh báo.
  const tired = tripStats({ legs: [statLeg()], map, ownFix: null, rest: fresh, now: Date.parse("2026-11-06T07:00:00.000Z") }).elapsed;
  assert.deepEqual([tired.sub, tired.warn], ["lái liên tục 4 giờ 30 · cần nghỉ", true]);
  // Chuyến nhiều chặng hoặc không có lộ trình: không có thông tin nghỉ.
  assert.equal(restInfoOf(map, 2, []), null);
});

test("chặng tiếp: km còn lại trừ các chặng sau; đã tới đích thì không còn km", () => {
  const map = baseMap({ remainingKm: 150, legs: [leg({ id: "1", status: "MOVING", distanceKm: 100 }), leg({ id: "2", seqNo: 2, distanceKm: 100 })] });
  const next = tripStats({ legs: [statLeg()], map, ownFix: null, now: NOW }).next;
  assert.equal(next.value, "Mộc Bài");
  assert.match(next.sub, /^còn 50 km/);
  const arrived = tripStats({ legs: [statLeg({ status: "AT_STOP" })], map, ownFix: null, now: NOW }).next;
  assert.deepEqual([arrived.value, arrived.sub], ["Mộc Bài", "đã tới điểm đích"]);
  const way = tripStats({ legs: [statLeg()], map, ownFix: null, waypoint: "Trạm nghỉ", now: NOW }).next;
  assert.equal(way.value, "Trạm nghỉ");
});

test("file maplibre nhúng sẵn khớp phiên bản trong package.json", async () => {
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const vendor = readFileSync(new URL("../src/map/vendor.generated.ts", import.meta.url), "utf8");
  const version = /MAPLIBRE_VERSION = "([^"]+)"/.exec(vendor)?.[1];
  assert.equal(version, pkg.devDependencies["maplibre-gl"], "chạy npm run map:vendor sau khi đổi phiên bản");
});

test("định dạng", () => {
  assert.equal(formatDuration(45 * 60_000), "45 phút");
  assert.equal(formatDuration(120 * 60_000), "2 giờ");
  assert.equal(formatKm(9.25), "9,3");
  assert.equal(formatKm(1234), "1.234");
});
