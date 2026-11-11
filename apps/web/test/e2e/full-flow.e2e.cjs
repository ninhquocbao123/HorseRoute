// Luồng nghiệp vụ trọn vẹn trên giao diện web thật, API thật, MySQL thật (database tạm):
// khách đăng ký → hồ sơ ngựa → đặt chuyến → quản lý yêu cầu bổ sung → khách sửa, gửi lại → quản lý tiếp nhận → chuyên viên duyệt giấy tờ → quản lý duyệt giá
// → khách đặt cọc → điều phối thêm xe, lập lộ trình, xe, tổ lái → quản lý duyệt và chuyển chuyến → tài xế chạy và giao ngựa.
// Thêm: chuyên viên thêm điểm dừng nghỉ, quản lý từ chối một đơn khác.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD=... pnpm --filter web test:e2e
// Trên Windows có Edge thay Chromium: thêm PLAYWRIGHT_CHANNEL=msedge.
const { run } = require('./harness.cjs');

run('Luồng E2E đặt chuyến đến giao ngựa', async ({ page, db, login, phase, PASSWORD, PNG, base, assert }) => {
  const customer = 'khach@e2e.test';
  const departure = new Date(Date.now() + 10 * 86400e3);
  const ddmmyyyy = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const main = page.locator('main');
  const customerNav = () => page.getByRole('navigation', { name: 'Điều hướng khách hàng' });
  const toast = text => page.locator('.ant-message, .ant-notification').getByText(text).first();
  let orderId;
  // Chờ kết quả được ghi vào DB thay vì dựa vào cách giao diện báo (toast hay dòng báo trên trang).
  const until = async (label, check) => {
    for (let i = 0; i < 100; i++) { if (await check()) return; await page.waitForTimeout(200); }
    throw new Error('Hết thời gian chờ: ' + label);
  };

  await phase('Khách đăng ký tài khoản (có kiểm tra mật khẩu nhập lại)', async () => {
    await page.goto(base + '/register');
    await page.getByLabel('Họ và tên').fill('Khách Hàng E2E');
    await page.getByLabel('Email').fill(customer);
    await page.getByLabel('Số điện thoại').fill('0912345678');
    await page.getByLabel('Địa chỉ').fill('12 Nguyễn Huệ, Quận 1, TP.HCM');
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD + 'x');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await page.getByText('Mật khẩu nhập lại chưa khớp.').waitFor();
    await page.getByLabel('Nhập lại mật khẩu').fill(PASSWORD);
    await page.getByText('Tôi đồng ý với điều khoản sử dụng').click();
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await page.waitForURL(/\/dashboard/);
    await page.getByText('Khách Hàng E2E').first().waitFor();
  });

  await phase('Khách tạo hồ sơ ngựa và tải đủ 3 giấy tờ', async () => {
    await customerNav().getByRole('button', { name: 'Hồ sơ ngựa' }).click();
    await page.getByRole('button', { name: 'Thêm ngựa mới' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Ví dụ: Silver Moon').fill('Silver Moon');
    await dialog.getByPlaceholder('Ví dụ: VN-985211').fill('VN-985211');
    await dialog.getByPlaceholder('Chọn hoặc nhập giống ngựa').fill('Thoroughbred');
    await dialog.getByPlaceholder('DD/MM/YYYY').fill('12/03/2021');
    await dialog.getByPlaceholder('DD/MM/YYYY').press('Enter');
    await dialog.getByPlaceholder('Ví dụ: Nâu đỏ').fill('Nâu đỏ');
    // Không có dấu * nhưng bước chọn ngựa khi đặt chuyến bắt buộc số hộ chiếu.
    await dialog.getByText('Số hộ chiếu (FEI / quốc gia)').locator('xpath=following::input[1]').fill('FEI-VN-1001');
    await dialog.getByRole('button', { name: /Giấy tờ & kiểm dịch/ }).click();
    const inputs = dialog.locator('input[type=file]');
    assert.equal(await inputs.count(), 3);
    for (let i = 0; i < 3; i++) await inputs.nth(i).setInputFiles({ name: `giay-${i}.png`, mimeType: 'image/png', buffer: PNG });
    await dialog.getByRole('button', { name: 'Lưu vào hồ sơ' }).click();
    await toast('Thao tác thành công').waitFor();
    await main.getByText('Silver Moon').first().waitFor();
    const [{ n }] = await db.query("SELECT COUNT(*) n FROM customer_profile_files WHERE kind='DOCUMENT'");
    assert.equal(Number(n), 3, 'ba giấy tờ đã lưu');
  });

  await phase('Khách đặt chuyến 4 bước và gửi đơn chờ duyệt', async () => {
    await customerNav().getByRole('button', { name: 'Đặt chuyến', exact: true }).click();
    await main.getByPlaceholder('DD/MM/YYYY').first().fill(ddmmyyyy(departure));
    await main.getByPlaceholder('DD/MM/YYYY').first().press('Enter');
    const selects = main.locator('select');
    const phones = main.getByPlaceholder('VD: +84 901 234 567');
    await phones.nth(0).fill('0912345678');
    await selects.nth(0).selectOption({ label: 'Thành phố Hồ Chí Minh' });
    await selects.nth(1).selectOption({ index: 8 });
    await main.getByLabel('Tên trang trại / Địa chỉ cụ thể *').nth(0).fill('12 Nguyễn Huệ');
    await main.getByLabel('CCCD / MST / Hộ chiếu *').nth(0).fill('079204000001');
    await main.getByLabel('Họ tên người nhận / Tên trại đích *').fill('Trại Ngựa Đà Nẵng');
    await phones.nth(1).fill('0987654321');
    await selects.nth(2).selectOption({ label: 'Thành phố Đà Nẵng' });
    await selects.nth(3).selectOption({ index: 8 });
    await main.getByLabel('Tên trang trại / Địa chỉ cụ thể *').nth(1).fill('Trại ngựa Hòa Xuân');
    await main.getByLabel('CCCD / MST / Hộ chiếu *').nth(1).fill('048204000002');
    await main.getByRole('button', { name: /Tiếp tục/ }).first().click();
    await main.getByText('Silver Moon').first().click();
    await main.getByText(/Đã chọn\s*1\s*\/\s*1 ngựa/).waitFor();
    await main.getByRole('button', { name: /Tiếp tục: Dịch vụ/ }).click();
    await main.getByText('Bảo hiểm chuyến đi').waitFor();
    await main.getByText('Không mua bảo hiểm', { exact: true }).click();
    await main.getByText(/Khoảng 838 km/).waitFor();
    await main.getByRole('button', { name: /Tiếp tục: Xác nhận/ }).click();
    await main.getByRole('checkbox', { name: /Tôi đã đọc và đồng ý/ }).check();
    await main.getByRole('button', { name: 'Gửi đơn chờ duyệt' }).click();
    await page.waitForURL(/view=orders/);
    await main.getByText('Chờ duyệt', { exact: true }).first().waitFor();
    const [order] = await db.query("SELECT id,status FROM orders WHERE status='PENDING'");
    assert.ok(order, 'đơn đã ở trạng thái PENDING');
    orderId = String(order.id);
  });

  const orderCode = async () => (await db.query('SELECT order_code c FROM orders WHERE id=?', [orderId]))[0].c;
  const orderStatus = async () => (await db.query('SELECT status s FROM orders WHERE id=?', [orderId]))[0].s;
  const confirmDialog = async name => { const button = page.getByRole('dialog').getByRole('button', { name, exact: true }); await button.click(); };

  const askNote = 'Vui lòng ghi rõ giờ ngựa ăn trước khi lên xe.';
  await phase('Quản lý yêu cầu khách bổ sung; nội dung là bắt buộc', async () => {
    await login('manager@e2e.test');
    await page.getByRole('button', { name: new RegExp(await orderCode()) }).first().click();
    await page.getByRole('button', { name: 'Yêu cầu bổ sung', exact: true }).click();
    const ask = page.getByRole('dialog').filter({ hasText: 'Yêu cầu khách bổ sung' });
    const send = ask.getByRole('button', { name: 'Gửi yêu cầu bổ sung' });
    assert.equal(await send.isDisabled(), true, 'chưa nhập nội dung thì không gửi được');
    await ask.getByLabel(/Nội dung cần bổ sung/).fill(askNote);
    await send.click();
    await until('đơn cần bổ sung', async () => await orderStatus() === 'NEED_INFO');
    const [o] = await db.query('SELECT manager_note FROM orders WHERE id=?', [orderId]);
    assert.equal(o.manager_note, askNote);
  });

  await phase('Khách đọc yêu cầu, sửa đơn và gửi lại; thông tin đặt chuyến được giữ', async () => {
    await login(customer, false);
    await page.goto(`${base}/dashboard?view=orders&order=${orderId}`);
    await main.getByText(askNote).first().waitFor();
    await main.getByRole('button', { name: 'Chỉnh sửa và gửi duyệt' }).click();
    await main.getByLabel('Yêu cầu đặc biệt').fill('Ngựa ăn lúc 6 giờ sáng, trước khi lên xe 2 tiếng.');
    await main.getByRole('button', { name: 'Lưu và gửi duyệt' }).click();
    await until('đơn gửi lại', async () => await orderStatus() === 'PENDING');
    const [o] = await db.query('SELECT special_requirements s, booking_details b FROM orders WHERE id=?', [orderId]);
    assert.match(o.s, /6 giờ sáng/);
    const booking = typeof o.b === 'string' ? JSON.parse(o.b) : o.b;
    assert.ok(booking && Number(booking.distanceKm) > 0, 'giữ quãng đường và thông tin đặt chuyến sau khi sửa');
  });

  await phase('Quản lý tiếp nhận đơn và giao điều phối viên', async () => {
    await login('manager@e2e.test');
    await page.getByRole('button', { name: new RegExp(await orderCode()) }).first().click();
    await page.getByRole('button', { name: /Tiếp nhận phân công/ }).click();
    await page.locator('.ant-select').filter({ hasText: /điều phối/i }).last().click();
    await page.locator('.ant-select-item-option').filter({ hasText: 'Điều Phối E2E' }).click();
    await page.getByRole('button', { name: 'Tiếp nhận đơn', exact: true }).click();
    await toast('Đã tiếp nhận đơn').waitFor();
    assert.equal(await orderStatus(), 'APPROVED');
    const [{ n }] = await db.query('SELECT COUNT(*) n FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=?', [orderId]);
    assert.equal(Number(n), 3, 'tạo đủ 3 giấy tờ cho ngựa');
  });

  await phase('Chuyên viên nhận hồ sơ, duyệt từng giấy tờ và kết luận', async () => {
    await login('specialist@e2e.test');
    await page.getByRole('button', { name: new RegExp(await orderCode()) }).first().click();
    await page.getByRole('button', { name: 'Tiếp nhận hồ sơ', exact: true }).click();
    await toast('Đã tiếp nhận hồ sơ').waitFor();
    const pendingInvalid = page.getByRole('button', { name: 'Không hợp lệ', exact: true });
    for (let i = 0; i < 3; i++) {
      await pendingInvalid.first().locator('xpath=following-sibling::button[1]').click();
      const dialog = page.getByRole('dialog').filter({ hasText: 'Xác nhận giấy tờ hợp lệ' });
      const expiry = dialog.getByPlaceholder('DD/MM/YYYY');
      if (await expiry.count()) { await expiry.fill('10/11/2030'); await expiry.press('Enter'); }
      await dialog.getByRole('button', { name: 'Gửi kết quả' }).click();
      await toast('Đã ghi nhận giấy tờ hợp lệ').waitFor();
      await page.locator('.ant-message-notice').first().waitFor({ state: 'detached' }).catch(() => {});
      await assert.doesNotReject(dialog.waitFor({ state: 'hidden' }));
    }
    await page.getByText('(3/3 đã kiểm tra)').waitFor();
    await page.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).click();
    await confirmDialog('Xác nhận');
    await toast('Đã lưu kết luận').waitFor();
    const [{ n }] = await db.query("SELECT COUNT(*) n FROM documents d JOIN horses h ON h.id=d.horse_id WHERE h.order_id=? AND d.status='VALID'", [orderId]);
    assert.equal(Number(n), 3);
  });

  await phase('Chuyên viên thêm điểm dừng nghỉ trên màn Địa điểm', async () => {
    await page.getByRole('button', { name: 'Địa điểm & trạm nghỉ' }).click();
    await page.getByRole('button', { name: 'Thêm địa điểm' }).click();
    const form = page.getByRole('dialog').filter({ hasText: 'Tên địa điểm' });
    await form.getByLabel('Tên địa điểm').fill('Trạm nghỉ Quảng Ngãi E2E');
    await form.getByLabel('Vĩ độ').fill('15.12');
    await form.getByLabel('Kinh độ').fill('108.80');
    await form.getByRole('button', { name: 'Thêm', exact: true }).click();
    await until('thêm địa điểm', async () => (await db.query("SELECT id FROM locations WHERE name='Trạm nghỉ Quảng Ngãi E2E' AND location_type='REST_STOP' AND latitude IS NOT NULL")).length === 1);
  });

  await phase('Quản lý lập dự toán theo bảng giá và duyệt giá gửi khách', async () => {
    await login('manager@e2e.test');
    await page.getByRole('button', { name: /Duyệt giá vận chuyển/ }).click();
    await page.getByRole('button', { name: new RegExp(await orderCode()) }).first().click();
    await page.getByRole('button', { name: '+ Lập dự toán' }).click();
    await page.getByRole('button', { name: 'Duyệt giá & gửi khách' }).click();
    await confirmDialog('Xác nhận');
    await toast('Đã duyệt giá').waitFor();
    const [quote] = await db.query("SELECT total,deposit FROM order_quotes WHERE order_id=? AND status='APPROVED'", [orderId]);
    assert.ok(Number(quote.total) > 0 && Number(quote.deposit) > 0, 'báo giá có tổng và tiền cọc');
  });

  await phase('Khách xem báo giá (đủ 100% cước vận chuyển) và đặt cọc: thất bại, thử lại, thành công', async () => {
    await login(customer, false);
    await page.goto(`${base}/dashboard?view=orders&order=${orderId}`);
    await main.getByText('Báo giá chính thức').waitFor();
    await main.getByText('100%').first().waitFor();
    await main.getByRole('button', { name: /^Đặt cọc/ }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Thất bại$/ }).click();
    await dialog.getByText('Thanh toán thất bại (Mô phỏng)').waitFor();
    await dialog.getByRole('button', { name: 'Thử lại' }).click();
    await dialog.getByRole('button', { name: /Thành công$/ }).click();
    await dialog.getByText('Thanh toán thành công (Mô phỏng)').waitFor();
    const [{ paid }] = await db.query('SELECT COALESCE(SUM(amount),0) paid FROM order_receipts WHERE order_id=?', [orderId]);
    const [{ deposit }] = await db.query("SELECT deposit FROM order_quotes WHERE order_id=? AND status='APPROVED'", [orderId]);
    assert.equal(Number(paid), Number(deposit), 'đã ghi đúng tiền cọc');
    assert.equal(await orderStatus(), 'PREPARING');
  });

  const tripId = async () => String((await db.query('SELECT id FROM trips WHERE order_id=?', [orderId]))[0].id);
  const planStatus = async () => (await db.query('SELECT plan_status s FROM trips WHERE order_id=?', [orderId]))[0].s;
  await phase('Điều phối thêm xe mới trên màn Phương tiện', async () => {
    await login('coordinator@e2e.test');
    await page.getByRole('menuitem', { name: 'Phương tiện' }).click();
    await page.getByText('51C-E2E.01').waitFor();
    await page.getByRole('button', { name: 'Thêm phương tiện' }).click();
    const form = page.getByRole('dialog').filter({ hasText: 'Biển số / mã xe' });
    await form.getByLabel('Biển số / mã xe').fill('51C-E2E.02');
    await form.getByRole('button', { name: 'Thêm', exact: true }).click();
    await until('thêm xe', async () => (await db.query("SELECT id FROM vehicles WHERE license_plate='51C-E2E.02' AND status='AVAILABLE'")).length === 1);
    await page.getByText('51C-E2E.02').waitFor();
  });

  await phase('Điều phối xác nhận hai đầu tuyến, chọn tuyến, xe, tổ lái, giờ chạy và gửi duyệt', async () => {
    await login('coordinator@e2e.test');
    await page.goto(`${base}/coordinator/trips/${await tripId()}`);
    for (const index of [0, 1]) {
      const row = page.locator('.waypoint-editor').nth(index);
      await row.getByRole('button', { name: 'Tìm', exact: true }).click();
      await row.locator('.address-results button').first().click();
      await row.getByText(/Đã xác nhận: /).waitFor();
    }
    await page.getByRole('button', { name: 'Tìm tuyến đường', exact: true }).click();
    await page.getByText(/^Tuyến 1 · /).click();
    await page.getByRole('button', { name: /Lưu lộ trình$/ }).click();
    await until('lưu lộ trình', async () => (await db.query('SELECT route_plan_revision r FROM trips WHERE order_id=?', [orderId]))[0].r > 0);

    await page.getByRole('button', { name: 'Chọn phương tiện', exact: true }).click();
    const drawer = () => page.locator('.ant-drawer-content, [role=dialog]').filter({ hasText: 'Xác nhận chọn' }).last();
    await drawer().getByRole('button', { name: /51C-E2E\.02/ }).click();
    await drawer().getByRole('button', { name: 'Xác nhận chọn', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn nhân sự', exact: true }).click();
    await drawer().getByRole('button', { name: /Tài Xế E2E/ }).click();
    await drawer().getByText('Lơ xe', { exact: true }).last().click();
    await drawer().getByRole('button', { name: /Hộ Tống E2E/ }).click();
    await drawer().getByText('Đã chọn 2 nhân sự cho 1 xe').waitFor();
    await drawer().getByRole('button', { name: 'Xác nhận chọn', exact: true }).click();

    const day = d => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const arrival = new Date(departure.getTime() + 86400e3);
    for (const [label, value] of [['Ngày khởi hành chặng 1', day(departure)], ['Giờ khởi hành chặng 1', '08:00'],
      ['Ngày giao dự kiến chặng 1', day(arrival)], ['Giờ giao dự kiến chặng 1', '18:00']]) {
      const input = page.getByRole('textbox', { name: label });
      await input.click();
      await input.press('Control+A');
      await input.pressSequentially(value);
      await input.press('Enter');
    }
    await page.keyboard.press('Escape');
    await page.getByText('Đủ điều kiện').waitFor();
    await page.getByRole('button', { name: /Lưu chặng và phân công$/ }).click();
    await until('lưu xe và tổ lái', async () => Number((await db.query('SELECT COUNT(*) n FROM trip_assignments a JOIN trips t ON t.id=a.trip_id WHERE t.order_id=?', [orderId]))[0].n) === 2);
    await page.getByRole('button', { name: /Gửi duyệt$/ }).click();
    await until('gửi duyệt', async () => await planStatus() === 'PENDING_APPROVAL');
    const [trip] = await db.query("SELECT DATE_FORMAT(CONVERT_TZ(planned_departure_at,'+00:00','+07:00'),'%H:%i') dep FROM trips WHERE order_id=?", [orderId]);
    assert.equal(trip.dep, '08:00', 'giờ khởi hành lưu đúng giờ Việt Nam');
  });

  await phase('Quản lý duyệt kế hoạch và chuyển chuyến cho tài xế', async () => {
    await login('manager@e2e.test');
    await page.goto(`${base}/dashboard?view=orders&order=${orderId}`);
    await page.getByRole('button', { name: /Duyệt đơn$/ }).click();
    await until('duyệt kế hoạch', async () => await planStatus() === 'APPROVED');
    const start = page.getByRole('button', { name: /Bắt đầu vận chuyển$/ });
    await start.waitFor();
    const response = page.waitForResponse(r => r.url().endsWith('/start-transport'));
    await start.click();
    const result = await response;
    assert.equal(result.status(), 200, await result.text());
    await until('chuyển chuyến cho tài xế', async () => await orderStatus() === 'READY');
  });

  const milestones = async () => (await db.query('SELECT m.milestone_type t FROM leg_milestones m JOIN legs l ON l.id=m.leg_id JOIN trips t2 ON t2.id=l.trip_id WHERE t2.order_id=? ORDER BY m.id', [orderId])).map(r => r.t);
  const dump = async label => {
    console.log(label + ' BUTTONS', JSON.stringify(await page.locator('button:visible').allInnerTexts()));
    console.log(label + ' MAIN', (await page.locator('main').innerText()).replace(/s+/g, ' ').slice(0, 900));
  };

  await phase('Tài xế xác nhận xuất phát, đơn chuyển sang đang vận chuyển', async () => {
    await login('driver@e2e.test');
    await page.getByRole('button', { name: 'Bắt đầu chuyến đi' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await until('ghi mốc xuất phát', async () => (await milestones()).includes('DEPARTED'));
    assert.equal(await orderStatus(), 'IN_TRANSIT');
    await page.waitForTimeout(1500);
  });

  await phase('Tài xế check-in tới điểm giao; khách còn nợ nên chưa giao được', async () => {
    await page.getByRole('button', { name: 'Check-in chặng' }).click();
    await page.getByRole('dialog').getByText(/Đã đến Trại ngựa Hòa Xuân/).waitFor();
    await page.getByRole('dialog').locator('.drv-dialog-ok').click();
    await until('ghi mốc tới nơi', async () => (await milestones()).includes('ARRIVED_AT_STOP'));
    await page.getByRole('button', { name: 'Chờ khách thanh toán' }).waitFor();
    assert.equal(await orderStatus(), 'IN_TRANSIT');
  });

  await phase('Khách trả nốt phần còn lại trên web', async () => {
    await login(customer, false);
    await page.goto(`${base}/dashboard?view=orders&order=${orderId}`);
    await main.getByRole('button', { name: /Thanh toán phần còn lại|Thanh toán d/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Thành công$/ }).click();
    await dialog.getByText('Thanh toán thành công (Mô phỏng)').waitFor();
    const [{ paid }] = await db.query('SELECT COALESCE(SUM(amount),0) paid FROM order_receipts WHERE order_id=?', [orderId]);
    const [{ total }] = await db.query("SELECT total FROM order_quotes WHERE order_id=? AND status='APPROVED'", [orderId]);
    assert.equal(Number(paid), Number(total), 'đã trả đủ');
  });

  await phase('Tài xế xác nhận đã giao; đơn hoàn tất, xe và tổ lái được trả về trạng thái rảnh', async () => {
    await login('driver@e2e.test');
    await page.getByRole('button', { name: 'Xác nhận đã giao' }).click();
    await page.getByRole('dialog').locator('.drv-dialog-ok').click();
    await until('đơn đã giao', async () => await orderStatus() === 'DELIVERED');
    assert.deepEqual(await milestones(), ['DEPARTED', 'ARRIVED_AT_STOP', 'DELIVERED']);
    const [vehicle] = await db.query("SELECT status FROM vehicles WHERE license_plate='51C-E2E.02'");
    assert.equal(vehicle.status, 'AVAILABLE');
    const crew = await db.query('SELECT work_status s FROM crew_profiles');
    assert.ok(crew.every(row => row.s === 'AVAILABLE'), 'tài xế và hộ tống rảnh lại');
  });

  await phase('Quản lý từ chối một đơn khác; khách thấy lý do', async () => {
    const [{ id: customerId }] = await db.query('SELECT id FROM users WHERE email=?', [customer]);
    const day = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10);
    const inserted = await db.query("INSERT INTO orders(order_code,customer_id,status,origin_country,destination_country,origin_address,destination_address,desired_departure_date) VALUES ('E2E-REJECT-1',?,'PENDING','VN','VN','Cần Thơ','Hà Nội',?)", [customerId, day]);
    await db.query("INSERT INTO horses(order_id,owner_id,name,passport_no) VALUES (?,?,'Bão Lửa','FEI-VN-2002')", [inserted.insertId, customerId]);
    await login('manager@e2e.test');
    await page.getByRole('button', { name: /E2E-REJECT-1/ }).first().click();
    await page.getByRole('button', { name: 'Từ chối đơn', exact: true }).click();
    const reject = page.getByRole('dialog').filter({ hasText: 'Lý do từ chối' });
    await reject.getByLabel(/Lý do từ chối/).fill('Tuyến Cần Thơ đi Hà Nội chưa có xe phục vụ trong tháng này.');
    await reject.getByRole('button', { name: 'Từ chối đơn' }).click();
    await until('đơn bị từ chối', async () => (await db.query('SELECT status s FROM orders WHERE id=?', [inserted.insertId]))[0].s === 'REJECTED');
    await login(customer, false);
    await page.goto(`${base}/dashboard?view=orders&order=${inserted.insertId}`);
    await main.getByText('Đơn hàng bị từ chối').waitFor();
    await main.getByText(/chưa có xe phục vụ/).first().waitFor();
  });

  await phase('Khách thấy đơn đã giao', async () => {
    await login(customer, false);
    await page.goto(`${base}/dashboard?view=orders`);
    await main.getByText('Đã giao').first().waitFor();
  });
});
