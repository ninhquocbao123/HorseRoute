// Driver: chia sẻ GPS (D1b), hàng đợi khi mất mạng, tốc độ so với VMAX, 409 (mục 2c).
const { run } = require('./harness.cjs');

run('driver-gps', async h => {
  const { assert, page, context, pageErrors, now, iso, DAY, leg, trips, extraIds, state, calls, fail, conflict, horses, crew, allLegs, tripOf, field, mark, open, noOverflow, action, checkInButton, checkIn, modalClosed, dialog, confirm, pick, photo, heading, fact, stops, reportButton, stat, startTrip, incidentOf } = h;
  await page.clock.install(); // đồng hồ giả: các bước sau đẩy thời gian thay vì chờ thật
  startTrip();
  await open('trip');
  await checkInButton().waitFor();

    // 2c. Chia sẻ GPS (D1b): đồng ý lần đầu, gửi lô mỗi 30 giây, hàng đợi khi mất mạng, 409 dừng; tốc độ so với VMAX
    const badge = () => page.locator('.drv-gps-badge');
    const gpsSwitch = () => page.getByRole('switch', { name: 'Chia sẻ vị trí' });
    // Chờ điều kiện phía Node (mock đếm request) mà không dùng sleep cố định.
    const waitFor = async (predicate, label) => {
      for (let i = 0; i < 100 && !predicate(); i++) await new Promise(resolve => setImmediate(resolve)).then(() => page.evaluate(() => 0));
      assert.ok(predicate(), label);
    };
    const queueLength = () => page.evaluate(() => JSON.parse(localStorage.getItem('wdp:tracking:gps-queue:100:test') || '[]').length);
    // Chờ thật (setTimeout của Node, không bị đồng hồ giả của trang ảnh hưởng) tới khi điều kiện đúng.
    const until = async (check, label, ms = 10_000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        if (await check()) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.fail('hết giờ chờ: ' + label);
    };
    const moveTo = async (latitude, longitude) => {
      await page.clock.fastForward('00:06'); // mở lại ngưỡng lấy mẫu 1 điểm/5 giây TRƯỚC khi vị trí mới tới
      await context.setGeolocation({ latitude, longitude });
      await until(() => page.evaluate(lat => window.__gps?.lat === lat, latitude), `trang nhận vị trí ${latitude}`);
    };
    // Đẩy đồng hồ qua nhịp gửi 30 giây rồi chờ kết quả; lặp lại nếu nhịp kế chưa kịp đặt lại (flush là bất đồng bộ).
    const runBatch = async (check, label) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        await page.clock.fastForward('00:31');
        try { await until(check, label, 1500); return; } catch { /* thử nhịp kế */ }
      }
      assert.fail('hết giờ chờ: ' + label);
    };
    assert.equal(await badge().innerText(), 'Chưa bật vị trí');
    assert.equal(await gpsSwitch().getAttribute('aria-checked'), 'false');
    await gpsSwitch().click();
    await dialog().getByText('Chia sẻ vị trí với điều phối viên?').waitFor();
    await dialog().getByText(/chỉ khi chuyến đang chạy và trang này đang mở/).waitFor();
    await dialog().getByRole('button', { name: 'Đồng ý và bật' }).click();
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    assert.equal(calls.positions.length, 0, 'chưa tới 30 giây: chưa gửi');
    await moveTo(10.9, 106.7);
    await moveTo(10.92, 106.75);
    await runBatch(() => calls.positions.length >= 1, 'gửi lô sau 30 giây');
    const firstBatch = calls.positions.flat();
    assert.ok(firstBatch.length >= 2 && firstBatch.length <= 20, 'lô 2–20 điểm: ' + firstBatch.length);
    // Điểm mới nhất có thể nằm ở lô kế tiếp nếu mẫu tới sau nhịp 30 giây đầu (async): chờ đúng điều kiện thay vì giả định lô đầu
    await runBatch(() => calls.positions.flat().some(point => point.latitude === 10.92 && point.longitude === 106.75), 'có điểm mới nhất');
    assert.ok(firstBatch.every(point => /Z$/.test(point.recordedAt)), 'recordedAt dạng UTC ISO');
    await until(async () => (await queueLength()) === 0, 'gửi xong thì xóa hàng đợi');
    // Lời giải thích dài nằm trong tooltip của biểu tượng (i) ở badge
    await page.getByLabel('Giải thích chia sẻ vị trí').hover();
    await page.clock.fastForward('00:01'); // tooltip antd mở sau độ trễ hover bằng setTimeout: đẩy đồng hồ giả thay vì chờ thời gian thật
    await page.getByRole('tooltip', { name: 'Chỉ gửi khi trang này đang mở; giữ màn hình sáng.' }).waitFor();
    await page.mouse.move(5, 5);

    // Mất mạng: giữ hàng đợi trong localStorage, badge "Mất mạng – sẽ gửi bù"; tải lại trang thì gửi bù (đã đồng ý nên tự bật lại)
    state.positionsMode = 'offline';
    await moveTo(10.95, 106.8);
    await runBatch(async () => (await badge().innerText()).startsWith('Mất mạng – sẽ gửi bù'), 'badge mất mạng');
    assert.ok(await queueLength() >= 1, 'điểm chưa gửi nằm trong localStorage');
    const sentBefore = calls.positions.length;
    state.positionsMode = null;
    await open('trip');
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('wdp:tracking:gps-queue:100:test') || '[]').length === 0);
    assert.ok(calls.positions.length > sentBefore, 'gửi bù sau khi có mạng');
    assert.ok(calls.positions.slice(sentBefore).flat().some(point => point.latitude === 10.95), 'điểm lúc mất mạng được gửi bù');

    // Tốc độ: GPS LIVE vượt VMAX → cảnh báo; GPS cũ → "GPS cũ n phút"
    const speedNow = await page.evaluate(() => Date.now());
    state.latest = { lat: 10.95, lng: 106.8, speedKmh: 92.4, accuracyM: 8, headingDeg: 90, recordedAt: new Date(speedNow - 30e3).toISOString(), legId: '10', freshness: 'LIVE' };
    await open('trip');
    await until(async () => (await stat('Tốc độ').locator('strong.is-warn').innerText().catch(() => '')) === '92 km/h', 'thẻ Tốc độ cập nhật');
    await until(async () => (await stat('Tốc độ').locator('small.is-warn').innerText().catch(() => '')) === 'giới hạn 80 km/h', 'thẻ Tốc độ cập nhật');
    state.latest = { ...state.latest, speedKmh: 64, recordedAt: new Date(speedNow - 5 * 60e3).toISOString(), freshness: 'STALE' };
    await open('trip');
    await until(async () => (await stat('Tốc độ').locator('strong').innerText().catch(() => '')) === '—', 'thẻ Tốc độ cập nhật');
    await until(async () => (await stat('Tốc độ').locator('small.is-muted').innerText().catch(() => '')) === 'GPS cũ 5 phút', 'thẻ Tốc độ cập nhật');
    state.latest = { ...state.latest, speedKmh: 64, recordedAt: new Date(speedNow - 10e3).toISOString(), freshness: 'LIVE' };
    await open('trip');
    await until(async () => (await stat('Tốc độ').locator('strong').innerText().catch(() => '')) === '64 km/h', 'thẻ Tốc độ cập nhật');
    assert.equal(await stat('Tốc độ').locator('strong.is-warn').count(), 0, 'dưới giới hạn: không cảnh báo');
    await badge().filter({ hasText: 'Đang chia sẻ GPS với điều phối' }).waitFor();
    await noOverflow('gps');
    await page.screenshot({ path: 'test-results/driver-gps-desktop.png', fullPage: true });

    // 409 (chuyến không còn nhận vị trí): dừng gửi, tắt công tắc, giải thích; không gửi thêm
    state.positionsMode = 409;
    const before409 = calls.positions.length;
    await moveTo(10.97, 106.85);
    await runBatch(() => calls.positions.length > before409, 'lô bị từ chối 409');
    await page.locator('.drv-gps-alert', { hasText: 'Chuyến không còn nhận vị trí' }).waitFor();
    assert.equal(await gpsSwitch().getAttribute('aria-checked'), 'false');
    assert.equal(await badge().innerText(), 'Chưa bật vị trí');
    const after409 = calls.positions.length;
    await context.setGeolocation({ latitude: 10.99, longitude: 106.9 }); // đã dừng theo dõi: không có gì tới trang để chờ
    await page.clock.fastForward('00:06');
    await page.clock.fastForward('01:05');
    assert.equal(calls.positions.length, after409, 'đã dừng: không gửi thêm');
    state.positionsMode = null;
    state.latest = null;
    await page.evaluate(() => localStorage.setItem('wdp:tracking:gps-enabled:test', 'false')); // các bước sau không cần GPS
    await context.setGeolocation({ latitude: 18.3421, longitude: 105.9057 }); // trả lại vị trí giả lập mà màn D2 dùng
    await open('trip');
    await checkInButton().waitFor();
});
