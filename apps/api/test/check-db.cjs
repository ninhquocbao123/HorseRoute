const mysql = require('../node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');
const envContent = fs.readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { ca: fs.readFileSync(env.DB_SSL_CA_PATH, 'utf8'), rejectUnauthorized: true }
  });
  const [rows] = await conn.query(`
    SELECT o.id, o.order_code, o.status AS order_status, a.status AS assessment_status, a.note
    FROM orders o
    JOIN specialist_assessments a ON a.order_id = o.id
    WHERE a.status = 'REJECTED' AND o.status <> 'REJECTED'
  `);
  console.log('Orders with REJECTED assessment but order status not REJECTED:', rows);
  await conn.end();
})();

