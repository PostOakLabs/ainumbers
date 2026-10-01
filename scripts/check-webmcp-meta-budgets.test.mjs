#!/usr/bin/env node
// check-webmcp-meta-budgets.test.mjs — RED/GREEN controls for the WebMCP
// tool-metadata budgets ceiling (WEBMCP-META-LINT-CEILING-1, SO #40b: a gate
// never observed going red is not known to work).
//
// Legs:
//   RED  (pure)  a synthetic over-budget manifest (name 40 chars, description
//                600, parameter description 200, a "$ref") yields exactly the
//                four expected findings and pushes the count OVER a synthetic
//                pin — while a missing or non-finite ceiling is REFUSED, never
//                read as Infinity (RATCHET-BASELINE-LOADER-1 / F-11).
//   GREEN(pure)  a clean synthetic manifest stays within a 0 ceiling.
//   RED  (e2e)   a DELETED baseline exits 1 with MISSING-FILE — the deleted-
//                baseline state is a hard red, never a silent pass.
//   RED  (e2e)   the synthetic over-budget manifest pushes the real CLI over a
//                pinned ceiling of 0 — exit 1, delta + new offender named.
//   GREEN(e2e)   the real tree passes the real pinned ceiling (exit 0).
//   GREEN(e2e)   report mode is unchanged: exit 0, same summary/done lines.
//   RED  (e2e)   --strict is unchanged: a bad manifest under the ceiling still
//                exits 1 in strict mode (the ceiling does not soften it).
//
// The e2e legs execute the REAL gate script copied into a temp tree (with its
// ratchet-baseline.mjs loader), so the exit codes are observable from outside
// the module — never a re-implementation (SO #34).

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanBudgets, ceilingBreach } from './check-webmcp-meta-budgets.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_LINT = resolve(HERE, 'check-webmcp-meta-budgets.mjs');
const REAL_LOADER = resolve(HERE, 'ratchet-baseline.mjs');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── fixtures ───────────────────────────────────────────────────────────────────
// Violates all four gallery-402 budgets at once: name > 30, description > 500,
// a schema description > 150, and a "$ref" — exactly four findings.
const BAD_MANIFEST = {
  mcp_tool_definition: {
    name: 'x'.repeat(40),
    description: 'y'.repeat(600),
    inputSchema: {
      type: 'object',
      properties: { q: { type: 'string', description: 'z'.repeat(200) } },
    },
    outputSchema: { $ref: 'https://example.invalid/schemas/thing.json' },
  },
};
const CLEAN_MANIFEST = {
  mcp_tool_definition: {
    name: 'fetch-eur-usd-rate',
    description: 'Returns the latest euro-to-dollar reference rate and its as-of date.',
    inputSchema: { type: 'object', properties: { date: { type: 'string', description: 'As-of date, YYYY-MM-DD.' } } },
  },
};

// Temp tree shaped like a mini repo: <tmp>/scripts/{lint,loader}, <tmp>/manifests/.
function makeTree(manifests) {
  const tmp = mkdtempSync(join(tmpdir(), 'wbudget-test-'));
  mkdirSync(join(tmp, 'scripts'));
  mkdirSync(join(tmp, 'manifests'));
  writeFileSync(join(tmp, 'scripts', 'check-webmcp-meta-budgets.mjs'), readFileSync(REAL_LINT, 'utf8'));
  writeFileSync(join(tmp, 'scripts', 'ratchet-baseline.mjs'), readFileSync(REAL_LOADER, 'utf8'));
  for (const [name, doc] of Object.entries(manifests)) {
    writeFileSync(join(tmp, 'manifests', name), JSON.stringify(doc, null, 2) + '\n');
  }
  return tmp;
}

