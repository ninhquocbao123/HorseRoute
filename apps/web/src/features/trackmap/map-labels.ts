// Chỉnh style nền TRƯỚC khi tạo bản đồ (thuần hàm, kiểm bằng node: test/map-labels.cjs), nên không có khoảnh khắc nhãn gốc hiện lên.
// Dữ liệu OpenStreetMap ghi tên hành chính nước ngoài và chữ Hán ở Hoàng Sa, Trường Sa: ẩn mọi nhãn/ranh giới trong hai vùng rồi tự đặt nhãn của Việt Nam.
import type { FilterSpecification, LayerSpecification, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl';

type Position = [number, number];
const rectangle = (points: Position[]): Position[][] => [[...points, points[0]]];

/** Vùng để ẨN nhãn dữ liệu nền, không phải đường biên giới. Chừa bờ biển Philippines, Malaysia, Brunei và đảo Hải Nam. */
export const HIDDEN_LABEL_AREAS = {
  type: 'MultiPolygon' as const,
  coordinates: [
    rectangle([[110.9, 15.5], [113.2, 15.5], [113.2, 17.4], [110.9, 17.4]]), // Hoàng Sa
    rectangle([[110.8, 6], [114.5, 6], [115.5, 7.2], [116.8, 8.6], [117.6, 10], [117.6, 12.4], [110.8, 12.4]]), // Trường Sa
  ],
};

export const VN_ISLAND_LABELS = [
  { name: 'Quần đảo Hoàng Sa\n(Việt Nam)', coordinates: [112, 16.5] as Position },
  { name: 'Quần đảo Trường Sa\n(Việt Nam)', coordinates: [114.3, 10] as Position },
];
export const VN_ISLANDS_LAYER = 'vn-islands-label';

/** Ưu tiên tên tiếng Việt, sau đó tên chữ Latin (tránh chữ Hán, chữ Thái... khi OSM chưa có name:vi). */
const VI_NAME = ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']];
const OUTSIDE_AREAS = ['!', ['within', HIDDEN_LABEL_AREAS]];

function withOutsideAreas(layer: LayerSpecification): FilterSpecification {
  const current = 'filter' in layer ? layer.filter : undefined;
  return (current ? ['all', current, OUTSIDE_AREAS] : OUTSIDE_AREAS) as FilterSpecification;
}

/** Biển số đường dùng `ref`, không phải tên: giữ nguyên text-field. */
const usesPlaceName = (layer: SymbolLayerSpecification) => JSON.stringify(layer.layout?.['text-field'] ?? '').includes('name');

export function localizeMapStyle(style: StyleSpecification): StyleSpecification {
  const layers = style.layers.map(layer => {
    if (layer.type === 'symbol') {
      const layout = usesPlaceName(layer) ? { ...layer.layout, 'text-field': VI_NAME } : layer.layout;
      return { ...layer, layout, filter: withOutsideAreas(layer) } as LayerSpecification;
    }
    if (layer.type === 'line' && /boundary/.test(layer.id)) return { ...layer, filter: withOutsideAreas(layer) } as LayerSpecification;
    return layer;
  });

  // Dùng lại font và màu của nhãn tên biển có sẵn trong style; style không có font (bản test cục bộ) thì không thêm nhãn.
  const symbols = style.layers.filter((layer): layer is SymbolLayerSpecification => layer.type === 'symbol' && !!layer.layout?.['text-font']);
  const reference = symbols.find(layer => layer.id.startsWith('water_name')) ?? symbols[0];
  if (!reference) return { ...style, layers };
  return {
    ...style,
    sources: {
      ...style.sources,
      [VN_ISLANDS_LAYER]: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: VN_ISLAND_LABELS.map(label => ({ type: 'Feature', properties: { name: label.name }, geometry: { type: 'Point', coordinates: label.coordinates } })) },
      },
    },
    layers: [...layers, {
      id: VN_ISLANDS_LAYER, type: 'symbol', source: VN_ISLANDS_LAYER,
      layout: { 'text-field': ['get', 'name'], 'text-font': reference.layout!['text-font'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#4f6f86', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 },
    }],
  };
}

const pending = new Map<string, Promise<StyleSpecification>>();

/** Tải style một lần cho mọi bản đồ trên trang. Lần lỗi không được giữ lại để nút "Thử lại" gọi mạng thật. */
export function loadLocalizedStyle(url: string): Promise<StyleSpecification> {
  let style = pending.get(url);
  if (!style) {
    style = fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('map style ' + response.status);
        return response.json() as Promise<StyleSpecification>;
      })
      .then(localizeMapStyle);
    style.catch(() => pending.delete(url));
    pending.set(url, style);
  }
  return style;
}
