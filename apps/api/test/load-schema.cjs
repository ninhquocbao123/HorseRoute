// Load only CREATE TABLE definitions from the current dump into an isolated test DB.
// Never execute dump-level GTID, SQL_LOG_BIN, DROP, USE or data statements.
const fs = require('node:fs');
const path = require('node:path');
module.exports = async function loadSchema(db) {
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    const [row] = await runner.query('SELECT DATABASE() AS name');
    if (!/^wdp_flow[1234]_test_[0-9a-f]{16}$/.test(row.name)) throw new Error('Schema loader requires an isolated test database');
    const source = fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8');
    const statements = source.match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g);
    if (!statements?.length) throw new Error('No CREATE TABLE definitions in schema.sql');
    await runner.query('SET FOREIGN_KEY_CHECKS=0');
    for (const statement of statements) await runner.query(statement);
    const { OrderRequirements1800000004000 } = require('../src/database/migrations/1800000004000-OrderRequirements');
    const { LocationCoordinates1800000005000 } = require('../src/database/migrations/1800000005000-LocationCoordinates');
    const { TrackMap1800000006000 } = require('../src/database/migrations/1800000006000-TrackMap');
    const { DriverIncidentDetails1800000007000 } = require('../src/database/migrations/1800000007000-DriverIncidentDetails');
    const { HotlineParam1800000008000 } = require('../src/database/migrations/1800000008000-HotlineParam');
    const { VmaxParam1800000009000 } = require('../src/database/migrations/1800000009000-VmaxParam');
    const { RouteCacheFull1800000010000 } = require('../src/database/migrations/1800000010000-RouteCacheFull');
    for (const Migration of [OrderRequirements1800000004000, LocationCoordinates1800000005000, TrackMap1800000006000, DriverIncidentDetails1800000007000, HotlineParam1800000008000, VmaxParam1800000009000, RouteCacheFull1800000010000]) await new Migration().up(runner);
  } finally {
    try { await runner.query('SET FOREIGN_KEY_CHECKS=1'); } finally { await runner.release(); }
  }
};
