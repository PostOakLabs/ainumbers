// Selftest for scripts/vintage-horizon.mjs (VINTAGE-HORIZON-1).
// Run: node --test scripts/vintage-horizon.test.mjs
// Tables are planted inline so the test does not depend on the live table's contents.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { horizonReport, formatReport } from './vintage-horizon.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'vintage-horizon.mjs');

const v = (fact, vintage, from, to, by) => ({
  fact, vintage, value: 1, unit: 'USD',
  effective_from: from, effective_to: to, successor_expected_by: by,
});

const WAGE_2026 = v('us.ssa.oasdi_wage_base', '2026', '2026-01-01', '2026-12-31', '2026-11-01');
const WAGE_2027 = v('us.ssa.oasdi_wage_base', '2027', '2027-01-01', '2027-12-31', '2027-11-01');

test('acceptance: with the clock at 2026-11-01 the 2027 wage base is listed as missing', () => {
  const rep = horizonReport({ vintages: [WAGE_2026] }, '2026-11-01');
  assert.equal(rep.findings.length, 1);
  assert.equal(rep.findings[0].fact, 'us.ssa.oasdi_wage_base');
  assert.deepEqual(rep.findings[0].reasons.map((r) => r.kind), ['EXPIRING', 'OVERDUE']);
  assert.match(formatReport(rep), /us\.ssa\.oasdi_wage_base/);
});

test('planted complete table gives an empty report', () => {
  const rep = horizonReport({ vintages: [WAGE_2026, WAGE_2027] }, '2026-11-01');
  assert.deepEqual(rep.findings, []);
  assert.match(formatReport(rep), /0 of 1 fact/);
});

test('window edges: 90 days out is listed, 91 days out is not', () => {
  const t = { vintages: [v('f.edge', '2026', '2026-01-01', '2026-12-31', null)] };
  assert.equal(horizonReport(t, '2026-10-02').findings.length, 1); // 90 days left
  assert.equal(horizonReport(t, '2026-10-01').findings.length, 0); // 91 days left
});

test('successor_expected_by arriving lists the fact even far from effective_to', () => {
  const t = { vintages: [v('f.late', '2026', '2026-01-01', '2026-12-31', '2026-03-01')] };
  const rep = horizonReport(t, '2026-03-01');
  assert.deepEqual(rep.findings[0].reasons.map((r) => r.kind), ['OVERDUE']);
  assert.equal(horizonReport(t, '2026-02-28').findings.length, 0);
});

test('a null-ended vintage with no expected successor is ignored', () => {
  const t = { vintages: [v('f.open', '2026', '2026-01-01', null, null)] };
  assert.deepEqual(horizonReport(t, '2030-01-01').findings, []);
});

test('only the latest vintage counts: an old lapsed one with a successor is quiet', () => {
  const t = { vintages: [
    v('f.chain', '2025', '2025-01-01', '2025-12-31', '2025-11-01'),
    v('f.chain', '2026', '2026-01-01', '2026-12-31', '2026-11-01'),
  ] };
  assert.deepEqual(horizonReport(t, '2026-03-01').findings, []);
});

test('malformed input fails loudly, never green', () => {
  assert.throws(() => horizonReport({}, '2026-11-01'), /vintages/);
  assert.throws(() => horizonReport({ vintages: [] }, 'nov-1'), /--now/);
  assert.throws(() => horizonReport({ vintages: [v('f', '1', '2026-1-1', null, null)] }, '2026-11-01'), /effective_from/);
});

test('CLI: exit 1 with findings, 0 when clean, 2 on a missing table; no network flags needed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vintage-horizon-'));
  const red = join(dir, 'red.json');
  const green = join(dir, 'green.json');
  const out = join(dir, 'gh-output.txt');
  writeFileSync(red, JSON.stringify({ vintages: [WAGE_2026] }));
  writeFileSync(green, JSON.stringify({ vintages: [WAGE_2026, WAGE_2027] }));
  const run = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

  const r = run(['--table', red, '--now', '2026-11-01', '--github-output', out]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /us\.ssa\.oasdi_wage_base/);
  assert.match(readFileSync(out, 'utf8'), /^state=red$/m);

  const g = run(['--table', green, '--now', '2026-11-01']);
  assert.equal(g.status, 0);

  const m = run(['--table', join(dir, 'absent.json'), '--now', '2026-11-01']);
  assert.equal(m.status, 2);
});
