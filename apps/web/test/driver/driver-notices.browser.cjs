// Driver: thông báo nổi, panel chuông, realtime và polling (mục 9).
const { run } = require('./harness.cjs');

run('driver-notices', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;
  await page.clock.install(); // đồng hồ giả: các bước sau đẩy thời gian thay vì chờ thật
  trips[100].orderStatus = 'READY';
    trips['400'] = { orderCode: 'WDP-TEST-3', orderStatus: 'READY', customer: 'Khách Ba', dep: iso(-7200e3), legs: trips[200].legs.map(l => ({ ...l, id: '400' + l.id, status: 'NOT_STARTED' })) };
    extraIds.push('400');
  await open('trip'); // cần một trang thật trước khi đụng localStorage

    // 9. UI-2: thông báo nổi (một thẻ + "+N cảnh báo khác") + panel chuông gọn + realtime (socket giả qua móc dev) + polling khi mất kết nối
    let alertSeq = 0;
    const alertOf = (id, content, type = 'WEATHER') => ({ id, tripId: '400', alertType: type, content, sentBy: '4', sentByName: 'Điều phối', sentAt: iso(++alertSeq * 1000) });
    const socketAlert = a => page.evaluate(payload => window.__wdpRealtime.emit('tracking:alert', payload), { alertId: a.id, tripId: a.tripId, alertType: a.alertType, content: a.content, sentByName: a.sentByName, sentAt: a.sentAt });
    const alertCards = () => page.locator('.drv-toast.is-alert');
    const moreLink = () => page.locator('.drv-toast-more');
    const cardCount = n => page.waitForFunction(count => document.querySelectorAll('.drv-toast.is-alert').length === count, n);
    const closeAllCards = async () => {
      for (let i = 0; i < 12; i++) {
        const text = await alertCards().first().textContent({ timeout: 1000 }).catch(() => null);
        if (text === null) break;
        await alertCards().first().locator('.ant-notification-notice-close').evaluate(button => button.click());
        // Chờ thẻ đang đóng rời khỏi DOM (animation chạy theo đồng hồ giả): đẩy đồng hồ từng bước nhỏ
        for (let step = 0; step < 10; step++) {
          await page.clock.fastForward('00:01');
          await page.waitForTimeout(60);
          const now = await alertCards().first().textContent({ timeout: 500 }).catch(() => null);
          if (now !== text) break;
        }
      }
      await cardCount(0);
    };
    state.alerts = [alertOf('1', 'Mưa lớn trên tuyến'), alertOf('2', 'Kẹt xe 5 km trước cửa khẩu', 'TRAFFIC')];
    await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('alerts-closed')).forEach(key => localStorage.removeItem(key)));
    await open('trip');
    // Chỉ MỘT thẻ (cảnh báo mới nhất) + dòng "+1 cảnh báo khác"; thẻ gọn ~360px, nội dung tối đa 3 dòng
    await cardCount(1);
    assert.match(await alertCards().first().innerText(), /Cảnh báo giao thông[\s\S]*Kẹt xe 5 km[\s\S]*\d{2}:\d{2} · Điều phối[\s\S]*\+1 cảnh báo khác/);
    const box = await alertCards().first().boundingBox();
    assert.ok(box.width >= 340 && box.width <= 372, 'thẻ cảnh báo ~360px: ' + box.width);
    await page.clock.fastForward('00:30');
    assert.equal(await alertCards().count(), 1, 'cảnh báo không tự tắt');
    // Đóng thẻ đang hiện → hiện cảnh báo kế tiếp chưa đóng (không còn dòng "+N")
    await alertCards().first().locator('.ant-notification-notice-close').click();
    await page.waitForFunction(() => /Mưa lớn trên tuyến/.test(document.querySelector('.drv-toast.is-alert')?.textContent ?? ''));
    await page.clock.fastForward('00:01');
    await cardCount(1);
    assert.equal(await moreLink().count(), 0);
    // Mở lại trang: cảnh báo đã đóng không hiện lại
    await open('trip');
    await cardCount(1);
    await page.waitForTimeout(300);
    assert.match(await alertCards().first().innerText(), /Mưa lớn trên tuyến/);
    assert.equal(await alertCards().count(), 1, 'cảnh báo đã đóng không hiện lại sau khi mở lại trang');
    await closeAllCards();
    // 3 cảnh báo qua socket → chỉ 1 thẻ + "+2 cảnh báo khác"; cùng alertId 2 lần → vẫn 1 thẻ, không đếm đôi
    const three = [alertOf('10', 'Cảnh báo mười'), alertOf('11', 'Cảnh báo mười một', 'TRAFFIC'), alertOf('12', 'Cửa khẩu đóng sớm', 'BORDER')];
    for (const a of three) await socketAlert(a);
    await cardCount(1);
    assert.match(await alertCards().first().innerText(), /Cảnh báo cửa khẩu[\s\S]*Cửa khẩu đóng sớm[\s\S]*\+2 cảnh báo khác/);
    await socketAlert(three[2]);
    await socketAlert(three[1]);
    await page.waitForTimeout(300);
    assert.equal(await alertCards().count(), 1, 'cùng alertId 2 lần → 1 thẻ');
    assert.match(await moreLink().innerText(), /^\+2 cảnh báo khác$/);
    await page.screenshot({ path: 'test-results/driver-ui2-toasts.png' });
    // Bấm "+2 cảnh báo khác" → drawer có mục "Cảnh báo điều phối" liệt kê ĐỦ 3 cảnh báo chưa đóng (lấy từ hàng đợi, không phụ thuộc thông báo)
    await moreLink().evaluate(button => button.click());
    await page.clock.fastForward('00:01');
    await page.locator('.drv-alert-list').waitFor();
    assert.equal(await page.locator('.drv-alert-list li').count(), 3, 'đủ 3 cảnh báo chưa đóng');
    const listText = await page.locator('.drv-alert-list').innerText();
    for (const text of ['Cảnh báo mười', 'Cảnh báo mười một', 'Cửa khẩu đóng sớm', 'Điều phối']) assert.ok(listText.includes(text), 'thiếu ' + text);
    await page.screenshot({ path: 'test-results/driver-ui2-alert-list.png' });
    await page.clock.fastForward('00:02');
    await cardCount(0); // danh sách đang mở: thẻ nổi tạm ẩn để không che danh sách
    await page.getByRole('button', { name: 'Đóng cảnh báo: Cảnh báo mười một' }).evaluate(button => button.click());
    await page.waitForFunction(() => document.querySelectorAll('.drv-alert-list li').length === 2);
    await page.locator('.ant-drawer-close').click();
    await page.clock.fastForward('00:01');
    await page.locator('.drv-alert-list').waitFor({ state: 'hidden' });
    await cardCount(1);
    assert.match(await moreLink().innerText(), /^\+1 cảnh báo khác$/, 'đóng danh sách: thẻ nổi hiện lại, đã trừ cảnh báo vừa đóng');
    // Sự cố được tiếp nhận (tự tắt sau 8 giây) và thông báo mới làm badge chuông tăng
    await page.mouse.move(5, 5); // con trỏ nằm trên thẻ thì antd tạm dừng đếm giờ tự tắt
    await page.evaluate(() => window.__wdpRealtime.emit('tracking:incident_updated', { incidentId: '7', tripId: '400', status: 'ACKNOWLEDGED', handlingNote: null }));
    await page.getByText('Điều phối viên đã tiếp nhận sự cố #7').waitFor();
    await page.clock.fastForward('00:07');
    assert.equal(await page.getByText('Điều phối viên đã tiếp nhận sự cố #7').count(), 1, 'chưa tới 8 giây');
    await page.clock.fastForward('00:02');
    await page.clock.fastForward('00:02'); // animation rời đi chạy theo đồng hồ giả
    await page.getByText('Điều phối viên đã tiếp nhận sự cố #7').waitFor({ state: 'detached' });
    const long = 'Chuyến WDP-TEST-3 có cập nhật rất dài từ điều phối viên: '.repeat(6);
    state.notices.unshift({ id: '2', content: long, is_read: 0, created_at: new Date().toISOString() });
    state.notices.push({ id: '3', content: 'Cảnh báo thời tiết chuyến 400: Mưa lớn.', is_read: 0, event_type: 'TRIP_ALERT', related_type: 'TRIP', related_id: '400', created_at: iso(-60e3) });
    await page.evaluate(text => window.__wdpRealtime.emit('notification:new', { id: '2', content: text, createdAt: new Date().toISOString() }), long);
    await page.getByRole('button', { name: /^Thông báo, 2 chưa đọc/ }).waitFor();
    // Mất kết nối: tải lại cảnh báo mỗi 60 giây; kết nối lại: tải lại một lần
    await page.evaluate(() => window.__wdpRealtime.setConnected(true));
    await page.evaluate(() => window.__wdpRealtime.setConnected(false));
    state.alerts = [...three, alertOf('13', 'Đường ngập cục bộ')]; // 11 đã đóng ở trên: không hiện lại
    await page.clock.fastForward('00:50');
    assert.match(await alertCards().first().innerText(), /Cửa khẩu đóng sớm/, 'chưa tới 60 giây: chưa tải lại');
    await page.clock.fastForward('00:15');
    await page.waitForFunction(() => /Đường ngập cục bộ/.test(document.querySelector('.drv-toast.is-alert')?.textContent ?? ''));
    assert.equal(await alertCards().count(), 1, 'polling không tạo thẻ thứ hai');
    assert.match(await moreLink().innerText(), /^\+2 cảnh báo khác$/, 'polling không đếm trùng các cảnh báo đã có, không hiện lại cảnh báo đã đóng');
    state.alerts.push(alertOf('14', 'Thời tiết xấu phía trước'));
    await page.evaluate(() => window.__wdpRealtime.setConnected(true));
    await page.waitForFunction(() => /Thời tiết xấu phía trước/.test(document.querySelector('.drv-toast.is-alert')?.textContent ?? ''));
    assert.equal(await alertCards().count(), 1);
    assert.match(await moreLink().innerText(), /^\+3 cảnh báo khác$/);
    await closeAllCards();
    // Panel chuông (khung tài xế): không còn đầu trang/mô tả/3 ô thống kê; có tab, "Đánh dấu tất cả đã đọc", nút Làm mới nhỏ trên thanh tiêu đề
    await page.getByRole('button', { name: /^Thông báo, 3 chưa đọc/ }).click();
    await page.locator('.notification-center__item').first().waitFor();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.notification-center__summary, .notification-center__header').count(), 0, 'ẩn đầu trang + 3 ô thống kê');
    assert.equal(await page.getByText('TRUNG TÂM THÔNG BÁO').count(), 0);
    assert.equal(await page.getByText('Thông báo mới', { exact: true }).count(), 0, 'bỏ tiêu đề lặp "Thông báo mới"');
    await page.getByText(/^Tất cả \(\d+\)$/).waitFor();
    await page.getByText(/^Chưa đọc \(\d+\)$/).waitFor();
    await page.locator('.ant-drawer-header').getByRole('button', { name: 'Làm mới thông báo' }).waitFor();
    const noticeRows = await page.locator('.notification-center__item').evaluateAll(items => items.map(item => {
      const text = item.querySelector('.notification-center__text');
      const row = item.querySelector('.notification-center__row');
      const style = getComputedStyle(item);
      return {
        overflowX: text.scrollWidth > text.clientWidth + 1,
        lines: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)),
        fill: text.getBoundingClientRect().width / row.getBoundingClientRect().width,
        time: item.querySelector('time')?.innerText,
        unread: item.classList.contains('is-unread'),
        border: style.borderLeftWidth + ' ' + style.borderLeftColor,
        alert: /Cảnh báo thời tiết chuyến 400/.test(text.innerText),
      };
    }));
    assert.equal(noticeRows.length, 3);
    assert.ok(noticeRows.every(row => !row.overflowX && row.lines <= 2 && row.fill > 0.7), 'chữ không tràn, tối đa 2 dòng, chiếm hết chiều ngang: ' + JSON.stringify(noticeRows));
    assert.ok(noticeRows.every(row => /^(vừa xong|[1-9]\d* phút trước)$/.test(row.time)), 'thời gian tương đối');
    assert.equal(noticeRows.find(row => row.alert).border, '3px rgb(202, 138, 4)', 'viền trái cảnh báo màu vàng');
    assert.equal(noticeRows.find(row => !row.alert).border, '3px rgb(154, 168, 161)', 'viền trái thông báo khác trung tính');
    await page.screenshot({ path: 'test-results/driver-ui2-panel.png' });
    await page.locator('.notification-center__item', { hasText: 'Chuyến WDP-TEST-1 đã được phân công' }).locator('.notification-center__row').click();
    await page.waitForFunction(() => document.querySelectorAll('.notification-center__item.is-unread').length === 2);
    assert.equal(state.notices.find(n => n.id === '1').is_read, 1, 'bấm vào thông báo = đánh dấu đã đọc');
    assert.equal(await page.locator('.notification-center__item:not(.is-unread)').evaluate(item => getComputedStyle(item).borderLeftWidth), '0px', 'đã đọc: không viền trái');
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).click();
    await page.waitForFunction(() => !document.querySelector('.notification-center__item.is-unread'));
    assert.ok(state.notices.every(n => n.is_read === 1));
    assert.equal(await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }).count(), 0);
    await page.locator('.ant-drawer-close').click();
});
