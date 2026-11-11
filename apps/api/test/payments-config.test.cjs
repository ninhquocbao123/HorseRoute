// A1: lệnh /payments/config và cờ PAYMENT_SIMULATION_ENABLED (mặc định tắt ở production).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
require('reflect-metadata');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { createApp } = require('../src/app');
const { TokenService } = require('../src/shared/utils/jwt.util');
const { simulationEnabled, vnpayConfigured } = require('../src/features/payments/vnpay');

const KEYS = ['PAYMENT_SIMULATION_ENABLED', 'NODE_ENV', 'VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET', 'VNPAY_RETURN_URL'];
function withEnv(values, fn) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, values);
  try { return fn(); } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

test('cờ mô phỏng: bật khi không phải production, tắt ở production, đặt rõ thì theo giá trị đặt', () => {
  assert.equal(withEnv({}, simulationEnabled), true);
  assert.equal(withEnv({ NODE_ENV: 'production' }, simulationEnabled), false);
  assert.equal(withEnv({ NODE_ENV: 'production', PAYMENT_SIMULATION_ENABLED: 'true' }, simulationEnabled), true);
  assert.equal(withEnv({ PAYMENT_SIMULATION_ENABLED: 'false' }, simulationEnabled), false);
  assert.equal(withEnv({}, vnpayConfigured), false);
  assert.equal(withEnv({ VNPAY_TMN_CODE: 'ABCD1234', VNPAY_HASH_SECRET: 'x', VNPAY_RETURN_URL: 'http://localhost:5173/payments/vnpay/return' }, vnpayConfigured), true);
});

test('tắt mô phỏng thì tạo và hoàn tất phiên mô phỏng trả 404; /payments/config cho giao diện biết', async () => {
  const tokens = new TokenService('payments-config-test-secret-with-32-characters!');
  const calls = [];
  const services = {
    users: { getById: async id => ({ id, role: 'CUSTOMER', accountStatus: 'ACTIVE' }) },
    payments: { createSession: async () => { calls.push('create'); return { sessionCode: 'PAY-1' }; }, completeSession: async () => { calls.push('complete'); return {}; } },
  };
  const server = createApp({ services, tokens, corsOrigin: 'http://localhost:5173', requestLimit: 1000 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/payments';
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens.sign({ sub: '1', email: 'c@t.local', role: 'CUSTOMER' }) };
  const body = JSON.stringify({ orderId: '1', paymentType: 'DEPOSIT', paymentMethod: 'BANK_TRANSFER' });
  const saved = process.env.PAYMENT_SIMULATION_ENABLED;
  try {
    process.env.PAYMENT_SIMULATION_ENABLED = 'false';
    assert.equal((await (await fetch(base + '/config', { headers })).json()).simulation, false);
    assert.equal((await fetch(base + '/sessions', { method: 'POST', headers, body })).status, 404);
    assert.equal((await fetch(base + '/sessions/PAY-1/complete', { method: 'POST', headers, body: JSON.stringify({ result: 'SUCCESS' }) })).status, 404);
    assert.deepEqual(calls, [], 'không chạm tới dịch vụ thanh toán');
    process.env.PAYMENT_SIMULATION_ENABLED = 'true';
    assert.equal((await (await fetch(base + '/config', { headers })).json()).simulation, true);
    assert.equal((await fetch(base + '/sessions', { method: 'POST', headers, body })).status, 201);
    assert.equal((await fetch(base + '/config')).status, 401, 'cần đăng nhập');
  } finally {
    if (saved === undefined) delete process.env.PAYMENT_SIMULATION_ENABLED; else process.env.PAYMENT_SIMULATION_ENABLED = saved;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
});
