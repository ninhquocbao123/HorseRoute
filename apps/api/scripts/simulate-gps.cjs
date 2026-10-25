// Mô phỏng GPS cho demo (kế hoạch Bước 6): đăng nhập bằng tài khoản Driver/Escort, lấy tuyến chặng đang chạy từ
// GET /tracking/trips/:tripId/map rồi gửi vị trí dọc tuyến. Máy tính để bàn không di chuyển nên đây là cách duy nhất
// thấy xe "chạy" trên bản đồ. KHÔNG chạy với NODE_ENV=production.
//
// Chạy (API đang chạy ở máy dev, chuyến đã IN_TRANSIT, chặng hiện tại không phải chặng bay):
//   node apps/api/scripts/simulate-gps.cjs --trip 200 --email driver@example.com --password Demo@12345
// Tùy chọn: --api http://localhost:3000/api/v1  --speed 60 (km/h)  --every 10 (giây giữa hai lần gửi)  --batch 2 (điểm/lô)
// Dừng: Ctrl+C. Dừng hẳn 2 phút thì bản đồ chuyển "mất tín hiệu"; quá 10 phút thì quay về vị trí ước tính.
'use strict';

if (process.env.NODE_ENV === 'production') {
  console.error('simulate-gps: không chạy trong production.');
  process.exit(1);
}

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const api = (args.api || 'http://localhost:3000/api/v1').replace(/\/$/, '');
const tripId = args.trip;
const speedKmh = Number(args.speed || 60);
const everySeconds = Number(args.every || 10);
const perBatch = Math.min(20, Math.max(1, Number(args.batch || 2)));
if (!tripId || !args.email || !args.password) {
  console.error('Thiếu tham số. Ví dụ: node apps/api/scripts/simulate-gps.cjs --trip 200 --email driver@example.com --password Demo@12345');
  process.exit(1);
}
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(api).hostname) && args.remote !== 'yes') {
  console.error('simulate-gps chỉ gửi tới API trên máy này. Muốn gửi tới máy khác (vẫn là môi trường dev) thêm --remote yes.');
  process.exit(1);
}

const toRad = deg => (deg * Math.PI) / 180;
function haversineKm([lng1, lat1], [lng2, lat2]) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function pointAt(line, km) {
  for (let i = 1; i < line.length; i++) {
    const segment = haversineKm(line[i - 1], line[i]);
    if (km <= segment) {
      const t = segment ? km / segment : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
    }
    km -= segment;
  }
  return null; // đã tới cuối chặng
}

async function call(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(api + path, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`${method} ${path} → ${response.status} ${data.message || ''}`), { status: response.status });
  return data;
}

(async () => {
  const login = await call('/auth/login', { method: 'POST', body: { email: args.email, password: args.password } });
  const token = login.accessToken || login.token || login.access_token;
  if (!token) throw new Error('Không đọc được token đăng nhập từ /auth/login.');
  const map = await call(`/tracking/trips/${tripId}/map`, { token });
  const leg = map.legs.find(item => item.status === 'MOVING' || item.status === 'AT_STOP');
  if (!leg) throw new Error('Chuyến không có chặng đang chạy (cần ghi mốc xuất phát trước).');
  if (leg.mode === 'AIR') throw new Error('Chặng hiện tại là chặng bay: không nhận GPS.');
  if (!leg.coordinates) throw new Error('Chặng hiện tại thiếu tọa độ điểm đầu/cuối.');
  console.log(`Chuyến ${map.orderCode}, chặng ${leg.seqNo} (${leg.mode}, ${leg.distanceKm ?? '?'} km), ${speedKmh} km/h, gửi mỗi ${everySeconds} giây.`);

  let travelledKm = 0;
  const stepSeconds = everySeconds / perBatch;
  let stopped = false;
  process.on('SIGINT', () => { stopped = true; console.log('\nDừng mô phỏng.'); });
  while (!stopped) {
    const points = [];
    for (let i = 0; i < perBatch; i++) {
      travelledKm += (speedKmh * stepSeconds) / 3600;
      const point = pointAt(leg.coordinates, travelledKm);
      if (!point) break;
      const recordedAt = new Date(Date.now() - (perBatch - 1 - i) * stepSeconds * 1000).toISOString();
      points.push({ latitude: +point[1].toFixed(6), longitude: +point[0].toFixed(6), recordedAt, speedMps: +(speedKmh / 3.6).toFixed(2), accuracyM: 10 });
    }
    if (!points.length) { console.log('Đã tới cuối chặng. Ghi mốc "Đã đến" trên giao diện tài xế rồi chạy lại cho chặng sau.'); break; }
    try {
      const result = await call(`/tracking/trips/${tripId}/positions`, { token, method: 'POST', body: { points } });
      console.log(`${new Date().toLocaleTimeString('vi-VN')} · ${travelledKm.toFixed(2)} km · nhận ${result.accepted}, trùng ${result.duplicates}`);
    } catch (error) {
      console.error(error.message);
      if (error.status === 409 || error.status === 403 || error.status === 404) break;
    }
    await new Promise(resolve => setTimeout(resolve, everySeconds * 1000));
  }
})().catch(error => { console.error('simulate-gps:', error.message); process.exitCode = 1; });
