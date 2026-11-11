// A2 - Xác minh email khi đăng ký, quên mật khẩu, thu hồi phiên (token_version). MySQL thật, HTTP thật, hộp thư giả.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/auth-email.mysql.cjs
require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mysql = require('mysql2/promise');
const { DataSource } = require('typeorm');
const { createServices } = require('../src/shared/config/services');
const { User } = require('../src/features/users/users.model');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const options = require('./mysql-options.cjs');

const name = 'wdp_flow1_test_' + require('crypto').randomBytes(8).toString('hex');
let admin, db, servers = [], created = false;
const checks = require('./checks.cjs')(), check = checks.check;
const PASSWORD = 'Mat-khau-dang-ky-1';
const outbox = [];
const mailer = { configured: true, send: async mail => { outbox.push(mail); } };
const lastCode = to => { const mail = [...outbox].reverse().find(m => m.to === to); return mail && /Mã của bạn: (\d{6})/.exec(mail.text)[1]; };

async function main() {
  delete process.env.EMAIL_VERIFICATION;
  admin = await mysql.createConnection(options);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({
    type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name,
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { connectionLimit: 20 },
  });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);
  await q("INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES (1,'admin@t.local','!','Quản Trị','ADMIN','ACTIVE')");

  const tokens = new TokenService('auth-email-integration-secret-at-least-thirty-two');
  const start = async m => {
    const server = createApp({ services: createServices(db, tokens, m), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
    await once(server, 'listening'); servers.push(server);
    return 'http://127.0.0.1:' + server.address().port + '/api/v1';
  };
  const base = await start(mailer);
  const call = async (method, path, { body, token, root = base } = {}) => {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(root + path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
  const expect = async (status, method, path, opts) => {
    const r = await call(method, path, opts);
    assert.equal(r.status, status, `${method} ${path} -> ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data;
  };
  const register = (email, root) => call('POST', '/auth/register', { root, body: { email, password: PASSWORD, fullName: 'Khách Thử', phone: '0901234567', address: '12 Nguyễn Huệ, TP.HCM' } });
  const login = (email, password = PASSWORD, root) => call('POST', '/auth/login', { root, body: { email, password } });
  // Bỏ thời gian chờ gửi lại 60 giây để thử tiếp mà không phải đợi.
  const skipCooldown = () => q('UPDATE auth_codes SET created_at=created_at - INTERVAL 2 MINUTE');

  await check('Đăng ký: tài khoản chờ xác minh, email có mã 6 số; đăng nhập trước khi xác minh báo EMAIL_NOT_VERIFIED', async () => {
    const r = await register('new@t.local');
    assert.equal(r.status, 201);
    assert.deepEqual([r.data.verificationRequired, r.data.email, 'accessToken' in r.data], [true, 'new@t.local', false]);
    assert.equal((await q("SELECT account_status s FROM users WHERE email='new@t.local'"))[0].s, 'PENDING');
    assert.match(lastCode('new@t.local'), /^\d{6}$/);
    const [row] = await q("SELECT code_hash FROM auth_codes a JOIN users u ON u.id=a.user_id WHERE u.email='new@t.local'");
    assert.notEqual(row.code_hash, lastCode('new@t.local'), 'chỉ lưu bản băm');
    const blocked = await login('new@t.local');
    assert.deepEqual([blocked.status, blocked.data.code], [403, 'EMAIL_NOT_VERIFIED']);
    assert.equal((await login('new@t.local', 'sai-mat-khau-1')).status, 401, 'sai mật khẩu không lộ trạng thái chờ xác minh');
  });

  await check('Xác minh: mã sai 400, mã đúng kích hoạt và trả phiên; gửi lại trong 60 giây không gửi thêm', async () => {
    const before = outbox.length;
    await expect(200, 'POST', '/auth/resend-verification', { body: { email: 'new@t.local' } });
    assert.equal(outbox.length, before, 'đang trong thời gian chờ');
    const wrong = lastCode('new@t.local') === '000000' ? '111111' : '000000';
    const bad = await expect(400, 'POST', '/auth/verify-email', { body: { email: 'new@t.local', code: wrong } });
    assert.ok(bad.fields.code);
    await expect(400, 'POST', '/auth/verify-email', { body: { email: 'new@t.local', code: '12ab' } });
    const ok = await expect(200, 'POST', '/auth/verify-email', { body: { email: 'new@t.local', code: lastCode('new@t.local') } });
    assert.ok(ok.accessToken);
    assert.equal(ok.user.accountStatus, 'ACTIVE');
    assert.equal('tokenVersion' in ok.user || 'passwordHash' in ok.user, false, 'không lộ trường nội bộ');
    assert.equal((await expect(200, 'GET', '/users/me', { token: ok.accessToken })).email, 'new@t.local');
    assert.equal((await login('new@t.local')).status, 200);
  });

  await check('Quên mật khẩu: email lạ và email thật trả cùng câu; chỉ email thật nhận mã', async () => {
    const before = outbox.length;
    const unknown = await expect(200, 'POST', '/auth/forgot-password', { body: { email: 'nobody@t.local' } });
    assert.equal(outbox.length, before);
    const known = await expect(200, 'POST', '/auth/forgot-password', { body: { email: 'NEW@t.local' } });
    assert.equal(known.message, unknown.message);
    assert.equal(outbox.length, before + 1);
    assert.match(outbox.at(-1).subject, /đặt lại mật khẩu/);
  });

  await check('Đặt lại mật khẩu: nhập sai quá 5 lần thì mã hết dùng được; mã mới đặt lại được, phiên cũ và mật khẩu cũ hết hiệu lực, mã không dùng lại được', async () => {
    const oldToken = (await login('new@t.local')).data.accessToken;
    const code = lastCode('new@t.local');
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: wrong, password: 'Mat-khau-moi-22' } });
    const fifth = await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: wrong, password: 'Mat-khau-moi-22' } });
    assert.match(fifth.message, /hết hạn|quá/);
    await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code, password: 'Mat-khau-moi-22' } });
    await skipCooldown();
    await expect(200, 'POST', '/auth/forgot-password', { body: { email: 'new@t.local' } });
    const fresh = lastCode('new@t.local');
    await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: fresh, password: 'ngan' } });
    await expect(200, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: fresh, password: 'Mat-khau-moi-22' } });
    await expect(401, 'GET', '/users/me', { token: oldToken });
    assert.equal((await login('new@t.local')).status, 401);
    assert.equal((await login('new@t.local', 'Mat-khau-moi-22')).status, 200);
    await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: fresh, password: 'Mat-khau-khac-33' } });
    assert.equal(Number((await q("SELECT COUNT(*) n FROM audit_logs WHERE action='RESET_PASSWORD_BY_EMAIL'"))[0].n), 1);
  });

  await check('Mã hết hạn sau 15 phút', async () => {
    await skipCooldown();
    await expect(200, 'POST', '/auth/forgot-password', { body: { email: 'new@t.local' } });
    await q("UPDATE auth_codes SET expires_at=UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE used_at IS NULL");
    await expect(400, 'POST', '/auth/reset-password', { body: { email: 'new@t.local', code: lastCode('new@t.local'), password: 'Mat-khau-khac-33' } });
  });

  await check('Đổi mật khẩu trong tài khoản đăng xuất mọi phiên cũ; Admin khóa rồi mở thì phiên cũ vẫn hết hiệu lực', async () => {
    const a = (await login('new@t.local', 'Mat-khau-moi-22')).data.accessToken;
    const b = (await login('new@t.local', 'Mat-khau-moi-22')).data.accessToken;
    await expect(200, 'POST', '/users/me/password', { token: a, body: { currentPassword: 'Mat-khau-moi-22', newPassword: 'Mat-khau-thu-ba-3' } });
    await expect(401, 'GET', '/users/me', { token: b });
    const c = (await login('new@t.local', 'Mat-khau-thu-ba-3')).data.accessToken;
    const adminToken = tokens.sign({ sub: '1', email: 'admin@t.local', role: 'ADMIN' });
    const [{ id }] = await q("SELECT CAST(id AS CHAR) id FROM users WHERE email='new@t.local'");
    await expect(200, 'POST', `/admin/accounts/${id}/lock`, { token: adminToken, body: { reason: 'Thử' } });
    await expect(200, 'POST', `/admin/accounts/${id}/unlock`, { token: adminToken, body: { reason: 'Thử' } });
    await expect(401, 'GET', '/users/me', { token: c });
    const d = (await login('new@t.local', 'Mat-khau-thu-ba-3')).data.accessToken;
    await expect(200, 'POST', `/admin/accounts/${id}/reset-password`, { token: adminToken, body: { password: 'Mat-khau-admin-4' } });
    await expect(401, 'GET', '/users/me', { token: d });
  });

  await check('Admin tạo nhân sự: gửi email báo tài khoản, không kèm mật khẩu', async () => {
    const adminToken = tokens.sign({ sub: '1', email: 'admin@t.local', role: 'ADMIN' });
    await expect(201, 'POST', '/admin/accounts', { token: adminToken, body: { email: 'staff@t.local', fullName: 'Nhân Sự', kind: 'MANAGER', password: 'Mat-khau-staff-5' } });
    const mail = outbox.at(-1);
    assert.equal(mail.to, 'staff@t.local');
    assert.doesNotMatch(mail.text, /Mat-khau-staff-5/);
  });

  await check('Không cấu hình email: đăng ký kích hoạt ngay như trước (chạy trên máy, test, CI)', async () => {
    const root = await start({ configured: false, send: async () => { throw new Error('không được gọi'); } });
    const r = await register('nomail@t.local', root);
    assert.equal(r.status, 201);
    assert.ok(r.data.accessToken);
    assert.equal((await q("SELECT account_status s FROM users WHERE email='nomail@t.local'"))[0].s, 'ACTIVE');
  });

  checks.done();
  console.log(`${checks.passed} auth email integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const server of servers) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
