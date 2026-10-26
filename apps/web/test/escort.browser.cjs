// Escort: khung hộ tống + màn E1 "Quản lý ngựa" (Figma 57:5425) trên web desktop, API giả lập (dùng chung harness với test tài xế).
// Chạy: PLAYWRIGHT_PACKAGE=<đường dẫn playwright> WEB_TEST_PORT=5181 node apps/web/test/escort.browser.cjs
const { run } = require('./driver/harness.cjs');

run('escort.browser', async h => {
  const { assert, page, trips, state, calls, crew, iso, open, noOverflow, heading, pick, fail, photo } = h;
  await page.clock.install(); // đồng hồ giả bắt đầu từ giờ thật (pick() đẩy đồng hồ cho animation của dropdown)
  crew.role = 'ESCORT';
  trips[100].orderStatus = 'IN_TRANSIT';
  Object.assign(trips[100].legs[0], { status: 'MOVING', actualDepartureAt: iso(-3600e3) });

  const min = n => iso(-n * 60e3);
  const care = (id, horseId, activityType, extra, at) => ({
    id, tripId: '100', legId: '10', horseId, horseName: horseId === '21' ? 'Bạch Mã' : horseId === '22' ? 'Hắc Mã' : null, activityType,
    feedDescription: null, amountLiters: null, durationMinutes: null, note: null, performedAt: at, createdBy: '7', createdByName: 'Hộ Tống',
    createdAt: at, correctsActivityId: null, ...extra,
  });
  // Hôm nay: 5 phút trở lại (không vượt qua nửa đêm); bữa của Hắc Mã hôm qua nằm ngoài "Hôm nay" nhưng vẫn là "lần cho ăn gần nhất".
  state.care = [
    care('801', '21', 'FEED', { feedDescription: 'Cỏ khô 4 kg + yến mạch 1,5 kg' }, min(3)),
    care('802', '21', 'WATER', { amountLiters: 10 }, min(2)),
    care('803', '22', 'WATER', { amountLiters: 8 }, min(2)),
    care('804', null, 'REST', { durationMinutes: 20 }, min(1)),
    care('805', '22', 'FEED', { feedDescription: 'Cỏ khô 3 kg' }, iso(-26 * 3600e3)),
  ];
  const report = (id, horseId, horseName, conditionStatus, reportStatus, at) => ({
    id, horseId, horseName, legId: '10', conditionStatus, note: null, loggedAt: at, createdBy: 'test', createdByName: 'Phan Thị Lan', createdByCrewRole: 'ESCORT',
    correctsLogId: null, bodyTempC: null, heartRateBpm: null, appetite: null, customerNote: null, reportStatus, sendToCustomer: true, sentAt: at, customerViewedAt: null, attachments: [],
  });
  state.horseLogs = [report('601', '21', 'Bạch Mã', 'OFF_FEED', 'SENT', min(60)), report('602', '22', 'Hắc Mã', 'STABLE', 'DRAFT', min(10))];

  const card = id => page.locator(`.esc-horse[data-horse-id="${id}"]`);
  const toast = text => page.locator('.drv-toast', { hasText: text });
  const save = () => page.getByRole('button', { name: 'Lưu nhật ký' });
  const todayValue = label => page.locator('.esc-today dl > div', { hasText: label }).locator('dd');
  const field = label => page.getByLabel(label, { exact: true });
  const lastCare = () => calls.care.at(-1);

  // 1. Khung hộ tống theo crewRole của chuyến đang hoạt động; view của tài xế quy về `care`
  await open('trip');
  await heading('Quản lý ngựa').waitFor();
  assert.match(page.url(), /view=care$/, 'view=trip của hộ tống quy về care');
  assert.deepEqual(await page.locator('.drs-sidebar nav button').allInnerTexts(), ['Quản lý ngựa'], 'sidebar hộ tống chỉ có Quản lý ngựa (E2 làm ở Bước 5)');
  assert.equal(await page.locator('.drs-sidebar nav button[aria-current=page]').innerText(), 'Quản lý ngựa');
  await page.locator('.drs-role', { hasText: 'ESCORT · Hộ tống' }).waitFor();
  assert.equal(await page.locator('.drs-search').count(), 0, 'hộ tống không có ô tìm kiếm');
  assert.equal(await page.getByRole('button', { name: 'Báo sự cố' }).isEnabled(), true, 'nút Báo sự cố trên topbar');
  await open('history');
  await heading('Quản lý ngựa').waitFor();
  assert.match(page.url(), /view=care$/, 'view=history của tài xế quy về care');

  // 2. Đầu trang
  await page.getByText('Nhật ký cho ăn, uống nước và nghỉ chân · chuyến WDP-TEST-1').waitFor();
  assert.equal(await page.locator('.drv-view-only, .drv-header').count(), 0, 'không còn thẻ chuyến chỉ xem của tài xế');
  assert.equal(await page.getByText(/Bạn là hộ tống của chuyến này/).count(), 0);

  // 3. Thẻ ngựa: giống · tuổi, trạng thái báo cáo đã gửi mới nhất, lần cho ăn gần nhất (toàn chuyến)
  await card('21').waitFor();
  assert.equal(await page.locator('.esc-horse').count(), 2);
  assert.match(await card('21').innerText(), /Bạch Mã[\s\S]*Thoroughbred · 5 tuổi[\s\S]*Bỏ ăn[\s\S]*Lần cho ăn gần nhất: [2-5] phút trước/);
  assert.match(await card('22').innerText(), /Hắc Mã[\s\S]*Arabian[\s\S]*Chưa có báo cáo[\s\S]*Lần cho ăn gần nhất: 1 ngày trước/, 'nháp không tính; bữa hôm qua vẫn là lần gần nhất');
  assert.equal(await card('21').locator('.esc-row').count(), 2, 'Bạch Mã: cho ăn + uống nước hôm nay');
  assert.equal(await card('22').locator('.esc-row').count(), 1, 'Hắc Mã: chỉ uống nước hôm nay');
  assert.match(await card('21').locator('.esc-row').first().innerText(), /Uống nước[\s\S]*10 L/, 'mới nhất trên');
  assert.equal(await page.getByText('Bữa tiếp theo').count() + await page.getByText('Sắp tới').count() + await page.getByRole('button', { name: 'Xác nhận' }).count(), 0, 'không có lịch / nút Xác nhận');

  // 4. Hôm nay: tổng thực tế, không mục tiêu
  assert.equal(await todayValue('Nước uống').innerText(), '18 L');
  assert.equal(await todayValue('Bữa ăn').innerText(), '1 bữa');
  assert.equal(await todayValue('Lần nghỉ chân').innerText(), '1 lần · 20 phút');
  assert.equal(await page.locator('.esc-today').innerText().then(text => text.includes('/')), false, 'không có mẫu số mục tiêu');

  // 5. Lịch sử hoạt động trong chuyến (mới nhất trước, gồm nghỉ chân cả đoàn)
  const history = page.locator('.esc-history .esc-row');
  assert.equal(await history.count(), 5);
  assert.match(await history.nth(0).innerText(), /Nghỉ chân · Cả đoàn[\s\S]*20 phút/);
  assert.match(await history.nth(4).innerText(), /Cho ăn · Hắc Mã[\s\S]*Cỏ khô 3 kg/);
  assert.equal(await page.getByRole('button', { name: /Xóa/ }).count(), 0, 'không có nút xóa (6.3)');
  await page.screenshot({ path: 'test-results/escort-e1.png', fullPage: true });

  // 6. Realtime (móc dev của socket dùng chung): khách đã xem báo cáo → toast; thông báo mới → chuông tăng
  await page.getByRole('button', { name: /^Thông báo, 1 chưa đọc/ }).waitFor();
  await page.evaluate(() => window.__wdpRealtime.emit('tracking:horse_report_viewed', { reportId: '601', viewedAt: new Date().toISOString() }));
  await toast('Khách đã xem báo cáo sức khỏe của Bạch Mã').waitFor();
  state.notices.unshift({ id: '9', content: 'Khách đã xem báo cáo Bạch Mã', is_read: 0, created_at: new Date().toISOString() });
  await page.evaluate(() => window.__wdpRealtime.emit('notification:new', { id: '9', content: 'Khách đã xem báo cáo Bạch Mã', createdAt: new Date().toISOString(), eventType: 'HORSE_REPORT_VIEWED' }));
  await page.getByRole('button', { name: /^Thông báo, 2 chưa đọc/ }).waitFor();

  // 7. Nháp form còn sau khi tải lại; mất mạng giữ nguyên dữ liệu
  await pick('Ngựa', 'Bạch Mã');
  await field('Khẩu phần').fill('Nháp: cỏ khô 2 kg');
  await open('care');
  await card('21').waitFor();
  assert.equal(await field('Khẩu phần').inputValue(), 'Nháp: cỏ khô 2 kg', 'nháp còn sau khi tải lại');
  fail.next = 1;
  await save().click();
  await page.getByText(/Mất kết nối mạng/).waitFor();
  assert.equal(await field('Khẩu phần').inputValue(), 'Nháp: cỏ khô 2 kg', 'lỗi mạng: giữ nguyên form');
  assert.equal(calls.care.length, 0, 'không có yêu cầu nào tới server');

  // 8. Ghi cho ăn: thiếu khẩu phần / ngựa → lỗi từng ô, không gửi; đủ → POST đúng body
  await field('Khẩu phần').fill('');
  await save().click();
  await page.getByText('Nhập khẩu phần đã cho ăn.').waitFor();
  assert.equal(calls.care.length, 0);
  await pick('Ngựa', 'Hắc Mã');
  await field('Khẩu phần').fill('Cỏ khô 3 kg + cà rốt');
  await save().click();
  await toast('Đã ghi nhận hoạt động.').waitFor();
  assert.deepEqual({ ...lastCare(), performedAt: undefined }, { activityType: 'FEED', horseId: '22', performedAt: undefined, note: null, feedDescription: 'Cỏ khô 3 kg + cà rốt' });
  assert.ok(Math.abs(Date.parse(lastCare().performedAt) - Date.now()) < 120e3, 'giờ mặc định là hiện tại');
  await page.waitForFunction(() => document.querySelector('.esc-horse[data-horse-id="22"]')?.innerText.includes('Cỏ khô 3 kg + cà rốt'));
  assert.equal(await todayValue('Bữa ăn').innerText(), '2 bữa');
  assert.match(await card('22').innerText(), /Lần cho ăn gần nhất: vừa xong/);

  // 9. Ghi uống nước: 0 / 200,1 / hai chữ số thập phân → lỗi; 7,5 → POST
  await pick('Hoạt động', 'Uống nước');
  for (const [text, message] of [['0', 'Lượng nước phải từ 0,1 đến 200 lít.'], ['200,1', 'Lượng nước phải từ 0,1 đến 200 lít.'], ['2,55', 'Lượng nước chỉ có tối đa 1 chữ số thập phân.'], ['', 'Nhập lượng nước (lít).']]) {
    await field('Lượng nước (lít)').fill(text);
    await save().click();
    await page.getByText(message).waitFor();
  }
  assert.equal(calls.care.length, 1, 'số sai không gửi');
  await field('Lượng nước (lít)').fill('7,5');
  await save().click();
  await page.waitForFunction(() => document.querySelector('.esc-today dl')?.innerText.includes('25,5 L'));
  assert.deepEqual([lastCare().activityType, lastCare().horseId, lastCare().amountLiters], ['WATER', '22', 7.5]);

  // 10. Nghỉ chân: Cả đoàn (horseId null) và riêng một ngựa; 0 / 721 phút bị chặn
  await pick('Hoạt động', 'Nghỉ chân');
  assert.match(await page.locator('.esc-quick .ant-select', { hasText: 'Cả đoàn' }).first().innerText(), /Cả đoàn/, 'nghỉ chân mặc định cả đoàn');
  for (const text of ['0', '721', '1,5']) {
    await field('Thời gian nghỉ (phút)').fill(text);
    await save().click();
    await page.getByText(/Thời gian nghỉ phải từ 1 đến 720 phút\.|Nhập số phút nghỉ/).waitFor();
  }
  const beforeRest = calls.care.length;
  assert.equal(beforeRest, 2);
  await field('Thời gian nghỉ (phút)').fill('15');
  await save().click();
  await page.waitForFunction(() => document.querySelector('.esc-today dl')?.innerText.includes('2 lần · 35 phút'));
  assert.deepEqual([lastCare().activityType, lastCare().horseId, lastCare().durationMinutes], ['REST', null, 15]);
  await pick('Ngựa', 'Bạch Mã');
  await field('Thời gian nghỉ (phút)').fill('10');
  await save().click();
  await page.waitForFunction(() => document.querySelector('.esc-today dl')?.innerText.includes('3 lần · 45 phút'));
  assert.deepEqual([lastCare().horseId, lastCare().durationMinutes], ['21', 10]);

  // 11. "Áp dụng cho tất cả ngựa": mỗi ngựa một bản ghi cùng nội dung và cùng giờ; lỗi giữa chừng chỉ thử lại phần còn thiếu
  await pick('Hoạt động', 'Cho ăn');
  assert.equal(await page.getByText('Áp dụng cho tất cả ngựa').count(), 1);
  await page.getByText('Áp dụng cho tất cả ngựa').click();
  assert.equal(await field('Ngựa').isDisabled(), true, 'chọn tất cả: khóa ô chọn ngựa');
  await field('Khẩu phần').fill('Yến mạch 2 kg');
  const beforeAll = calls.care.length;
  await save().click();
  await toast('Đã ghi cho 2 ngựa.').waitFor();
  const both = calls.care.slice(beforeAll);
  assert.deepEqual(both.map(call => call.horseId), ['21', '22']);
  assert.equal(both[0].performedAt, both[1].performedAt, 'cùng giờ');
  assert.deepEqual(both.map(call => call.feedDescription), ['Yến mạch 2 kg', 'Yến mạch 2 kg']);
  // Lỗi ở ngựa thứ hai
  await page.getByText('Áp dụng cho tất cả ngựa').click();
  await field('Khẩu phần').fill('Cỏ tươi 1 kg');
  state.careRejects.push(null, { status: 500, message: 'Máy chủ bận.' });
  const beforeFail = calls.care.length;
  await save().click();
  await page.getByText(/Đã ghi 1\/2 ngựa\. Máy chủ bận\./).waitFor();
  await page.getByText('Chưa ghi: Hắc Mã.').waitFor();
  assert.equal(calls.care.length - beforeFail, 2);
  await page.getByRole('button', { name: 'Thử lại ngựa còn lại' }).click();
  await toast('Đã ghi cho 2 ngựa.').waitFor();
  const retried = calls.care.slice(beforeFail);
  assert.deepEqual(retried.map(call => call.horseId), ['21', '22', '22'], 'thử lại chỉ gửi ngựa còn thiếu, không ghi trùng');

  // 12. Sửa = đính chính: khóa ngựa và loại, POST kèm correctsActivityId, bản cũ ẩn; 409 → báo và tải lại
  await page.getByRole('button', { name: 'Xem thêm' }).click(); // lịch sử phân trang 10 dòng: mở hết để thấy các hoạt động cũ
  await page.locator('.esc-history li[data-activity-id="802"] .esc-edit').click();
  await page.getByRole('heading', { name: 'Đính chính hoạt động' }).waitFor();
  assert.equal(await field('Hoạt động').isDisabled(), true);
  assert.equal(await field('Ngựa').isDisabled(), true);
  assert.equal(await field('Lượng nước (lít)').inputValue(), '10');
  await field('Lượng nước (lít)').fill('8');
  await page.getByRole('button', { name: 'Lưu bản đính chính' }).click();
  await toast('Đã ghi bản đính chính.').waitFor();
  assert.deepEqual([lastCare().correctsActivityId, lastCare().horseId, lastCare().activityType, lastCare().amountLiters], ['802', '21', 'WATER', 8]);
  await page.waitForFunction(() => !document.querySelector('.esc-history li[data-activity-id="802"]'));
  assert.ok(await page.locator('.esc-history .esc-tag', { hasText: 'Bản đính chính' }).count() >= 1, 'bản mới mang nhãn Bản đính chính');
  await page.getByRole('heading', { name: 'Ghi nhận nhanh' }).waitFor();
  await page.locator('.esc-history li[data-activity-id="801"] .esc-edit').click();
  state.careRejects.push({ status: 409, message: 'Bản ghi này đã được đính chính; hãy đính chính bản mới nhất.' });
  await field('Khẩu phần').fill('Cỏ khô 5 kg');
  await page.getByRole('button', { name: 'Lưu bản đính chính' }).click();
  await toast('Hoạt động này đã được đính chính ở nơi khác').waitFor();
  await page.getByRole('heading', { name: 'Ghi nhận nhanh' }).waitFor();

  // 13. Bố cục: không tràn ngang ở 1440, 1366×768 và 390px
  await noOverflow('e1-1440');
  await page.setViewportSize({ width: 1366, height: 768 });
  await noOverflow('e1-1366');
  await page.screenshot({ path: 'test-results/escort-e1-1366.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow('e1-390');
  await page.setViewportSize({ width: 1440, height: 900 });

  // 14. Báo sự cố từ topbar: mặc định Y tế ngựa; gửi xong quay về E1
  await page.evaluate(() => Object.keys(localStorage).filter(key => key.includes('incident:')).forEach(key => localStorage.removeItem(key)));
  await page.getByRole('button', { name: 'Báo sự cố' }).click();
  await heading('Báo sự cố').waitFor();
  assert.match(page.url(), /view=incident$/);
  await page.locator('.drv-severity').waitFor();
  assert.equal(await page.locator('.ant-select', { hasText: 'Y tế ngựa · Khác' }).count(), 1, 'hộ tống: loại mặc định Y tế ngựa');
  await page.getByRole('radio', { name: /^Trung bình/ }).click();
  await page.getByLabel('Mô tả chi tiết').fill('Bạch Mã đổ mồ hôi nhiều, bỏ ăn buổi trưa');
  await page.getByRole('radio', { name: 'Ngựa', exact: true }).click();
  await pick('Con ngựa liên quan', 'Bạch Mã');
  await page.getByRole('button', { name: 'Gửi báo cáo cho điều phối' }).click();
  await toast('Đã báo sự cố KHẨN. Quản lý và điều phối viên đã được thông báo.').waitFor();
  await heading('Quản lý ngựa').waitFor();
  assert.match(page.url(), /view=care$/);
  assert.equal(calls.incidents.length, 1);

  // 15. Đơn đã giao giữa chừng (đổi ở nơi khác): API 409 → thông báo rõ ràng, form bị khóa nhưng giữ nguyên, không lỗi JS; tải lại → màn trống
  await open('care');
  await card('21').waitFor();
  await pick('Ngựa', 'Bạch Mã');
  await field('Khẩu phần').fill('Cỏ khô sau khi giao');
  state.careRejects.push({ status: 409, message: 'Chỉ ghi nhật ký chăm sóc khi chuyến sẵn sàng khởi hành (READY) hoặc đang vận chuyển (IN_TRANSIT).' });
  await save().click();
  await page.getByText(/Chỉ ghi nhật ký chăm sóc khi chuyến sẵn sàng khởi hành/).waitFor();
  assert.equal(await field('Khẩu phần').inputValue(), 'Cỏ khô sau khi giao', 'giữ nguyên dữ liệu đã nhập');
  assert.equal(await save().isDisabled(), true, 'form bị khóa sau khi API từ chối vì trạng thái đơn');
  trips[100].orderStatus = 'DELIVERED';
  await page.getByRole('button', { name: 'Tải lại chuyến' }).click();
  await page.getByText('Bạn chưa có chuyến được phân công').waitFor();

  // 16. Không có chuyến: màn trống E0, chỉ "Tải lại", không có lịch sử giao hàng (6.6); vẫn là khung hộ tống vì chuyến gần nhất là hộ tống
  assert.deepEqual(await page.locator('.drv-empty-actions button').allInnerTexts(), ['Tải lại']);
  assert.equal(await page.getByRole('button', { name: 'Xem lịch sử giao hàng' }).count(), 0);
  assert.equal(await page.locator('.drs-sidebar nav button').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Báo sự cố' }).isDisabled(), true, 'chưa có chuyến thì không báo sự cố');

  // 17. Tài xế (crewRole DRIVER) không thấy E1: khung tài xế, ?view=care quy về trip
  crew.role = 'DRIVER';
  trips[100].orderStatus = 'READY';
  Object.assign(trips[100].legs[0], { status: 'NOT_STARTED', actualDepartureAt: null });
  await open('care');
  await heading('Chuyến vận chuyển').waitFor();
  assert.match(page.url(), /view=trip$/);
  assert.deepEqual(await page.locator('.drs-sidebar nav button').allInnerTexts(), ['Chuyến vận chuyển', 'Lịch sử giao hàng', 'Báo cáo sự cố']);
  assert.equal(await page.locator('.esc, .esc-incident-btn').count(), 0, 'tài xế không có E1 / nút Báo sự cố của hộ tống');
  assert.equal(await photo.name, 'ngua.png');
});
