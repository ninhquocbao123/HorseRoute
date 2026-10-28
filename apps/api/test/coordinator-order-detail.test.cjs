require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OrdersService } = require('../src/features/orders/orders.service');

test('Coordinator cannot read an order outside their assigned trips', async () => {
  const service = new OrdersService({ query: async (sql, args) => {
    assert.match(sql, /order_id=\? AND planned_by=\?/);
    assert.deepEqual(args, ['31', '7']);
    return [];
  } }, { findOrder: () => assert.fail('Order data must not be read before scope check') });
  await assert.rejects(() => service.detail({ id: '7', role: 'COORDINATOR' }, '31'), e => e.getStatus() === 404);
});

test('Coordinator can read details of an assigned order', async () => {
  const order = { id: '31', status: 'PREPARING', customer_id: '9', desired_departure_date: '2026-12-01' };
  const service = new OrdersService({ manager: {}, query: async () => [{ id: '2' }] }, {
    findOrder: async () => [order], findHorses: async () => [], findDocuments: async () => [],
    findCustomer: async () => [{ full_name: 'Customer' }], findHistory: async () => [],
  });
  const result = await service.detail({ id: '7', role: 'COORDINATOR' }, '31');
  assert.equal(result.id, '31');
  assert.equal(result.customer.full_name, 'Customer');
});
