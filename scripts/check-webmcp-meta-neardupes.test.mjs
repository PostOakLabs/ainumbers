#!/usr/bin/env node
// check-webmcp-meta-neardupes.test.mjs — RED/GREEN controls for the
// near-duplicate WebMCP metadata ceiling (WEBMCP-META-LINT-CEILING-1, SO #40b:
// a gate never observed going red is not known to work).
//
// Legs:
//   RED  (pure)  a synthetic near-duplicate PAIR (identical name+description
//                tokens) scores >= 0.42 and pushes the pair count OVER a
//                synthetic pin — while a missing or non-finite ceiling is
//                REFUSED, never read as Infinity (RATCHET-BASELINE-LOADER-1 / F-11).
//   GREEN(pure)  two genuinely distinct tools stay within a 0 ceiling.
//   RED  (e2e)   a DELETED baseline exits 1 with MISSING-FILE — the deleted-
//                baseline state is a hard red, never a silent pass.
//   RED  (e2e)   the synthetic pair pushes the real CLI over a pinned ceiling
//                of 0 — exit 1, delta + the new pair named.
//   GREEN(e2e)   the real tree passes the real pinned ceiling (exit 0).
//   GREEN(e2e)   report mode is unchanged: exit 0, same summary/done lines,
//                and the 0.42 threshold is still the one in force.
//   RED  (e2e)   --strict is unchanged: a flagged pair under the ceiling still
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
import { scanNeardupes, ceilingBreach, pairKey } from './check-webmcp-meta-neardupes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_LINT = resolve(HERE, 'check-webmcp-meta-neardupes.mjs');
const REAL_LOADER = resolve(HERE, 'ratchet-baseline.mjs');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); passed++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// ── fixtures ───────────────────────────────────────────────────────────────────
// Identical name+description tokens: Jaccard 1.0 x 0.75 = 0.75 >= 0.42 — one
// flagged pair. Distinct tokens: Jaccard 0 — no pair. (Neither description is
// "vague" under the upstream verb test, and neither declares required params,
// so the 0.15 overlap term and the 0.25 bonus stay at zero for both cases.)
const DUP_DESC = 'Fetches the latest euro dollar exchange quote from the central bank feed';
const TOOL_A = {
  mcp_tool_definition: {
    name: 'fetchEurUsdExchangeQuote',
    description: DUP_DESC,
    inputSchema: { type: 'object', properties: {} },
  },
};
const TOOL_A_DUP = {
  mcp_tool_definition: {
    name: 'fetchEurUsdExchangeQuote2',
    description: DUP_DESC,
    inputSchema: { type: 'object', properties: {} },
  },
};
const TOOL_B = {
  mcp_tool_definition: {
    name: 'priceOptionBlackScholes',
    description: 'Values a european vanilla option under dividend yield and risk free discounting',
    inputSchema: { type: 'object', properties: {} },
  },
};

// Temp tree shaped like a mini repo: <tmp>/scripts/{lint,loader}, <tmp>/manifests/.
function makeTree(manifests) {
  const tmp = mkdtempSync(join(tmpdir(), 'wndup-test-'));
  mkdirSync(join(tmp, 'scripts'));
  mkdirSync(join(tmp, 'manifests'));
  writeFileSync(join(tmp, 'scripts', 'check-webmcp-meta-neardupes.mjs'), readFileSync(REAL_LINT, 'utf8'));
  writeFileSync(join(tmp, 'scripts', 'ratchet-baseline.mjs'), readFileSync(REAL_LOADER, 'utf8'));
  for (const [name, doc] of Object.entries(manifests)) {
    writeFileSync(join(tmp, 'manifests', name), JSON.stringify(doc, null, 2) + '\n');
  }
  return tmp;
}

