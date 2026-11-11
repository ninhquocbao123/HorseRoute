// Chạy các test không cần trình duyệt của web (logic thuần, render tĩnh). Mỗi file là một script tự kiểm tra bằng assert.
// Chạy hết rồi báo mọi file lỗi.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const files = ['allocate-crew.test.cjs', 'driver-map-theme.cjs', 'map-labels.cjs', 'map-view-plan.cjs', 'route-progress.cjs', 'trip-phase.cjs'];
const failed = [];
for (const file of files) {
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  console.log(`${result.status === 0 ? 'PASS' : 'FAIL'} ${file}`);
  if (result.status !== 0) failed.push(file);
}
if (failed.length) {
  console.error(`Lỗi: ${failed.join(', ')}`);
  process.exitCode = 1;
}
