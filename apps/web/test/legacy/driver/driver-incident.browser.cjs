// Driver: báo sự cố (D2) trên trang riêng (mục 4).
const { run } = require('./harness.cjs');

run('driver-incident', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;
  await page.clock.install(); // đồng hồ giả: các bước sau đẩy thời gian thay vì chờ thật
  startTrip();
  await open('trip');
  await checkInButton().waitFor();

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
    assert.equal(await page.locator('.ant-select', { hasText: 'Hỏng xe · Khác' }).count(), 1, 'tài xế: loại mặc định Hỏng xe');
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
});
