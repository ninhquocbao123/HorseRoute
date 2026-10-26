// Chạy API trỏ vào DB demo cục bộ mà KHÔNG đụng .env gốc: nạp apps/api/.env.demo, GHI ĐÈ biến môi trường (dotenv trong app không ghi đè biến đã có),
// từ chối nếu DB_HOST không phải máy này. Dùng: pnpm dev:api:demo (xem docs/demo-local.md).
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const file = path.resolve(__dirname, '../.env.demo');
if (!fs.existsSync(file)) {
  console.error('Thiếu apps/api/.env.demo. Sao chép từ apps/api/.env.demo.example rồi điền giá trị (docs/demo-local.md).');
  process.exit(1);
}
const demo = require('dotenv').parse(fs.readFileSync(file));
if (!['127.0.0.1', 'localhost', '::1'].includes(demo.DB_HOST)) {
  console.error(`Từ chối: DB_HOST=${demo.DB_HOST} không phải máy này. API demo chỉ dùng với MySQL cục bộ.`);
  process.exit(1);
}
const env = { ...process.env, ...demo };
const bin = path.resolve(__dirname, '../node_modules/.bin/' + (process.platform === 'win32' ? 'nodemon.cmd' : 'nodemon'));
const child = spawn(bin, [], { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', code => process.exit(code ?? 0));
