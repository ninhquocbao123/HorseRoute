// Theme bản đồ màn tài xế (trackmap/driver-map-theme.ts): kiểm bằng map giả, không cần WebGL hay mạng.
// Chạy: node apps/web/test/driver-map-theme.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(web, 'src/features/trackmap/driver-map-theme.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'theme-test.cjs'), module);
  mod.filename = path.join(web, 'theme-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { applyDriverMapTheme, driverMapColors } = mod.exports;

  // Không có phần tử/biến CSS: dùng giá trị dự phòng lấy từ Figma
  const fallback = driverMapColors(null);
  assert.equal(fallback.land, '#e2efe8');
  assert.equal(fallback.water, '#c9e3ec');
  assert.equal(fallback.route, '#f4b942');
  assert.equal(fallback.routeDone, '#d18e12');
  assert.equal(fallback.routeHalo, '#0b3b42');

  const fakeMap = ids => {
    const paints = new Map();
    const hidden = new Set();
    return {
      paints, hidden,
      getLayer: id => (ids.includes(id) ? { id } : undefined),
      setPaintProperty: (id, property, value) => paints.set(id + '.' + property, value),
      setLayoutProperty: (id, property, value) => { if (property === 'visibility' && value === 'none') hidden.add(id); },
      getContainer: () => null,
    };
  };
  const ids = ['land', 'landuse', 'national-park', 'water', 'waterway', 'road-simple', 'bridge-case-simple', 'road-pedestrian', 'road-label-simple',
    'settlement-major-label', 'water-point-label', 'poi-label', 'airport-label', 'natural-point-label', 'building'];
  const map = fakeMap(ids);
  applyDriverMapTheme(map, fallback);
  assert.equal(map.paints.get('land.background-color'), '#e2efe8', 'nền đất xanh lá rất nhạt');
  assert.equal(map.paints.get('water.fill-color'), '#c9e3ec', 'nước xanh dương nhạt');
  assert.equal(map.paints.get('waterway.line-color'), '#c9e3ec');
  assert.equal(map.paints.get('landuse.fill-color'), map.paints.get('national-park.fill-color'), 'công viên cùng một màu');
  assert.notEqual(map.paints.get('landuse.fill-color'), '#e2efe8', 'công viên khác nền');
  assert.equal(map.paints.get('road-pedestrian.line-color'), '#ffffff', 'đường nhỏ trắng');
  const road = map.paints.get('road-simple.line-color');
  assert.deepEqual(road[0], 'match');
  assert.deepEqual(road[2], ['motorway', 'trunk', 'primary']);
  assert.equal(road[3], fallback.roadMajor, 'đường lớn hơi đậm/ấm hơn');
  assert.equal(road[4], '#ffffff', 'còn lại trắng');
  assert.notEqual(fallback.roadMajor, fallback.road);
  assert.equal(map.paints.get('road-label-simple.text-color')[2], fallback.label, 'nhãn xám xanh');
  assert.equal(map.paints.get('settlement-major-label.text-halo-color'), '#e2efe8');
  assert.deepEqual([...map.hidden].sort(), ['airport-label', 'building', 'natural-point-label', 'poi-label'], 'ẩn POI, sân bay, địa hình, tòa nhà');
  assert.equal(map.paints.has('tunnel-simple.line-color'), false, 'layer không có trong style thì bỏ qua');

  // Style đổi tên layer hoặc setPaintProperty ném lỗi: không bao giờ làm bản đồ lỗi
  const broken = { getLayer: () => ({}), setPaintProperty() { throw new Error('boom'); }, setLayoutProperty() { throw new Error('boom'); }, getContainer: () => null };
  assert.doesNotThrow(() => applyDriverMapTheme(broken, fallback));
  assert.doesNotThrow(() => applyDriverMapTheme(fakeMap([]), fallback));
  console.log('PASS driver-map-theme: colors from Figma, layers recolored, POI hidden, missing layers and errors tolerated.');
})().catch(error => { console.error(error); process.exitCode = 1; });
