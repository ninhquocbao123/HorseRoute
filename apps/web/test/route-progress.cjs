// Đoạn đã đi của bản đồ tài xế (trackmap/route-progress.ts). Chạy: node apps/web/test/route-progress.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(web, 'src/features/trackmap/route-progress.ts')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'progress-test.cjs'), module);
  mod.filename = path.join(web, 'progress-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { travelledRoute, OFF_ROUTE_KM } = mod.exports;

  const done = { id: 'a', status: 'COMPLETED', mode: 'ROAD', coordinates: [[0, 0], [0.1, 0]] };
  const moving = { id: 'b', status: 'MOVING', mode: 'ROAD', coordinates: [[0.1, 0], [0.2, 0], [0.2, 0.1]] };
  const next = { id: 'c', status: 'NOT_STARTED', mode: 'ROAD', coordinates: [[0.2, 0.1], [0.3, 0.1]] };

  // Xe ở giữa đoạn đầu của chặng đang chạy, lệch 0,001° (~110 m) khỏi tuyến: cắt đúng điểm chiếu, marker không bị kéo
  const r = travelledRoute([done, moving, next], [0.15, 0.001]);
  assert.equal(r.lines.length, 2);
  assert.deepEqual(r.lines[0].coordinates, done.coordinates);
  assert.deepEqual(r.lines[1].coordinates, [[0.1, 0], [0.15, 0]]);
  assert.ok(r.offsetKm > 0.1 && r.offsetKm < OFF_ROUTE_KM);

  // Qua khúc cua: giữ các đỉnh đã qua, cắt trên đoạn thứ hai
  const bend = travelledRoute([moving], [0.2, 0.05]);
  assert.deepEqual(bend.lines[0].coordinates, [[0.1, 0], [0.2, 0], [0.2, 0.05]]);

  // Lệch xa tuyến (> 300 m)
  assert.ok(travelledRoute([moving], [0.15, 0.01]).offsetKm > OFF_ROUTE_KM);

  // Chưa có vị trí: chỉ chặng đã xong; chặng đã tới điểm dừng tính nguyên chặng
  assert.equal(travelledRoute([done, moving], null).lines.length, 1);
  assert.equal(travelledRoute([done, moving], null).offsetKm, null);
  assert.equal(travelledRoute([{ ...moving, status: 'AT_STOP' }], null).lines[0].coordinates.length, 3);
  console.log('route-progress: ok');
})().catch(e => { console.error(e); process.exit(1); });
