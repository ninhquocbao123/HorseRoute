// Driver: lịch sử giao hàng và chi tiết chỉ xem (mục 6, 6b).
const { run } = require('./harness.cjs');

run('driver-history', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;
  await page.clock.install(); // đồng hồ giả: các bước sau đẩy thời gian thay vì chờ thật
  trips[100].orderStatus = 'DELIVERED';
  trips[100].legs.forEach(l => { l.status = 'COMPLETED'; l.actualDepartureAt = iso(-3600e3); l.actualArrivalAt = iso(-1800e3); });
  state.incidents.push(incidentOf(9), incidentOf(10));
  await open('history');

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
});
