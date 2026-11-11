// Tạo một tài khoản nhân viên trên DB đã dựng bằng `pnpm db:setup`. API không có màn tạo nhân viên,
// nên DB mới chỉ có khách tự đăng ký; dùng lệnh này để có quản trị, quản lý, điều phối, tài xế...
//   pnpm db:create-user --email admin@local.test --role ADMIN --name "Quản trị" --password "..."
//   Vai trò: ADMIN, MANAGER, SPECIALIST, COORDINATOR, DRIVER, ESCORT (DRIVER và ESCORT tạo thêm hồ sơ tổ lái).
//   Mặc định chỉ chạy với MySQL trên máy này; thêm --allow-remote nếu thật sự muốn ghi lên DB ở xa.
const path = require('node:path');
const api = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
require('dotenv').config({ path: path.resolve(api, '../../.env') });
require('ts-node').register({ project: path.join(api, 'tsconfig.json'), transpileOnly: true });
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const { mysqlSsl } = require('../src/database/mysql-ssl');

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];
const ROLES = { ADMIN: 'ADMIN', MANAGER: 'MANAGER', SPECIALIST: 'SPECIALIST', COORDINATOR: 'COORDINATOR', DRIVER: 'DRIVER_ESCORT', ESCORT: 'DRIVER_ESCORT' };

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const env = process.env;
  const email = option('email')?.trim().toLowerCase();
  const role = option('role')?.trim().toUpperCase();
  const name = option('name')?.trim() || email;
  const password = option('password') ?? env.NEW_USER_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('Thiếu hoặc sai --email.');
  if (!ROLES[role]) throw new Error(`--role phải là một trong: ${Object.keys(ROLES).join(', ')}.`);
  if (!password || password.length < 8) throw new Error('Mật khẩu (--password hoặc NEW_USER_PASSWORD) cần ít nhất 8 ký tự.');
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter(key => !env[key]);
  if (missing.length) throw new Error(`Thiếu biến môi trường: ${missing.join(', ')}`);
  if (!LOCAL_HOSTS.includes(env.DB_HOST) && !process.argv.includes('--allow-remote')) {
    throw new Error(`Từ chối chạy trên ${env.DB_HOST}. Thêm --allow-remote nếu thật sự muốn ghi lên DB này.`);
  }

  const db = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER, password: env.DB_PASSWORD,
    database: env.DB_NAME, ssl: mysqlSsl(env.DB_SSL, env.DB_SSL_CA_PATH),
  });
  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) throw new Error(`Email ${email} đã có tài khoản.`);
    await db.beginTransaction();
    const [result] = await db.query(
      "INSERT INTO users(email,password_hash,full_name,role,account_status) VALUES (?,?,?,?,'ACTIVE')",
      [email, await bcrypt.hash(password, 12), name, ROLES[role]],
    );
    // Điều phối chỉ chọn được tài xế, hộ tống có hồ sơ tổ lái đúng loại.
    if (role === 'DRIVER' || role === 'ESCORT') {
      await db.query("INSERT INTO crew_profiles(user_id,crew_type,work_status) VALUES (?,?,'AVAILABLE')", [result.insertId, role]);
    }
    await db.commit();
    console.log(`Đã tạo ${email} (${role}), id ${result.insertId}.`);
  } catch (error) {
    await db.rollback().catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
