const { test } = require('node:test'); const assert = require('node:assert/strict');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { NotificationRelay } = require('../src/features/notifications/notification-relay');

test('relay skips notifications created before start and emits each new one once to its recipient', async () => {
  const rows = [];
  const db = { query: async (sql, params) => sql.includes('MAX(id)') ? [{ maxId: '10' }] : rows.filter(r => BigInt(r.id) > BigInt(params[0])) };
  const sent = [];
  const relay = new NotificationRelay(db, { emitToUsers: (ids, event, payload) => sent.push({ ids, event, payload }) }, 60000);
  await relay.start();
  rows.push({ id: '9', recipientId: '1', content: 'cũ', createdAt: new Date() });
  rows.push({ id: '11', recipientId: '7', content: 'Yêu cầu bổ sung', eventType: 'DOCUMENT_SUPPLEMENT', relatedType: 'DOCUMENT', relatedId: '5', orderId: '100', documentId: '5', horseId: '21', createdAt: new Date('2026-11-19T01:00:00Z') });
  await relay.tick();
  await relay.tick();
  relay.stop();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].ids, ['7']);
  assert.equal(sent[0].event, 'notification:new');
  assert.equal(sent[0].payload.orderId, '100');
  assert.equal(sent[0].payload.createdAt, '2026-11-19T01:00:00.000Z');
});
