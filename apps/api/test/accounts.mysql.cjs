// A3 - Quản trị tài khoản: MySQL thật, dịch vụ thật, HTTP thật. Chỉ tạo và xóa một database tên ngẫu nhiên.
// Chạy: TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3306 TEST_DB_USER=root TEST_DB_PASSWORD=... TEST_DB_SSL=false node test/accounts.mysql.cjs
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
let admin, db, server, created = false;
const checks = require('./checks.cjs')(), check = checks.check;
const ids = { admin: '1', manager: '2', customer: '3', busyDriver: '4' };
const PASSWORD = 'Mat-khau-moi-1';

async function main() {
  admin = await mysql.createConnection(options);
  assert.match(name, /^wdp_flow1_test_[0-9a-f]{16}$/);
  await admin.query('CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'); created = true;
  db = new DataSource({
    type: 'mysql', host: options.host, port: options.port, username: options.user, password: options.password, ssl: options.ssl, database: name,
    timezone: 'Z', supportBigNumbers: true, bigNumberStrings: true, entities: [User], extra: { connectionLimit: 20 },
  });
  await db.initialize();
  await require('./load-schema.cjs')(db);
  const q = (sql, params) => db.query(sql, params);
  await q(`INSERT INTO users(id,email,password_hash,full_name,role,account_status) VALUES
    (1,'admin@t.local','!','Quản Trị','ADMIN','ACTIVE'),(2,'manager@t.local','!','Quản Lý','MANAGER','ACTIVE'),
    (3,'customer@t.local','!','Khách','CUSTOMER','ACTIVE'),(4,'busy@t.local','!','Tài Xế Bận','DRIVER_ESCORT','ACTIVE')`);
  await q("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (4,'DRIVER','IN_TRIP')");

  const tokens = new TokenService('accounts-integration-secret-at-least-thirty-two-characters');
  server = createApp({ services: createServices(db, tokens), tokens, corsOrigin: 'http://localhost:5173', requestLimit: 5000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
  async function call(method, suffix, { as, token, body } = {}) {
    const headers = {};
    if (as) headers.Authorization = 'Bearer ' + tokens.sign({ sub: as, email: 't@t.local', role: 'ADMIN' });
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + suffix, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  const expectStatus = async (status, method, suffix, opts) => {
    const r = await call(method, suffix, opts);
    assert.equal(r.status, status, `${method} ${suffix} -> ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    return r.data;
  };
  const login = (email, password) => call('POST', '/auth/login', { body: { email, password } });
  const audits = id => q("SELECT action FROM audit_logs WHERE entity_type='USER' AND entity_id=? ORDER BY id", [id]);
  const as = { as: ids.admin };
  let driverId;

  await check('Chỉ ADMIN dùng được; người khác 403, chưa đăng nhập 401', async () => {
    await expectStatus(401, 'GET', '/admin/accounts');
    for (const who of [ids.manager, ids.customer]) {
      await expectStatus(403, 'GET', '/admin/accounts', { as: who });
      await expectStatus(403, 'POST', '/admin/accounts', { as: who, body: {} });
    }
  });

  await check('Tạo tài xế: kiểm tra dữ liệu, có hồ sơ tổ lái, đăng nhập được, ghi audit; email trùng bị từ chối', async () => {
    const bad = await expectStatus(400, 'POST', '/admin/accounts', { ...as, body: { email: 'x', fullName: '', kind: 'CUSTOMER', password: 'short' } });
    assert.deepEqual(Object.keys(bad.fields).sort(), ['email', 'fullName', 'kind', 'password']);
    const made = await expectStatus(201, 'POST', '/admin/accounts', { ...as, body: { email: ' New.Driver@T.local ', fullName: 'Tài Xế Mới', phone: '0901 234 567', kind: 'DRIVER', password: PASSWORD } });
    driverId = made.id;
    assert.deepEqual([made.email, made.role, made.kind, made.status, made.workStatus], ['new.driver@t.local', 'DRIVER_ESCORT', 'DRIVER', 'ACTIVE', 'AVAILABLE']);
    assert.equal('passwordHash' in made || 'password_hash' in made, false);
    assert.equal((await login('new.driver@t.local', PASSWORD)).status, 200);
    const dup = await expectStatus(400, 'POST', '/admin/accounts', { ...as, body: { email: 'new.driver@t.local', fullName: 'Trùng', kind: 'MANAGER', password: PASSWORD } });
    assert.ok(dup.fields.email);
    assert.deepEqual((await audits(driverId)).map(a => a.action), ['CREATE']);
  });

  await check('Danh sách lọc theo vai trò, trạng thái, từ khóa và phân trang', async () => {
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts', as)).total, 5);
    assert.deepEqual((await expectStatus(200, 'GET', '/admin/accounts?kind=DRIVER', as)).items.map(i => i.id).sort(), [driverId, ids.busyDriver].sort());
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts?kind=CUSTOMER', as)).items[0].id, ids.customer);
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts?kind=STAFF', as)).total, 4);
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts?q=' + encodeURIComponent('Quản Lý'), as)).items[0].id, ids.manager);
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts?q=%25', as)).total, 0, 'ký tự % được tìm nguyên văn');
    const page = await expectStatus(200, 'GET', '/admin/accounts?limit=2&page=3', as);
    assert.deepEqual([page.items.length, page.total], [1, 5]);
    await expectStatus(400, 'GET', '/admin/accounts?kind=BOSS', as);
  });

  await check('Đổi tài xế thành hộ tống, rồi thành điều phối; không đổi khách, không tự đổi mình, không đổi người đang chạy chuyến', async () => {
    const escort = await expectStatus(200, 'PATCH', '/admin/accounts/' + driverId, { ...as, body: { fullName: 'Hộ Tống Mới', kind: 'ESCORT' } });
    assert.deepEqual([escort.kind, escort.fullName], ['ESCORT', 'Hộ Tống Mới']);
    const coord = await expectStatus(200, 'PATCH', '/admin/accounts/' + driverId, { ...as, body: { fullName: 'Hộ Tống Mới', kind: 'COORDINATOR' } });
    assert.deepEqual([coord.role, coord.workStatus], ['COORDINATOR', null]);
    assert.equal(Number((await q('SELECT COUNT(*) n FROM crew_profiles WHERE user_id=?', [driverId]))[0].n), 0);
    await expectStatus(409, 'PATCH', '/admin/accounts/' + ids.customer, { ...as, body: { fullName: 'Khách', kind: 'MANAGER' } });
    await expectStatus(409, 'PATCH', '/admin/accounts/' + ids.admin, { ...as, body: { fullName: 'Quản Trị', kind: 'MANAGER' } });
    await expectStatus(409, 'PATCH', '/admin/accounts/' + ids.busyDriver, { ...as, body: { fullName: 'Tài Xế Bận', kind: 'ESCORT' } });
    const renamed = await expectStatus(200, 'PATCH', '/admin/accounts/' + ids.busyDriver, { ...as, body: { fullName: 'Tài Xế Bận Rộn' } });
    assert.deepEqual([renamed.kind, renamed.fullName], ['DRIVER', 'Tài Xế Bận Rộn']);
    await expectStatus(404, 'PATCH', '/admin/accounts/999', { ...as, body: { fullName: 'Không có' } });
    await expectStatus(400, 'PATCH', '/admin/accounts/abc', { ...as, body: { fullName: 'Sai id' } });
  });

  await check('Khóa cần lý do, chặn đăng nhập và token đang dùng; mở khóa dùng lại được; không tự khóa, không khóa người đang chạy chuyến', async () => {
    const token = (await login('new.driver@t.local', PASSWORD)).data.accessToken;
    await expectStatus(400, 'POST', `/admin/accounts/${driverId}/lock`, { ...as, body: {} });
    const locked = await expectStatus(200, 'POST', `/admin/accounts/${driverId}/lock`, { ...as, body: { reason: 'Nghỉ việc' } });
    assert.equal(locked.status, 'LOCKED');
    assert.equal((await login('new.driver@t.local', PASSWORD)).status, 401);
    await expectStatus(403, 'GET', '/users/me', { token });
    await expectStatus(200, 'POST', `/admin/accounts/${driverId}/unlock`, { ...as, body: { reason: 'Quay lại làm' } });
    assert.equal((await login('new.driver@t.local', PASSWORD)).status, 200);
    await expectStatus(409, 'POST', `/admin/accounts/${ids.admin}/lock`, { ...as, body: { reason: 'Thử' } });
    await expectStatus(409, 'POST', `/admin/accounts/${ids.busyDriver}/lock`, { ...as, body: { reason: 'Thử' } });
    assert.deepEqual((await audits(driverId)).map(a => a.action), ['CREATE', 'UPDATE', 'UPDATE', 'LOCK', 'UNLOCK']);
    const [lock] = await q("SELECT reason FROM audit_logs WHERE entity_type='USER' AND entity_id=? AND action='LOCK'", [driverId]);
    assert.equal(lock.reason, 'Nghỉ việc');
  });

  await check('Đặt lại mật khẩu: mật khẩu cũ hết dùng được, audit không lưu mật khẩu', async () => {
    await expectStatus(400, 'POST', `/admin/accounts/${driverId}/reset-password`, { ...as, body: { password: '123' } });
    await expectStatus(200, 'POST', `/admin/accounts/${driverId}/reset-password`, { ...as, body: { password: 'Mat-khau-cap-lai-2' } });
    assert.equal((await login('new.driver@t.local', PASSWORD)).status, 401);
    assert.equal((await login('new.driver@t.local', 'Mat-khau-cap-lai-2')).status, 200);
    const [row] = await q("SELECT old_value o,new_value n FROM audit_logs WHERE entity_type='USER' AND entity_id=? AND action='RESET_PASSWORD'", [driverId]);
    assert.deepEqual([row.o, row.n], [null, null]);
  });

  await check('Quản trị viên khóa được quản trị viên khác, người bị khóa mất quyền ngay; không ai tự khóa mình', async () => {
    const second = await expectStatus(201, 'POST', '/admin/accounts', { ...as, body: { email: 'admin2@t.local', fullName: 'Quản Trị 2', kind: 'ADMIN', password: PASSWORD } });
    await expectStatus(409, 'POST', `/admin/accounts/${second.id}/lock`, { as: second.id, body: { reason: 'Thử' } });
    await expectStatus(200, 'POST', `/admin/accounts/${second.id}/lock`, { ...as, body: { reason: 'Bàn giao' } });
    await expectStatus(403, 'GET', '/admin/accounts', { as: second.id });
    await expectStatus(200, 'POST', `/admin/accounts/${second.id}/unlock`, { ...as, body: { reason: 'Mở lại' } });
    // Khóa đã thu hồi phiên cũ (token_version tăng): mở khóa xong phải đăng nhập lại.
    await expectStatus(401, 'GET', '/admin/accounts', { as: second.id });
    const fresh = tokens.sign({ sub: second.id, email: 'admin2@t.local', role: 'ADMIN', ver: 1 });
    assert.equal((await expectStatus(200, 'GET', '/admin/accounts?kind=ADMIN', { token: fresh })).total, 2);
  });

  checks.done();
  console.log(`${checks.passed} Accounts integration checks passed`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  if (db?.isInitialized) await db.destroy();
  if (admin) { try { if (created) await admin.query('DROP DATABASE `' + name + '`'); } finally { await admin.end(); } }
});
