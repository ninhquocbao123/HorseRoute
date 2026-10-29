require('reflect-metadata');
require('ts-node').register({ project: require('path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TripsRepository } = require('../src/features/trips/trips.repository');
test('trip list does not depend on route-plan columns and retains coordinator scope', async () => {
  const calls = [];
  const repo = new TripsRepository({ query: async (sql, args) => {
    calls.push({sql,args});
    assert.doesNotMatch(sql, /route_plan/);
    assert.match(sql, /t\.planned_by = \?/);
    return sql.startsWith('SELECT COUNT') ? [{total: 0}] : [];
  }});
  assert.deepEqual(await repo.list({coordinatorId:'12'},20,0), {rows:[],total:0});
  assert.deepEqual(calls[0].args,['12',20,0]);
  assert.deepEqual(calls[1].args,['12']);
});