function runCli(dir, args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'scripts', 'check-webmcp-meta-neardupes.mjs'), ...args], {
      encoding: 'utf8', cwd: dir, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// ── legs ───────────────────────────────────────────────────────────────────────
test('RED (pure): synthetic near-duplicate pair pushes the count over a synthetic pin; bad ceilings refused', () => {
  const dir = makeTree({ 'a.manifest.json': TOOL_A, 'a-dup.manifest.json': TOOL_A_DUP });
  try {
    const scan = scanNeardupes([join(dir, 'manifests')], dir);
    assert(scan.pairs.length === 1, `expected exactly 1 flagged pair, got ${scan.pairs.length}`);
    assert(scan.pairs[0].score >= 0.42, `pair must score >= 0.42, got ${scan.pairs[0].score}`);
    const key = pairKey(scan.pairs[0]);
    assert(key.includes('a.manifest.json') && key.includes('a-dup.manifest.json'), `pair key must name both files: ${key}`);
    const breach = ceilingBreach(scan, { pairs: 0, pair_keys: [] });
    assert(breach.over === true, 'pair count 1 must exceed ceiling 0');
    assert(breach.count === 1 && breach.ceiling === 0, 'breach must quote count and ceiling');
    assert(breach.added.length === 1 && breach.added[0] === key, 'breach must name the new pair');
    // ⛔ A non-finite ceiling is the disabled-ratchet state — refused, never Infinity (F-11).
    let threw = false;
    try { ceilingBreach(scan, { pairs: Infinity }); } catch { threw = true; }
    assert(threw, 'Infinity ceiling must throw');
    threw = false;
    try { ceilingBreach(scan, {}); } catch { threw = true; }
    assert(threw, 'missing ceiling key must throw');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('GREEN (pure): genuinely distinct tools stay within a 0 ceiling', () => {
  const dir = makeTree({ 'a.manifest.json': TOOL_A, 'b.manifest.json': TOOL_B });
  try {
    const scan = scanNeardupes([join(dir, 'manifests')], dir);
    assert(scan.pairs.length === 0, `distinct tools must yield 0 pairs, got ${JSON.stringify(scan.pairKeys)}`);
    const breach = ceilingBreach(scan, { pairs: 0, pair_keys: [] });
    assert(breach.over === false && breach.count === 0, 'distinct tools must stay within a 0 ceiling');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED (e2e): a DELETED baseline exits 1 with MISSING-FILE — never green', () => {
  const dir = makeTree({ 'a.manifest.json': TOOL_A, 'a-dup.manifest.json': TOOL_A_DUP });
  try {
    const r = runCli(dir, ['--ceiling']);
    assert(r.status === 1, `deleted baseline must exit 1, got ${r.status}\n${r.out}`);
    assert(r.out.includes('RATCHET BASELINE MISSING-FILE'), `output must name MISSING-FILE:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('RED (e2e): synthetic near-duplicate pair pushes the real CLI over the pinned ceiling', () => {
  const dir = makeTree({ 'a.manifest.json': TOOL_A, 'a-dup.manifest.json': TOOL_A_DUP });
  try {
    writeFileSync(join(dir, 'scripts', 'webmcp-meta-neardupes-baseline.json'),
      JSON.stringify({ pairs: 0, pair_keys: [] }, null, 2) + '\n');
    const r = runCli(dir, ['--ceiling']);
    assert(r.status === 1, `breach must exit 1, got ${r.status}\n${r.out}`);
    assert(r.out.includes('pinned ceiling 0'), `output must quote the ceiling:\n${r.out}`);
    assert(r.out.includes('a.manifest.json') && r.out.includes('a-dup.manifest.json'), `output must name the new pair:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('GREEN (e2e): the real tree passes the real pinned ceiling', () => {
  const out = execFileSync(process.execPath, [REAL_LINT, '--ceiling'], { encoding: 'utf8', cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'] });
  assert(/within ceiling \(\d+ < \d+\)|at ceiling \(\d+ = \d+\)/.test(out), `expected a within/at-ceiling verdict line:\n${out.slice(-400)}`);
});

test('GREEN (e2e): report mode unchanged — exit 0, same summary/done lines, 0.42 threshold intact', () => {
  const out = execFileSync(process.execPath, [REAL_LINT], { encoding: 'utf8', cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'] });
  assert(/findings >= 0\.42: \d+/.test(out), 'report summary line with the 0.42 threshold missing');
  assert(out.trimEnd().endsWith('done (report mode)'), 'report done line missing');
});

test('RED (e2e): --strict unchanged — a flagged pair under the ceiling still exits 1', () => {
  const dir = makeTree({ 'a.manifest.json': TOOL_A, 'a-dup.manifest.json': TOOL_A_DUP });
  try {
    writeFileSync(join(dir, 'scripts', 'webmcp-meta-neardupes-baseline.json'),
      JSON.stringify({ pairs: 99, pair_keys: [] }, null, 2) + '\n'); // ceiling irrelevant here
    const r = runCli(dir, ['--strict']);
    assert(r.status === 1, `strict must exit 1 on findings, got ${r.status}\n${r.out}`);
    assert(r.out.includes('FAIL (--strict, findings above)'), `strict failure line missing:\n${r.out}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`\ncheck-webmcp-meta-neardupes.test.mjs: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
