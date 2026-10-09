// Structural check in an isolated in-memory SQLite database; does not connect to MySQL.
// Usage: node database/verify-seed.cjs <path-to-wdp_schema_v2.sql>
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const schema = fs.readFileSync(process.argv[2], 'utf8');
const seed = fs.readFileSync(`${__dirname}/wdp_seed_v2.sql`, 'utf8');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON');
db.function('CONCAT', { varargs: true }, (...args) => args.join(''));
const tables = [...schema.matchAll(/CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE=/g)];
for (const [, name, body] of tables) {
  const lines = body.split('\n').map(x => x.trim()).filter(Boolean);
  const definitions = [];
  for (let line of lines) {
    line = line.replace(/,$/, '').replace(/ COMMENT '[^']*'/g, '');
    if (/^KEY /.test(line)) continue;
    line = line.replace(/^UNIQUE KEY \w+/, 'UNIQUE')
      .replace(/BIGINT UNSIGNED/g, 'INTEGER').replace(/\bAUTO_INCREMENT\b/g, '')
      .replace(/DEFAULT \(UTC_TIMESTAMP\(\)\)/g, "DEFAULT '2026-10-08 03:00:00'");
    const e = line.match(/^(\w+)\s+ENUM\(([^)]+)\)/);
    if (e) line = line.replace(/ENUM\([^)]+\)/, 'TEXT') + ` CHECK (${e[1]} IN (${e[2]}))`;
    definitions.push(line);
  }
  const alter = schema.match(new RegExp(`ALTER TABLE ${name}\\s+([\\s\\S]*?);`));
  if (alter) for (const fk of alter[1].matchAll(/FOREIGN KEY \((\w+)\) REFERENCES (\w+) \((\w+)\)/g)) {
    definitions.push(`FOREIGN KEY (${fk[1]}) REFERENCES ${fk[2]} (${fk[3]})`);
  }
  db.exec(`CREATE TABLE ${name} (${definitions.join(',')})`);
}
const inserts = [...seed.matchAll(/INSERT INTO (?:'[^']*(?:''[^']*)*'|[^';])*;/g)];
db.exec('BEGIN');
for (const [sql] of inserts) db.exec(sql);
const failures = db.prepare('PRAGMA foreign_key_check').all();
if (failures.length) throw new Error(JSON.stringify(failures));
const checks = [
  'SELECT h.id FROM horses h JOIN orders o ON o.id=h.order_id WHERE h.owner_id<>o.customer_id',
  'SELECT l.id FROM horse_logs l JOIN horses h ON h.id=l.horse_id JOIN legs g ON g.id=l.leg_id JOIN trips t ON t.id=g.trip_id WHERE h.order_id<>t.order_id',
  'SELECT i.id FROM incidents i JOIN legs l ON l.id=i.leg_id WHERE i.trip_id<>l.trip_id',
  'SELECT i.id FROM incidents i JOIN horses h ON h.id=i.horse_id JOIN trips t ON t.id=i.trip_id WHERE h.order_id<>t.order_id',
  "SELECT d.id FROM documents d WHERE status<>'NOT_SUBMITTED' AND NOT EXISTS (SELECT 1 FROM document_versions v WHERE v.document_id=d.id)",
  'SELECT v.id FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.uploaded_at>d.reviewed_at',
  'SELECT id FROM legs WHERE actual_arrival_at<actual_departure_at',
  "SELECT d.id FROM documents d JOIN horses h ON h.id=d.horse_id JOIN orders o ON o.id=h.order_id WHERE o.status IN ('READY','IN_TRANSIT','DELIVERED') AND d.status<>'VALID'",
];
for (const query of checks) if (db.prepare(query).all().length) throw new Error(query);
const counts = tables.map(([,name]) => ({ table: name, rows: db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get().n }));
if (counts.some(x => !x.rows)) throw new Error('Empty table');
console.table(counts);
console.log(`PASS: ${counts.length} tables, ${counts.reduce((s,x)=>s+x.rows,0)} rows; PK/UNIQUE/FK/CHECK/ENUM and ${checks.length} consistency checks.`);
console.log('This is not a MySQL runtime or stored-procedure validation.');
db.close();
