const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createServer } = require('node:http');
const { once } = require('node:events');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { startServer } = require('../src/index');
const { mysqlSsl } = require('../src/database/mysql-ssl');
const { safeError, ConfigurationError } = require('../src/shared/utils/logger.util');
const { DocumentsService } = require('../src/features/documents/documents.service');

function fixture() {
  const calls = [];
  const db = { isInitialized: false, async initialize() { calls.push('mysql.connect'); this.isInitialized = true; }, async destroy() { calls.push('mysql.close'); this.isInitialized = false; } };
  const redis = { async connect() { calls.push('redis.connect'); }, disconnect() { calls.push('redis.close'); } };
  const documents = { startExpiryJob() { calls.push('job.start'); }, async stopExpiryJob() { calls.push('job.stop'); } };
  const tracking = { startPositionRetentionJob() { calls.push('positions.start'); }, async stopPositionRetentionJob() { calls.push('positions.stop'); } };
  const server = new EventEmitter();
  server.listening = false;
  server.listen = () => { calls.push('http.listen'); server.listening = true; queueMicrotask(() => server.emit('listening')); };
  server.close = callback => { calls.push('http.close'); server.listening = false; callback(); };
  const dependencies = {
    loadEnvironment: () => ({ PORT: 0, JWT_SECRET: 'test-secret', CORS_ORIGIN: 'http://localhost' }),
    createDatabase: () => db, createRedis: () => redis,
    createServices: () => ({ documents, tracking }), createApp: () => (_req, res) => res.end(), createServer: () => server,
  };
  return { calls, db, redis, documents, server, dependencies };
}

async function capture(action) {
  const logs = [];
  const previous = { log: console.log, warn: console.warn, error: console.error };
  for (const key of Object.keys(previous)) console[key] = line => logs.push(JSON.parse(line));
  try { await action(logs); } finally { Object.assign(console, previous); }
}

test('missing CA reports mysql_config/ENOENT before any connection', async () => capture(async logs => {
  const f = fixture();
  f.dependencies.createDatabase = () => mysqlSsl(true, require('node:path').join(__dirname, 'missing-ca-fixture.pem'));
  await assert.rejects(startServer(f.dependencies), { code: 'ENOENT' });
  assert.equal(logs.find(x => x.event === 'startup_failed').stage, 'mysql_config');
  assert.equal(logs.find(x => x.event === 'startup_failed').code, 'ENOENT');
  assert.deepEqual(f.calls, []);
}));

test('Redis failure survives cleanup failure and remaining resources close', async () => capture(async logs => {
  const f = fixture();
  const original = Object.assign(new Error('sensitive-password'), { code: 'ECONNREFUSED' });
  f.redis.connect = async () => { throw original; };
  f.documents.stopExpiryJob = async () => { throw new Error('cleanup-secret'); };
  f.redis.disconnect = () => { f.calls.push('redis.close'); throw new Error('disconnect-secret'); };
  await assert.rejects(startServer(f.dependencies), error => error === original);
  assert.ok(f.calls.includes('mysql.close'));
  assert.ok(!f.calls.includes('http.listen'));
  assert.equal(logs.find(x => x.event === 'startup_failed').stage, 'redis');
  assert.equal(logs.filter(x => x.event === 'cleanup_failed').length, 2);
  assert.doesNotMatch(JSON.stringify(logs), /sensitive-password|cleanup-secret|disconnect-secret/);
}));

test('occupied real HTTP port reports http/EADDRINUSE and cleans connections', async () => {
  const occupied = createServer();
  occupied.listen(0);
  await once(occupied, 'listening');
  try {
    await capture(async logs => {
      const f = fixture();
      f.dependencies.loadEnvironment = () => ({ PORT: occupied.address().port, JWT_SECRET: 'test-secret' });
      f.dependencies.createServer = createServer;
      await assert.rejects(startServer(f.dependencies), { code: 'EADDRINUSE' });
      assert.equal(logs.find(x => x.event === 'startup_failed').stage, 'http');
      assert.ok(f.calls.includes('redis.close'));
      assert.ok(f.calls.includes('mysql.close'));
      assert.ok(!f.calls.includes('job.start'));
    });
  } finally { await new Promise(resolve => occupied.close(resolve)); }
});

test('shutdown is idempotent and waits for active job before closing database', async () => capture(async () => {
  const f = fixture();
  const signalsBefore = process.listenerCount('SIGTERM');
  let release;
  f.documents.stopExpiryJob = () => new Promise(resolve => { release = resolve; });
  const api = await startServer(f.dependencies);
  const first = api.stop();
  assert.equal(api.stop(), first);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!f.calls.includes('mysql.close'));
  release();
  await first;
  assert.equal(f.calls.filter(x => x === 'mysql.close').length, 1);
  assert.equal(process.listenerCount('SIGTERM'), signalsBefore);
}));

test('document expiry stop waits for actual in-flight query and prevents overlap', async () => {
  let release;
  let queries = 0;
  const service = new DocumentsService({}, {
    findOrdersWithExpiredDocuments: () => { queries++; return new Promise(resolve => { release = resolve; }); },
  });
  service.startExpiryJob();
  service.startExpiryJob();
  const run = service.expireAll();
  let stopped = false;
  const stopping = service.stopExpiryJob().then(() => { stopped = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stopped, false);
  assert.equal(queries, 1);
  release([]);
  await Promise.all([run, stopping]);
  assert.equal(stopped, true);
});

test('diagnostics omit raw messages, SQL, credentials and provider bodies', () => {
  const result = safeError({ code: 'ER_ACCESS_DENIED_ERROR', message: 'password-secret', sql: 'SQL-secret', driverError: { code: 'ER_ACCESS_DENIED_ERROR', sql: 'SQL-secret' } });
  assert.equal(result.code, 'ER_ACCESS_DENIED_ERROR');
  assert.doesNotMatch(JSON.stringify(result), /password-secret|SQL-secret/);
  assert.equal(safeError(new Error('WRONGPASS credential-secret')).code, 'WRONGPASS');
  assert.equal(safeError(new Error('unknown-secret')).code, 'UNKNOWN_ERROR');
  assert.equal(safeError(new ConfigurationError('INVALID_ENV', ['JWT_SECRET'])).configFields, 'JWT_SECRET');
});
