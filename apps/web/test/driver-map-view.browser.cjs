// Bản đồ lộ trình tài xế với Mapbox THẬT: không globe, góc nhìn Việt Nam khi thiếu dữ liệu, một điểm, /map lỗi, tuyến xuyên lục địa.
// Cần VITE_MAPBOX_TOKEN trong apps/web/.env (CI không có token nên bỏ qua) và Edge/Chromium có WebGL 2.
// Chạy: PLAYWRIGHT_PACKAGE=<đường dẫn playwright-core> node apps/web/test/driver-map-view.browser.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const web = path.resolve(__dirname, '..');
  const { createServer, loadEnv } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
  if (!loadEnv('development', web, 'VITE_').VITE_MAPBOX_TOKEN && !process.env.VITE_MAPBOX_TOKEN) {
    console.log('driver-map-view: bỏ qua (không có VITE_MAPBOX_TOKEN)');
    return;
  }
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  const server = await createServer({ root: web, logLevel: 'error', server: { host: '127.0.0.1', port: 5196, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    const now = Date.now();
    const iso = ms => new Date(now + ms).toISOString();
    const leg = (id, seqNo, from, to) => ({ id, seqNo, fromLocationId: from, fromLocationName: from, toLocationId: to, toLocationName: to, toLocationType: 'AIRPORT', vehicleId: '5', vehicleCode: 'XE-01',
      plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(3600e3), status: 'NOT_STARTED', actualDepartureAt: null, actualArrivalAt: null, updatedAt: null, updatedByName: null, milestones: [] });
    const legs = [leg('10', 1, 'Kho HCM', 'Hong Kong International Airport')];
    const summary = { id: '100', orderId: '50', orderCode: 'VCN-TEST-0009', orderStatus: 'READY', planStatus: 'APPROVED', plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(7200e3), crewRole: 'ESCORT', legs };
    const stop = (name, lng, lat) => ({ locationId: name, name, locationType: 'AIRPORT', lng, lat });
    const mapOf = (stops, coords, mode = 'ROAD') => ({
      tripId: '100', orderCode: summary.orderCode, orderStatus: 'READY', stops,
      legs: [{ id: '10', seqNo: 1, status: 'NOT_STARTED', fromLocationId: 'a', toLocationId: 'b', mode, coordinates: coords, distanceKm: coords ? 100 : null, plannedDepartureAt: iso(0), plannedArrivalAt: iso(3600e3), actualDepartureAt: null, actualArrivalAt: null, isOverdue: false }],
      totalKm: coords ? 100 : null, remainingKm: null, position: null, latestPosition: null, speedLimitKmh: 80,
      warnings: stops.filter(s => s.lat === null).map(s => `Chưa có tọa độ cho ${s.name}`),
    });
    // great-circle thô Việt Nam → London (tuyến xuyên lục địa như chặng bay)
    const wide = Array.from({ length: 20 }, (_, i) => [106.7 - (106.8 * i) / 19, 10.8 + (40.7 * i) / 19]);
    const scenarios = {
      none: () => ({ json: mapOf([stop('Kho HCM', null, null), stop('Hong Kong International Airport', null, null)], null) }),
      one: () => ({ json: mapOf([stop('Kho HCM', 106.66, 10.82), stop('Hong Kong International Airport', null, null)], null) }),
      wide: () => ({ json: mapOf([stop('Kho HCM', wide[0][0], wide[0][1]), stop('London', wide[19][0], wide[19][1])], wide, 'AIR') }),
      road: () => ({ json: mapOf([stop('Kho HCM', 106.66, 10.82), stop('Biên Hòa', 106.9, 10.95)], [[106.66, 10.82], [106.9, 10.95]]) }),
      error: () => ({ status: 500, json: { message: 'boom' } }),
    };
    let scenario = 'none';
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/api/v1/**', route => {
      const p = new URL(route.request().url()).pathname.replace('/api/v1', '');
      if (p === '/tracking/driver/trips') return route.fulfill({ json: [summary] });
      if (/^\/tracking\/trips\/100$/.test(p)) return route.fulfill({ json: { ...summary, horses: [], crew: [{ userId: 'test', name: 'Phan Thị Lan', phone: '1', role: 'ESCORT' }], customer: { name: 'K' }, recipient: null, coordinator: null, emergencyHotline: null, vehicles: [] } });
      if (/\/map$/.test(p)) { const answer = scenarios[scenario](); return route.fulfill({ status: answer.status ?? 200, json: answer.json }); }
      return route.fulfill({ json: [] });
    });
    const view = () => page.evaluate(() => {
      const map = window.__wdpMap;
      return map ? { projection: map.getProjection().name, zoom: map.getZoom(), lng: map.getCenter().lng, lat: map.getCenter().lat } : null;
    });
    const open = async name => {
      scenario = name;
      await page.goto('http://127.0.0.1:5196/test/portal.html?role=DRIVER_ESCORT&view=trip', { waitUntil: 'domcontentloaded' });
      await page.locator('.trackmap.is-ready').waitFor({ timeout: 40_000 });
      await page.waitForTimeout(800);
    };

    // 1. Không điểm nào có tọa độ: không globe, Việt Nam, có dòng cảnh báo hướng dẫn
    await open('none');
    let v = await view();
    assert.equal(v.projection, 'mercator', 'không dùng globe');
    assert.ok(Math.abs(v.zoom - 6) < 0.05 && Math.abs(v.lng - 106.7) < 0.2 && Math.abs(v.lat - 10.8) < 0.2, 'góc nhìn Việt Nam: ' + JSON.stringify(v));
    assert.ok(v.zoom >= 3);
    const notes = await page.locator('.drv-map-warnings li').allInnerTexts();
    assert.ok(notes.includes('Điểm Hong Kong International Airport chưa có tọa độ — nhờ Specialist ghim trên màn Địa điểm'), notes.join('|'));
    assert.ok(notes.includes('Điểm Kho HCM chưa có tọa độ — nhờ Specialist ghim trên màn Địa điểm'));
    assert.ok(!notes.some(n => n.startsWith('Chưa có tọa độ cho')), 'không lặp câu cảnh báo chung của API');
    assert.equal(await page.locator('.drv-map-error').count(), 0);
    await page.screenshot({ path: 'test-results/driver-map-none.png' });

    // 2. Chỉ một điểm có tọa độ: bay tới điểm đó, zoom ~10; điểm còn lại vẫn có cảnh báo
    await open('one');
    v = await view();
    assert.equal(v.projection, 'mercator');
    assert.ok(Math.abs(v.zoom - 10) < 0.05 && Math.abs(v.lng - 106.66) < 0.01 && Math.abs(v.lat - 10.82) < 0.01, 'zoom ~10 tại điểm duy nhất: ' + JSON.stringify(v));
    assert.deepEqual(await page.locator('.drv-map-warnings li').allInnerTexts(), ['Điểm Hong Kong International Airport chưa có tọa độ — nhờ Specialist ghim trên màn Địa điểm']);

    // 3. Tuyến xuyên lục địa: vẫn mercator, zoom không dưới mức tối thiểu (không thu về quả địa cầu)
    await open('wide');
    v = await view();
    assert.equal(v.projection, 'mercator');
    assert.ok(v.zoom >= 3, 'zoom tối thiểu 3: ' + v.zoom);
    await page.screenshot({ path: 'test-results/driver-map-wide.png' });

    // 4. /map lỗi: giữ góc nhìn Việt Nam + thông báo nhỏ trong khung có nút Thử lại; bấm thử lại khi API hết lỗi thì fit theo tuyến
    await open('error');
    v = await view();
    assert.equal(v.projection, 'mercator');
    assert.ok(Math.abs(v.zoom - 6) < 0.05 && Math.abs(v.lng - 106.7) < 0.2, 'lỗi: giữ góc nhìn Việt Nam ' + JSON.stringify(v));
    const error = page.locator('.drv-map-wrap .drv-map-error');
    await error.getByText('Không tải được dữ liệu bản đồ.').waitFor();
    const box = await page.locator('.drv-map-wrap').boundingBox();
    const errBox = await error.boundingBox();
    assert.ok(errBox.x >= box.x && errBox.y >= box.y && errBox.x + errBox.width <= box.x + box.width && errBox.y + errBox.height <= box.y + box.height, 'thông báo nằm trong khung bản đồ');
    await page.screenshot({ path: 'test-results/driver-map-error.png' });
    scenario = 'road';
    await error.getByRole('button', { name: 'Thử lại' }).click();
    await page.locator('.drv-map-error').waitFor({ state: 'detached' });
    await page.waitForFunction(() => window.__wdpMap.getZoom() > 8);
    v = await view();
    assert.ok(Math.abs(v.lng - 106.78) < 0.1, 'sau khi thử lại: fit theo tuyến ' + JSON.stringify(v));

    assert.deepEqual(pageErrors, [], 'lỗi JS trong trang');
    console.log('driver-map-view: OK');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
