// Driver: khung D1 (READY), checklist, màn D1b (IN_TRANSIT), ghi chú hộ tống, chuyến chưa có mốc, chuyến sắp tới (mục 1, 2, 2b, 7, 8 của driver.browser.cjs cũ).
const { run } = require('./harness.cjs');

run('driver-trip', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;

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
    const log = (id, createdBy, note, at) => ({ id, horseId: '21', horseName: 'Bạch Mã', legId: '10', conditionStatus: 'STABLE', note, loggedAt: at, createdBy, createdByName: createdBy === 'test' ? 'Phan Thị Lan' : 'Lê Hộ Tống', createdByCrewRole: createdBy === 'test' ? 'DRIVER' : 'ESCORT', correctsLogId: null, attachments: [] });
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
});
