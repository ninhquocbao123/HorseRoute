// Kiểm thử trình duyệt giao diện Driver (Flow 4, khung DriverShell + màn D1) trên web desktop 1440px với API giả lập.
// Chạy: PLAYWRIGHT_PACKAGE=<đường dẫn playwright-core> node apps/web/test/driver.browser.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const web = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  process.env.VITE_MAP_ENABLED = 'false'; // không gọi Mapbox trong test; bản đồ rơi về khung dự phòng
  const server = await createServer({ root: web, server: { host: '127.0.0.1', port: 5190, strictPort: true } });
  await server.listen();
  let browser, page;
  try {
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
    const state = { incidents: [], horseLogs: [], track: [], latest: null, positionsMode: null };
    const calls = { milestones: [], complete: [], incidents: [], positions: [], maps: 0 };
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
    const horses = [{ id: '21', name: 'Bạch Mã', passportNo: 'PP-1', orderStatus: 'NORMAL' }, { id: '22', name: 'Hắc Mã', passportNo: 'PP-2', orderStatus: 'NORMAL' }];
    const summary = id => ({ id, orderId: '5' + id, orderCode: trips[id].orderCode, orderStatus: trips[id].orderStatus, planStatus: 'APPROVED', plannedDepartureAt: trips[id].dep ?? iso(-3600e3), plannedArrivalAt: iso(7200e3), crewRole: 'DRIVER', legs: trips[id].legs });
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
      if (p === '/notifications') return route.fulfill({ json: [{ id: '1', content: 'Chuyến WDP-TEST-1 đã được phân công cho bạn.', is_read: 0 }] });
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
      if (/^\/tracking\/trips\/\d+\/alerts$/.test(p)) return route.fulfill({ json: [{ id: '1', tripId: '100', alertType: 'WEATHER', content: 'Mưa lớn trên tuyến', sentBy: '4', sentByName: 'Điều phối', sentAt: iso(-60e3) }] });
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
      return route.fulfill({ status: 404, json: { message: 'unmocked ' + p } });
    });

    const open = async view => {
      // Lần tải đầu Vite biên dịch hàng trăm module nên có thể quá 30 giây khi máy đang bận: nới hạn để test không lỗi vì thời gian.
      await page.goto(`http://127.0.0.1:5190/test/portal.html?view=${view}`, { timeout: 120_000 });
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
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option }).click();
    };
    // PNG 1×1 hợp lệ để ô ảnh hiển thị được trong ảnh chụp.
    const photo = { name: 'ngua.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkqGOoBwAEhQGAzc9FWwAAAABJRU5ErkJggg==', 'base64') };
    const heading = name => page.getByRole('heading', { level: 1, name, exact: true });
    const fact = label => page.locator('.drv-header-facts > div', { hasText: label }).locator('dd');
    const stops = () => page.locator('.drv-stops li');
    const reportButton = () => page.locator('.drv-header-actions').getByRole('button', { name: 'Báo cáo sự cố' });

    // 1. Khung tài xế + màn D1 (READY): view cũ quy về ?view=trip, không còn thẻ thống kê/danh sách/tab
    await open('assignments');
    await heading('Chuyến vận chuyển').waitFor();
    assert.match(page.url(), /view=trip$/, 'view cũ chuyển về trip');
    assert.deepEqual(await page.locator('.drs-sidebar nav button').allInnerTexts(), ['Chuyến vận chuyển', 'Lịch sử giao hàng', 'Báo cáo sự cố'], 'sidebar 3 mục');
    assert.equal(await page.locator('.drs-sidebar nav button[aria-current=page]').innerText(), 'Chuyến vận chuyển');
    await page.locator('.drs-role', { hasText: 'DRIVER · Tài xế' }).waitFor();
    await page.locator('.drs-user', { hasText: 'Phan Thị Lan' }).waitFor();
    assert.equal(await page.locator('.ant-tabs, .drv-stats, .drv-list').count(), 0, 'đã bỏ tab, thống kê, danh sách chuyến');
    await page.getByRole('heading', { name: 'WDP-TEST-1' }).waitFor();
    await page.locator('.drv-badge', { hasText: 'Sẵn sàng khởi hành' }).waitFor();
    await page.locator('.drv-header-title p', { hasText: 'Kho HCM → Cửa khẩu Mộc Bài' }).waitFor();
    assert.equal(await fact('Xe').innerText(), 'XE-01 · 4 chuồng');
    assert.equal(await fact('Hộ tống').innerText(), 'Lê Hộ Tống');
    assert.equal(await fact('Ngựa').innerText(), 'Bạch Mã, Hắc Mã');
    assert.equal(await fact('Người nhận').innerText(), 'Người Nhận SG');
    assert.equal(await stops().count(), 4, '3 chặng → 4 điểm dừng');
    assert.match(await stops().nth(0).innerText(), /Kho HCM[\s\S]*Nhận 2 ngựa/);
    assert.match(await stops().nth(2).innerText(), /Trạm Phan Thiết[\s\S]*Tiếp nhiên liệu/);
    assert.match(await stops().nth(3).innerText(), /Cửa khẩu Mộc Bài[\s\S]*Bàn giao[\s\S]*\+1$/);
    assert.equal(await page.locator('.drv-stops li.is-reached').count(), 0);
    assert.equal(await page.getByText('Cảnh báo từ điều phối viên').count(), 0, 'UI-1: bỏ khung cảnh báo khỏi trang');
    await page.getByText('Bản đồ đang tạm tắt.').waitFor();
    await page.locator('.drv-header-title p', { hasText: 'Kho HCM → Cửa khẩu Mộc Bài · 1.720 km · ' }).waitFor();
    assert.equal(await page.locator('.drv-route-card .drv-card-head > span').innerText(), '1.720 km', 'D1: tổng km thay cho số chặng');
    await page.locator('.drv-map-warnings', { hasText: 'Chặng 3: chưa có tuyến đường bộ' }).waitFor();
    assert.equal(await page.locator('.drv-gps-badge, .drv-gps-controls').count(), 0, 'D1 (READY): chưa chia sẻ GPS');
    assert.equal(await page.locator('.drv-checklist .ant-checkbox-wrapper').count(), 5);
    assert.equal(await reportButton().isDisabled(), false, 'READY: vẫn được báo sự cố (5.4)');
    await noOverflow('trip');
    // Sidebar: nền phủ hết chiều cao trang, phần nội dung sticky cao đúng viewport, thẻ user ở đáy viewport (kể cả khi đã cuộn).
    const sidebar = async () => page.evaluate(() => {
      const aside = document.querySelector('.drs-sidebar').getBoundingClientRect();
      const inner = document.querySelector('.drs-sidebar-inner').getBoundingClientRect();
      const user = document.querySelector('.drs-user').getBoundingClientRect();
      return { aside: aside.height, page: document.documentElement.scrollHeight, inner: inner.height, innerTop: inner.top, userBottom: user.bottom, viewport: innerHeight };
    });
    for (const scrolled of [false, true]) {
      if (scrolled) await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const s = await sidebar();
      assert.equal(Math.round(s.aside), s.page, 'nền sidebar phủ hết trang');
      assert.equal(Math.round(s.inner), s.viewport, 'sidebar cao đúng viewport');
      assert.equal(Math.round(s.innerTop), 0, 'sidebar dính đầu màn hình');
      assert.ok(s.viewport - s.userBottom <= 28 && s.userBottom <= s.viewport, 'thẻ user ở đáy');
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const rows = await page.locator('.drv-stops li').evaluateAll(items => items.map(item => item.getBoundingClientRect().height));
    assert.ok(rows.every(h => h >= 50 && h <= 56), 'mỗi dòng chặng ~53px: ' + rows.join(','));
    await page.screenshot({ path: 'test-results/driver-d1-desktop.png', fullPage: true });

    // Chuông dùng lại NotificationsPanel
    await page.getByRole('button', { name: /^Thông báo, 1 chưa đọc/ }).click();
    await page.getByText('Chuyến WDP-TEST-1 đã được phân công cho bạn.').waitFor();
    await page.locator('.ant-drawer-close').click();

    // UI-1: chỉ chuyến đang hoạt động, không dropdown chọn chuyến, không ô tìm kiếm ở màn chuyến, không dòng "chuyến sắp tới"
    assert.equal(await page.locator('.drv-trip-select, .drs-search').count(), 0);
    assert.equal(await page.locator('.drv-upcoming').count(), 0);
    assert.equal(await page.getByText('WDP-TEST-2').count(), 0, 'chuyến đã giao không hiện ở màn chuyến');
    assert.equal(await fact('Xe').innerText(), 'XE-01 · 4 chuồng', 'READY: xe của chặng đầu');
    // Thu gọn: 4 ô thông tin ≤ 56px một dòng, bản đồ nằm trọn trong màn hình ở cả 1440×900 và 1366×768
    for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(size);
      const m = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        return { mapBottom: box('.drv-map-wrap').bottom, mapHeight: box('.drv-map-wrap').height, factHeights: [...document.querySelectorAll('.drv-header-facts > div')].map(el => el.getBoundingClientRect().height), viewport: innerHeight };
      });
      assert.ok(m.mapBottom <= m.viewport, `D1 ${size.width}×${size.height}: mép dưới bản đồ ${Math.round(m.mapBottom)} phải ≤ ${m.viewport}`);
      assert.ok(m.mapHeight >= 380, 'bản đồ cao tối thiểu 380px: ' + m.mapHeight);
      assert.ok(m.factHeights.every(h => h <= 56), '4 ô thông tin ≤ 56px: ' + m.factHeights.join(','));
      await page.screenshot({ path: `test-results/driver-d1-${size.width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.ok(await fact('Xe').evaluate(el => getComputedStyle(el).whiteSpace === 'nowrap' && getComputedStyle(el).textOverflow === 'ellipsis'), 'ô Xe một dòng, ellipsis');

    // 2. Checklist lưu theo chuyến; chưa đủ thì hộp thoại cảnh báo nhưng không khóa nút
    await page.locator('.drv-checklist').getByText('Lốp, phanh, đèn đã kiểm tra').click();
    await page.locator('.drv-checklist').getByText('Giấy kiểm dịch mang theo').click();
    await open('trip');
    await page.locator('.drv-checklist .ant-checkbox-wrapper-checked').first().waitFor(); // chờ trang vẽ xong checklist (networkidle chưa đảm bảo)
    assert.equal(await page.locator('.drv-checklist .ant-checkbox-wrapper-checked').count(), 2, 'tick còn sau khi tải lại');
    assert.equal(await page.locator('.drv-action').count(), 1, 'chỉ một nút hành động chính');
    await action('Bắt đầu chuyến đi').click();
    await dialog().getByText('Còn 3 mục chưa kiểm tra').waitFor();
    assert.equal(await dialog().locator('.ant-modal-title').innerText(), 'Bắt đầu chuyến đi');
    await page.screenshot({ path: 'test-results/driver-confirm-desktop.png' });
    await confirm();
    await heading('Chuyến đang chạy').waitFor();
    await checkInButton().waitFor();
    await page.locator('.drv-badge', { hasText: 'Đang di chuyển' }).waitFor();
    assert.equal(calls.milestones.at(-1).milestoneType, 'DEPARTED');
    assert.ok(Math.abs(Date.parse(calls.milestones.at(-1).occurredAt) - Date.now()) < 60e3, 'giờ mặc định là hiện tại');
    assert.equal(await page.locator('.drv-checklist').count(), 0, 'đang chạy: ẩn checklist');
    assert.equal(await page.locator('.drv-stops li.is-reached').count(), 1, 'điểm xuất phát đã qua');

    // 2b. Màn D1b (IN_TRANSIT): topbar, header, ETA, ba thẻ dưới bản đồ, timeline 3 trạng thái, ghi chú hộ tống
    await page.locator('.drs-breadcrumb', { hasText: 'Chuyến đang chạy' }).waitFor();
    await page.getByText('Bấm Check-in mỗi khi tới một chặng').waitFor();
    assert.deepEqual(await page.locator('.drv-header-actions .ant-btn').allInnerTexts(), ['Check-in chặng', 'Báo cáo sự cố'], 'Check-in đứng trước Báo cáo sự cố');
    const eta = new Date(trips[100].legs[2].plannedArrivalAt);
    const two = n => String(n).padStart(2, '0');
    const etaText = `${two(eta.getDate())}/${two(eta.getMonth() + 1)} ${two(eta.getHours())}:${two(eta.getMinutes())}`;
    assert.equal(await page.locator('.drv-route-card .drv-card-head > span').innerText(), `Còn 1.710 km · ETA ${etaText}`);
    assert.equal(await page.locator('.drv-gps-badge').innerText(), 'Chưa bật vị trí', 'chưa đồng ý chia sẻ → chưa gửi');
    const stat = label => page.locator('.drv-stat-card', { hasText: label });
    assert.equal(await stat('Chặng tiếp').locator('strong').innerText(), 'Trạm Đồng Nai');
    assert.match(await stat('Chặng tiếp').locator('small').innerText(), /^còn 200 km · \d{2}:\d{2}$/, '1.710 − (160 + 1.350) = 200 km tới điểm kế');
    // Tên điểm một dòng (ellipsis), title có tên đầy đủ; ba thẻ cao bằng nhau
    assert.equal(await stat('Chặng tiếp').locator('strong').getAttribute('title'), 'Trạm Đồng Nai');
    assert.ok(await stat('Chặng tiếp').locator('strong').evaluate(el => el.getClientRects().length === 1 && getComputedStyle(el).whiteSpace === 'nowrap' && getComputedStyle(el).textOverflow === 'ellipsis'), 'tên điểm 1 dòng');
    const heights = await page.locator('.drv-stat-card').evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().height)));
    assert.equal(new Set(heights).size, 1, 'ba thẻ cao bằng nhau: ' + heights.join(','));
    assert.equal(await stat('Tốc độ').locator('strong').innerText(), '—');
    assert.equal(await stat('Tốc độ').locator('small.is-muted').innerText(), 'Chưa có tín hiệu GPS');
    assert.match(await stat('Đã chạy').locator('strong').innerText(), /^[01] phút$/, 'vừa xuất phát');
    assert.match(await stat('Đã chạy').locator('small').innerText(), /^nghỉ tiếp sau \d+ phút$/);
    assert.equal(await page.locator('.drv-stops li.is-current').count(), 1, 'đúng một điểm đang tới');
    assert.equal(await page.locator('.drv-stops li[aria-current=step]').innerText().then(t => t.split('\n')[0]), 'Trạm Đồng Nai');
    assert.equal(await page.locator('.drv-escort-note').count(), 0, 'chưa có ghi chú → ẩn thẻ');
    assert.equal(await page.getByText('Cảnh báo từ điều phối viên').count(), 0);
    assert.equal(await fact('Xe').innerText(), 'XE-01 · 4 chuồng', 'IN_TRANSIT: xe của chặng đang chạy');
    // Thông báo "Đã ghi nhận…" (tạm thời, đóng được) làm trang cao thêm: đóng trước khi đo
    while (await page.locator('.drv-alert-notice .ant-alert-close-icon, .ant-alert-close-icon').count()) await page.locator('.ant-alert-close-icon').first().click();
    for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(size);
      const m = await page.evaluate(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const cards = [...document.querySelectorAll('.drv-stat-card')].map(card => card.getBoundingClientRect());
        return { mapBottom: rect('.drv-map-wrap').bottom, mapRight: rect('.drv-route-card').right, cardsLeft: Math.min(...cards.map(c => c.left)), lastBottom: Math.max(...cards.map(c => c.bottom)), cardHeights: cards.map(c => Math.round(c.height)), stopsBottom: rect('.drv-stops').bottom, firstTop: Math.min(...cards.map(c => c.top)) };
      });
      assert.ok(m.mapBottom <= size.height, `D1b ${size.width}×${size.height}: mép dưới bản đồ ${Math.round(m.mapBottom)} ≤ ${size.height}`);
      assert.ok(m.lastBottom <= size.height, `D1b ${size.width}×${size.height}: mép dưới thẻ cuối ${Math.round(m.lastBottom)} ≤ ${size.height}`);
      assert.ok(m.cardsLeft >= m.mapRight && m.firstTop >= m.stopsBottom, 'ba thẻ nằm ở cột phải, ngay dưới "Các chặng"');
      assert.ok(m.cardHeights.every(h => h <= 72), 'mỗi thẻ gọn ~1 hàng: ' + m.cardHeights.join(','));
      await page.screenshot({ path: `test-results/driver-d1b-${size.width}.png` });
    }
    // < 1200px: ba thẻ về dưới bản đồ
    await page.setViewportSize({ width: 1100, height: 900 });
    const narrow = await page.evaluate(() => ({ mapBottom: document.querySelector('.drv-map-wrap').getBoundingClientRect().bottom, cardsTop: document.querySelector('.drv-stat-card').getBoundingClientRect().top, stopsTop: document.querySelector('.drv-stops').getBoundingClientRect().top }));
    assert.ok(narrow.cardsTop >= narrow.mapBottom && narrow.cardsTop < narrow.stopsTop, 'màn hẹp: ba thẻ dưới bản đồ, trước "Các chặng"');
    await page.setViewportSize({ width: 1440, height: 900 });
    // Ghi chú của chính mình không hiện; ghi chú mới nhất của người khác thì hiện "HH:mm · nội dung"
    const log = (id, createdBy, note, at) => ({ id, horseId: '21', horseName: 'Bạch Mã', legId: '10', conditionStatus: 'STABLE', note, loggedAt: at, createdBy, createdByName: createdBy === 'test' ? 'Phan Thị Lan' : 'Lê Hộ Tống', correctsLogId: null, attachments: [] });
    state.horseLogs = [log('1', 'test', 'Ghi chú của tôi', iso(-10 * 60e3))];
    await open('trip');
    await checkInButton().waitFor();
    assert.equal(await page.locator('.drv-escort-note').count(), 0, 'ghi chú của chính mình không tính');
    const noteAt = new Date(Date.now() - 5 * 60e3).toISOString();
    state.horseLogs.push(log('2', '7', 'Ngựa cũ hơn', iso(-60 * 60e3)), log('3', '7', 'Hai ngựa đã uống 20 L nước, ăn uống bình thường.', noteAt), log('4', '7', null, iso(0)));
    await open('trip');
    const hhmm = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(noteAt));
    assert.equal(await page.locator('.drv-escort-note p').innerText(), `${hhmm} · Hai ngựa đã uống 20 L nước, ăn uống bình thường.`);
    // Tự tải lại mỗi 2 phút khi tab đang hiển thị (đồng hồ giả của Playwright để không phải chờ thật)
    await page.clock.install();
    await open('trip');
    await page.locator('.drv-escort-note p', { hasText: 'Hai ngựa đã uống' }).waitFor();
    const newerAt = new Date(Date.now() + 60e3).toISOString();
    state.horseLogs.push(log('5', '7', 'Đã cho ngựa nghỉ 15 phút.', newerAt));
    await page.clock.fastForward('01:00');
    assert.match(await page.locator('.drv-escort-note p').innerText(), /Hai ngựa đã uống/, 'chưa tới 2 phút: chưa tải lại');
    await page.clock.fastForward('01:05');
    await page.locator('.drv-escort-note p', { hasText: 'Đã cho ngựa nghỉ 15 phút.' }).waitFor();
    state.horseLogs.pop();
    // "Đã chạy" tính từ giờ xuất phát thực tế; quá giờ đến dự kiến của chặng → "trễ" màu cảnh báo
    const firstLeg = trips[100].legs[0];
    const saved = { dep: firstLeg.actualDepartureAt, arr: firstLeg.plannedArrivalAt };
    // Tính theo giờ trong trang (đồng hồ giả ở trên đã đẩy giờ trang lên trước).
    const pageNow = await page.evaluate(() => Date.now());
    firstLeg.actualDepartureAt = new Date(pageNow - (6 * 60 + 40) * 60e3 - 20e3).toISOString();
    firstLeg.plannedArrivalAt = new Date(pageNow - 25 * 60e3 - 20e3).toISOString();
    await open('trip');
    assert.equal(await stat('Đã chạy').locator('strong').innerText(), '6 giờ 40');
    assert.equal(await stat('Đã chạy').locator('small.is-warn').innerText(), 'trễ 25 phút');
    await noOverflow('in-transit');
    await page.screenshot({ path: 'test-results/driver-intransit-desktop.png', fullPage: true });
    Object.assign(firstLeg, { actualDepartureAt: saved.dep, plannedArrivalAt: saved.arr });
    await open('trip');
    await checkInButton().waitFor();

    // 2c. Chia sẻ GPS (D1b): đồng ý lần đầu, gửi lô mỗi 30 giây, hàng đợi khi mất mạng, 409 dừng; tốc độ so với VMAX
    const badge = () => page.locator('.drv-gps-badge');
    const gpsSwitch = () => page.getByRole('switch', { name: 'Chia sẻ vị trí' });
    // Chờ điều kiện phía Node (mock đếm request) mà không dùng sleep cố định.
    const waitFor = async (predicate, label) => {
      for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setImmediate(resolve)).then(() => page.evaluate(() => 0));
      assert.ok(predicate(), label);
    };
    const queueLength = () => page.evaluate(() => JSON.parse(localStorage.getItem('wdp:tracking:gps-queue:100:test') || '[]').length);
    // Chờ thật (setTimeout của Node, không bị đồng hồ giả của trang ảnh hưởng) tới khi điều kiện đúng.
    const until = async (check, label, ms = 10_000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await check()) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.fail('hết giờ chờ: ' + label);
    };
    const moveTo = async (latitude, longitude) => {
      await page.clock.fastForward('00:06'); // mở lại ngưỡng lấy mẫu 1 điểm/5 giây TRƯỚC khi vị trí mới tới
      await context.setGeolocation({ latitude, longitude });
      await until(() => page.evaluate(lat => window.__gps?.lat === lat, latitude), `trang nhận vị trí ${latitude}`);
    };
    // Đẩy đồng hồ qua nhịp gửi 30 giây rồi chờ kết quả; lặp lại nếu nhịp kế chưa kịp đặt lại (flush là bất đồng bộ).
    const runBatch = async (check, label) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        await page.clock.fastForward('00:31');
        try { await until(check, label, 1500); return; } catch { /* thử nhịp kế */ }
      }
      assert.fail('hết giờ chờ: ' + label);
    };
    assert.equal(await badge().innerText(), 'Chưa bật vị trí');
    assert.equal(await gpsSwitch().getAttribute('aria-checked'), 'false');
    await gpsSwitch().click();
    await dialog().getByText('Chia sẻ vị trí với điều phối viên?').waitFor();
    await dialog().getByText(/chỉ khi chuyến đang chạy và trang này đang mở/).waitFor();
    await dialog().getByRole('button', { name: 'Đồng ý và bật' }).click();
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    assert.equal(calls.positions.length, 0, 'chưa tới 30 giây: chưa gửi');
    await moveTo(10.9, 106.7);
    await moveTo(10.92, 106.75);
    await runBatch(() => calls.positions.length >= 1, 'gửi lô sau 30 giây');
    const firstBatch = calls.positions.flat();
    assert.ok(firstBatch.length >= 2 && firstBatch.length <= 20, 'lô 2–20 điểm: ' + firstBatch.length);
    assert.ok(firstBatch.some(point => point.latitude === 10.92 && point.longitude === 106.75), 'có điểm mới nhất');
    assert.ok(firstBatch.every(point => /Z$/.test(point.recordedAt)), 'recordedAt dạng UTC ISO');
    await until(async () => (await queueLength()) === 0, 'gửi xong thì xóa hàng đợi');
    // Lời giải thích dài nằm trong tooltip của biểu tượng (i) ở badge
    await page.getByLabel('Giải thích chia sẻ vị trí').hover();
    await page.getByRole('tooltip', { name: 'Chỉ gửi khi trang này đang mở; giữ màn hình sáng.' }).waitFor();
    await page.mouse.move(5, 5);

    // Mất mạng: giữ hàng đợi trong localStorage, badge "Mất mạng – sẽ gửi bù"; tải lại trang thì gửi bù (đã đồng ý nên tự bật lại)
    state.positionsMode = 'offline';
    await moveTo(10.95, 106.8);
    await runBatch(async () => (await badge().innerText()).startsWith('Mất mạng – sẽ gửi bù'), 'badge mất mạng');
    assert.ok(await queueLength() >= 1, 'điểm chưa gửi nằm trong localStorage');
    const sentBefore = calls.positions.length;
    state.positionsMode = null;
    await open('trip');
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('wdp:tracking:gps-queue:100:test') || '[]').length === 0);
    assert.ok(calls.positions.length > sentBefore, 'gửi bù sau khi có mạng');
    assert.ok(calls.positions.slice(sentBefore).flat().some(point => point.latitude === 10.95), 'điểm lúc mất mạng được gửi bù');

    // Tốc độ: GPS LIVE vượt VMAX → cảnh báo; GPS cũ → "GPS cũ n phút"
    const speedNow = await page.evaluate(() => Date.now());
    state.latest = { lat: 10.95, lng: 106.8, speedKmh: 92.4, accuracyM: 8, headingDeg: 90, recordedAt: new Date(speedNow - 30e3).toISOString(), legId: '10', freshness: 'LIVE' };
    await open('trip');
    assert.equal(await stat('Tốc độ').locator('strong.is-warn').innerText(), '92 km/h');
    assert.equal(await stat('Tốc độ').locator('small.is-warn').innerText(), 'giới hạn 80 km/h');
    state.latest = { ...state.latest, speedKmh: 64, recordedAt: new Date(speedNow - 5 * 60e3).toISOString(), freshness: 'STALE' };
    await open('trip');
    assert.equal(await stat('Tốc độ').locator('strong').innerText(), '—');
    assert.equal(await stat('Tốc độ').locator('small.is-muted').innerText(), 'GPS cũ 5 phút');
    state.latest = { ...state.latest, speedKmh: 64, recordedAt: new Date(speedNow - 10e3).toISOString(), freshness: 'LIVE' };
    await open('trip');
    assert.equal(await stat('Tốc độ').locator('strong').innerText(), '64 km/h');
    assert.equal(await stat('Tốc độ').locator('strong.is-warn').count(), 0, 'dưới giới hạn: không cảnh báo');
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    await noOverflow('gps');
    await page.screenshot({ path: 'test-results/driver-gps-desktop.png', fullPage: true });

    // 409 (chuyến không còn nhận vị trí): dừng gửi, tắt công tắc, giải thích; không gửi thêm
    state.positionsMode = 409;
    const before409 = calls.positions.length;
    await moveTo(10.97, 106.85);
    await runBatch(() => calls.positions.length > before409, 'lô bị từ chối 409');
    await page.locator('.drv-gps-alert', { hasText: 'Chuyến không còn nhận vị trí' }).waitFor();
    assert.equal(await gpsSwitch().getAttribute('aria-checked'), 'false');
    assert.equal(await badge().innerText(), 'Chưa bật vị trí');
    const after409 = calls.positions.length;
    await context.setGeolocation({ latitude: 10.99, longitude: 106.9 }); // đã dừng theo dõi: không có gì tới trang để chờ
    await page.clock.fastForward('00:06');
    await page.clock.fastForward('01:05');
    assert.equal(calls.positions.length, after409, 'đã dừng: không gửi thêm');
    state.positionsMode = null;
    state.latest = null;
    await page.evaluate(() => localStorage.setItem('wdp:tracking:gps-enabled:test', 'false')); // các bước sau không cần GPS
    await context.setGeolocation({ latitude: 18.3421, longitude: 105.9057 }); // trả lại vị trí giả lập mà màn D2 dùng
    await open('trip');
    await checkInButton().waitFor();

    // 3. Mất mạng: giữ nguyên giờ đã chốt, còn sau khi tải lại, gửi lại đúng giờ đó
    fail.next = 1;
    await checkInButton().click();
    await dialog().locator('.ant-modal-title', { hasText: 'Xác nhận: Đã đến Trạm Đồng Nai' }).waitFor();
    await confirm();
    await dialog().getByText(/Mất kết nối mạng/).waitFor();
    const firstAttempt = calls.milestones.find(c => c.failed);
    await dialog().getByRole('button', { name: 'Hủy' }).click();
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await open('trip');
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await page.getByRole('button', { name: 'Gửi lại' }).click();
    await page.getByText('Đã ghi nhận: Đã đến điểm dừng.').waitFor();
    assert.equal(calls.milestones.at(-1).occurredAt, firstAttempt.occurredAt, 'gửi lại đúng giờ đã chốt');
    assert.equal(calls.milestones.at(-1).milestoneType, 'ARRIVED_AT_STOP');
    await checkIn('Hoàn thành chặng tới Trạm Đồng Nai');
    await modalClosed();
    assert.equal(calls.complete.length, 1);

    // 4. Báo sự cố (màn D2, trang riêng ?view=incident): nút trên header mở trang, gửi xong quay về D1
    const form = () => page.locator('.drv-incident-form');
    const submitReport = () => form().getByRole('button', { name: 'Gửi báo cáo cho điều phối' }).click();
    await reportButton().click();
    await heading('Báo cáo sự cố').waitFor();
    assert.match(page.url(), /view=incident$/);
    await page.getByText('Tạo đơn báo cáo gửi điều phối · chuyến WDP-TEST-1').waitFor();
    assert.equal(await page.locator('.drs-sidebar nav button[aria-current=page]').innerText(), 'Báo cáo sự cố');
    // GPS tự điền tọa độ; cột phải: việc cần làm, liên hệ nhanh, banner đỏ (câu chữ theo 5.8)
    await page.waitForFunction(() => document.querySelector('input[aria-label="Vị trí"]')?.value === '18.342100, 105.905700');
    assert.equal(await page.locator('.drv-checklist .ant-checkbox-wrapper').count(), 3);
    assert.equal(await page.getByRole('link', { name: 'Gọi điều phối: Điều Phối A' }).getAttribute('href'), 'tel:0903');
    assert.equal(await page.getByRole('link', { name: 'Cứu hộ 24/7: 1900 1080' }).getAttribute('href'), 'tel:19001080');
    const redNotice = page.getByText('Mức nghiêm trọng sẽ gửi thông báo khẩn ngay tới điều phối viên.');
    assert.equal(await redNotice.count(), 0, 'cảnh báo chỉ hiện khi chọn Nghiêm trọng');
    assert.equal(await page.locator('.drv-reported-list').count(), 0, 'chưa có sự cố nào');
    // Thiếu thông tin: không gửi
    await submitReport();
    await page.getByText('Chọn mức độ sự cố.').waitFor();
    assert.equal(calls.incidents.length, 0);
    await page.getByRole('radio', { name: /^Nghiêm trọng/ }).click();
    await redNotice.waitFor();
    await pick('Loại sự cố', 'Hỏng xe · Nổ lốp');
    await page.getByLabel('Mô tả chi tiết').fill('Lốp sau phải nổ khi đang chạy 60 km/h');
    assert.equal(await page.getByLabel('Con ngựa liên quan').count(), 0, 'chỉ hiện ô chọn ngựa khi liên quan tới ngựa');
    await page.getByRole('radio', { name: 'Cả hai', exact: true }).click();
    await pick('Con ngựa liên quan', 'Bạch Mã');
    await page.locator('input[type=file]').setInputFiles([photo, { ...photo, name: 'xe.png' }]);
    await page.getByLabel('Nhãn ảnh 1').fill('Lốp sau');
    await page.getByLabel('Nhãn ảnh 2').fill('Toàn xe');
    await page.getByRole('button', { name: /Chụp thêm ảnh \(2\/3\)/ }).waitFor();
    await noOverflow('incident');
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    await page.waitForFunction(() => [...document.querySelectorAll('.ant-select-dropdown')].every(el => el.getBoundingClientRect().height === 0 || getComputedStyle(el).visibility === 'hidden' || el.classList.contains('ant-select-dropdown-hidden')));
    await page.screenshot({ path: 'test-results/driver-incident-desktop.png', fullPage: true });
    // Mất mạng: giữ nguyên dữ liệu đã nhập (cả ảnh và nhãn)
    fail.next = 1;
    await submitReport();
    await page.getByText(/Mất kết nối mạng/).waitFor();
    assert.equal(await page.getByLabel('Mô tả chi tiết').inputValue(), 'Lốp sau phải nổ khi đang chạy 60 km/h');
    assert.equal(await page.getByLabel('Nhãn ảnh 2').inputValue(), 'Toàn xe');
    assert.equal(await page.getByRole('radio', { name: /^Nghiêm trọng/ }).getAttribute('aria-checked'), 'true');
    // Nháp (trừ ảnh) còn sau khi tải lại
    await open('incident');
    assert.equal(await page.getByLabel('Mô tả chi tiết').inputValue(), 'Lốp sau phải nổ khi đang chạy 60 km/h', 'nháp còn sau khi tải lại');
    assert.equal(await page.locator('.drv-photo').count(), 0, 'ảnh không lưu vào nháp');
    await page.locator('input[type=file]').setInputFiles([photo, { ...photo, name: 'xe.png' }]);
    await page.getByLabel('Nhãn ảnh 1').fill('Lốp sau');
    await submitReport();
    await page.getByText(/Đã báo sự cố KHẨN/).waitFor();
    await heading('Chuyến đang chạy').waitFor();
    assert.match(page.url(), /view=trip$/);
    const sent = calls.incidents.at(-1);
    assert.deepEqual(
      ['severity', 'incidentType', 'subType', 'damageTarget', 'horseId', 'latitude', 'longitude'].map(name => field(sent, name)[0]),
      ['RED', 'VEHICLE_BREAKDOWN', 'TIRE_BURST', 'BOTH', '21', '18.3421', '105.9057'],
    );
    assert.deepEqual(field(sent, 'locationText'), [], 'tọa độ GPS không sửa → gửi latitude/longitude');
    assert.deepEqual(field(sent, 'captions'), ['Lốp sau', ''], 'nhãn theo đúng thứ tự ảnh');
    assert.equal((sent.match(/name="photos"/g) || []).length, 2);

    // Lần 2 qua sidebar: nháp đã xóa; sửa ô vị trí thành chữ → gửi locationText; mức cam → thường
    await page.locator('.drs-sidebar nav button', { hasText: 'Báo cáo sự cố' }).click();
    await heading('Báo cáo sự cố').waitFor();
    assert.equal(await page.getByLabel('Mô tả chi tiết').inputValue(), '', 'nháp đã xóa sau khi gửi');
    await page.locator('.drv-reported-list .drv-sev-tag', { hasText: 'Nghiêm trọng' }).waitFor();
    await page.locator('.drv-reported-list', { hasText: 'Hỏng xe · Nổ lốp' }).waitFor();
    await page.getByRole('radio', { name: /^Trung bình/ }).click();
    await page.getByLabel('Loại sự cố').fill('thi công');
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: 'Tắc đường · Thi công / cấm đường' }).click();
    await page.getByLabel('Vị trí').fill('Km 742 QL1A, Hà Tĩnh');
    await page.getByLabel('Mô tả chi tiết').fill('Kẹt xe 40 phút do thi công');
    await page.getByRole('radio', { name: 'Xe', exact: true }).click();
    await submitReport();
    await page.getByText('Đã báo sự cố. Điều phối viên sẽ liên hệ với bạn.').waitFor();
    const second = calls.incidents.at(-1);
    assert.deepEqual(field(second, 'locationText'), ['Km 742 QL1A, Hà Tĩnh']);
    assert.deepEqual(field(second, 'latitude'), []);
    assert.deepEqual(field(second, 'severity'), ['ORANGE']);
    assert.deepEqual(field(second, 'horseId'), [], 'không liên quan ngựa → không gửi horseId');
    // Hủy: về D1 không gửi gì
    await reportButton().click();
    await heading('Báo cáo sự cố').waitFor();
    await form().getByRole('button', { name: 'Hủy' }).click();
    await heading('Chuyến đang chạy').waitFor();
    assert.equal(calls.incidents.length, 2, 'chỉ 2 lần gửi tới server (lần mất mạng không tới)');

    // 5. 409: chặng đã bị cập nhật ở nơi khác → báo và tải lại dữ liệu mới, không gửi lại
    conflict.next = 1;
    conflict.apply = () => { const l = trips[100].legs[1]; l.status = 'MOVING'; mark(l, 'DEPARTED', iso(0)); };
    await checkIn('Xác nhận: Xuất phát từ Trạm Đồng Nai');
    await page.getByText('Trạng thái chặng đã thay đổi. Đã tải lại dữ liệu mới nhất.').waitFor();
    await modalClosed(); // hộp thoại đóng sau 409
    await page.locator('.drv-stops li.is-current', { hasText: 'Trạm Phan Thiết' }).waitFor();
    assert.equal(await fact('Xe').innerText(), 'XE-02 · 2 chuồng', 'xe đổi theo chặng hiện tại');

    // Các chặng còn lại: đến, hoàn thành; chặng cuối là cửa khẩu: xuất phát, đến, thông quan, giao
    const steps = [
      ['Xác nhận: Đã đến Trạm Phan Thiết', 'ARRIVED_AT_STOP'], ['Hoàn thành chặng tới Trạm Phan Thiết', null],
      ['Xác nhận: Xuất phát từ Trạm Phan Thiết', 'DEPARTED'], ['Xác nhận: Đã đến Cửa khẩu Mộc Bài', 'ARRIVED_AT_STOP'],
      ['Thông quan xong tại Cửa khẩu Mộc Bài', 'CUSTOMS_CLEARED'], ['Xác nhận: Đã giao ngựa tại Cửa khẩu Mộc Bài', 'DELIVERED'],
    ];
    for (const [title, expected] of steps) {
      await checkIn(title);
      await modalClosed();
      if (expected) assert.equal(calls.milestones.at(-1).milestoneType, expected);
    }
    assert.equal(await page.getByText('Tất cả các chặng đã hoàn thành').count(), 0, 'UI-1: bỏ banner hoàn thành');
    assert.equal(calls.complete.length, 2);
    // Giao xong: không còn chuyến hoạt động → trạng thái trống + nút sang Lịch sử
    await page.getByText('Bạn chưa có chuyến được phân công').waitFor();
    assert.equal(await page.locator('.drv-header').count(), 0);
    await noOverflow('empty');
    await page.screenshot({ path: 'test-results/driver-empty-desktop.png', fullPage: true });
    // Báo sự cố khi không có chuyến hoạt động: cũng là trạng thái trống
    await open('incident');
    await page.getByText('Bạn chưa có chuyến được phân công').waitFor();
    await open('trip');
    await page.getByRole('button', { name: 'Xem lịch sử giao hàng' }).click();
    await heading('Lịch sử giao hàng').waitFor();
    assert.match(page.url(), /view=history$/);

    // 6. Lịch sử giao hàng (?view=history): bảng chuyến đã giao mới nhất trước, lọc bằng ô tìm kiếm trên topbar
    const histRows = () => page.locator('.drv-history .ant-table-tbody > tr:not([aria-hidden])');
    await histRows().first().waitFor();
    assert.equal(await page.locator('.drs-sidebar nav button[aria-current=page]').innerText(), 'Lịch sử giao hàng');
    assert.deepEqual(await page.locator('.drv-history th').allInnerTexts(), ['Mã đơn', 'Tuyến', 'Khởi hành', 'Giao thực tế', 'Km', 'Xe', 'Ngựa', 'Sự cố']);
    const first = histRows().filter({ hasText: 'WDP-TEST-1' });
    await first.waitFor();
    await page.waitForFunction(() => !document.querySelector('.drv-history tbody')?.innerText.includes('…'));
    const cells = await first.locator('td').allInnerTexts();
    assert.match(cells[1], /Kho HCM → Cửa khẩu Mộc Bài/);
    assert.equal(cells[4], '1.720', 'km dùng dấu chấm nghìn');
    assert.equal(cells[5], 'XE-02 · 2 chuồng', 'xe của chặng cuối');
    assert.equal(cells[6], '2', 'số ngựa');
    assert.equal(cells[7], String(state.incidents.length), 'số sự cố');
    await page.locator('.drs-search input').fill('khách hai');
    await page.waitForFunction(() => document.querySelectorAll('.drv-history tbody tr:not([aria-hidden])').length === 1);
    assert.match(await histRows().first().innerText(), /WDP-TEST-2/);
    await page.locator('.drs-search input').fill('zzz');
    await page.getByText('Không có chuyến nào khớp “zzz”.').waitFor();
    await page.locator('.drs-search input').fill('');
    // Phân trang client 10 dòng
    for (let n = 0; n < 12; n++) {
      const id = String(300 + n);
      trips[id] = { orderCode: 'WDP-OLD-' + String(n).padStart(2, '0'), orderStatus: 'DELIVERED', customer: 'Khách Cũ', legs: trips[200].legs.map(l => ({ ...l, id: id + l.id })) };
      extraIds.push(id);
    }
    await open('history');
    await histRows().first().waitFor();
    assert.equal(await histRows().count(), 10, 'trang 1: 10 dòng');
    await page.locator('.drv-history .ant-pagination-item-2').click();
    await page.waitForFunction(() => document.querySelectorAll('.drv-history tbody tr:not([aria-hidden])').length === 4);
    extraIds.length = 0;
    await open('history');
    await histRows().first().waitFor();
    await noOverflow('history');
    for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(size);
      await page.screenshot({ path: `test-results/driver-history-${size.width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // 6b. Chi tiết chỉ xem (?view=history&trip=ID): header gọn, bản đồ, các chặng giờ thực tế, sự cố, không nút hành động
    await histRows().filter({ hasText: 'WDP-TEST-1' }).click();
    await page.getByRole('button', { name: 'Quay lại danh sách' }).waitFor();
    assert.match(page.url(), /view=history&trip=\d+$/);
    assert.equal(await page.locator('.drv-history-header h2').innerText(), 'WDP-TEST-1');
    assert.equal(await page.locator('.drv-action, .drv-btn-report, .drv-gps-badge, .drv-gps-controls').count(), 0, 'chỉ xem: không nút hành động, không chia sẻ GPS');
    assert.equal(await page.locator('.drv-history-legs li').count(), 3);
    assert.match(await page.locator('.drv-history-legs li').first().innerText(), /1\. Kho HCM → Trạm Đồng Nai[\s\S]*XE-01/);
    assert.match(await page.locator('.drv-history-legs li').nth(2).innerText(), /3\. Trạm Phan Thiết → Cửa khẩu Mộc Bài[\s\S]*XE-02/);
    assert.equal(await page.locator('.drv-route-card').count(), 1, 'có thẻ bản đồ toàn tuyến');
    assert.match(await page.locator('.drv-history-header p').innerText(), /1\.720 km/);
    assert.ok(await page.locator('.drv-reported-list li').count() >= 1, 'liệt kê sự cố của chuyến');
    await noOverflow('history-detail');
    for (const size of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      await page.setViewportSize(size);
      const bottom = await page.evaluate(() => document.querySelector('.drv-map-wrap').getBoundingClientRect().bottom);
      assert.ok(bottom <= size.height, `chi tiết lịch sử ${size.width}×${size.height}: mép dưới bản đồ ${Math.round(bottom)}`);
      await page.screenshot({ path: `test-results/driver-history-detail-${size.width}.png` });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'Quay lại danh sách' }).click();
    await histRows().first().waitFor();
    assert.match(page.url(), /view=history$/);
    await open('history&trip=999');
    await page.getByText('Không tìm thấy chuyến này trong lịch sử giao hàng.').waitFor();

    // 7. Đang chạy nhưng chưa có mốc nào ghi được (ví dụ điều phối vừa hiệu chỉnh chặng 1 về chưa bắt đầu): nút Check-in bị khóa, có giải thích
    trips[100].orderStatus = 'IN_TRANSIT';
    trips[100].legs.forEach(l => { l.status = 'NOT_STARTED'; l.milestones = []; l.actualDepartureAt = null; });
    await open('trip');
    assert.equal(await checkInButton().isDisabled(), true, 'không có hành động → khóa');
    await checkInButton().hover({ force: true });
    await page.getByRole('tooltip', { name: /Chưa có mốc nào cần ghi/ }).waitFor();
    assert.equal(await page.locator('.drv-stat-card', { hasText: 'Đã chạy' }).locator('strong').innerText(), '—', 'chưa xuất phát → chưa tính giờ chạy');

    // 8. Dữ liệu sai quy tắc "một tài xế một chuyến hoạt động": chuyến IN_TRANSIT + 1 dòng nhỏ về chuyến sắp tới (không dropdown)
    trips['400'] = { orderCode: 'WDP-TEST-3', orderStatus: 'READY', customer: 'Khách Ba', dep: iso(-7200e3), legs: trips[200].legs.map(l => ({ ...l, id: '400' + l.id, status: 'NOT_STARTED' })) };
    extraIds.push('400');
    await open('trip');
    await page.getByRole('heading', { name: 'WDP-TEST-1' }).waitFor();
    assert.equal((await page.locator('.drv-upcoming').innerText()).trim(), 'Chuyến kế tiếp: WDP-TEST-3');
    assert.equal(await page.locator('.drv-trip-select, .ant-select').count(), 0, 'không có dropdown chọn chuyến');
    // Không có IN_TRANSIT thì chọn READY khởi hành sớm nhất (WDP-TEST-3 sớm hơn WDP-TEST-1)
    trips[100].orderStatus = 'READY';
    await open('trip');
    await page.getByRole('heading', { name: 'WDP-TEST-3' }).waitFor();
    assert.equal((await page.locator('.drv-upcoming').innerText()).trim(), 'Chuyến kế tiếp: WDP-TEST-1');

    assert.deepEqual(pageErrors, [], 'lỗi JS trong trang');
    console.log('driver.browser: OK');
  } catch (error) {
    // Giữ lại ảnh và nội dung trang khi test lỗi để dễ tìm nguyên nhân.
    try { await page?.screenshot({ path: 'test-results/driver-failure.png', fullPage: true }); console.log('PAGE TEXT:', (await page.locator('body').innerText()).slice(0, 800)); } catch { /* bỏ qua */ }
    throw error;
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
