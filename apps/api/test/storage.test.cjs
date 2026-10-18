const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
require('reflect-metadata');
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { saveFile, loadFile, removeFile, verifyStoredFile, MAX_FILE_SIZE } = require('../src/features/documents/file-storage');
const { envValidationSchema } = require('../src/shared/config/env.validation');
const pdf = { buffer: Buffer.from('%PDF-1.7\nfixture'), originalname: 'giấy tờ.pdf', size: 16 };

test('private storage integration', async t => {
  const keys = ['DOCUMENT_STORAGE_PROVIDER', 'DOCUMENT_STORAGE_DIR', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_STORAGE_BUCKET'];
  const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  const originalFetch = global.fetch;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wdp-storage-test-'));
  const calls = [];
  let handler;
  global.fetch = async (input, init) => {
    const url = String(input);
    assert.ok(url.startsWith('https://storage-test.supabase.co/storage/v1/'));
    calls.push({ url, init });
    return handler(url, init);
  };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  Object.assign(process.env, {
    DOCUMENT_STORAGE_PROVIDER: 'supabase', DOCUMENT_STORAGE_DIR: dir,
    SUPABASE_URL: 'https://storage-test.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    SUPABASE_STORAGE_BUCKET: 'wdp-documents',
  });
  try {
    await t.test('uploads only to private bucket, downloads and deletes same stored key', async () => {
      handler = (url, init) => {
        if (url.includes('/bucket/')) return json({ id: 'wdp-documents', name: 'wdp-documents', public: false });
        if (init.method === 'GET') return new Response(pdf.buffer);
        return json({ Key: 'ok' });
      };
      const saved = await saveFile(pdf);
      assert.match(saved.key, /^supabase:wdp-documents\/[a-f0-9-]{36}$/);
      assert.equal(saved.name, pdf.originalname);
      const upload = calls.find(c => c.init.method === 'POST');
      assert.equal(new Headers(upload.init.headers).get('x-upsert'), 'false');
      assert.equal(new Headers(upload.init.headers).get('content-type'), 'application/pdf');
      assert.equal(new Headers(upload.init.headers).get('apikey'), 'sb_secret_test_only');
      // Provider switches must not reinterpret stored cloud references as local paths.
      process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
      assert.deepEqual(await loadFile(saved.key), pdf.buffer);
      await removeFile(saved.key);
      assert.ok(calls.some(c => c.init.method === 'DELETE' && c.init.body.includes(saved.key.split('/')[1])));
      process.env.DOCUMENT_STORAGE_PROVIDER = 'supabase';
    });
    await t.test('public bucket is rejected before uploading', async () => {
      calls.length = 0;
      handler = () => json({ id: 'wdp-documents', public: true });
      await assert.rejects(saveFile(pdf), e => e.getStatus() === 503);
      assert.equal(calls.length, 1);
    });
    await t.test('provider errors stay generic and do not fall back to local disk', async () => {
      handler = () => json({ message: 'sb_secret_sensitive_provider_error' }, 403);
      await assert.rejects(saveFile(pdf), e => e.getStatus() === 503 && !e.message.includes('sb_secret'));
      assert.deepEqual(await fs.readdir(dir), []);
      await assert.rejects(loadFile('supabase:wdp-documents/12345678-1234-1234-1234-123456789abc'), e => e.getStatus() === 503);
    });
    await t.test('local files remain readable after switching to Supabase', async () => {
      process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
      const saved = await saveFile(pdf);
      process.env.DOCUMENT_STORAGE_PROVIDER = 'supabase';
      assert.deepEqual(await loadFile(saved.key), pdf.buffer);
      await removeFile(saved.key);
      await assert.rejects(loadFile(saved.key), e => e.getStatus() === 404);
    });
    await t.test('invalid paths and files never reach storage', async () => {
      calls.length = 0;
      for (const key of ['../../secret', 'https://example.com/a', 'supabase:../x', 'supabase:bucket/../../secret']) {
        await assert.rejects(loadFile(key), e => e.getStatus() === 400);
      }
      await assert.rejects(saveFile({ ...pdf, buffer: Buffer.from('not an image') }), e => e.getStatus() === 400);
      await assert.rejects(saveFile({ ...pdf, buffer: Buffer.alloc(MAX_FILE_SIZE + 1) }), e => e.getStatus() === 400);
      assert.equal(calls.length, 0);
    });
    await t.test('readiness inspects private object metadata only and fails closed', async () => {
      calls.length = 0;
      const key = 'supabase:wdp-documents/12345678-1234-1234-1234-123456789abc';
      handler = url => url.includes('/bucket/') ? json({ public: false }) : json({ size: 16 });
      assert.equal(await verifyStoredFile(key, '16'), true);
      assert.equal(await verifyStoredFile(key, '17'), false);
      assert.ok(calls.every(c => c.url.includes('/bucket/') || c.url.includes('/object/info/')));
      handler = () => json({ public: true });
      assert.equal(await verifyStoredFile(key, '16'), false);
      handler = () => { throw new Error('provider unavailable'); };
      assert.equal(await verifyStoredFile(key, '16'), false);
      assert.equal(await verifyStoredFile('../../secret', '16'), false);
      process.env.DOCUMENT_STORAGE_PROVIDER = 'local';
      const saved = await saveFile(pdf);
      assert.equal(await verifyStoredFile(saved.key, String(saved.size)), true);
      await removeFile(saved.key);
      assert.equal(await verifyStoredFile(saved.key, String(saved.size)), false);
    });
    await t.test('Supabase config is required only when selected', () => {
      const base = { CORS_ORIGIN: 'http://localhost', DB_HOST: 'localhost', DB_NAME: 'test', DB_USER: 'test', DB_PASSWORD: 'test', REDIS_HOST: 'localhost', JWT_SECRET: 'x'.repeat(32) };
      assert.equal(envValidationSchema.validate(base).error, undefined);
      assert.ok(envValidationSchema.validate({ ...base, DOCUMENT_STORAGE_PROVIDER: 'supabase' }).error);
      assert.equal(envValidationSchema.validate({ ...base, DOCUMENT_STORAGE_PROVIDER: 'supabase', SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: 'test' }).error, undefined);
    });
  } finally {
    global.fetch = originalFetch;
    for (const k of keys) previous[k] === undefined ? delete process.env[k] : process.env[k] = previous[k];
    await fs.rm(dir, { recursive: true, force: true });
  }
});
