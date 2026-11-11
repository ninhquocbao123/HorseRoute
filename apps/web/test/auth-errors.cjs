// Phân loại lỗi khi tải tài khoản (lib/auth-errors.ts): chỉ hết phiên khi máy chủ từ chối tài khoản; 429, 5xx, mất mạng thì giữ phiên và thử lại.
// Chạy: node apps/web/test/auth-errors.cjs
const path = require('node:path');
const assert = require('node:assert/strict');
const Module = require('node:module');
const web = path.resolve(__dirname, '..');
const esbuild = require(require.resolve('esbuild', { paths: [require.resolve('vite', { paths: [web] })] }));

(async () => {
  const result = await esbuild.build({
    stdin: { contents: "export * from './src/lib/auth-errors';", resolveDir: web, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  });
  const mod = new Module(path.join(web, 'auth-errors-test.cjs'), module);
  mod.filename = path.join(web, 'auth-errors-test.cjs');
  mod.paths = module.paths;
  mod._compile(result.outputFiles[0].text, mod.filename);
  const { meFailure, retryDelay, ME_RETRIES } = mod.exports;

  for (const status of [401, 403, 404]) assert.equal(meFailure(status), 'expired', String(status));
  for (const status of [undefined, 408, 429, 500, 502, 503]) assert.equal(meFailure(status), 'retry', String(status));
  assert.deepEqual([0, 1, 2, 3, 4].map(n => retryDelay(n)), [1000, 2000, 4000, 8000, 8000]);
  assert.equal(retryDelay(0, '5'), 5000, 'theo Retry-After của máy chủ');
  assert.equal(retryDelay(0, '600'), 30000, 'chờ tối đa 30 giây');
  assert.equal(retryDelay(1, 'abc'), 2000);
  assert.ok(ME_RETRIES >= 3);
  console.log('PASS auth-errors: 401/403/404 hết phiên; 429, 5xx, mất mạng giữ phiên và thử lại theo Retry-After.');
})().catch(error => { console.error(error); process.exitCode = 1; });
