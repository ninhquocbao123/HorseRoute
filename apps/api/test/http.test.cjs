const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
require('reflect-metadata');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const jwt = require('jsonwebtoken');
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const { AuthService } = require('../src/features/auth/auth.service');
const { ConflictException, NotFoundException } = require('../src/shared/core/error.response');
const { fileType } = require('../src/features/documents/file-storage');
const secret = 'http-test-secret-with-at-least-thirty-two-characters';

async function fixture(options = {}) {
  const accounts = new Map(Object.entries({
    '1': { id: '1', email: 'one@example.com', role: 'CUSTOMER', accountStatus: 'ACTIVE' },
    '2': { id: '2', email: 'two@example.com', role: 'MANAGER', accountStatus: 'ACTIVE' },
    '3': { id: '3', role: 'SPECIALIST', accountStatus: 'ACTIVE' },
    '4': { id: '4', role: 'CUSTOMER', accountStatus: 'LOCKED' },
    '5': { id: '5', role: 'ADMIN', accountStatus: 'ACTIVE' },
    '6': { id: '6', role: 'DRIVER_ESCORT', accountStatus: 'ACTIVE' },
  }));
  const calls = [];
  const record = name => async (...args) => { calls.push({ name, args }); return { ok: name }; };
  const users = {
    getById: async id => { if (!accounts.has(id)) throw new NotFoundException(); return accounts.get(id); },
    findAll: record('users.list'), findByEmailWithPassword: async email => [...accounts.values()].find(a => a.email === email),
    create: async data => { const result = { id: '7', ...data }; accounts.set('7', result); return result; },
  };
  const tokens = new TokenService(secret);
  const services = {
    users, auth: new AuthService(users, tokens),
    health: { check: async () => ({ status: 'ok', info: { mysql: { status: 'up' } } }) },
    orders: Object.fromEntries(['list','detail','reviewOptions','save','submit','review'].map(n => [n, record('orders.' + n)])),
    notifications: { list: record('notifications.list'), read: record('notifications.read') },
    documents: { ...Object.fromEntries(['list','detail','review','request','updateDossier'].map(n => [n, record('documents.' + n)])),
      upload: async (...args) => { fileType(args[3]); return record('documents.upload')(...args); },
      download: async () => ({ original_name: 'giấy phép.pdf', buffer: Buffer.from('%PDF-fixture') }),
    },
  };
  const server = createApp({ services, tokens, corsOrigin: 'http://localhost:5173', requestLimit: 1000, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const token = (id, role = 'ADMIN') => tokens.sign({ sub: id, email: 'test@example.com', role });
  const request = (url, { id, body, method = 'GET', headers = {}, ...rest } = {}) => fetch(base + url, {
    ...rest, method, headers: { ...(id ? { Authorization: 'Bearer ' + token(id) } : {}), ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
  });
  return { request, accounts, services, calls, token, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}

test('Express HTTP contract and access boundaries', async t => {
  const f = await fixture();
  try {
    await t.test('public routes, Swagger and legacy JWT tokens work', async () => {
      assert.equal((await f.request('/api/v1/health')).status, 200);
      assert.equal((await f.request('/docs/')).status, 200);
      assert.equal((await f.request('/docs-json')).status, 200);
      const oldToken = jwt.sign({ sub: '1', email: 'old@example.com', role: 'ADMIN' }, secret, { expiresIn: '7d' });
      const res = await f.request('/api/v1/users/me', { headers: { Authorization: 'Bearer ' + oldToken } });
      assert.equal(res.status, 200); assert.equal((await res.json()).role, 'CUSTOMER');
    });
    await t.test('missing, forged, expired and invalid-sub tokens are rejected', async () => {
      for (const token of [null, 'invalid', jwt.sign({ sub: '1' }, 'different-secret'), jwt.sign({ sub: '1' }, secret, { expiresIn: -1 }), jwt.sign({ sub: 1 }, secret)]) {
        const res = await f.request('/api/v1/orders', { headers: token ? { Authorization: 'Bearer ' + token } : {} });
        assert.equal(res.status, 401);
      }
      assert.equal((await f.request('/api/v1/users/me', { id: '4' })).status, 403);
      assert.equal((await f.request('/api/v1/orders/1/review-options', { id: '1' })).status, 403);
      f.accounts.get('1').accountStatus = 'LOCKED';
      assert.equal((await f.request('/api/v1/users/me', { id: '1' })).status, 403);
      f.accounts.get('1').accountStatus = 'ACTIVE';
    });
    await t.test('registration normalizes data, hashes password and returns raw session', async () => {
      const data = { fullName: '  Nguyễn Văn An  ', email: 'NEW@example.com', phone: '0901234567', address: '123 Nguyễn Huệ', password: 'password123' };
      const bad = await f.request('/api/v1/auth/register', { method: 'POST', body: { ...data, role: 'ADMIN' } });
      assert.equal(bad.status, 400); assert.ok((await bad.json()).fields.role);
      const res = await f.request('/api/v1/auth/register', { method: 'POST', body: data });
      assert.equal(res.status, 201); const session = await res.json();
      assert.ok(session.accessToken); assert.equal(session.user.role, 'CUSTOMER'); assert.equal(session.user.email, 'new@example.com');
      assert.equal('passwordHash' in session.user, false); assert.equal('data' in session, false);
      const login = await f.request('/api/v1/auth/login', { method: 'POST', body: { email: data.email, password: data.password } });
      assert.equal(login.status, 200); assert.ok((await login.json()).accessToken);
      const wrong = await f.request('/api/v1/auth/login', { method: 'POST', body: { email: data.email, password: 'wrong' } });
      assert.equal(wrong.status, 401);
    });
    await t.test('pagination, nested unknown fields and invalid IDs yield keyed errors', async () => {
      let res = await f.request('/api/v1/orders?page=2&limit=5', { id: '1' });
      assert.equal(res.status, 200); assert.equal(f.calls.at(-1).args[1].page, 2);
      assert.equal((await f.request('/api/v1/orders?limit=101', { id: '1' })).status, 400);
      assert.equal((await f.request('/api/v1/orders/invalid', { id: '1' })).status, 400);
      res = await f.request('/api/v1/orders', { id: '1', method: 'POST', body: { horses: [{ role: 'ADMIN' }] } });
      assert.equal(res.status, 400); const body = await res.json();
      assert.ok(body.fields['horses.0.role']); assert.equal(body.path, '/api/v1/orders'); assert.ok(body.timestamp);
      assert.equal((await f.request('/api/v1/orders', { id: '1', method: 'POST', body: { horses: [] } })).status, 201);
    });
    await t.test('each role boundary applies before upload and service work', async () => {
      const denied = [
        ['GET','/api/v1/users','1'],['POST','/api/v1/orders','2'],['PUT','/api/v1/orders/1','2'],
        ['POST','/api/v1/orders/1/submit','2'],['POST','/api/v1/orders/1/review','1'],
        ['GET','/api/v1/documents/orders','6'],['POST','/api/v1/documents/orders/1/items/1/upload','2'],
        ['POST','/api/v1/documents/orders/1/items/1/review','1'],['POST','/api/v1/documents/orders/1/items/1/request','1'],
        ['POST','/api/v1/documents/orders/1/dossiers/1','2'],
      ];
      const count = f.calls.length;
      for (const [method,url,id] of denied) assert.equal((await f.request(url,{id,method})).status,403,url);
      assert.equal(f.calls.length,count);
      assert.equal((await f.request('/api/v1/users',{id:'5'})).status,200);
      assert.equal((await f.request('/api/v1/orders/1/review-options',{id:'2'})).status,200);
      assert.equal((await f.request('/api/v1/notifications',{id:'1'})).status,200);
    });
    await t.test('async conflicts retain 409 and unexpected errors do not leak internals', async () => {
      f.services.orders.submit = async () => { throw new ConflictException('Đơn đã gửi.'); };
      const res = await f.request('/api/v1/orders/1/submit', { method:'POST', id:'1' });
      assert.equal(res.status,409); assert.equal((await res.json()).message,'Đơn đã gửi.');
      f.services.orders.detail = async () => { throw new Error('secret SQL password'); };
      const fail = await f.request('/api/v1/orders/1',{id:'1'}); assert.equal(fail.status,500);
      assert.equal((await fail.text()).includes('secret'),false);
    });
    await t.test('multipart upload, size limits, and private download headers survive', async () => {
      const form = new FormData(); form.append('file',new Blob(['%PDF-1.7 fixture'],{type:'application/pdf'}),'test.pdf');
      const res = await f.request('/api/v1/documents/orders/1/items/1/upload',{id:'1',method:'POST',body:form});
      assert.equal(res.status,201); assert.equal(f.calls.at(-1).args[3].originalname,'test.pdf');
      assert.equal((await f.request('/api/v1/documents/orders/1/items/1/upload',{id:'1',method:'POST'})).status,400);
      const big = new FormData(); big.append('file',new Blob([Buffer.alloc(5*1024*1024+1)]),'big.pdf');
      assert.equal((await f.request('/api/v1/documents/orders/1/items/1/upload',{id:'1',method:'POST',body:big})).status,413);
      const result = await f.request('/api/v1/documents/orders/1/files/1',{id:'1'});
      assert.equal(result.headers.get('cache-control'),'private, no-store'); assert.match(result.headers.get('content-disposition'),/filename\*=UTF-8/);
      assert.equal(await result.text(),'%PDF-fixture');
    });
    await t.test('CORS allows configured origin only and JSON errors remain 400', async () => {
      const allowed = await f.request('/api/v1/users/me',{id:'1',headers:{Origin:'http://localhost:5173'}});
      assert.equal(allowed.headers.get('access-control-allow-origin'),'http://localhost:5173');
      const denied = await f.request('/api/v1/users/me',{id:'1',headers:{Origin:'https://evil.invalid'}});
      assert.equal(denied.headers.get('access-control-allow-origin'),null);
      const malformed = await fetch(allowed.url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});
      assert.equal(malformed.status,400);
      assert.equal((await f.request('/missing')).status,404);
    });
    await t.test('health returns 503 when database is unavailable',async()=>{
      f.services.health.check=async()=>{throw new Error('database down');};
      assert.equal((await f.request('/api/v1/health')).status,503);
    });
  } finally { await f.close(); }
});
test('production hides Swagger and rate limiting returns legacy error envelope',async()=>{
  const f=await fixture({production:true,requestLimit:2});
  try {
    assert.equal((await f.request('/docs')).status,404);assert.equal((await f.request('/docs-json')).status,404);
    await f.request('/api/v1/health');await f.request('/api/v1/health');
    const res=await f.request('/api/v1/health');assert.equal(res.status,429);assert.equal((await res.json()).statusCode,429);
  }finally{await f.close();}
});
