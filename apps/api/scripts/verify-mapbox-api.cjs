require('reflect-metadata');
require('ts-node').register({ project: require('node:path').resolve(__dirname, '../tsconfig.json'), transpileOnly: true });

const { loadEnvironment } = require('../src/shared/config/env');
const { createDatabase } = require('../src/shared/config/db');
const { TokenService } = require('../src/shared/utils/jwt.util');

function fail(message) {
  console.error(`MAPBOX API VERIFY FAILED: ${message}`);
  process.exitCode = 1;
}

async function json(response, label) {
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`${label} trả dữ liệu không phải JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`${label} trả HTTP ${response.status}: ${body?.message || body?.error || 'không có thông báo'}`);
  return body;
}

async function main() {
  const env = loadEnvironment();
  const db = createDatabase(env);
  await db.initialize();
  try {
    const rows = await db.query(`SELECT t.id AS tripId, u.id AS userId, u.email
      FROM trips t
      JOIN orders o ON o.id=t.order_id
      JOIN users u ON u.id=t.planned_by AND u.role='COORDINATOR' AND u.account_status='ACTIVE'
      WHERE t.plan_status='DRAFT' AND o.status IN ('APPROVED','PREPARING')
        AND NOT EXISTS (SELECT 1 FROM legs l WHERE l.trip_id=t.id AND (l.status<>'NOT_STARTED' OR l.actual_departure_at IS NOT NULL OR l.actual_arrival_at IS NOT NULL))
      ORDER BY t.id DESC LIMIT 1`);
    if (!rows.length) throw new Error('Không có chuyến DRAFT hợp lệ thuộc Coordinator để kiểm tra route-preview.');
    const actor = rows[0];
    const accessToken = new TokenService(env.JWT_SECRET).sign({ sub: String(actor.userId), email: actor.email, role: 'COORDINATOR' });
    const headers = { Authorization: `Bearer ${accessToken}` };
    const base = `http://127.0.0.1:${env.PORT || 3000}/api/v1`;

    const searchBody = await json(await fetch(`${base}/maps/search?q=${encodeURIComponent('Hồ Hoàn Kiếm, Hà Nội')}`, {
      headers, signal: AbortSignal.timeout(20_000),
    }), 'GET /maps/search');
    if (!Array.isArray(searchBody.items) || !searchBody.items.length) throw new Error('GET /maps/search không trả kết quả.');
    const item = searchBody.items[0];
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) throw new Error('GET /maps/search trả tọa độ không hợp lệ.');

    const previewBody = await json(await fetch(`${base}/trips/${actor.tripId}/route-preview`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({ waypoints: [
        { id: 'origin-smoke', kind: 'ORIGIN', label: 'Hồ Hoàn Kiếm', latitude: 21.0285, longitude: 105.8542, note: '' },
        { id: 'destination-smoke', kind: 'DESTINATION', label: 'Công viên Thống Nhất', latitude: 21.0110, longitude: 105.8410, note: '' },
      ] }),
    }), 'POST /trips/{id}/route-preview');
    const route = previewBody?.routes?.[0];
    if (!route || route.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || !route.verificationToken) {
      throw new Error('route-preview không trả geometry/token hợp lệ.');
    }
    console.log('MAPBOX API VERIFY PASS');
    console.log(`- GET /api/v1/maps/search: PASS; ${searchBody.items.length} kết quả`);
    console.log(`- POST /api/v1/trips/{id}/route-preview: PASS; ${previewBody.routes.length} phương án; ${Math.round(route.distanceM)} m; ${Math.round(route.durationS)} giây`);
    console.log('- Database: chỉ đọc; route_plan không được ghi trong smoke test');
  } finally {
    await db.destroy();
  }
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
