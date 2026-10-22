// Kiểm thử trình duyệt giao diện Driver (Flow 4) trên web desktop 1440px với API giả lập.
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
    const leg = (id, seqNo, status, from, to, type = 'REST_STOP') => ({
      id, seqNo, fromLocationId: '1', fromLocationName: from, toLocationId: '2', toLocationName: to, toLocationType: type,
      vehicleId: '5', vehicleCode: 'XE-01', plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(3600e3), status,
      actualDepartureAt: null, actualArrivalAt: null, updatedAt: null, updatedByName: null, milestones: [],
    });
    const state = {
      orderStatus: 'READY',
      legs: [leg('10', 1, 'NOT_STARTED', 'Kho HCM', 'Trạm Đồng Nai'), leg('11', 2, 'NOT_STARTED', 'Trạm Đồng Nai', 'Cửa khẩu', 'BORDER')],
      logs: [], incidents: [],
    };
    const calls = { milestones: [], complete: [], horseLogs: [], incidents: [] };
    const fail = { next: 0 };
    const horses = [{ id: '21', name: 'Bạch Mã', passportNo: 'PP-1', orderStatus: 'NORMAL' }, { id: '22', name: 'Hắc Mã', passportNo: 'PP-2', orderStatus: 'NORMAL' }];
    const summary = () => ({ id: '100', orderId: '50', orderCode: 'WDP-TEST-1', orderStatus: state.orderStatus, planStatus: 'APPROVED', plannedDepartureAt: iso(-3600e3), plannedArrivalAt: iso(7200e3), crewRole: 'DRIVER', legs: state.legs });
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
      if (p === '/notifications') return route.fulfill({ json: [] });
      if (p === '/tracking/driver/trips') return route.fulfill({ json: [summary()] });
      if (p === '/tracking/trips/100' && method === 'GET') return route.fulfill({ json: { ...summary(), horses, legs: state.legs } });
      if (p === '/tracking/trips/100/alerts') return route.fulfill({ json: [{ id: '1', tripId: '100', alertType: 'WEATHER', content: 'Mưa lớn trên tuyến', sentBy: '4', sentByName: 'Điều phối', sentAt: iso(-60e3) }] });
      if (p === '/tracking/trips/100/horse-logs') return route.fulfill({ json: state.logs });
      if (p === '/tracking/trips/100/incidents' && method === 'GET') return route.fulfill({ json: state.incidents });
      const milestone = /^\/tracking\/legs\/(\d+)\/milestones$/.exec(p);
      if (milestone && method === 'POST') {
        const body = request.postDataJSON();
        calls.milestones.push(body);
        const l = state.legs.find(x => x.id === milestone[1]);
        if (body.milestoneType === 'DEPARTED') { l.status = 'MOVING'; l.actualDepartureAt = body.occurredAt; state.orderStatus = 'IN_TRANSIT'; }
        if (body.milestoneType === 'ARRIVED_AT_STOP') { l.status = 'AT_STOP'; l.actualArrivalAt = body.occurredAt; }
        if (body.milestoneType === 'DELIVERED') { l.status = 'COMPLETED'; state.orderStatus = 'DELIVERED'; }
        mark(l, body.milestoneType, body.occurredAt);
        return route.fulfill({ status: 201, json: { milestoneId: '1', legId: l.id, milestoneType: body.milestoneType, legStatus: l.status, orderStatus: state.orderStatus } });
      }
      const complete = /^\/tracking\/legs\/(\d+)\/complete$/.exec(p);
      if (complete && method === 'POST') {
        calls.complete.push(request.postDataJSON());
        state.legs.find(x => x.id === complete[1]).status = 'COMPLETED';
        return route.fulfill({ json: { legId: complete[1], status: 'COMPLETED' } });
      }
      if (/^\/tracking\/legs\/\d+\/horse-logs$/.test(p) && method === 'POST') {
        calls.horseLogs.push(request.postData() || '');
        state.logs.push({ id: '1', horseId: '21', horseName: 'Bạch Mã', legId: '10', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn sáng', loggedAt: iso(0), createdBy: '1', createdByName: 'Tài xế', correctsLogId: null, attachments: [] });
        return route.fulfill({ status: 201, json: state.logs[state.logs.length - 1] });
      }
      if (p === '/tracking/trips/100/incidents' && method === 'POST') {
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
    // Bấm xác nhận rồi đợi hộp thoại đóng (thành công) hoặc vẫn mở (lỗi mạng).
    const confirm = () => dialog().getByRole('button', { name: 'Xác nhận', exact: true }).click();
    const pick = async (label, option) => {
      await page.getByLabel(label, { exact: true }).click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option', { hasText: option }).click();
    };
    const photo = { name: 'ngua.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]) };

    // 1. Tổng quan: thống kê, danh sách chuyến bên trái, chi tiết chuyến bên phải
    await open('assignments');
    await page.getByRole('heading', { name: 'WDP-TEST-1' }).waitFor();
    await page.getByText('Kho HCM → Trạm Đồng Nai → Cửa khẩu').waitFor();
    assert.equal(await page.locator('.drv-facts dd').nth(1).innerText(), '2', 'số ngựa');
    await page.getByText('Cảnh báo từ điều phối viên').waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Tổng quan chuyến' }).getAttribute('aria-selected'), 'true');
    await page.getByText('Việc cần làm tiếp theo').waitFor();
    await page.getByRole('cell', { name: 'Bạch Mã' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Báo sự cố khẩn cấp' }).isDisabled(), false, 'READY: vẫn được báo sự cố (5.4)');
    await noOverflow('assignments');
    await page.screenshot({ path: 'test-results/driver-overview-desktop.png', fullPage: true });

    // 2. Ghi mốc: một nút hành động (màu theo loại mốc), xác nhận trong hộp thoại
    await page.getByRole('button', { name: 'Mở mốc hành trình' }).click();
    await page.getByRole('heading', { name: /Kho HCM/ }).waitFor();
    assert.equal(await page.locator('.drv-action').count(), 1, 'chỉ một nút hành động chính');
    await action('XÁC NHẬN XUẤT PHÁT').click();
    await dialog().waitFor();
    await page.screenshot({ path: 'test-results/driver-confirm-desktop.png' });
    await confirm();
    await action('ĐÃ ĐẾN TRẠM DỪNG').waitFor();
    assert.equal(calls.milestones.at(-1).milestoneType, 'DEPARTED');
    assert.ok(Math.abs(Date.parse(calls.milestones.at(-1).occurredAt) - Date.now()) < 60e3, 'giờ mặc định là hiện tại');

    // 3. Mất mạng: giữ nguyên giờ đã chốt và gửi lại đúng giờ đó
    fail.next = 1;
    await action('ĐÃ ĐẾN TRẠM DỪNG').click();
    await confirm();
    await dialog().getByText(/Mất kết nối mạng/).waitFor();
    const firstAttempt = calls.milestones.find(c => c.failed);
    await dialog().getByRole('button', { name: 'Hủy' }).click();
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await open('milestones');
    await page.getByText('Có thao tác chưa gửi được').waitFor();
    await page.getByRole('button', { name: 'Gửi lại' }).click();
    await action('HOÀN THÀNH CHẶNG').waitFor();
    assert.equal(calls.milestones.at(-1).occurredAt, firstAttempt.occurredAt, 'gửi lại đúng giờ đã chốt');
    assert.equal(calls.milestones.at(-1).milestoneType, 'ARRIVED_AT_STOP');

    // Chặng trung gian → "Hoàn thành chặng" → chặng 2 là cửa khẩu: xuất phát, đến, thông quan, giao
    await action('HOÀN THÀNH CHẶNG').click();
    await confirm();
    await action('XÁC NHẬN XUẤT PHÁT').waitFor();
    assert.equal(calls.complete.length, 1);
    const steps = [['XÁC NHẬN XUẤT PHÁT', 'DEPARTED', 'ĐÃ ĐẾN ĐIỂM ĐÍCH'], ['ĐÃ ĐẾN ĐIỂM ĐÍCH', 'ARRIVED_AT_STOP', 'ĐÃ THÔNG QUAN'], ['ĐÃ THÔNG QUAN', 'CUSTOMS_CLEARED', 'ĐÃ GIAO NGỰA AN TOÀN'], ['ĐÃ GIAO NGỰA AN TOÀN', 'DELIVERED', null]];
    for (const [label, expected, next] of steps) {
      await action(label).click();
      await confirm();
      if (next) await action(next).waitFor();
      else await page.getByText('Tất cả các chặng đã hoàn thành').first().waitFor();
      assert.equal(calls.milestones.at(-1).milestoneType, expected);
    }
    assert.equal(await page.locator('.drv-action').count(), 0);
    await noOverflow('milestones');
    await page.screenshot({ path: 'test-results/driver-milestones-done-desktop.png', fullPage: true });

    // 4. Nhật ký ngựa: lỗi mạng không mất dữ liệu, nháp còn sau khi tải lại
    state.orderStatus = 'IN_TRANSIT';
    state.legs[1].status = 'MOVING';
    await open('horse-logs');
    await page.getByRole('heading', { name: 'Ghi nhật ký sức khỏe ngựa' }).waitFor();
    await pick('Con ngựa', 'Bạch Mã');
    await page.getByRole('button', { name: /Bỏ ăn/ }).click();
    await page.getByPlaceholder(/Biểu hiện/).fill('Bỏ ăn sáng');
    await page.locator('input[type=file]').setInputFiles(photo);
    await page.getByRole('button', { name: /Thêm ảnh \(1\/3\)/ }).waitFor();
    assert.equal(await page.locator('input[type=file]').isVisible(), false, 'ô chọn tệp gốc phải được ẩn');
    await noOverflow('horse-log form');
    await page.screenshot({ path: 'test-results/driver-horse-log-desktop.png', fullPage: true });
    fail.next = 1;
    await page.getByRole('button', { name: 'Gửi nhật ký' }).click();
    await page.getByText(/Mất kết nối mạng/).waitFor();
    assert.equal(await page.getByPlaceholder(/Biểu hiện/).inputValue(), 'Bỏ ăn sáng', 'ghi chú còn nguyên sau lỗi mạng');
    await page.reload(); await page.waitForLoadState('networkidle');
    assert.equal(await page.getByPlaceholder(/Biểu hiện/).inputValue(), 'Bỏ ăn sáng', 'nháp còn sau khi tải lại');
    await page.locator('input[type=file]').setInputFiles(photo);
    await page.getByRole('button', { name: 'Gửi nhật ký' }).click();
    await page.getByText('Đã lưu nhật ký ngựa.').waitFor();
    assert.equal(calls.horseLogs.length, 1);
    assert.ok(/name="horseId"[\s\S]*21/.test(calls.horseLogs[0]) && /OFF_FEED/.test(calls.horseLogs[0]) && /name="photos"/.test(calls.horseLogs[0]), 'multipart có ngựa, tình trạng, ảnh');
    assert.equal(await page.getByPlaceholder(/Biểu hiện/).inputValue(), '', 'nháp được xóa sau khi gửi thành công');

    // 5. Báo sự cố khẩn cấp
    await page.getByRole('button', { name: 'Báo sự cố khẩn cấp' }).click();
    await dialog().waitFor();
    await dialog().getByRole('button', { name: 'Y tế ngựa' }).click();
    await dialog().getByPlaceholder(/Chuyện gì đang xảy ra/).fill('Ngựa đau bụng, đổ mồ hôi');
    await dialog().getByRole('button', { name: 'Gửi báo sự cố' }).click();
    await dialog().getByText(/chọn con ngựa bị ảnh hưởng/).waitFor();
    assert.equal(calls.incidents.length, 0, 'chưa gửi khi thiếu ngựa');
    await pick('Con ngựa liên quan', 'Bạch Mã');
    await page.screenshot({ path: 'test-results/driver-incident-desktop.png' });
    await dialog().getByRole('button', { name: 'Gửi báo sự cố' }).click();
    await page.getByText(/Đã báo sự cố KHẨN/).waitFor();
    assert.equal(calls.incidents.length, 1);
    assert.ok(/HORSE_MEDICAL/.test(calls.incidents[0]));

    // 6. Chuyến không còn vận chuyển: nút khẩn cấp bị khóa
    state.orderStatus = 'DELIVERED';
    await open('assignments');
    assert.equal(await page.getByRole('button', { name: 'Báo sự cố khẩn cấp' }).isDisabled(), true);

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
