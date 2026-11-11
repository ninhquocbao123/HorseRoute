// Kiểm thử trình duyệt Flow 4 - Bước 5: Customer timeline, Coordinator/Manager/Specialist vận hành. API giả lập.
// Chạy: PLAYWRIGHT_PACKAGE=<đường dẫn playwright-core> node apps/web/test/ops.browser.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const web = path.resolve(__dirname, '..');
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
  const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
  const server = await createServer({ root: web, server: { host: '127.0.0.1', port: 5191, strictPort: true } });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const now = Date.now();
    const iso = ms => new Date(now + ms).toISOString();
    const H = 3600e3;

    const mkLeg = (id, seqNo, status, from, to, extra = {}) => ({
      id, seqNo, fromLocationId: '1', fromLocationName: from, toLocationId: '2', toLocationName: to, toLocationType: 'REST_STOP',
      vehicleId: '5', vehicleCode: 'XE-01', plannedDepartureAt: iso(-6 * H), plannedArrivalAt: iso(-1 * H), status,
      actualDepartureAt: null, actualArrivalAt: null, updatedAt: null, updatedByName: null, milestones: [], isOverdue: false, ...extra,
    });
    const state = {
      orderStatus: 'IN_TRANSIT',
      legs: [
        mkLeg('10', 1, 'COMPLETED', 'Kho HCM', 'Trạm Đồng Nai', {
          actualDepartureAt: iso(-6 * H), actualArrivalAt: iso(-4 * H), updatedAt: iso(-3 * H), updatedByName: 'Tài xế An',
          milestones: [{ id: '1', legId: '10', milestoneType: 'DEPARTED', occurredAt: iso(-6 * H), recordedBy: '5', recordedByName: 'Tài xế An' }, { id: '2', legId: '10', milestoneType: 'ARRIVED_AT_STOP', occurredAt: iso(-4 * H), recordedBy: '5', recordedByName: 'Tài xế An' }],
        }),
        mkLeg('11', 2, 'AT_STOP', 'Trạm Đồng Nai', 'Cửa khẩu', {
          toLocationType: 'BORDER', actualDepartureAt: iso(-3 * H), actualArrivalAt: iso(-90 * 60e3), updatedAt: iso(-90 * 60e3), updatedByName: 'Tài xế An', isOverdue: true,
          milestones: [{ id: '3', legId: '11', milestoneType: 'DEPARTED', occurredAt: iso(-3 * H), recordedBy: '5', recordedByName: 'Tài xế An' }, { id: '4', legId: '11', milestoneType: 'ARRIVED_AT_STOP', occurredAt: iso(-90 * 60e3), recordedBy: '5', recordedByName: 'Tài xế An' }],
        }),
      ],
      incidents: [
        { id: '701', tripId: '200', legId: '11', horseId: '21', horseName: 'Bạch Mã', incidentType: 'HORSE_MEDICAL', description: 'Ngựa đau bụng', urgency: 'HIGH', status: 'NEW', reportedBy: '5', reportedByName: 'Tài xế An', reportedAt: iso(-30 * 60e3), receivedBy: null, handlingNote: null, closedAt: null, attachments: [] },
        { id: '702', tripId: '200', legId: null, horseId: null, horseName: null, incidentType: 'LONG_TRAFFIC_JAM', description: 'Kẹt xe 40 phút', urgency: 'NORMAL', status: 'NEW', reportedBy: '5', reportedByName: 'Tài xế An', reportedAt: iso(-2 * H), receivedBy: null, handlingNote: null, closedAt: null, attachments: [] },
      ],
      alerts: [],
      logs: [{ id: '1', horseId: '21', horseName: 'Bạch Mã', legId: '11', conditionStatus: 'OFF_FEED', note: 'Bỏ ăn sáng', loggedAt: iso(-2 * H), createdBy: '5', createdByName: 'Tài xế An', correctsLogId: null, attachments: [] }],
    };
    const calls = { correct: [], incident: [], alert: [] };
    const timeline = () => ({
      tripId: '200', orderId: '100', orderCode: 'WDP-OPS-1', orderStatus: state.orderStatus, planStatus: 'APPROVED', plannedDepartureAt: iso(-6 * H), plannedArrivalAt: iso(2 * H),
      lastUpdatedAt: iso(-90 * 60e3), lastUpdatedByName: 'Tài xế An', legs: state.legs, horseLogs: state.logs, incidents: state.incidents, alerts: state.alerts,
    });
    const active = () => {
      const open = state.incidents.filter(i => i.status !== 'CLOSED');
      return {
        summary: { inTransit: 1, openIncidents: open.length, overdueTrips: 1 },
        items: [{
          tripId: '200', orderId: '100', orderCode: 'WDP-OPS-1', orderStatus: state.orderStatus, customerName: 'Khách Lan', plannedDepartureAt: iso(-6 * H), plannedArrivalAt: iso(2 * H),
          legCount: 2, completedLegs: 1, currentLeg: { seqNo: 2, fromLocationName: 'Trạm Đồng Nai', toLocationName: 'Cửa khẩu', status: 'AT_STOP' },
          openIncidents: open.length, highUrgencyOpenIncidents: open.filter(i => i.urgency === 'HIGH').length, isOverdue: true, lastUpdatedAt: iso(-90 * 60e3), lastUpdatedByName: 'Tài xế An',
        }],
      };
    };
    const customerLegs = state.legs.map(l => ({
      seqNo: l.seqNo, fromLocationName: l.fromLocationName, toLocationName: l.toLocationName, plannedDepartureAt: l.plannedDepartureAt, plannedArrivalAt: l.plannedArrivalAt,
      status: l.status, actualDepartureAt: l.actualDepartureAt, actualArrivalAt: l.actualArrivalAt,
      milestones: l.milestones.map(m => ({ milestoneType: m.milestoneType, occurredAt: m.occurredAt, recordedByName: m.recordedByName })),
      latestMilestone: l.milestones.at(-1)?.milestoneType ?? null, latestMilestoneAt: l.milestones.at(-1)?.occurredAt ?? null,
      lastUpdatedByName: l.updatedByName, lastUpdatedAt: l.updatedAt, isOverdue: l.isOverdue,
    }));

    const context = async (width, height = 900) => {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, isMobile: width < 600 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/v1/**', async route => {
        const request = route.request();
        const p = new URL(request.url()).pathname.replace('/api/v1', '');
        const method = request.method();
        if (p === '/notifications') return route.fulfill({ json: [] });
        if (p === '/orders') return route.fulfill({ json: { items: [{ id: '100', order_code: 'WDP-OPS-1', status: 'IN_TRANSIT', origin_country: 'VN', destination_country: 'SG' }, { id: '101', order_code: 'WDP-OPS-2', status: 'APPROVED', origin_country: 'VN', destination_country: 'TH' }], total: 2 } });
        if (p === '/tracking/orders/100/timeline') return route.fulfill({ json: { orderId: '100', orderCode: 'WDP-OPS-1', orderStatus: 'IN_TRANSIT', plannedDepartureAt: iso(-6 * H), plannedArrivalAt: iso(2 * H), lastUpdatedAt: iso(-90 * 60e3), lastUpdatedByName: 'Tài xế An', legs: customerLegs } });
        if (p === '/tracking/orders/101/timeline') return route.fulfill({ json: { orderId: '101', orderCode: 'WDP-OPS-2', orderStatus: 'APPROVED', plannedDepartureAt: null, plannedArrivalAt: null, lastUpdatedAt: null, lastUpdatedByName: null, legs: [] } });
        if (p === '/tracking/operations/active-trips') return route.fulfill({ json: active() });
        if (p === '/tracking/trips/200/timeline') return route.fulfill({ json: timeline() });
        const correct = /^\/tracking\/legs\/(\d+)\/correct$/.exec(p);
        if (correct && method === 'PATCH') {
          const body = request.postDataJSON();
          calls.correct.push({ legId: correct[1], ...body });
          state.legs.find(l => l.id === correct[1]).status = body.status;
          return route.fulfill({ json: { legId: correct[1], status: body.status, reason: body.reason, orderStatus: 'IN_TRANSIT' } });
        }
        const incident = /^\/tracking\/incidents\/(\d+)$/.exec(p);
        if (incident && method === 'PATCH') {
          const body = request.postDataJSON();
          calls.incident.push({ id: incident[1], ...body });
          const item = state.incidents.find(i => i.id === incident[1]);
          item.status = body.status;
          if (body.status === 'CLOSED') { item.handlingNote = body.handlingNote; item.closedAt = iso(0); }
          return route.fulfill({ json: item });
        }
        if (p === '/tracking/trips/200/alerts' && method === 'POST') {
          const body = request.postDataJSON();
          calls.alert.push(body);
          state.alerts.push({ id: '1', tripId: '200', alertType: body.alertType, content: body.content, sentBy: '4', sentByName: 'Điều phối Hà', sentAt: iso(0) });
          return route.fulfill({ status: 201, json: state.alerts[0] });
        }
        return route.fulfill({ status: 404, json: { message: 'unmocked ' + p } });
      });
      return { page, errors, close: () => ctx.close() };
    };
    const open = async (page, role, view) => {
      await page.goto(`http://127.0.0.1:5191/test/portal.html?role=${role}&view=${view}`);
      await page.waitForLoadState('networkidle');
    };
    const noOverflow = async (page, label) => {
      const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
      assert.ok(scroll <= inner, `${label}: ngang ${scroll} > ${inner}`);
    };
    const smallTargets = (page, selector) => page.evaluate(sel => {
      const root = document.querySelector(sel) || document;
      return [...root.querySelectorAll('button, select, input:not([type=file]), textarea')]
        .filter(el => el.offsetParent !== null)
        .map(el => ({ text: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40), h: Math.round(el.getBoundingClientRect().height) }))
        .filter(item => item.h < 44 && !/Đến nội dung chính/.test(item.text));
    }, selector);

    // ── A. Customer (điện thoại) ────────────────────────────────────────────
    {
      const c = await context(390, 844);
      await open(c.page, 'CUSTOMER', 'tracking');
      await c.page.getByRole('heading', { name: 'WDP-OPS-1' }).waitFor();
      assert.ok(await c.page.getByText(/Cập nhật lần cuối lúc .* bởi Tài xế An/).first().isVisible());
      assert.equal(await c.page.locator('.trk-step').count(), 2);
      assert.equal(await c.page.locator('.trk-step.is-done').count(), 1, 'chặng xong màu xanh');
      assert.equal(await c.page.locator('.trk-step.is-active').count(), 1, 'chặng đang đi màu cam');
      await c.page.getByText('Chậm so với dự kiến').waitFor();
      assert.ok(await c.page.getByText('Đã đến điểm dừng').first().isVisible());
      await noOverflow(c.page, 'customer timeline');
      assert.deepEqual(await smallTargets(c.page, '.portal-main'), [], 'customer: mục dưới 44px');
      await c.page.screenshot({ path: 'test-results/customer-timeline-390.png', fullPage: true });
      await c.page.locator('select').first().selectOption('101');
      await c.page.getByText(/Lịch trình chi tiết sẽ hiển thị sau khi kế hoạch/).waitFor();
      assert.equal(await c.page.locator('.trk-step').count(), 0);
      assert.deepEqual(c.errors, []);
      await c.close();
    }

    // ── B. Coordinator (máy tính) ───────────────────────────────────────────
    {
      const c = await context(1366, 900);
      const { page } = c;
      await open(page, 'COORDINATOR', 'operations');
      await page.getByRole('heading', { name: 'Chuyến đang vận hành' }).waitFor();
      const stats = await page.locator('.trk-stats strong').allInnerTexts();
      assert.deepEqual(stats, ['1', '2', '1']);
      await page.getByText('1 sự cố khẩn').waitFor();
      await page.getByText('Trễ hạn').first().waitFor();
      await page.getByRole('heading', { name: /WDP-OPS-1 · Chuyến #200/ }).waitFor();
      await page.screenshot({ path: 'test-results/coordinator-desktop.png', fullPage: true });

      // Hiệu chỉnh mốc: bắt buộc lý do
      await page.getByRole('button', { name: 'Hiệu chỉnh mốc' }).nth(1).click();
      await page.getByRole('dialog').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: 'Hoàn thành' }).click();
      await page.getByRole('button', { name: 'Lưu hiệu chỉnh' }).click();
      await page.getByText('Lý do hiệu chỉnh là bắt buộc.').waitFor();
      assert.equal(calls.correct.length, 0, 'không gửi khi thiếu lý do');
      await page.getByPlaceholder(/tài xế quên báo mốc/).fill('Đã thông quan, tài xế quên báo');
      await page.getByRole('button', { name: 'Lưu hiệu chỉnh' }).click();
      await page.getByText(/Đã hiệu chỉnh chặng 2/).waitFor();
      assert.deepEqual({ ...calls.correct[0], occurredAt: undefined }, { legId: '11', status: 'COMPLETED', reason: 'Đã thông quan, tài xế quên báo', occurredAt: undefined });
      assert.ok(Math.abs(Date.parse(calls.correct[0].occurredAt) - Date.now()) < 120e3);

      // Sự cố: tiếp nhận, đóng cần ghi chú
      await page.getByRole('tab', { name: /Sự cố hành trình/ }).click();
      await page.getByText('#701 · Y tế ngựa').waitFor();
      assert.equal(await page.locator('.trk-log-list > li').first().getAttribute('class'), 'is-urgent', 'sự cố khẩn lên đầu và nổi bật');
      await page.getByRole('button', { name: 'Tiếp nhận' }).first().click();
      await page.getByText('Đã tiếp nhận sự cố #701.').waitFor();
      assert.deepEqual(calls.incident[0], { id: '701', status: 'ACKNOWLEDGED' });
      await page.getByRole('button', { name: 'Đóng sự cố' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng sự cố' }).click();
      await page.getByText('Cần ghi hướng xử lý khi đóng sự cố.').waitFor();
      assert.equal(calls.incident.length, 1);
      await page.getByPlaceholder(/Đã làm gì để xử lý/).fill('Đã đưa ngựa tới thú y');
      await page.getByRole('dialog').getByRole('button', { name: 'Đóng sự cố' }).click();
      await page.getByText('Đã đóng sự cố #701.').waitFor();
      assert.deepEqual(calls.incident[1], { id: '701', status: 'CLOSED', handlingNote: 'Đã đưa ngựa tới thú y' });
      await page.getByText(/Đã xử lý lúc .*: Đã đưa ngựa tới thú y/).waitFor();

      // Cảnh báo thủ công
      await page.getByRole('tab', { name: /Cảnh báo/ }).click();
      await page.getByRole('button', { name: 'Gửi cảnh báo' }).click();
      await page.getByText('Chọn loại cảnh báo.').waitFor();
      await page.getByRole('button', { name: 'Thời tiết', exact: true }).click();
      await page.getByPlaceholder(/Mưa lớn trên QL1A/).fill('Mưa lớn trên QL1A, giảm tốc độ');
      await page.getByRole('button', { name: 'Gửi cảnh báo' }).click();
      await page.getByText('Đã phát cảnh báo tới tài xế, hộ tống và quản lý.').waitFor();
      assert.deepEqual(calls.alert[0], { alertType: 'WEATHER', content: 'Mưa lớn trên QL1A, giảm tốc độ' });
      await page.getByText('Gửi bởi Điều phối Hà').waitFor();

      await page.getByRole('tab', { name: /Nhật ký ngựa/ }).click();
      await page.getByText('Bỏ ăn sáng').waitFor();
      assert.deepEqual(c.errors, []);
      await c.close();
    }

    // ── C. Coordinator (điện thoại) ─────────────────────────────────────────
    {
      const c = await context(390, 844);
      await open(c.page, 'COORDINATOR', 'operations');
      await c.page.getByRole('heading', { name: 'Chuyến đang vận hành' }).waitFor();
      await noOverflow(c.page, 'coordinator mobile');
      assert.deepEqual(await smallTargets(c.page, '.portal-main'), [], 'coordinator mobile: mục dưới 44px');
      await c.page.getByRole('button', { name: 'Hiệu chỉnh mốc' }).first().click();
      await c.page.getByRole('dialog').waitFor();
      await noOverflow(c.page, 'correct dialog');
      assert.deepEqual(await smallTargets(c.page, 'dialog'), [], 'dialog hiệu chỉnh: mục dưới 44px');
      await c.page.screenshot({ path: 'test-results/coordinator-correct-390.png' });
      assert.deepEqual(c.errors, []);
      await c.close();
    }

    // ── D. Manager: dashboard, có hiệu chỉnh nhưng không xử lý sự cố/phát cảnh báo ──
    {
      state.incidents[0].status = 'NEW';
      state.incidents[0].closedAt = null;
      const c = await context(1366, 900);
      const { page } = c;
      await open(page, 'MANAGER', 'operations');
      await page.getByRole('heading', { name: 'Chuyến đang vận hành' }).waitFor();
      await page.getByText('Chuyến trễ hạn').waitFor();
      await page.getByRole('heading', { name: /WDP-OPS-1 · Chuyến #200/ }).waitFor();
      assert.ok(await page.getByRole('button', { name: 'Hiệu chỉnh mốc' }).count() > 0, 'manager hiệu chỉnh được');
      await page.getByRole('tab', { name: /Sự cố hành trình/ }).click();
      await page.getByText('#701 · Y tế ngựa').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Tiếp nhận' }).count(), 0, 'manager không tiếp nhận sự cố');
      assert.equal(await page.getByRole('button', { name: 'Đóng sự cố' }).count(), 0);
      await page.getByRole('tab', { name: /Cảnh báo/ }).click();
      assert.equal(await page.getByRole('button', { name: 'Gửi cảnh báo' }).count(), 0, 'manager không phát cảnh báo');
      await page.getByRole('tab', { name: /Nhật ký ngựa/ }).click();
      await page.getByText('Bỏ ăn sáng').waitFor();
      await page.screenshot({ path: 'test-results/manager-desktop.png', fullPage: true });
      assert.deepEqual(c.errors, []);
      await c.close();
    }

    // ── E. Specialist: chỉ đọc, không thấy sự cố ─────────────────────────────
    {
      const c = await context(1366, 900);
      const { page } = c;
      await open(page, 'SPECIALIST', 'tracking');
      await page.getByRole('heading', { name: 'Chuyến đang vận hành' }).waitFor();
      await page.getByText('Bạn xem ở chế độ chỉ đọc.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Hiệu chỉnh mốc' }).count(), 0);
      assert.equal(await page.getByRole('tab', { name: /Sự cố hành trình/ }).count(), 0, 'specialist không thấy tab sự cố');
      assert.ok(await page.getByRole('tab', { name: /Nhật ký ngựa/ }).isVisible());
      assert.deepEqual(c.errors, []);
      await c.close();
    }

    console.log('ops.browser: OK');
  } finally {
    await browser?.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
