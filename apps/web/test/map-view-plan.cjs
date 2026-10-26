// Góc nhìn bản đồ lộ trình (trackmap/map-view-plan.ts): không điểm, một điểm, nhiều điểm, lề không vượt khung.
// Chạy: node apps/web/test/map-view-plan.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(web, 'src/features/trackmap/map-view-plan.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'plan-test.cjs'), module);
  mod.filename = path.join(web, 'plan-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { planView, usablePoints, clampPadding, VN_VIEW, MIN_ZOOM } = mod.exports;
  const size = { width: 700, height: 470 };

  // Việt Nam, không phải cả thế giới
  assert.deepEqual(VN_VIEW, { longitude: 106.7, latitude: 10.8, zoom: 6 });
  assert.ok(MIN_ZOOM >= 3);

  // Không có tọa độ nào → góc nhìn mặc định
  assert.deepEqual(planView([], size), { kind: 'default' });
  assert.deepEqual(planView([[NaN, 10], [Infinity, 1]], size), { kind: 'default' }, 'tọa độ hỏng bị bỏ');
  assert.deepEqual(planView([[0, 0], [0, 0]], size), { kind: 'default' }, '(0, 0) là dữ liệu chưa nhập, không dùng để fit');
  assert.deepEqual(usablePoints([[106, 10], [0, 0], [200, 5], [10, 95]]), [[106, 10]]);

  // Một điểm (hoặc nhiều điểm trùng nhau) → bay tới điểm đó, zoom ~10
  assert.deepEqual(planView([[114.0, 22.3]], size), { kind: 'point', center: [114.0, 22.3], zoom: 10 });
  assert.equal(planView([[114.0, 22.3], [114.00001, 22.30001]], size).kind, 'point');

  // Nhiều điểm → fit khung với lề 80
  const fit = planView([[106.5, 10.9], [114.0, 22.3]], size);
  assert.equal(fit.kind, 'bounds');
  assert.deepEqual(fit.bounds, [[106.5, 10.9], [114.0, 22.3]]);
  assert.equal(fit.padding, 80);
  assert.equal(fit.maxZoom, 12);
  // Điểm (0, 0) lẫn trong dữ liệu không kéo bounds ra giữa Đại Tây Dương
  assert.deepEqual(planView([[106.5, 10.9], [0, 0], [114.0, 22.3]], size).bounds, [[106.5, 10.9], [114.0, 22.3]]);

  // Lề không bao giờ lớn hơn khung (lề ≥ nửa khung làm fitBounds thất bại âm thầm)
  assert.equal(clampPadding({ width: 700, height: 470 }), 80);
  assert.equal(clampPadding({ width: 300, height: 200 }), 50);
  assert.equal(clampPadding({ width: 120, height: 100 }), 25);
  assert.equal(clampPadding({ width: 0, height: 0 }), 0);
  for (const [width, height] of [[100, 100], [160, 90], [90, 400], [10, 10]]) {
    const padding = planView([[106, 10], [107, 11]], { width, height }).padding;
    assert.ok(padding * 2 < Math.min(width, height) || padding === 0, `lề ${padding} vượt khung ${width}×${height}`);
  }
  console.log('map-view-plan: ok');
})().catch(e => { console.error(e); process.exit(1); });
