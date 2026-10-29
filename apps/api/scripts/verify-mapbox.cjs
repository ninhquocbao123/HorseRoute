const { config } = require('dotenv');
const { resolve } = require('node:path');

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(__dirname, '../../../.env') });

const token = process.env.MAPBOX_ACCESS_TOKEN?.trim();
const tokenPattern = /^(pk|sk)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function fail(message) {
  console.error(`MAPBOX VERIFY FAILED: ${message}`);
  process.exitCode = 1;
}

async function readJson(response, service) {
  let body;
  try { body = await response.json(); }
  catch { throw new Error(`${service} trả dữ liệu không phải JSON (HTTP ${response.status}).`); }
  if (!response.ok) {
    const providerMessage = typeof body?.message === 'string' ? `: ${body.message}` : '';
    throw new Error(`${service} trả HTTP ${response.status}${providerMessage}`);
  }
  return body;
}

async function main() {
  if (!token) return fail('MAPBOX_ACCESS_TOKEN chưa được cấu hình trong .env gốc.');
  if (!tokenPattern.test(token)) return fail('MAPBOX_ACCESS_TOKEN không đúng định dạng pk... hoặc sk...');

  const geocode = new URL('https://api.mapbox.com/search/geocode/v6/forward');
  geocode.searchParams.set('q', 'Hồ Hoàn Kiếm, Hà Nội');
  geocode.searchParams.set('access_token', token);
  geocode.searchParams.set('autocomplete', 'false');
  geocode.searchParams.set('permanent', 'true');
  geocode.searchParams.set('language', 'vi');
  geocode.searchParams.set('limit', '1');
  const geocodeBody = await readJson(await fetch(geocode, { signal: AbortSignal.timeout(15_000) }), 'Geocoding');
  const feature = geocodeBody?.features?.[0];
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) {
    throw new Error('Geocoding không trả về Point hợp lệ cho truy vấn kiểm tra.');
  }

  const directions = new URL('https://api.mapbox.com/directions/v5/mapbox/driving/105.8542,21.0285;105.8410,21.0110');
  directions.searchParams.set('access_token', token);
  directions.searchParams.set('alternatives', 'true');
  directions.searchParams.set('geometries', 'geojson');
  directions.searchParams.set('overview', 'full');
  const directionsBody = await readJson(await fetch(directions, { signal: AbortSignal.timeout(15_000) }), 'Directions');
  const route = directionsBody?.routes?.[0];
  if (directionsBody?.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates) || route.geometry.coordinates.length < 2 || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    throw new Error('Directions không trả về LineString/distance/duration hợp lệ.');
  }

  console.log('MAPBOX VERIFY PASS');
  console.log(`- Token: ${token.startsWith('sk.') ? 'secret' : 'public'}; giá trị không được in ra`);
  console.log(`- Permanent Geocoding: PASS; ${geocodeBody.features.length} kết quả hợp lệ`);
  console.log(`- Directions: PASS; ${directionsBody.routes.length} phương án; ${Math.round(route.distance)} m; ${Math.round(route.duration)} giây`);
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