function runCli(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', 'check-webmcp-meta-budgets.mjs'), ...args], {
      encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// ── legs ───────────────────────────────────────────────────────────────────────
test('RED (pure): over-budget manifest pushes the count over a synthetic pin; bad ceilings refused', () => {
  const dir = makeTree({ 'bad.manifest.json': BAD_MANIFEST });
  try {
    const scan = scanBudgets([join(dir, 'manifests')], dir);
    assert(scan.findings.length === 4, `expected 4 findings (name/description/param-description/$ref), got ${scan.findings.length}: ${JSON.stringify(scan.findings)}`);
    assert(scan.offenderFiles.length === 1 && scan.offenderFiles[0] === 'manifests/bad.manifest.json', `unexpected offenderFiles: ${JSON.stringify(scan.offenderFiles)}`);
    const breach = ceilingBreach(scan, { violations: 3, violation_files: [] });
    assert(breach.over === true, 'count 4 must exceed ceiling 3');
    assert(breach.count === 4 && breach.ceiling === 3, 'breach must quote count and ceiling');
    assert(breach.added.length === 1 && breach.added[0] === 'manifests/bad.manifest.json', 'breach must name the new offender');
    // ⛔ A non-finite ceiling is the disabled-ratchet state — refused, never Infinity (F-11).
    let threw = false;
    try { ceilingBreach(scan, { violations: Infinity }); } catch { threw = true; }
    assert(threw, 'Infinity ceiling must throw');
    threw = false;
    try { ceilingBreach(scan, {}); } catch { threw = true; }
    assert(threw, 'missing ceiling key must throw');
    // At the pin (count-neutral) there is no breach — a swap stays legal by design.
    const flat = ceilingBreach(scan, { violations: 4, violation_files: ['manifests/bad.manifest.json'] });
    assert(flat.over === false && flat.added.length === 0, 'at-ceiling with known offender must stay green');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('GREEN (pure): clean synthetic manifest stays within a 0 ceiling', () => {
  const dir = makeTree({ 'clean.manifest.json': CLEAN_MANIFEST });
  try {
    const scan = scanBudgets([join(dir, 'manifests')], dir);
    assert(scan.findings.length === 0, `clean manifest must yield 0 findings, got ${JSON.stringify(scan.findings)}`);
    const breach = ceilingBreach(scan, { violations: 0, violation_files: [] });
    assert(breach.over === false && breach.count === 0, 'clean tree must stay within a 0 ceiling');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED (e2e): a DELETED baseline exits 1 with MISSING-FILE — never green', () => {
  const dir = makeTree({ 'bad.manifest.json': BAD_MANIFEST });
  try {
    const r = runCli(dir, ['--ceiling']);
    assert(r.status === 1, `deleted baseline must exit 1, got ${r.status}\n${r.out}`);
    assert(r.out.includes('RATCHET BASELINE MISSING-FILE'), `output must name MISSING-FILE:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED (e2e): synthetic over-budget manifest pushes the real CLI over the pinned ceiling', () => {
  const dir = makeTree({ 'bad.manifest.json': BAD_MANIFEST });
  try {
    writeFileSync(join(dir, 'scripts', 'webmcp-meta-budgets-baseline.json'),
      JSON.stringify({ violations: 0, violation_files: [] }, null, 2) + '\n');
    const r = runCli(dir, ['--ceiling']);
    assert(r.status === 1, `breach must exit 1, got ${r.status}\n${r.out}`);
    assert(r.out.includes('pinned ceiling 0'), `output must quote the ceiling:\n${r.out}`);
    assert(r.out.includes('manifests/bad.manifest.json'), `output must name the new offender:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('GREEN (e2e): the real tree passes the real pinned ceiling', () => {
  const out = execFileSync(process.execPath, [REAL_LINT, '--ceiling'], { encoding: 'utf8', cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'] });
  assert(/within ceiling \(\d+ < \d+\)|at ceiling \(\d+ = \d+\)/.test(out), `expected a within/at-ceiling verdict line:\n${out.slice(-400)}`);
});

test('GREEN (e2e): report mode unchanged — exit 0, same summary and done lines', () => {
  const out = execFileSync(process.execPath, [REAL_LINT], { encoding: 'utf8', cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'] });
  assert(/violations: \d+/.test(out), 'report summary line missing');
  assert(out.trimEnd().endsWith('done (report mode)'), 'report done line missing');
});

test('RED (e2e): --strict unchanged — a bad manifest under the ceiling still exits 1', () => {
  const dir = makeTree({ 'bad.manifest.json': BAD_MANIFEST });
  try {
    writeFileSync(join(dir, 'scripts', 'webmcp-meta-budgets-baseline.json'),
      JSON.stringify({ violations: 99, violation_files: [] }, null, 2) + '\n'); // ceiling irrelevant here
    const r = runCli(dir, ['--strict']);
    assert(r.status === 1, `strict must exit 1 on violations, got ${r.status}\n${r.out}`);
    assert(r.out.includes('FAIL (--strict, violations above)'), `strict failure line missing:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\ncheck-webmcp-meta-budgets.test.mjs: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
