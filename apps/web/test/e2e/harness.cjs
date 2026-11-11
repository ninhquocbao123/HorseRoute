// Khung test E2E chạy trên API thật và MySQL thật, dữ liệu dựng từ đầu bằng migration.
// Mỗi lần chạy tạo một database ngẫu nhiên wdp_e2e_<hex> và xóa khi xong. Không đọc .env, không chạm DB của người dùng.
// Cần TEST_DB_HOST/PORT/USER/PASSWORD (giống test tích hợp của API). Dịch vụ bản đồ là server giả cục bộ, không gọi mạng ngoài.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

const web = path.resolve(__dirname, '../..');
const apiRoot = path.resolve(web, '../api');
const apiRequire = createRequire(path.join(apiRoot, 'package.json'));
apiRequire('reflect-metadata');
apiRequire('ts-node').register({ project: path.join(apiRoot, 'tsconfig.json'), transpileOnly: true });
const mysql = apiRequire('mysql2/promise');
const bcrypt = apiRequire('bcrypt');
const { DataSource } = apiRequire('typeorm');

const PASSWORD = 'E2e-test-12345';
// PNG 1×1 hợp lệ: đủ để API nhận diện là ảnh và trình duyệt hiển thị được.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Server giả thay Photon/OSRM: tọa độ suy từ chuỗi tìm kiếm nên hai địa chỉ khác nhau luôn khác điểm. */
async function fakeMaps() {
  const point = text => { const h = crypto.createHash('sha1').update(text).digest(); return [105 + h[0] / 255, 10 + h[1] / 25]; };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/search' || url.pathname === '/api/') {
      const query = url.searchParams.get('q') || '';
      const [name, ...rest] = query.split(', ');
      res.end(JSON.stringify({ features: [{ geometry: { type: 'Point', coordinates: point(query) },
        properties: { name, state: rest.join(' ') || name, countrycode: (url.searchParams.get('countrycode') || 'VN').toUpperCase(), street: name } }] }));
      return;
    }
    const points = decodeURIComponent(url.pathname.split('/').pop()).split(';').map(p => p.split(',').map(Number));
    const mid = [(points[0][0] + points.at(-1)[0]) / 2, (points[0][1] + points.at(-1)[1]) / 2];
    res.end(JSON.stringify({ code: 'Ok', waypoints: points.map(() => ({ distance: 10 })),
      routes: [0, 1].map(i => ({ distance: 838000 + i * 20000, duration: 36000 + i * 1800,
        geometry: { type: 'LineString', coordinates: [points[0], [mid[0] + i * 0.05, mid[1]], ...points.slice(1)] } })) }));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

