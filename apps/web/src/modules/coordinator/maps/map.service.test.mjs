import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('./map.service.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { isLatLng, routeInputKey, parseRoutes } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('reject missing/out-of-range/non-finite coordinates without inventing 0,0', () => {
  for (const value of [[null, null], [undefined, undefined], [91, 105], [10, 181], [NaN, 10], ['10', 106]]) assert.equal(isLatLng(value), false);
  assert.equal(isLatLng([10.7769, 106.7009]), true);
});
test('route key changes when a waypoint changes', () => {
  const before = [{ id: 'origin', position: [10, 106] }];
  assert.notEqual(routeInputKey(before), routeInputKey([{ id: 'origin', position: [11, 106] }]));
});
test('validate real OSRM geometry and preserve distance/duration', () => {
  const routes = parseRoutes({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: [[106, 10], [105, 21]] }, distance: 1000, duration: 120 }] });
  assert.equal(routes[0].distanceM, 1000);
  assert.equal(routes[0].durationS, 120);
  assert.deepEqual(routes[0].geometry.coordinates[0], [106, 10]);
});
test('no route or malformed geometry raises actionable error', () => {
  for (const value of [null, { code: 'NoRoute' }, { code: 'Ok', routes: [] }, { code: 'Ok', routes: [{ geometry: { type: 'Point', coordinates: [] }, distance: 0, duration: 0 }] }]) assert.throws(() => parseRoutes(value));
});
