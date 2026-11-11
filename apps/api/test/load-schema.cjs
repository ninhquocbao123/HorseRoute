// Load only CREATE TABLE definitions from the current dump into an isolated test DB.
// Never execute dump-level GTID, SQL_LOG_BIN, DROP, USE or data statements.
const fs = require('node:fs');
const path = require('node:path');
// except: tên class migration không chạy ở đây, cho test tự chạy để kiểm tra chính migration đó trên lược đồ chưa có nó.
module.exports = async function loadSchema(db, { except = [] } = {}) {
  const skip = new Set(except);
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    const [row] = await runner.query('SELECT DATABASE() AS name');
    if (!/^wdp_flow[1234]_test_[0-9a-f]{16}$/.test(row.name)) throw new Error('Schema loader requires an isolated test database');
    const source = fs.readFileSync(path.join(__dirname, 'fixtures/schema.sql'), 'utf8');
    const statements = source.match(/CREATE TABLE `\w+` \([\s\S]*?\) ENGINE=[^\r\n]+;/g);
    if (!statements?.length) throw new Error('No CREATE TABLE definitions in schema.sql');
    await runner.query('SET FOREIGN_KEY_CHECKS=0');
    const up = async Migration => { if (!skip.has(Migration.name)) await new Migration().up(runner); };
    for (const statement of statements) await runner.query(statement);
    const { OrderRequirements1800000004000 } = require('../src/database/migrations/1800000004000-OrderRequirements');
    const { LocationCoordinates1800000005000 } = require('../src/database/migrations/1800000005000-LocationCoordinates');
    const { TrackMap1800000006000 } = require('../src/database/migrations/1800000006000-TrackMap');
    const { DriverIncidentDetails1800000007000 } = require('../src/database/migrations/1800000007000-DriverIncidentDetails');
    const { HotlineParam1800000008000 } = require('../src/database/migrations/1800000008000-HotlineParam');
    const { VmaxParam1800000009000 } = require('../src/database/migrations/1800000009000-VmaxParam');
    const { RouteCacheFull1800000010000 } = require('../src/database/migrations/1800000010000-RouteCacheFull');
    for (const Migration of [OrderRequirements1800000004000, LocationCoordinates1800000005000, TrackMap1800000006000, DriverIncidentDetails1800000007000, HotlineParam1800000008000, VmaxParam1800000009000, RouteCacheFull1800000010000]) await up(Migration);
    const {CustomerProfiles1800000009000}=require('../src/database/migrations/1800000009000-CustomerProfiles');
    await up(CustomerProfiles1800000009000);
    const {SpecialistAssessments1800000010000}=require('../src/database/migrations/1800000010000-SpecialistAssessments');
    await up(SpecialistAssessments1800000010000);
    const {EscortHorseCare1800000013000}=require('../src/database/migrations/1800000013000-EscortHorseCare');
    await up(EscortHorseCare1800000013000);
    const {CrewReservations1800000091000}=require('../src/database/migrations/1800000091000-CrewReservations');
    await up(CrewReservations1800000091000);
    const {ClientRequestIds1800000092000}=require('../src/database/migrations/1800000092000-ClientRequestIds');
    await up(ClientRequestIds1800000092000);
    const {DeliveryExceptions1800000093000}=require('../src/database/migrations/1800000093000-DeliveryExceptions');
    await up(DeliveryExceptions1800000093000);
    // Migrations newer than the schema.sql dump. Keep this list in step with src/database/migrations.
    // RemoveQuarantineRules is left out on purpose: it seeds document_types, and flow2 tests approval before they exist.
    for (const file of ['1800000007000-PricingVersions', '1800000008000-ManagerQuotes',
      '1800000012000-PaymentSimulation', '1800000013000-TripRoutePlan', '1800000015000-TripFleet', '1800000016000-RepresentativeTripLeg',
      '1800000017000-LegWaypointCheckins', '1800000018000-CareActivityPhotos', '1800000019000-IncidentResponses', '1800000090000-AccountAvatars', '1800000094000-AuthCodes']) {
      const Migration = Object.values(require('../src/database/migrations/' + file))[0];
      await up(Migration);
    }
  } finally {
    try { await runner.query('SET FOREIGN_KEY_CHECKS=1'); } finally { await runner.release(); }
  }
};