exports.run = async (name, body) => {
  const testDb = apiRequire(path.join(apiRoot, 'test/mysql-options.cjs'));
  const dbName = 'wdp_e2e_' + crypto.randomBytes(6).toString('hex');
  const files = fs.mkdtempSync(path.join(os.tmpdir(), 'wdp-e2e-'));
  const stop = [];
  let admin, db, browser, page, failed = false;
  try {
    admin = await mysql.createConnection(testDb);
    await admin.query('CREATE DATABASE `' + dbName + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    db = new DataSource({ type: 'mysql', host: testDb.host, port: testDb.port, username: testDb.user, password: testDb.password, ssl: testDb.ssl,
      database: dbName, timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true,
      entities: [apiRequire(path.join(apiRoot, 'src/features/users/users.model')).User],
      migrations: [path.join(apiRoot, 'src/database/migrations/*.ts')] });
    await db.initialize();
    await db.runMigrations({ transaction: 'each' });

    // Nhân sự ban đầu chèn thẳng như `pnpm db:create-user` làm trên DB mới; nhân sự sau đó Admin tạo trên web (chặng A3 của test).
    const hash = await bcrypt.hash(PASSWORD, 4);
    const staff = {};
    for (const [key, fullName, role] of [['admin', 'Quản Trị E2E', 'ADMIN'], ['manager', 'Quản Lý E2E', 'MANAGER'], ['specialist', 'Chuyên Viên E2E', 'SPECIALIST'],
      ['coordinator', 'Điều Phối E2E', 'COORDINATOR'], ['driver', 'Tài Xế E2E', 'DRIVER_ESCORT'], ['escort', 'Hộ Tống E2E', 'DRIVER_ESCORT']]) {
      const result = await db.query("INSERT INTO users(email,password_hash,full_name,role,account_status,phone) VALUES (?,?,?,?,'ACTIVE','0901234567')",
        [`${key}@e2e.test`, hash, fullName, role]);
      staff[key] = String(result.insertId);
    }
    await db.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,'DRIVER','AVAILABLE'),(?,'ESCORT','AVAILABLE')", [staff.driver, staff.escort]);
    await db.query("INSERT INTO vehicles(vehicle_type,capacity_stalls,license_plate,status) VALUES ('LIGHT',2,'51C-E2E.01','AVAILABLE')");

    const maps = await fakeMaps(); stop.push(() => maps.close());
    const mapsBase = 'http://127.0.0.1:' + maps.address().port;
    Object.assign(process.env, { MAP_GEOCODING_URL: mapsBase + '/search', MAP_ROUTING_URL: mapsBase + '/route/v1/driving/',
      ROUTE_GEOCODER_URL: mapsBase, ROUTE_ROUTER_URL: mapsBase, ROUTE_PREVIEW_SECRET: crypto.randomBytes(32).toString('hex'), DOCUMENT_STORAGE_PROVIDER: 'local', DOCUMENT_STORAGE_DIR: files });

    const { createApp } = apiRequire(path.join(apiRoot, 'src/app'));
    const { createServices } = apiRequire(path.join(apiRoot, 'src/shared/config/services'));
    const { TokenService } = apiRequire(path.join(apiRoot, 'src/shared/utils/jwt.util'));
    const webPort = Number(process.env.E2E_WEB_PORT || 5197);
    const tokens = new TokenService(crypto.randomBytes(32).toString('hex'));
    // Hộp thư giả thay Gmail SMTP: email xác minh và đặt lại mật khẩu được giữ trong bộ nhớ để test đọc mã. Bật xác minh như production.
    const outbox = [];
    const mailer = { configured: true, send: async mail => { outbox.push(mail); } };
    const mailCode = to => { const mail = [...outbox].reverse().find(m => m.to === to); const match = mail && /Mã của bạn: (\d{6})/.exec(mail.text); return match ? match[1] : null; };
    const api = createApp({ services: createServices(db, tokens, mailer), tokens, corsOrigin: `http://127.0.0.1:${webPort}`, requestLimit: 100000 }).listen(0, '127.0.0.1');
    await once(api, 'listening'); stop.push(() => new Promise(resolve => { api.close(resolve); api.closeAllConnections(); }));
    const apiBase = `http://127.0.0.1:${api.address().port}/api/v1`;

    process.env.VITE_API_URL = apiBase;
    process.env.VITE_MAP_ENABLED = 'false';
    const { createServer } = await import(pathToFileURL(path.join(path.dirname(require.resolve('vite', { paths: [web] })), 'dist/node/index.js')).href);
    const vite = await createServer({ root: web, logLevel: 'error', server: { host: '127.0.0.1', port: webPort, strictPort: true } });
    await vite.listen(); stop.push(() => vite.close());

    const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
    context.setDefaultTimeout(20000);
    // Không gọi mạng ngoài: phông chữ và ảnh nền bản đồ (Leaflet/OSM, OpenFreeMap) đều bị chặn.
    await context.route(/fonts\.(googleapis|gstatic)\.com|tile\.openstreetmap\.org|openfreemap\.org|basemaps\.cartocdn\.com/, route => route.abort());
    page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    const login = async (email, staffLogin = true) => {
      // Xóa phiên trên một tệp tĩnh cùng origin: ứng dụng không chạy nên không có yêu cầu 401 nào tự chuyển trang giữa chừng.
      await page.goto(`http://127.0.0.1:${webPort}/brand/horse-transport-logo.png`);
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto(`http://127.0.0.1:${webPort}${staffLogin ? '/staff/login' : '/login'}`);
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL(/\/(dashboard|coordinator)/);
    };
    let step = 0;
    const phase = async (label, fn) => { step++; await fn(); console.log(`PASS ${step}. ${label}`); };
    await page.goto(`http://127.0.0.1:${webPort}/`);
    await body({ page, db, staff, login, phase, PASSWORD, PNG, base: `http://127.0.0.1:${webPort}`, apiBase, assert, files, outbox, mailCode });
    assert.deepEqual(pageErrors, [], 'không có lỗi JavaScript trên trang');
    console.log(`${name}: ${step} chặng đạt`);
  } catch (error) {
    failed = true;
    console.error(error);
    // Ảnh màn hình lúc lỗi giúp xem giao diện đang ở đâu; đặt E2E_ARTIFACTS để đổi thư mục (CI tải lên làm artifact).
    if (page) {
      const out = process.env.E2E_ARTIFACTS || path.join(os.tmpdir(), 'wdp-e2e-artifacts');
      fs.mkdirSync(out, { recursive: true });
      await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
      console.error('Ảnh màn hình lúc lỗi: ' + path.join(out, 'failure.png') + ' (' + page.url() + ')');
    }
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const fn of stop.reverse()) await Promise.resolve(fn()).catch(() => {});
    if (db?.isInitialized) await db.destroy();
    if (admin) { try { if (process.env.E2E_KEEP_DB !== '1' || !failed) await admin.query('DROP DATABASE IF EXISTS `' + dbName + '`'); } finally { await admin.end(); } }
    fs.rmSync(files, { recursive: true, force: true });
  }
};
