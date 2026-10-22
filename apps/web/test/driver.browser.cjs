// Kiểm thử trình duyệt giao diện Driver (Flow 4, khung DriverShell + màn D1) trên web desktop 1440px với API giả lập.
// Chạy: PLAYWRIGHT_PACKAGE=<đường dẫn playwright-core> node apps/web/test/driver.browser.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const web = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  const server = await createServer({ root: web, server: { host: '127.0.0.1', port: 5190, strictPort: true } });
  await server.listen();
  let browser, page;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
    const state = { incidents: [] };
    const calls = { milestones: [], complete: [], incidents: [] };
    const fail = { next: 0 };
    const conflict = { next: 0, apply: null };
    const horses = [{ id: '21', name: 'Bạch Mã', passportNo: 'PP-1', orderStatus: 'NORMAL' }, { id: '22', name: 'Hắc Mã', passportNo: 'PP-2', orderStatus: 'NORMAL' }];
    const summary = id => ({ id, orderId: '5' + id, orderCode: trips[id].orderCode, orderStatus: trips[id].orderStatus, planStatus: 'APPROVED', plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(7200e3), crewRole: 'DRIVER', legs: trips[id].legs });
    const detail = id => ({
      ...summary(id), horses,
      crew: [{ userId: 'test', name: 'Phan Thị Lan', phone: '0901', role: 'DRIVER' }, { userId: '7', name: 'Lê Hộ Tống', phone: '0902', role: 'ESCORT' }],
      customer: { name: trips[id].customer }, recipient: id === '100' ? { name: 'Người Nhận SG', phone: '+6560000050' } : null,
      coordinator: { name: 'Điều Phối A', phone: '0903' }, vehicles: [{ id: '5', code: 'XE-01', type: 'TRUCK', capacityStalls: 4 }],
    });
    const allLegs = () => Object.values(trips).flatMap(t => t.legs);
    const tripOf = legId => Object.values(trips).find(t => t.legs.some(l => l.id === legId));
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
      if (p === '/tracking/driver/trips') return route.fulfill({ json: ['100', '200'].map(summary) });
      const tripGet = /^\/tracking\/trips\/(\d+)$/.exec(p);
      if (tripGet && method === 'GET') return route.fulfill({ json: detail(tripGet[1]) });
      if (/^\/tracking\/trips\/\d+\/alerts$/.test(p)) return route.fulfill({ json: [{ id: '1', tripId: '100', alertType: 'WEATHER', content: 'Mưa lớn trên tuyến', sentBy: '4', sentByName: 'Điều phối', sentAt: iso(-60e3) }] });
      if (/^\/tracking\/trips\/\d+\/incidents$/.test(p) && method === 'GET') return route.fulfill({ json: state.incidents });
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
        return route.fulfill({ status: 201, json: { id: '9', urgency: raw.includes('HORSE_MEDICAL') ? 'HIGH' : 'NORMAL', status: 'NEW' } });
      }
      return route.fulfill({ status: 404, json: { message: 'unmocked ' + p } });
    });

    const open = async view => {
      await page.goto(`http://127.0.0.1:5190/test/portal.html?view=${view}`);
      await page.waitForLoadState('networkidle');
    };
    const noOverflow = async label => {
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      assert.ok(scroll <= inner, `${label}: ngang ${scroll} > ${inner}`);
    };
    const action = label => page.locator('.drv-action', { hasText: label });
    const dialog = () => page.locator('.ant-modal-wrap:visible [role=dialog]');
    const confirm = () => dialog().getByRole('button', { name: 'Xác nhận', exact: true }).click();
    const pick = async (label, option) => {
      await page.getByLabel(label, { exact: true }).click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option }).click();
    };
    const heading = name => page.getByRole('heading', { level: 1, name, exact: true });
    const fact = label => page.locator('.drv-header-facts > div', { hasText: label }).locator('dd');
    const stops = () => page.locator('.drv-stops li');
    const reportButton = () => page.locator('.drv-header-actions').getByRole('button', { name: 'Báo cáo sự cố' });

    // 1. Khung tài xế + màn D1 (READY): view cũ quy về ?view=trip, không còn thẻ thống kê/danh sách/tab
    await open('assignments');
    await heading('Chuyến vận chuyển').waitFor();
    assert.match(page.url(), /view=trip$/, 'view cũ chuyển về trip');
    assert.equal(await page.locator('.drs-sidebar nav button').count(), 2, 'sidebar chỉ 2 mục');
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
    await page.getByText('Cảnh báo từ điều phối viên').waitFor();
    await page.getByText('Bản đồ đang tạm tắt.').waitFor();
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
      assert.ok(s.page > s.viewport, 'nội dung dài hơn viewport');
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

    // Tìm kiếm theo khách hàng + dropdown chọn chuyến
    await page.getByLabel('Tìm chuyến theo mã đơn hoặc khách hàng').fill('zzz');
    await page.getByText('Không có chuyến nào khớp “zzz”.').waitFor();
    await page.getByLabel('Tìm chuyến theo mã đơn hoặc khách hàng').fill('khách hai');
    await pick('Chọn chuyến', 'WDP-TEST-2');
    await page.getByRole('heading', { name: 'WDP-TEST-2' }).waitFor();
    await page.locator('.drv-badge', { hasText: 'Đã giao xong' }).waitFor();
    assert.equal(await reportButton().isDisabled(), true, 'chuyến đã giao: khóa báo sự cố');
    assert.equal(await fact('Người nhận').innerText(), '—', 'không có người nhận');
    assert.equal(await page.locator('.drv-checklist').count(), 0, 'checklist chỉ khi READY');
    await page.getByLabel('Tìm chuyến theo mã đơn hoặc khách hàng').fill('');
    await pick('Chọn chuyến', 'WDP-TEST-1');
    await page.getByRole('heading', { name: 'WDP-TEST-1' }).waitFor();

    // 2. Checklist lưu theo chuyến; chưa đủ thì hộp thoại cảnh báo nhưng không khóa nút
    await page.locator('.drv-checklist').getByText('Lốp, phanh, đèn đã kiểm tra').click();
    await page.locator('.drv-checklist').getByText('Giấy kiểm dịch mang theo').click();
    await open('trip');
    assert.equal(await page.locator('.drv-checklist .ant-checkbox-wrapper-checked').count(), 2, 'tick còn sau khi tải lại');
    assert.equal(await page.locator('.drv-action').count(), 1, 'chỉ một nút hành động chính');
    await action('Bắt đầu chuyến đi').click();
    await dialog().getByText('Còn 3 mục chưa kiểm tra').waitFor();
    assert.equal(await dialog().locator('.ant-modal-title').innerText(), 'Bắt đầu chuyến đi');
    await page.screenshot({ path: 'test-results/driver-confirm-desktop.png' });
    await confirm();
    await action('ĐÃ ĐẾN TRẠM DỪNG').waitFor();
    await heading('Chuyến đang chạy').waitFor();
    await page.locator('.drv-badge', { hasText: 'Đang vận chuyển' }).waitFor();
    assert.equal(calls.milestones.at(-1).milestoneType, 'DEPARTED');
    assert.ok(Math.abs(Date.parse(calls.milestones.at(-1).occurredAt) - Date.now()) < 60e3, 'giờ mặc định là hiện tại');
    assert.equal(await page.locator('.drv-checklist').count(), 0, 'đang chạy: ẩn checklist');
    assert.equal(await page.locator('.drv-stops li.is-reached').count(), 1, 'điểm xuất phát đã qua');

    // 3. Mất mạng: giữ nguyên giờ đã chốt, còn sau khi tải lại, gửi lại đúng giờ đó
    fail.next = 1;
    await action('ĐÃ ĐẾN TRẠM DỪNG').click();
    await confirm();
    await dialog().getByText(/Mất kết nối mạng/).waitFor();
    const firstAttempt = calls.milestones.find(c => c.failed);
    await dialog().getByRole('button', { name: 'Hủy' }).click();
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await open('trip');
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await page.getByRole('button', { name: 'Gửi lại' }).click();
    await action('HOÀN THÀNH CHẶNG').waitFor();
    assert.equal(calls.milestones.at(-1).occurredAt, firstAttempt.occurredAt, 'gửi lại đúng giờ đã chốt');
    assert.equal(calls.milestones.at(-1).milestoneType, 'ARRIVED_AT_STOP');
    await action('HOÀN THÀNH CHẶNG').click();
    await confirm();
    await action('XÁC NHẬN XUẤT PHÁT').waitFor();
    assert.equal(calls.complete.length, 1);

    // 4. Báo sự cố: nút trên header mở ?view=incident (tạm dùng IncidentDialog), xong quay về trip
    await reportButton().click();
    await dialog().waitFor();
    assert.match(page.url(), /view=incident$/);
    await heading('Báo cáo sự cố').waitFor();
    assert.equal(await page.locator('.drs-sidebar nav button[aria-current=page]').innerText(), 'Báo cáo sự cố');
    await dialog().getByRole('button', { name: 'Y tế ngựa' }).click();
    await dialog().getByPlaceholder(/Chuyện gì đang xảy ra/).fill('Ngựa đau bụng, đổ mồ hôi');
    await dialog().getByRole('button', { name: 'Gửi báo sự cố' }).click();
    await dialog().getByText(/chọn con ngựa bị ảnh hưởng/).waitFor();
    assert.equal(calls.incidents.length, 0, 'chưa gửi khi thiếu ngựa');
    await pick('Con ngựa liên quan', 'Bạch Mã');
    await page.screenshot({ path: 'test-results/driver-incident-desktop.png' });
    await dialog().getByRole('button', { name: 'Gửi báo sự cố' }).click();
    await page.getByText(/Đã báo sự cố KHẨN/).waitFor();
    assert.match(page.url(), /view=trip$/);
    assert.equal(calls.incidents.length, 1);
    assert.ok(/HORSE_MEDICAL/.test(calls.incidents[0]));
    // Mục "Báo cáo sự cố" trên sidebar cũng mở hộp thoại; đóng thì về trip
    await page.locator('.drs-sidebar nav button', { hasText: 'Báo cáo sự cố' }).click();
    await dialog().waitFor();
    await dialog().getByRole('button', { name: /Hủy|Đóng/ }).first().click();
    await heading('Chuyến đang chạy').waitFor();

    // 5. 409: chặng đã bị cập nhật ở nơi khác → báo và tải lại dữ liệu mới, không gửi lại
    conflict.next = 1;
    conflict.apply = () => { const l = trips[100].legs[1]; l.status = 'MOVING'; mark(l, 'DEPARTED', iso(0)); };
    await action('XÁC NHẬN XUẤT PHÁT').click();
    await confirm();
    await page.getByText('Trạng thái chặng đã thay đổi. Đã tải lại dữ liệu mới nhất.').waitFor();
    await action('ĐÃ ĐẾN TRẠM DỪNG').waitFor();
    await dialog().waitFor({ state: 'detached' }); // hộp thoại đóng sau 409

    // Các chặng còn lại: đến, hoàn thành; chặng cuối là cửa khẩu: xuất phát, đến, thông quan, giao
    const steps = [
      ['ĐÃ ĐẾN TRẠM DỪNG', 'ARRIVED_AT_STOP', 'HOÀN THÀNH CHẶNG'], ['HOÀN THÀNH CHẶNG', null, 'XÁC NHẬN XUẤT PHÁT'],
      ['XÁC NHẬN XUẤT PHÁT', 'DEPARTED', 'ĐÃ ĐẾN ĐIỂM ĐÍCH'], ['ĐÃ ĐẾN ĐIỂM ĐÍCH', 'ARRIVED_AT_STOP', 'ĐÃ THÔNG QUAN'],
      ['ĐÃ THÔNG QUAN', 'CUSTOMS_CLEARED', 'ĐÃ GIAO NGỰA AN TOÀN'], ['ĐÃ GIAO NGỰA AN TOÀN', 'DELIVERED', null],
    ];
    for (const [label, expected, next] of steps) {
      await action(label).click();
      await confirm();
      if (next) await action(next).waitFor();
      else await page.getByText('Tất cả các chặng đã hoàn thành').first().waitFor();
      if (expected) assert.equal(calls.milestones.at(-1).milestoneType, expected);
    }
    assert.equal(calls.complete.length, 2);
    assert.equal(await page.locator('.drv-action').count(), 0);
    assert.equal(await page.locator('.drv-stops li.is-reached').count(), 4, 'mọi điểm dừng đã qua');
    await noOverflow('delivered');
    await page.screenshot({ path: 'test-results/driver-delivered-desktop.png', fullPage: true });

    // 6. Chuyến không còn vận chuyển: nút báo sự cố bị khóa
    await open('trip');
    assert.equal(await reportButton().isDisabled(), true);

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
