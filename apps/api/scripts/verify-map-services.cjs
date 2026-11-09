// Gọi thật Photon và OSRM theo cấu hình hiện tại (không ghi database). Chạy: pnpm --filter api verify:maps
const { config } = require('dotenv');
const { resolve } = require('node:path');

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(__dirname, '../../../.env') });

const headers = { 'User-Agent': 'HorseRoute/1.0' };
const geocodingUrl = process.env.MAP_GEOCODING_URL?.trim() || 'https://photon.komoot.io/api/';
const rawRoutingUrl = process.env.MAP_ROUTING_URL?.trim() || 'https://router.project-osrm.org/route/v1/driving/';
const routingUrl = rawRoutingUrl.endsWith('/') ? rawRoutingUrl : `${rawRoutingUrl}/`;

function fail(message) {
  console.error(`MAP SERVICES VERIFY FAILED: ${message}`);
  process.exitCode = 1;
}

async function readJson(response, service) {
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`${service} trả dữ liệu không phải JSON (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(`${service} trả HTTP ${response.status}${typeof body?.message === 'string' ? `: ${body.message}` : ''}`);
  return body;
}

async function main() {
  const geocode = new URL(geocodingUrl);
  geocode.searchParams.set('q', 'Hồ Hoàn Kiếm, Hà Nội');
  geocode.searchParams.set('limit', '1');
  const geocodeBody = await readJson(await fetch(geocode, { headers, signal: AbortSignal.timeout(15_000) }), 'Tìm địa chỉ');
  const feature = geocodeBody?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) {
    throw new Error('Tìm địa chỉ không trả về Point hợp lệ cho truy vấn kiểm tra.');
  }

  const routing = new URL(`${routingUrl}105.8542,21.0285;105.8410,21.0110`);
  routing.searchParams.set('alternatives', '2');
  routing.searchParams.set('geometries', 'geojson');
  routing.searchParams.set('overview', 'full');
  const routingBody = await readJson(await fetch(routing, { headers, signal: AbortSignal.timeout(15_000) }), 'Tính tuyến');
  const route = routingBody?.routes?.[0];
  if (routingBody?.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new Error('Tính tuyến không trả về LineString/distance/duration hợp lệ.');
  }

  console.log('MAP SERVICES VERIFY PASS');
  console.log(`- Tìm địa chỉ (${geocode.host}): PASS; ${geocodeBody.features.length} kết quả hợp lệ`);
  console.log(`- Tính tuyến (${routing.host}): PASS; ${routingBody.routes.length} phương án; ${Math.round(route.distance)} m; ${Math.round(route.duration)} giây`);
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
