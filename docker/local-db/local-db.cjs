// Dựng bản sao database chung trên máy mình bằng một lệnh, không đụng .env:
//   pnpm db:local        khởi động MySQL (cổng 3307), nạp dump 28/10 nếu là lần đầu, rồi chạy các migration mới hơn
//   pnpm db:local:reset  xóa bản sao trên máy mình rồi làm lại từ đầu
// Đổi cổng: đặt LOCAL_DB_PORT trước khi chạy.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const compose = ['compose', '-f', path.join(__dirname, 'docker-compose.yml')];
const port = process.env.LOCAL_DB_PORT || '3307';
const run = (command, args, env) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (process.argv.includes('--reset')) run('docker', [...compose, 'down', '-v']);
console.log('Khởi động MySQL bản sao (lần đầu mất khoảng 1 phút để nạp dữ liệu)...');
run('docker', [...compose, 'up', '-d', '--wait']);
console.log('Chạy các migration mới hơn bản dump...');
run(process.execPath, [path.join(root, 'apps/api/scripts/db-setup.cjs')], {
  DB_HOST: '127.0.0.1', DB_PORT: port, DB_NAME: 'wdp', DB_USER: 'root', DB_PASSWORD: 'wdp-local', DB_SSL: 'false', DB_SSL_CA_PATH: '',
});
console.log(`\nXong. Trỏ API vào bản sao trong .env: DB_HOST=127.0.0.1 DB_PORT=${port} DB_NAME=wdp DB_USER=root DB_PASSWORD=wdp-local DB_SSL=false`);
