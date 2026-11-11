const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('reflect-metadata');
require('ts-node').register({ project: path.resolve(__dirname, '../tsconfig.json'), transpileOnly: true });

const dir = path.resolve(__dirname, '../src/database/migrations');
const files = fs.readdirSync(dir).filter(file => file.endsWith('.ts')).sort();
const migrations = files.map(file => {
  const exported = Object.values(require(path.join(dir, file))).filter(value => typeof value === 'function');
  assert.equal(exported.length, 1, `${file} phải export đúng một class migration`);
  return { file, Migration: exported[0] };
});

test('baseline schema stays in sync with the schema dump and never creates the migrations table', () => {
  const { baselineTables } = require('../src/database/baseline-schema');
  const dump = fs.readFileSync(path.resolve(__dirname, 'fixtures/schema.sql'), 'utf8')
    .match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g)
    .filter(statement => !statement.startsWith('CREATE TABLE `migrations`'))
    .map(statement => statement.replace(/\r/g, '').replace(/ AUTO_INCREMENT=\d+/, '').replace(/;$/, ''));
  assert.deepEqual([...baselineTables], dump, 'Chạy lại node scripts/gen-baseline-schema.cjs');
  assert.ok(baselineTables.every(statement => !/AUTO_INCREMENT=\d/.test(statement)));
  assert.ok(baselineTables.some(statement => statement.startsWith('CREATE TABLE `users`')));
});

test('migration class names are unique because TypeORM tracks executed migrations by name', () => {
  const names = migrations.map(({ Migration }) => Migration.name);
  assert.equal(new Set(names).size, names.length);
  for (const { file, Migration } of migrations) {
    const timestamp = file.split('-')[0];
    assert.ok(Migration.name.endsWith(timestamp), `${file}: tên class phải kết thúc bằng ${timestamp}`);
  }
});

test('migrations that manage their own transaction opt out of the TypeORM wrapper', () => {
  for (const { file, Migration } of migrations) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!source.includes('startTransaction(')) continue;
    assert.equal(new Migration().transaction, false, `${file} tự mở transaction nên cần transaction = false`);
  }
});

test('Init builds the baseline only on an empty database and never touches an existing one', async () => {
  const { Init1700000000000 } = require('../src/database/migrations/1700000000000-Init');
  const runner = (tables) => {
    const queries = [];
    return {
      queries,
      hasTable: async name => tables.has(name),
      hasColumn: async (table, column) => table === 'users' && column === 'full_name' && tables.get('users') === 'v2',
      query: async sql => { queries.push(sql); },
    };
  };
  const existing = runner(new Map([['users', 'v2']]));
  await new Init1700000000000().up(existing);
  assert.deepEqual(existing.queries, []);

  const empty = runner(new Map());
  await new Init1700000000000().up(empty);
  assert.equal(empty.queries[0], 'SET FOREIGN_KEY_CHECKS=0');
  assert.equal(empty.queries.at(-1), 'SET FOREIGN_KEY_CHECKS=1');
  assert.equal(empty.queries.filter(sql => sql.startsWith('CREATE TABLE')).length, 25);

  await assert.rejects(new Init1700000000000().up(runner(new Map([['users', 'legacy']]))), /không theo schema WDP v2/);
});
