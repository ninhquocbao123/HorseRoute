import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('./trip-time.utils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { inputToUtc, utcToInput } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`
);

test('converts a Vietnam wall-clock value to an API UTC instant with Z', () => {
  assert.equal(inputToUtc('2026-10-28T15:30'), '2026-10-28T08:30:00.000Z');
});

test('round-trips without depending on the operating-system timezone', () => {
  const local = '2026-01-02T00:15';
  assert.equal(utcToInput(inputToUtc(local)), local);
});

test('preserves invalid/incomplete input for schema validation instead of inventing a time', () => {
  assert.equal(inputToUtc(''), '');
  assert.equal(inputToUtc('2026-10-28'), '2026-10-28');
});
