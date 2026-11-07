// Màu bản đồ lộ trình của màn tài xế (Figma D1 57:4903 / D1b 57:5087). Giữ style nền OpenFreeMap Positron rồi đổi màu từng layer
// sau khi tải xong; CHỈ gọi từ DriverRouteMap, nên bản đồ "Địa điểm & cửa khẩu" của Specialist không đổi.
// Màu đọc từ biến CSS --drs-* / --drs-map-* (khai báo trong tracking/driver/driver-shell.css); hằng bên dưới là giá trị dự phòng
// khi biến không có (vd. bản đồ render ngoài khung `.drs`).
import type { Map as MapLibreMap } from 'maplibre-gl';
import { VN_ISLANDS_LAYER } from './map-labels';

export type DriverMapColors = Record<keyof typeof FALLBACK, string>;

const FALLBACK = {
  land: '#e2efe8', water: '#c9e3ec', park: '#d3e9d9', road: '#ffffff', roadMajor: '#fbf8ec', roadCase: '#cddbd4',
  label: '#546d71', labelFaint: '#8fa3a6',
  // Tuyến: vàng của Figma; đoạn đã đi vàng đậm; phần còn lại vàng nhạt; viền trắng + quầng teal mờ để nổi trên nền
  route: '#f4b942', routeDone: '#d18e12', routeRest: '#f7d98b', routeHalo: '#0b3b42',
  // Marker theo Figma: điểm dừng trắng viền teal; điểm gửi vàng; điểm nhận xanh lá; xe nền navy
  stop: '#14606a', start: '#f4b942', end: '#16a34a', vehicle: '#0b3b42',
};

const VARS: Record<keyof typeof FALLBACK, string> = {
  land: '--drs-map-land', water: '--drs-map-water', park: '--drs-map-park', road: '--drs-map-road', roadMajor: '--drs-map-road-major',
  roadCase: '--drs-map-road-case', label: '--drs-map-label', labelFaint: '--drs-map-label-faint',
  route: '--drs-gold', routeDone: '--drs-route-done', routeRest: '--drs-route-rest', routeHalo: '--drs-route-halo',
  stop: '--drs-navy2', start: '--drs-gold', end: '--drs-map-end', vehicle: '--drs-navy',
};

/** Đọc màu từ CSS của phần tử (kế thừa biến từ `.drs`); thiếu biến thì dùng giá trị dự phòng. */
export function driverMapColors(element?: Element | null): DriverMapColors {
  const style = element && typeof getComputedStyle === 'function' ? getComputedStyle(element) : null;
  return Object.fromEntries((Object.keys(FALLBACK) as (keyof typeof FALLBACK)[]).map(key => [key, style?.getPropertyValue(VARS[key]).trim() || FALLBACK[key]])) as DriverMapColors;
}

const MINOR_ROADS = ['highway_minor', 'highway_path', 'road_pier'];
const MAJOR_ROADS = ['highway_major_inner', 'highway_major_subtle', 'highway_motorway_inner', 'highway_motorway_subtle', 'highway_motorway_bridge_inner', 'tunnel_motorway_inner'];
const ROAD_CASINGS = ['highway_major_casing', 'highway_motorway_casing', 'highway_motorway_bridge_casing', 'tunnel_motorway_casing'];
/** Nhãn cho tài xế không cần: điểm quan tâm, sân bay, tòa nhà, số hiệu đường. */
const HIDDEN = ['label_other', 'airport', 'building', 'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us'];
/** Nhãn địa danh/nước giữ lại, đổi sang xám xanh. */
const KEPT_LABELS = ['label_town', 'label_state', 'label_city', 'label_city_capital', 'label_country_1', 'label_country_2', 'label_country_3',
  'water_name_point_label', 'water_name_line_label', 'waterway_line_label', VN_ISLANDS_LAYER];
/** Nhãn đường và làng: nhạt hơn để không lấn tuyến. */
const FAINT_LABELS = ['label_village', 'highway-name-major', 'highway-name-minor', 'highway-name-path'];

/**
 * Đổi màu layer của Positron theo Figma bằng setPaintProperty: nền đất xanh lá rất nhạt, nước xanh dương nhạt, công viên
 * xanh hơn nền một chút, đường trắng (đường lớn hơi đậm/ấm hơn), nhãn xám xanh; ẩn bớt POI. Layer không có trong style
 * (nhà cung cấp đổi tên) thì bỏ qua, không bao giờ làm bản đồ lỗi.
 */
export function applyDriverMapTheme(map: MapLibreMap, colors: DriverMapColors = driverMapColors(map.getContainer())) {
  const paint = (id: string, property: string, value: unknown) => {
    try { if (map.getLayer(id)) map.setPaintProperty(id, property as never, value as never); } catch { /* layer/thuộc tính không đổi được */ }
  };
  const hide = (id: string) => {
    try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); } catch { /* bỏ qua */ }
  };

  paint('background', 'background-color', colors.land);
  paint('landuse_residential', 'fill-color', colors.land);
  paint('park', 'fill-color', colors.park);
  paint('landcover_wood', 'fill-color', colors.park);
  paint('water', 'fill-color', colors.water);
  paint('waterway', 'line-color', colors.water);
  paint('aeroway-area', 'fill-color', colors.roadCase);
  for (const id of ['aeroway-taxiway', 'aeroway-runway', 'aeroway-runway-casing']) paint(id, 'line-color', colors.roadCase);

  for (const id of MINOR_ROADS) paint(id, 'line-color', colors.road);
  for (const id of MAJOR_ROADS) paint(id, 'line-color', colors.roadMajor);
  for (const id of ROAD_CASINGS) paint(id, 'line-color', colors.roadCase);
  paint('boundary_3', 'line-color', colors.roadCase);
  paint('boundary_2', 'line-color', colors.labelFaint);
  paint('boundary_disputed', 'line-color', colors.labelFaint);

  for (const id of KEPT_LABELS) paint(id, 'text-color', colors.label);
  for (const id of FAINT_LABELS) paint(id, 'text-color', colors.labelFaint);
  for (const id of [...KEPT_LABELS, ...FAINT_LABELS]) paint(id, 'text-halo-color', colors.land);
  for (const id of HIDDEN) hide(id);
}
