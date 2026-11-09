import assert from "node:assert/strict";
import test from "node:test";
import { LABELS_SCRIPT } from "../src/map/map-labels.ts";

const page = new Function(
  `${LABELS_SCRIPT}; return { localizeLabels, HIDDEN_LABEL_AREAS, OUTSIDE_AREAS, VN_ISLAND_LABELS, VN_ISLANDS_LAYER };`,
)();
const colors = { label: "#111", halo: "#fff" };

function localized(layers: any[]) {
  const style: any = { sources: {}, layers: JSON.parse(JSON.stringify(layers)) };
  page.localizeLabels(style, colors);
  return style;
}

function insideRing([x, y]: number[], ring: number[][]) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
const hidden = (point: number[]) =>
  page.HIDDEN_LABEL_AREAS.coordinates.some((polygon: number[][][]) => insideRing(point, polygon[0]));

const WATER = {
  id: "water_name_point_label",
  type: "symbol",
  filter: ["==", ["get", "class"], "sea"],
  layout: { "text-font": ["Noto Sans Italic"] },
};

test("mọi lớp symbol và ranh giới bị lọc khỏi vùng ẩn, giữ nguyên filter cũ", () => {
  const { layers } = localized([
    WATER,
    { id: "airport", type: "symbol" },
    { id: "boundary_2", type: "line", filter: ["==", ["get", "admin_level"], 2] },
  ]);
  assert.deepEqual(layers[0].filter, ["all", WATER.filter, page.OUTSIDE_AREAS]);
  assert.deepEqual(layers[1].filter, page.OUTSIDE_AREAS);
  assert.deepEqual(layers[2].filter, ["all", ["==", ["get", "admin_level"], 2], page.OUTSIDE_AREAS]);
});

test("ranh giới vẽ ngay dưới lớp nước, trên lớp phủ đất, để biển che các vòng quanh đảo", () => {
  const { layers } = localized([
    { id: "park", type: "fill" },
    { id: "water", type: "fill" },
    { id: "road_motorway", type: "line" },
    { id: "boundary_3", type: "line" },
    { id: "boundary_2", type: "line" },
    WATER,
  ]);
  assert.deepEqual(
    layers.map((layer: any) => layer.id),
    ["park", "boundary_3", "boundary_2", "water", "road_motorway", WATER.id, page.VN_ISLANDS_LAYER],
  );
});

test("đường bộ, đường sông và lớp nền không bị lọc", () => {
  const { layers } = localized([
    { id: "road_motorway", type: "line", filter: ["==", ["get", "class"], "motorway"] },
    { id: "waterway_river", type: "line" },
    { id: "water", type: "fill" },
  ]);
  assert.deepEqual(layers[0].filter, ["==", ["get", "class"], "motorway"]);
  assert.equal(layers[1].filter, undefined);
  assert.equal(layers[2].filter, undefined);
});

test("nhãn Việt Nam đặt trên cùng, dùng font nhãn nước và màu theo giao diện", () => {
  const { layers, sources } = localized([
    { id: "label_city", type: "symbol", layout: { "text-font": ["Noto Sans Regular"] } },
    WATER,
    { id: "label_country", type: "symbol", layout: { "text-font": ["Noto Sans Bold"] } },
  ]);
  const label = layers[layers.length - 1];
  assert.equal(label.id, page.VN_ISLANDS_LAYER);
  assert.deepEqual(label.layout["text-font"], ["Noto Sans Italic"]);
  assert.equal(label.paint["text-color"], colors.label);
  assert.equal(label.filter, undefined);
  assert.deepEqual(
    sources[page.VN_ISLANDS_LAYER].data.features.map((feature: any) => [
      feature.properties.name,
      feature.geometry.coordinates,
    ]),
    [
      ["Quần đảo Hoàng Sa\n(Việt Nam)", [112, 16.5]],
      ["Quần đảo Trường Sa\n(Việt Nam)", [114.3, 10]],
    ],
  );
});

test("style không có font thì không thêm nhãn, vẫn lọc", () => {
  const { layers, sources } = localized([{ id: "airport", type: "symbol" }]);
  assert.equal(layers.length, 1);
  assert.deepEqual(sources, {});
});

test("vùng ẩn chứa các nhãn lấy từ tile thật và vòng polygon khép kín", () => {
  for (const [name, point] of Object.entries({
    "Tam Sa": [112.33, 16.83],
    "Yongle Qundao": [111.74, 16.47],
    "Quận Nam Sa": [112.89, 9.55],
    Kalayaan: [114.28, 11.05],
    "Đảo Mĩ Tế Bắc": [115.57, 9.92],
    "羚羊礁海山": [112.07, 15.44],
    "春风海脊": [112.03, 14.2],
    "江畔海山": [110.52, 10.68],
    "闲潭海台": [110.23, 11.48],
  })) {
    assert.equal(hidden(point), true, name);
  }
  for (const polygon of page.HIDDEN_LABEL_AREAS.coordinates) {
    assert.deepEqual(polygon[0][0], polygon[0][polygon[0].length - 1]);
  }
});

test("vùng ẩn chừa bờ biển Việt Nam, Hải Nam, Palawan, Sabah", () => {
  for (const [name, point] of Object.entries({
    "Đà Nẵng": [108.22, 16.07],
    "Lý Sơn": [109.12, 15.38],
    "Phú Quý": [108.94, 10.53],
    "Côn Đảo": [106.6, 8.68],
    "Hải Khẩu": [110.2, 20.05],
    "Văn Xương": [110.79, 19.55],
    "Tam Á": [109.5, 18.25],
    Palawan: [118.68, 9.88],
    "Puerto Princesa": [118.74, 9.74],
    "Balabac Island": [117.02, 7.94],
    Rizal: [117.64, 9.03],
    "Kota Kinabalu": [116.07, 5.98],
  })) {
    assert.equal(hidden(point), false, name);
  }
});
