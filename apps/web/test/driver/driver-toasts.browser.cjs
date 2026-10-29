// Thông báo nổi ↔ bản ghi thông báo: toast ở góc dưới phải, tắt (X) = đã đọc, bấm thân toast = mở bảng thông báo, badge chuông (ẩn khi 0, "9+" khi > 9).
const { run } = require('./harness.cjs');

run('driver-toasts', async h => {
  const { alertOf, assert, page, state, calls, iso, open, startTrip, checkInButton } = h;
  await page.clock.install();
  startTrip();
  state.notices = [];
  const weather = alertOf('1', 'Mưa lớn trên tuyến', 'WEATHER', true);
  const traffic = alertOf('2', 'Kẹt xe 5 km trước cửa khẩu', 'TRAFFIC', true);
  state.alerts = [weather, traffic];
  const cards = () => page.locator('.drv-toast.is-alert');
  const bell = () => page.getByRole('button', { name: /^Thông báo/ });
  const cardCount = n => page.waitForFunction(count => document.querySelectorAll('.drv-toast.is-alert').length === count, n);
  const closeFirst = async () => {
    await cards().first().locator('.ant-notification-notice-close').evaluate(button => button.click());
    await page.clock.fastForward('00:01');
  };
  await open('trip');
  await checkInButton().waitFor();

  // 1. Toast ở GÓC DƯỚI PHẢI, không che nút Báo cáo sự cố / chuông; chỉ một thẻ + "+1 cảnh báo khác"
  await cardCount(1);
  assert.match(await cards().first().innerText(), /Kẹt xe 5 km[\s\S]*\+1 cảnh báo khác/);
  const box = await cards().first().boundingBox();
  const viewport = page.viewportSize();
  assert.ok(box.y + box.height <= viewport.height && box.y > viewport.height / 2, `toast ở nửa dưới màn hình: y=${box.y}`);
  assert.ok(viewport.width - (box.x + box.width) <= 40 && box.x > viewport.width / 2, `toast sát mép phải: x=${box.x}`);
  const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  for (const target of [bell(), page.locator('.drv-header-actions').getByRole('button', { name: 'Báo cáo sự cố' })]) {
    assert.equal(overlaps(box, await target.boundingBox()), false, 'toast không che nút trên đầu trang');
  }

  // 2. Bảng thông báo có đủ bản ghi tương ứng với toast (không còn "Tất cả (0)"); badge đếm chưa đọc
  await page.getByRole('button', { name: 'Thông báo, 2 chưa đọc' }).waitFor();
  await bell().click();
  await page.getByText('Tất cả (2)').waitFor();
  await page.getByText('Chưa đọc (2)').waitFor();
  const panel = await page.locator('.notification-center__list').innerText();
  assert.ok(panel.includes('Mưa lớn trên tuyến') && panel.includes('Kẹt xe 5 km'), 'mỗi toast có một thông báo trong bảng');
  await page.locator('.ant-drawer-close').click();
  await page.clock.fastForward('00:01');

  // 3. Bấm X trên toast = đánh dấu đã đọc (API sẵn có), badge giảm ngay, toast kế tiếp hiện, không hiện lại sau khi tải lại trang
  await cardCount(1);
  await closeFirst();
  await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }).waitFor();
  assert.deepEqual(calls.read, [traffic.notificationId], 'POST /notifications/:id/read đúng thông báo của cảnh báo vừa tắt');
  await page.waitForFunction(() => /Mưa lớn trên tuyến/.test(document.querySelector('.drv-toast.is-alert')?.textContent ?? ''));
  assert.equal(await page.locator('.drv-toast-more').count(), 0, 'chỉ còn một cảnh báo chưa đọc');
  assert.equal(await page.locator('.ant-drawer-open').count(), 0, 'bấm X không mở bảng thông báo');
  await open('trip');
  await cardCount(1);
  assert.match(await cards().first().innerText(), /Mưa lớn trên tuyến/, 'cảnh báo đã đọc không hiện lại');

  // 4. Bấm thân toast = mở bảng thông báo và đánh dấu đã đọc thông báo đó
  await cards().first().locator('.ant-notification-notice-description').click();
  await page.locator('.ant-drawer-open').waitFor();
  await page.getByText('Chưa đọc (0)').waitFor();
  assert.deepEqual(calls.read, [traffic.notificationId, weather.notificationId]);
  await cardCount(0);
  assert.equal(await bell().getAttribute('aria-label'), 'Thông báo', 'hết chưa đọc: badge ẩn');
  await page.clock.fastForward('00:02'); // animation ẩn badge chạy theo đồng hồ giả
  await page.waitForFunction(() => ![...document.querySelectorAll('.ant-badge-count')].some(el => el.textContent?.trim()), null, { timeout: 5000 });
  await page.locator('.ant-drawer-close').click();
  await page.clock.fastForward('00:01');

  // 5. Cảnh báo không có thông báo tương ứng (cũ) thì không có toast
  state.alerts.push({ ...alertOf('3', 'Cảnh báo cũ không có thông báo'), notificationId: null, notificationRead: null });
  await page.evaluate(() => window.__wdpRealtime.emit('tracking:alert', { alertId: '3', tripId: '100', alertType: 'WEATHER', content: 'Cảnh báo cũ không có thông báo', sentByName: 'Điều phối', sentAt: new Date().toISOString() }));
  await page.clock.fastForward('00:02');
  assert.equal(await cards().count(), 0);

  // 6. Badge "9+" khi có hơn 9 thông báo chưa đọc
  state.notices = Array.from({ length: 12 }, (_, n) => ({ id: String(700 + n), content: `Thông báo ${n}`, is_read: 0, created_at: iso(-n * 60e3) }));
  await open('trip');
  await page.getByRole('button', { name: 'Thông báo, 12 chưa đọc' }).waitFor();
  assert.equal(await page.locator('.ant-badge-count').innerText(), '9+');

  // 7. Hai cảnh báo CÙNG nội dung = hai thông báo riêng: tắt một toast thì toast kia vẫn còn (không đọc nhầm cả hai)
  calls.read.length = 0;
  state.notices = [];
  const first = alertOf('21', 'Mưa lớn trên tuyến', 'WEATHER', true);
  const second = alertOf('22', 'Mưa lớn trên tuyến', 'WEATHER', true);
  assert.notEqual(first.notificationId, second.notificationId);
  state.alerts = [first, second];
  await open('trip');
  await cardCount(1);
  assert.match(await cards().first().innerText(), /Mưa lớn trên tuyến[\s\S]*\+1 cảnh báo khác/, 'hai cảnh báo cùng nội dung: một thẻ + "+1"');
  await page.getByRole('button', { name: 'Thông báo, 2 chưa đọc' }).waitFor();
  await closeFirst();
  await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }).waitFor();
  assert.deepEqual(calls.read, [second.notificationId], 'chỉ thông báo của cảnh báo mới nhất được đánh dấu đã đọc');
  await cardCount(1);
  assert.equal(await page.locator('.drv-toast-more').count(), 0, 'toast còn lại là cảnh báo kia, không còn "+N"');
  assert.equal(first.notificationRead, false, 'cảnh báo thứ nhất vẫn chưa đọc');
  await open('trip');
  await cardCount(1);
  await closeFirst();
  assert.deepEqual(calls.read, [second.notificationId, first.notificationId]);
  await cardCount(0);
});
