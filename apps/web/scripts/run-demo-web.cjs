// Chạy web trỏ vào API demo (cổng 3010) mà không đổi apps/web/.env: biến môi trường của tiến trình ưu tiên hơn file .env của Vite.
// Dùng: pnpm dev:web:demo → http://localhost:5180 (xem docs/demo-local.md). Token Mapbox (VITE_MAPBOX_TOKEN) vẫn lấy từ apps/web/.env nếu có.
const path = require('node:path');
const { spawn } = require('node:child_process');
const env = { ...process.env, VITE_API_URL: 'http://localhost:3010/api/v1' };
const bin = path.resolve(__dirname, '../node_modules/.bin/' + (process.platform === 'win32' ? 'vite.cmd' : 'vite'));
const child = spawn(bin, ['--port', '5180', '--strictPort'], { cwd: path.resolve(__dirname, '..'), env, stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', code => process.exit(code ?? 0));
