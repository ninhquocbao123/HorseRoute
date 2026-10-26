// Khung dùng chung cho các bài kiểm thử trình duyệt của Driver/Escort (API giả lập bằng page.route, không cần DB).
// Chạy từng file: PLAYWRIGHT_PACKAGE=<đường dẫn playwright> WEB_TEST_PORT=5181 node apps/web/test/driver/<file>.browser.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

/** Mở trình duyệt + vite + API giả, chạy `body(h)`, rồi dọn dẹp. `h` có mọi helper và dữ liệu giả của bài kiểm thử. */
exports.run = async (name, body) => {
  try {
  const web = path.resolve(__dirname, '../..');
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  process.env.VITE_MAP_ENABLED = 'false'; // không gọi Mapbox trong test; bản đồ rơi về khung dự phòng
  const PORT = Number(process.env.WEB_TEST_PORT || 5181);
  const server = await createServer({ root: web, server: { host: '127.0.0.1', port: PORT, strictPort: true } });
  await server.listen();
  let browser, page;
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    // GPS giả lập cho màn D2 (ô vị trí tự điền tọa độ).
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, geolocation: { latitude: 18.3421, longitude: 105.9057 }, permissions: ['geolocation'] });
    // Đếm các lần trình duyệt giao vị trí cho trang: vị trí tới BẤT ĐỒNG BỘ (thật) sau setGeolocation, trong khi đồng hồ giả chạy ngay.
    // Test chờ đúng tín hiệu này thay vì đoán bằng fastForward (nguyên nhân flaky cũ: mẫu tới sau khi lô 30 giây đã chạy).
    await context.addInitScript(() => {
      const watch = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = (success, error, options) => watch(position => {
        window.__gps = { n: (window.__gps?.n ?? 0) + 1, lat: position.coords.latitude };
        success(position);
      }, error, options);
    });
    page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    const now = Date.now();
    const iso = ms => new Date(now + ms).toISOString();
    const DAY = 86400e3;
    const leg = (id, seqNo, status, from, to, type = 'REST_STOP', arrival = 3600e3) => ({
      id, seqNo, fromLocationId: '1', fromLocationName: from, toLocationId: '2', toLocationName: to, toLocationType: type,
      vehicleId: '5', vehicleCode: 'XE-01', plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(arrival), status,
      actualDepartureAt: null, actualArrivalAt: null, updatedAt: null, updatedByName: null, milestones: [],
    });
    // Chuyến 100 (READY, 3 chặng, điểm cuối là cửa khẩu, tới ngày hôm sau) và chuyến 200 (đã giao) để thử dropdown + tìm kiếm.
    const trips = {
      100: {
        orderCode: 'WDP-TEST-1', orderStatus: 'READY', customer: 'Khách Một',
        legs: [
          leg('10', 1, 'NOT_STARTED', 'Kho HCM', 'Trạm Đồng Nai'),
          leg('11', 2, 'NOT_STARTED', 'Trạm Đồng Nai', 'Trạm Phan Thiết', 'FUEL_STOP'),
          leg('12', 3, 'NOT_STARTED', 'Trạm Phan Thiết', 'Cửa khẩu Mộc Bài', 'BORDER', -3600e3 + DAY),
        ],
      },
      200: { orderCode: 'WDP-TEST-2', orderStatus: 'DELIVERED', customer: 'Khách Hai', legs: [leg('20', 1, 'COMPLETED', 'Kho HN', 'Sân bay Nội Bài', 'AIRPORT')] },
    };
    // Chặng 2, 3 dùng xe thứ hai: ô "Xe" chỉ hiện xe của chặng hiện tại / đầu / cuối.
    for (const l of trips[100].legs.slice(1)) { l.vehicleId = '6'; l.vehicleCode = 'XE-02'; }
    const extraIds = []; // chuyến thêm động (nhiều chuyến đã giao để thử phân trang, chuyến sắp tới)
    const state = {
      incidents: [], horseLogs: [], care: [], careRejects: [], track: [], latest: null, positionsMode: null, alerts: [],
      notices: [{ id: '1', content: 'Chuyến WDP-TEST-1 đã được phân công cho bạn.', is_read: 0, created_at: iso(-5 * 60e3) }],
    };
    const calls = { milestones: [], complete: [], incidents: [], positions: [], maps: 0, care: [], careGets: 0 };
    // /map giả lập: km cố định để kiểm định dạng (tổng 1.720 km), chặng 3 là đường thẳng ước lượng.
    const COORDS = {
      'Kho HCM': [106.6, 10.85], 'Trạm Đồng Nai': [106.95, 10.95], 'Trạm Phan Thiết': [108.1, 10.93], 'Cửa khẩu Mộc Bài': [106.158, 11.076],
      'Kho HN': [105.8, 21.0], 'Sân bay Nội Bài': [105.807, 21.219],
    };
    const KM = new Proxy({ 10: 210, 11: 160, 12: 1350, 20: 30 }, { get: (target, key) => target[key] ?? 30 });
    const mapFor = id => {
      const t = trips[id];
      const legs = t.legs.map(l => ({
        id: l.id, seqNo: l.seqNo, status: l.status, fromLocationId: l.fromLocationName, toLocationId: l.toLocationName,
        mode: l.id === '12' ? 'STRAIGHT' : 'ROAD', coordinates: [COORDS[l.fromLocationName], COORDS[l.toLocationName]], distanceKm: KM[l.id],
        plannedDepartureAt: l.plannedDepartureAt, plannedArrivalAt: l.plannedArrivalAt, actualDepartureAt: l.actualDepartureAt, actualArrivalAt: l.actualArrivalAt, isOverdue: false,
      }));
      const totalKm = legs.reduce((sum, l) => sum + l.distanceKm, 0);
      const running = t.orderStatus === 'IN_TRANSIT';
      return {
        tripId: id, orderCode: t.orderCode, orderStatus: t.orderStatus,
        stops: [t.legs[0].fromLocationName, ...t.legs.map(l => l.toLocationName)].map(name => ({ locationId: name, name, locationType: 'REST_STOP', lat: COORDS[name][1], lng: COORDS[name][0] })),
        legs, totalKm, remainingKm: t.orderStatus === 'DELIVERED' ? 0 : running ? totalKm - 10 : totalKm,
        position: { source: 'ESTIMATED', lat: 10.85, lng: 106.6, asOf: iso(0), legId: t.legs[0].id, label: 'Ước tính theo kế hoạch, không phải GPS: chưa xuất phát, đang ở Kho HCM' },
        latestPosition: state.latest, speedLimitKmh: 80,
        warnings: id === '100' ? ['Chặng 3: chưa có tuyến đường bộ, đang vẽ đường thẳng ước lượng'] : [],
      };
    };
    const fail = { next: 0 };
    const conflict = { next: 0, apply: null };
    const horses = [
      { id: '21', name: 'Bạch Mã', passportNo: 'PP-1', orderStatus: 'NORMAL', breed: 'Thoroughbred', birthDate: `${new Date().getFullYear() - 5}-01-01` },
      { id: '22', name: 'Hắc Mã', passportNo: 'PP-2', orderStatus: 'NORMAL', breed: 'Arabian', birthDate: null },
    ];
    const crew = { role: 'DRIVER' };
    const summary = id => ({ id, orderId: '5' + id, orderCode: trips[id].orderCode, orderStatus: trips[id].orderStatus, planStatus: 'APPROVED', plannedDepartureAt: trips[id].dep ?? iso(-3600e3), plannedArrivalAt: iso(7200e3), crewRole: crew.role, legs: trips[id].legs });
    const detail = id => ({
      ...summary(id), horses,
      crew: [{ userId: 'test', name: 'Phan Thị Lan', phone: '0901', role: 'DRIVER' }, { userId: '7', name: 'Lê Hộ Tống', phone: '0902', role: 'ESCORT' }],
      customer: { name: trips[id].customer }, recipient: id === '100' ? { name: 'Người Nhận SG', phone: '+6560000050' } : null,
      coordinator: { name: 'Điều Phối A', phone: '0903' }, emergencyHotline: '1900 1080', vehicles: [{ id: '5', code: 'XE-01', type: 'TRUCK', capacityStalls: 4 }, { id: '6', code: 'XE-02', type: 'TRUCK', capacityStalls: 2 }],
    });
    const allLegs = () => Object.values(trips).flatMap(t => t.legs);
    const tripOf = legId => Object.values(trips).find(t => t.legs.some(l => l.id === legId));
    // Giá trị các field cùng tên trong body multipart (theo thứ tự).
    const field = (raw, name) => [...raw.matchAll(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`, 'g'))].map(m => m[1]);
    const mark = (l, type, at) => l.milestones.push({ id: String(Math.random()), legId: l.id, milestoneType: type, occurredAt: at, recordedBy: '1', recordedByName: 'Tài xế' });

    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const p = url.pathname.replace('/api/v1', '');
      const method = request.method();
      if (method === 'POST' && fail.next > 0) {
        fail.next -= 1;
        if (p.endsWith('/milestones')) calls.milestones.push({ failed: true, ...request.postDataJSON() });
        return route.abort('internetdisconnected');
      }
      if (method === 'POST' && conflict.next > 0) {
        conflict.next -= 1;
        conflict.apply();
        return route.fulfill({ status: 409, json: { message: 'Trạng thái chặng đã thay đổi.' } });
      }
      if (p === '/notifications') return route.fulfill({ json: state.notices });
      const readNotice = /^\/notifications\/(\d+)\/read$/.exec(p);
      if (readNotice && method === 'POST') { state.notices.find(n => n.id === readNotice[1]).is_read = 1; return route.fulfill({ json: {} }); }
      if (p === '/tracking/driver/trips') return route.fulfill({ json: ['100', '200', ...extraIds].map(summary) });
      const mapGet = /^\/tracking\/trips\/(\d+)\/map$/.exec(p);
      if (mapGet) { calls.maps++; return route.fulfill({ json: mapFor(mapGet[1]) }); }
      if (/^\/tracking\/trips\/\d+\/positions$/.test(p) && method === 'GET') return route.fulfill({ json: state.track });
      if (/^\/tracking\/trips\/\d+\/positions$/.test(p) && method === 'POST') {
        const points = request.postDataJSON().points;
        if (state.positionsMode === 'offline') return route.abort('internetdisconnected');
        calls.positions.push(points);
        if (typeof state.positionsMode === 'number') return route.fulfill({ status: state.positionsMode, json: { message: 'mock ' + state.positionsMode } });
        return route.fulfill({ status: 201, json: { legId: '10', accepted: points.length, duplicates: 0 } });
      }
      const tripGet = /^\/tracking\/trips\/(\d+)$/.exec(p);
      if (tripGet && method === 'GET') return route.fulfill({ json: detail(tripGet[1]) });
      if (/^\/tracking\/trips\/\d+\/alerts$/.test(p)) return route.fulfill({ json: state.alerts });
      if (/^\/tracking\/trips\/\d+\/incidents$/.test(p) && method === 'GET') return route.fulfill({ json: state.incidents });
      if (/^\/tracking\/trips\/\d+\/horse-logs$/.test(p) && method === 'GET') return route.fulfill({ json: state.horseLogs });
      const milestone = /^\/tracking\/legs\/(\d+)\/milestones$/.exec(p);
      if (milestone && method === 'POST') {
        const body = request.postDataJSON();
        calls.milestones.push(body);
        const l = allLegs().find(x => x.id === milestone[1]);
        const trip = tripOf(l.id);
        if (body.milestoneType === 'DEPARTED') { l.status = 'MOVING'; l.actualDepartureAt = body.occurredAt; trip.orderStatus = 'IN_TRANSIT'; }
        if (body.milestoneType === 'ARRIVED_AT_STOP') { l.status = 'AT_STOP'; l.actualArrivalAt = body.occurredAt; }
        if (body.milestoneType === 'DELIVERED') { l.status = 'COMPLETED'; trip.orderStatus = 'DELIVERED'; }
        mark(l, body.milestoneType, body.occurredAt);
        return route.fulfill({ status: 201, json: { milestoneId: '1', legId: l.id, milestoneType: body.milestoneType, legStatus: l.status, orderStatus: trip.orderStatus } });
      }
      const complete = /^\/tracking\/legs\/(\d+)\/complete$/.exec(p);
      if (complete && method === 'POST') {
        calls.complete.push(request.postDataJSON());
        allLegs().find(x => x.id === complete[1]).status = 'COMPLETED';
        return route.fulfill({ json: { legId: complete[1], status: 'COMPLETED' } });
      }
      if (/^\/tracking\/trips\/\d+\/incidents$/.test(p) && method === 'POST') {
        const raw = request.postData() || '';
        calls.incidents.push(raw);
        const [severity] = field(raw, 'severity');
        const [incidentType] = field(raw, 'incidentType');
        const [subType] = field(raw, 'subType');
        const created = {
          id: String(9 + state.incidents.length), tripId: '100', legId: null, horseId: null, horseName: null, incidentType, subType, severity,
          damageTarget: field(raw, 'damageTarget')[0], latitude: null, longitude: null, locationText: null, description: field(raw, 'description')[0],
          urgency: severity === 'RED' || incidentType === 'HORSE_MEDICAL' ? 'HIGH' : 'NORMAL', status: 'NEW',
          reportedBy: 'test', reportedByName: 'Phan Thị Lan', reportedAt: iso(0), receivedBy: null, handlingNote: null, closedAt: null, attachments: [],
        };
        state.incidents.push(created);
        return route.fulfill({ status: 201, json: created });
      }
      // Hoạt động chăm sóc (E1): bản gốc đã bị đính chính được ẩn; summary tính trên các bản trả về; lastFeedAtByHorse theo toàn chuyến.
      if (/^\/tracking\/trips\/\d+\/care-activities$/.test(p)) {
        if (method === 'GET') {
          calls.careGets++;
          const visible = state.care.filter(a => !state.care.some(c => c.correctsActivityId === a.id)).sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt));
          const from = url.searchParams.get('from'), to = url.searchParams.get('to');
          const rows = from && to ? visible.filter(a => Date.parse(a.performedAt) >= Date.parse(from) && Date.parse(a.performedAt) < Date.parse(to)) : visible;
          const summary = { waterLiters: 0, meals: 0, rests: 0, restMinutes: 0, lastFeedAtByHorse: {} };
          for (const a of rows) {
            if (a.activityType === 'WATER') summary.waterLiters += a.amountLiters; else if (a.activityType === 'FEED') summary.meals++; else { summary.rests++; summary.restMinutes += a.durationMinutes; }
          }
          for (const a of visible) if (a.activityType === 'FEED' && a.horseId && !summary.lastFeedAtByHorse[a.horseId]) summary.lastFeedAtByHorse[a.horseId] = a.performedAt;
          summary.waterLiters = Math.round(summary.waterLiters * 10) / 10;
          return route.fulfill({ json: { activities: rows, summary } });
        }
        if (method === 'POST') {
          const body = request.postDataJSON();
          calls.care.push(body);
          const rejected = state.careRejects.shift();
          if (rejected) return route.fulfill({ status: rejected.status, json: { message: rejected.message } });
          const horse = horses.find(h => h.id === body.horseId);
          const created = {
            id: String(900 + state.care.length), tripId: '100', legId: null, horseId: body.horseId ?? null, horseName: horse?.name ?? null, activityType: body.activityType,
            feedDescription: body.feedDescription ?? null, amountLiters: body.amountLiters ?? null, durationMinutes: body.durationMinutes ?? null, note: body.note ?? null,
            performedAt: body.performedAt, createdBy: 'test', createdByName: 'Phan Thị Lan', createdAt: iso(0), correctsActivityId: body.correctsActivityId ?? null,
          };
          state.care.push(created);
          return route.fulfill({ status: 201, json: created });
        }
      }
      return route.fulfill({ status: 404, json: { message: 'unmocked ' + p } });
    });

    const open = async view => {
      // Lần tải đầu Vite biên dịch hàng trăm module nên có thể quá 30 giây khi máy đang bận: nới hạn để test không lỗi vì thời gian.
      await page.goto(`http://127.0.0.1:${PORT}/test/portal.html?view=${view}`, { timeout: 120_000 });
      await page.waitForLoadState('networkidle', { timeout: 120_000 });
    };
    const noOverflow = async label => {
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      assert.ok(scroll <= inner, `${label}: ngang ${scroll} > ${inner}`);
    };
    const action = label => page.locator('.drv-action', { hasText: label });
    const checkInButton = () => page.locator('.drv-header-actions .drv-action', { hasText: 'Check-in chặng' });
    // Bấm "Check-in chặng", kiểm tra hộp thoại ghi đúng hành động, rồi xác nhận.
    const checkIn = async title => {
      await checkInButton().click();
      await dialog().locator('.ant-modal-title', { hasText: title }).waitFor();
      await confirm();
    };
    const modalClosed = () => dialog().waitFor({ state: 'detached' });
    const dialog = () => page.locator('.ant-modal-wrap:visible [role=dialog]');
    const confirm = () => dialog().getByRole('button', { name: 'Xác nhận', exact: true }).click();
    const pick = async (label, option) => {
      await page.getByLabel(label, { exact: true }).click();
      await page.clock.fastForward('00:01').catch(() => undefined); // đồng hồ giả có thể đã cài: đẩy để animation dropdown kịp ổn định
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option }).click();
    };
    // PNG 1×1 hợp lệ để ô ảnh hiển thị được trong ảnh chụp.
    const photo = { name: 'ngua.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGOoBwAEhQGAzc9FWwAAAABJRU5ErkJggg==', 'base64') };
    const heading = name => page.getByRole('heading', { level: 1, name, exact: true });
    const fact = label => page.locator('.drv-header-facts > div', { hasText: label }).locator('dd');
    const stops = () => page.locator('.drv-stops li');
    const reportButton = () => page.locator('.drv-header-actions').getByRole('button', { name: 'Báo cáo sự cố' });

    const stat = label => page.locator('.drv-stat-card', { hasText: label });
    const incidentOf = id => ({
      id: String(id), tripId: '100', legId: null, horseId: null, horseName: null, incidentType: 'VEHICLE_BREAKDOWN', subType: 'TIRE_BURST', severity: 'RED',
      damageTarget: 'VEHICLE', latitude: null, longitude: null, locationText: null, description: 'Lốp sau phải nổ', urgency: 'HIGH', status: 'NEW',
      reportedBy: 'test', reportedByName: 'Phan Thị Lan', reportedAt: iso(-1800e3), receivedBy: null, handlingNote: null, closedAt: null, attachments: [],
    });
    // Chuyến 100 đã xuất phát (như sau khi bấm "Bắt đầu chuyến đi"): chặng 1 đang chạy, đơn IN_TRANSIT.
    const startTrip = () => {
      trips[100].orderStatus = 'IN_TRANSIT';
      Object.assign(trips[100].legs[0], { status: 'MOVING', actualDepartureAt: iso(-3600e3) });
      mark(trips[100].legs[0], 'DEPARTED', iso(-3600e3));
    };

    const h = { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf };
    try {
      await body(h);
      assert.deepEqual(pageErrors, [], 'lỗi JS trong trang');
      console.log(name + ': OK');
    } catch (error) {
      // Giữ lại ảnh và nội dung trang khi test lỗi để dễ tìm nguyên nhân.
      try { await page?.screenshot({ path: `test-results/${name}-failure.png`, fullPage: true }); console.log('PAGE TEXT:', (await page.locator('body').innerText()).slice(0, 800)); } catch { /* bỏ qua */ }
      throw error;
    } finally {
      await browser?.close();
      await server.close();
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
