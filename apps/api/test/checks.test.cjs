const { test } = require('node:test');
const assert = require('node:assert/strict');
const createChecks = require('./checks.cjs');

test('ca lỗi không chặn ca sau, done() liệt kê mọi ca lỗi', async t => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  const checks = createChecks();
  const ran = [];
  await checks.check('một', async () => { ran.push(1); });
  await checks.check('hai', async () => { ran.push(2); assert.equal(1, 2); });
  await checks.check('ba', () => { ran.push(3); throw new Error('lỗi đồng bộ'); });
  await checks.check('bốn', async () => { ran.push(4); });
  assert.deepEqual(ran, [1, 2, 3, 4]);
  assert.equal(checks.passed, 2);
  assert.deepEqual(checks.failed, ['hai', 'ba']);
  assert.throws(() => checks.done(), /2 ca lỗi:\n- hai\n- ba/);
});

test('done() không ném lỗi khi mọi ca đạt', async t => {
  t.mock.method(console, 'log', () => {});
  const checks = createChecks();
  await checks.check('một', async () => {});
  checks.done();
  assert.equal(checks.passed, 1);
});
