// Tạo database nếu chưa có rồi chạy mọi migration còn thiếu. Mặc định chỉ chạy với MySQL trên máy này.
//   pnpm db:setup                  đọc DB_* từ biến môi trường hoặc .env
//   pnpm db:setup --allow-remote   chỉ khi chủ động muốn áp dụng lên DB ở xa (ví dụ DB chung)
require('reflect-metadata');
const path = require('node:path');
const api = path.resolve(__dirname, '..');
// dotenv không ghi đè biến đã có, nên biến đặt sẵn trong shell luôn được ưu tiên.
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
require('dotenv').config({ path: path.resolve(api, '../../.env') });
require('ts-node').register({ project: path.join(api, 'tsconfig.json'), transpileOnly: true });
const mysql = require('mysql2/promise');
const { mysqlSsl } = require('../src/database/mysql-ssl');
const { createDatabase } = require('../src/shared/config/db');

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

async function main() {
  const env = process.env;
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(key => !env[key]);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  if (!/^\w+$/.test(env.DB_NAME)) throw new Error('DB_NAME chỉ được gồm chữ, số và dấu gạch dưới.');
  if (!LOCAL_HOSTS.includes(env.DB_HOST) && !process.argv.includes('--allow-remote')) {
    throw new Error(`Từ chối chạy trên ${env.DB_HOST}. Thêm --allow-remote nếu thật sự muốn áp dụng lên DB này.`);
  }

  const admin = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD,
    ssl: mysqlSsl(env.DB_SSL, env.DB_SSL_CA_PATH),
  });
  try {
    // utf8mb4_unicode_ci là bắt buộc: migration CustomerProfiles so khớp cột giữa các bảng.
    await admin.query('CREATE DATABASE IF NOT EXISTS `' + env.DB_NAME + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  } finally {
    await admin.end();
  }

  const db = createDatabase(env);
  await db.initialize();
  try {
    const done = await db.runMigrations({ transaction: 'each' });
    console.log(`Database ${env.DB_NAME}: đã chạy ${done.length} migration mới.`);
    for (const migration of done) console.log(`  ${migration.name}`);
  } finally {
    await db.destroy();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
