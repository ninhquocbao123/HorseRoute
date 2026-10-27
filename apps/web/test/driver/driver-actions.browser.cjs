// Driver: ghi mốc / check-in, mất mạng giữ giờ, 409 chặng đổi, các chặng còn lại tới lúc giao xong và trạng thái trống (mục 3, 5).
const { run } = require('./harness.cjs');

run('driver-actions', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;
  await page.clock.install(); // đồng hồ giả: các bước sau đẩy thời gian thay vì chờ thật
  startTrip();
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
    // UI-2: thành công là toast (không còn banner trong trang), tự tắt sau 5 giây
    assert.equal(await page.locator('.ant-alert-success').count(), 0, 'không còn banner trong trang');
    await page.clock.fastForward('00:03');
    assert.equal(await page.locator('.drv-toast.is-success').count(), 1, 'chưa tới 5 giây: toast còn');
    await page.clock.fastForward('00:03');
    await page.locator('.drv-toast.is-success').waitFor({ state: 'detached' });
    assert.equal(calls.milestones.at(-1).occurredAt, firstAttempt.occurredAt, 'gửi lại đúng giờ đã chốt');
    assert.equal(calls.milestones.at(-1).milestoneType, 'ARRIVED_AT_STOP');
    await checkIn('Hoàn thành chặng tới Trạm Đồng Nai');
    await modalClosed();
    assert.equal(calls.complete.length, 1);
    // 5. 409: chặng đã bị cập nhật ở nơi khác → báo và tải lại dữ liệu mới, không gửi lại
    conflict.next = 1;
    conflict.apply = () => { const l = trips[100].legs[1]; l.status = 'MOVING'; mark(l, 'DEPARTED', iso(0)); };
    await checkIn('Xác nhận: Xuất phát từ Trạm Đồng Nai');
    await page.getByText('Trạng thái chặng đã thay đổi, đã tải lại.').waitFor();
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
});
