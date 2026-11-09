// Nhãn tiếng Việt và chủ quyền Hoàng Sa, Trường Sa (trackmap/map-labels.ts): kiểm trên JSON style, không cần WebGL hay mạng.
// Chạy: node apps/web/test/map-labels.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

const inside = ([x, y], ring) => {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(web, 'src/features/trackmap/map-labels.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'labels-test.cjs'), module);
  mod.filename = path.join(web, 'labels-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { localizeMapStyle, HIDDEN_LABEL_AREAS, VN_ISLAND_LABELS, VN_ISLANDS_LAYER } = mod.exports;

  const areaFilter = ['!', ['within', HIDDEN_LABEL_AREAS]];
  const cityFilter = ['==', ['get', 'class'], 'city'];
  const style = {
    version: 8, sources: { openmaptiles: { type: 'vector', url: 'https://example.test/planet' } },
    layers: [
      { id: 'background', type: 'background' },
      { id: 'highway_minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation' },
      { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 2] },
      { id: 'water_name_point_label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name', layout: { 'text-field': ['get', 'name_en'], 'text-font': ['Noto Sans Italic'] } },
      { id: 'label_city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', filter: cityFilter, layout: { 'text-field': ['get', 'name_en'], 'text-font': ['Noto Sans Regular'] } },
      { id: 'highway-shield-non-us', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', layout: { 'text-field': ['to-string', ['get', 'ref']], 'text-font': ['Noto Sans Regular'] } },
    ],
  };
  const before = JSON.stringify(style);
  const out = localizeMapStyle(style);
  const layer = id => out.layers.find(item => item.id === id);

  assert.equal(JSON.stringify(style), before, 'không sửa style gốc (style được dùng chung cho nhiều bản đồ)');
  assert.deepEqual(layer('label_city').layout['text-field'], ['coalesce', ['get', 'name:vi'], ['get', 'name:latin'], ['get', 'name']], 'ưu tiên tên tiếng Việt');
  assert.deepEqual(layer('highway-shield-non-us').layout['text-field'], ['to-string', ['get', 'ref']], 'số hiệu đường giữ nguyên');
  assert.deepEqual(layer('label_city').filter, ['all', cityFilter, areaFilter], 'giữ bộ lọc cũ và ẩn nhãn trong hai vùng');
  assert.deepEqual(layer('water_name_point_label').filter, areaFilter, 'layer chưa có bộ lọc');
  assert.deepEqual(layer('boundary_2').filter, ['all', ['==', ['get', 'admin_level'], 2], areaFilter], 'ẩn cả ranh giới trong hai vùng');
  assert.equal(layer('highway_minor').filter, undefined, 'đường không bị đụng tới');

  const islands = layer(VN_ISLANDS_LAYER);
  assert.equal(out.layers.at(-1).id, VN_ISLANDS_LAYER);
  assert.deepEqual(islands.layout['text-font'], ['Noto Sans Italic'], 'dùng font có sẵn của nhãn biển');
  assert.equal(islands.filter, undefined, 'nhãn của Việt Nam không bị chính vùng ẩn che mất');
  const features = out.sources[VN_ISLANDS_LAYER].data.features;
  assert.deepEqual(features.map(feature => feature.properties.name), ['Quần đảo Hoàng Sa\n(Việt Nam)', 'Quần đảo Trường Sa\n(Việt Nam)']);

  // Vùng ẩn phủ đúng hai quần đảo, không phạm vào đất liền hay địa danh của nước khác.
  const hidden = point => HIDDEN_LABEL_AREAS.coordinates.some(polygon => inside(point, polygon[0]));
  const covered = { 'đảo Phú Lâm': [112.33, 16.83], 'đảo Tri Tôn': [111.2, 15.78], 'đảo Trường Sa Lớn': [111.92, 8.65], 'đảo Ba Bình': [114.36, 10.38], 'đảo Thị Tứ': [114.28, 11.05], 'đá Vành Khăn': [115.53, 9.9], 'đá Hoa Lau': [113.84, 7.37] };
  for (const [name, point] of Object.entries(covered)) assert.ok(hidden(point), name + ' phải nằm trong vùng ẩn');
  const untouched = { 'TP. Hồ Chí Minh': [106.7, 10.77], 'Quy Nhơn': [109.22, 13.77], 'Côn Đảo': [106.6, 8.68], 'Phú Quý': [108.94, 10.53], 'Hải Khẩu': [110.33, 20.04], 'Sanya': [109.51, 18.25], 'Puerto Princesa': [118.74, 9.74], 'Kota Kinabalu': [116.07, 5.98], 'Bandar Seri Begawan': [114.94, 4.9], 'Manila': [120.98, 14.6] };
  for (const [name, point] of Object.entries(untouched)) assert.equal(hidden(point), false, name + ' không được nằm trong vùng ẩn');
  for (const label of VN_ISLAND_LABELS) assert.ok(hidden(label.coordinates), label.name + ' nằm giữa vùng đã dọn nhãn');

  // Style không có font (bản test cục bộ): không thêm layer chữ vì sẽ không có glyph.
  const bare = localizeMapStyle({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] });
  assert.equal(bare.layers.length, 1);
  assert.equal(bare.sources[VN_ISLANDS_LAYER], undefined);
  console.log('PASS map-labels: nhãn tiếng Việt, vùng ẩn đúng phạm vi, nhãn Hoàng Sa và Trường Sa.');
})().catch(error => { console.error(error); process.exitCode = 1; });
