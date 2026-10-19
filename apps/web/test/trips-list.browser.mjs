// Run against Vite using API fixtures; no requests are sent to the real backend.
// TRIPS_TEST_URL defaults to http://127.0.0.1:5178.
// PLAYWRIGHT_MODULE / BROWSER_EXECUTABLE may point to an existing local runtime.
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
const base = process.env.TRIPS_TEST_URL || 'http://127.0.0.1:5178';
const errors = [];
const fixture = (index, role) => ({
  id: (18446744073709551615n - BigInt(index)).toString(), orderId: String(100 + index),
  orderCode: `ORD-${index + 1}`, plannedBy: role === 'COORDINATOR' ? '4' : String(index % 2 + 4),
  planStatus: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'][index % 3],
  plannedDepartureAt: index % 3 ? '2026-10-20T01:00:00.000Z' : null,
  plannedArrivalAt: index % 3 ? '2026-10-20T05:00:00.000Z' : null,
});
async function setup(role = 'MANAGER') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('accessToken', 'ui-test-only'));
  const state = { total: role === 'MANAGER' ? 41 : 3, error: 0, delay: 0, requests: [], paths: [] };
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    state.paths.push(url.pathname);
    assert.equal(request.method(), 'GET', 'List must not write');
    if (url.pathname.endsWith('/users/me')) return route.fulfill({ json: { id: role === 'MANAGER' ? '2' : '4', fullName: 'Người kiểm tra', role, email: 'ui@example.test' } });
    if (url.pathname.endsWith('/trips')) {
      assert.deepEqual([...url.searchParams.keys()].sort(), ['limit', 'page']);
      assert.equal(request.headers().authorization, 'Bearer ui-test-only');
      const page = Number(url.searchParams.get('page')), limit = Number(url.searchParams.get('limit'));
      assert(page > 0 && Number.isSafeInteger((page - 1) * limit) && limit > 0 && limit <= 100);
      state.requests.push({ page, limit });
      if (state.delay) await new Promise(resolve => setTimeout(resolve, state.delay));
      if (state.error) return route.fulfill({ status: state.error, json: { message: 'Fixture error' } });
      const all = Array.from({ length: state.total }, (_, index) => fixture(index, role));
      return route.fulfill({ json: { items: all.slice((page - 1) * limit, page * limit), total: state.total, page, limit } });
    }
    const detailId = url.pathname.match(/\/trips\/([^/]+)$/)?.[1];
    if (detailId) {
      const index = Number(18446744073709551615n - BigInt(detailId));
      return route.fulfill({ json: { ...fixture(index, role), orderStatus: 'PREPARING', approvedBy: null, approvedAt: null, returnReason: null, legs: [] } });
    }
    return route.fulfill({ json: [] });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return { context, page, state };
}
async function ready(page) { await page.getByRole('button', { name: 'Làm mới', exact: true }).waitFor(); }
try {
  const { context, page, state } = await setup();
  state.delay = 300;
  await page.goto(base + '/dashboard/trips');
  await page.getByRole('status', { name: 'Đang tải danh sách chuyến' }).waitFor();
  await ready(page);
  assert(page.url().endsWith('?page=1&limit=20'));
  assert.equal(await page.locator('.trip-list-table tbody tr').count(), 20);
  assert.equal(await page.getByRole('button', { name: /Tạo chuyến/ }).count(), 0);
  await page.getByText('41 chuyến', { exact: true }).waitFor();
  assert((await page.locator('.trip-list-table').innerText()).includes('08:00'));
  state.delay = 0;
  await page.getByRole('button', { name: 'Sau →', exact: true }).click(); await ready(page);
  assert(page.url().endsWith('?page=2&limit=20'));
  const tripId = fixture(20, 'MANAGER').id;
  await page.getByRole('button', { name: `Xem chi tiết chuyến ${tripId}`, exact: true }).click();
  await page.getByRole('heading', { name: `Chuyến #${tripId} · Đơn ORD-21`, exact: true }).waitFor();
  await page.reload(); await page.getByRole('link', { name: 'Danh sách chuyến', exact: false }).click(); await ready(page);
  assert(page.url().endsWith('?page=2&limit=20'));
  await page.getByRole('button', { name: `Xem chi tiết chuyến ${tripId}`, exact: true }).click();
  await page.goBack(); await ready(page); assert(page.url().endsWith('?page=2&limit=20'));
  await page.getByLabel('Số dòng').selectOption('10'); await ready(page);
  assert(page.url().endsWith('?page=1&limit=10')); assert.equal(await page.locator('.trip-list-table tbody tr').count(), 10);
  state.error = 503;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert((await page.getByRole('alert').innerText()).includes('kết quả tải trước đó'));
  state.error = 0;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await ready(page);
  await page.getByRole('alert').waitFor({ state: 'hidden' });
  for (const width of [320, 375, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`);
    if (width === 320) { assert(await page.locator('.trip-list-cards').isVisible()); assert(!await page.locator('.trip-list-table').isVisible()); }
    if (width === 1440) assert(await page.locator('.trip-list-table').isVisible());
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const query of ['page=-1&limit=101', 'page=9007199254740991&limit=100', 'page=abc&limit=xyz', 'page=1&page=2&limit=20&plannedBy=999']) {
    await page.goto(base + '/dashboard/trips?' + query); await ready(page);
    assert.equal(new URL(page.url()).searchParams.get('page'), '1');
    assert(!new URL(page.url()).searchParams.has('plannedBy'));
  }
  await page.goto(base + '/dashboard/trips?page=99&limit=20');
  await page.waitForURL('**/trips?page=3&limit=20'); await ready(page);
  assert.equal(await page.locator('.trip-list-table tbody tr').count(), 1);
  state.total = 0;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.waitForURL('**/trips?page=1&limit=20'); await ready(page);
  await page.getByRole('heading', { name: 'Chưa có chuyến vận chuyển', exact: true }).waitFor();
  assert(state.paths.filter(path => /\/trips\//.test(path)).every(path => path.endsWith('/' + tripId)), 'Only explicitly opened trip detail is fetched');
  await context.close();
  console.log('PASS manager list: loading, pagination, BIGINT, back/reload, page size, error recovery, responsive, URL validation, last-page correction, empty');

  const coordinator = await setup('COORDINATOR');
  await coordinator.page.goto(base + '/dashboard/trips?page=1&limit=7'); await ready(coordinator.page);
  assert.equal(await coordinator.page.locator('.trip-list-table tbody tr').count(), 3);
  assert.equal(await coordinator.page.getByLabel('Số dòng').inputValue(), '7');
  coordinator.state.total = 0;
  await coordinator.page.getByRole('button', { name: 'Làm mới', exact: true }).click(); await ready(coordinator.page);
  await coordinator.page.getByRole('heading', { name: 'Bạn chưa được giao chuyến' }).waitFor();
  await coordinator.context.close();
  console.log('PASS coordinator: server-owned results, custom valid limit and role-specific empty state');

  const failure = await setup(); failure.state.error = 403;
  await failure.page.goto(base + '/dashboard/trips'); await failure.page.getByRole('alert').waitFor();
  assert((await failure.page.getByRole('alert').innerText()).includes('không có quyền'));
  assert.equal(failure.state.requests.length, 1, 'Do not retry authorization failure');
  failure.state.error = 0;
  await failure.page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await failure.page.locator('.trip-list-table tbody tr').first().waitFor(); await ready(failure.page);
  assert.equal(await failure.page.locator('.trip-list-table tbody tr').count(), 20);
  await failure.context.close();
  console.log('PASS initial 403 and retry recovery');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
