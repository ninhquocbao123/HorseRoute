// Màu bản đồ lộ trình của màn tài xế (Figma D1 57:4903 / D1b 57:5087). Giữ style nền Mapbox light-v11 rồi đổi màu từng layer
// sau khi tải xong; CHỈ gọi từ DriverRouteMap, nên bản đồ "Địa điểm & cửa khẩu" của Specialist không đổi.
// Màu đọc từ biến CSS --drs-* / --drs-map-* (khai báo trong tracking/driver/driver-shell.css); hằng bên dưới là giá trị dự phòng
// khi biến không có (vd. bản đồ render ngoài khung `.drs`).
import type { Map as MapboxMap } from 'mapbox-gl';

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

const MAJOR = ['motorway', 'trunk', 'primary'];
const ROAD_LINES = ['road-simple', 'road-path-trail', 'road-path-cycleway-piste', 'road-path', 'road-steps', 'road-pedestrian',
  'tunnel-simple', 'tunnel-path-trail', 'tunnel-path-cycleway-piste', 'tunnel-path', 'tunnel-steps', 'tunnel-pedestrian',
  'bridge-simple', 'bridge-path-trail', 'bridge-path-cycleway-piste', 'bridge-path', 'bridge-steps', 'bridge-pedestrian'];
/** Nhãn cho tài xế không cần: điểm quan tâm, sân bay, địa hình, tòa nhà, số hiệu đường. */
const HIDDEN = ['poi-label', 'airport-label', 'natural-point-label', 'natural-line-label', 'building', 'road-number-shield', 'road-exit-shield', 'transit-label'];
/** Nhãn địa danh/đường/nước giữ lại, đổi sang xám xanh. */
const KEPT_LABELS = ['road-label-simple', 'settlement-subdivision-label', 'settlement-minor-label', 'settlement-major-label', 'state-label',
  'country-label', 'continent-label', 'water-point-label', 'water-line-label', 'waterway-label'];

/**
 * Đổi màu layer của light-v11 theo Figma bằng setPaintProperty: nền đất xanh lá rất nhạt, nước xanh dương nhạt, công viên
 * xanh hơn nền một chút, đường trắng (đường lớn hơi đậm/ấm hơn), nhãn xám xanh; ẩn bớt POI. Layer không có trong style
 * (Mapbox đổi tên) thì bỏ qua, không bao giờ làm bản đồ lỗi.
 */
export function applyDriverMapTheme(map: MapboxMap, colors: DriverMapColors = driverMapColors(map.getContainer())) {
  const paint = (id: string, property: string, value: unknown) => {
    try { if (map.getLayer(id)) map.setPaintProperty(id, property as never, value as never); } catch { /* layer/thuộc tính không đổi được */ }
  };
  const hide = (id: string) => {
    try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); } catch { /* bỏ qua */ }
  };

  paint('land', 'background-color', colors.land);
  paint('landuse', 'fill-color', colors.park);
  paint('national-park', 'fill-color', colors.park);
  paint('water', 'fill-color', colors.water);
  paint('waterway', 'line-color', colors.water);
  paint('land-structure-polygon', 'fill-color', colors.land);
  paint('aeroway-polygon', 'fill-color', colors.roadCase);
  paint('aeroway-line', 'line-color', colors.roadCase);

  const roadColor = ['match', ['get', 'class'], MAJOR, colors.roadMajor, colors.road];
  for (const id of ROAD_LINES) paint(id, 'line-color', id.endsWith('-simple') ? roadColor : colors.road);
  paint('bridge-case-simple', 'line-color', colors.roadCase);
  paint('admin-1-boundary', 'line-color', colors.roadCase);
  paint('admin-0-boundary', 'line-color', colors.labelFaint);

  for (const id of KEPT_LABELS) {
    paint(id, 'text-color', ['step', ['to-number', ['get', 'symbolrank'], 0], colors.label, 11, colors.labelFaint]);
    paint(id, 'text-halo-color', colors.land);
  }
  for (const id of HIDDEN) hide(id);
}
