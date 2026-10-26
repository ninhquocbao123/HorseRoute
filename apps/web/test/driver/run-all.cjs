// Chạy tuần tự các bài kiểm thử trình duyệt Driver + Escort (mỗi file một tiến trình, cùng cổng WEB_TEST_PORT, mặc định 5181).
// PLAYWRIGHT_PACKAGE=<đường dẫn playwright> WEB_TEST_PORT=5181 node apps/web/test/driver/run-all.cjs
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const files = ['driver-trip', 'driver-gps', 'driver-actions', 'driver-incident', 'driver-history', 'driver-notices'].map(name => path.join(__dirname, name + '.browser.cjs'))
  .concat(path.join(__dirname, '../escort.browser.cjs'));
let failed = 0;
for (const file of files) {
  console.log('\n▶ ' + path.basename(file));
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) { failed++; console.log('✖ ' + path.basename(file)); }
}
console.log(failed ? `\n${failed}/${files.length} file lỗi` : `\nTất cả ${files.length} file đạt`);
process.exit(failed ? 1 : 0);
