#!/usr/bin/env node
/**
 * scripts/check-node-complete.mjs — NODE-COMPLETENESS-GATE-1.
 *
 * PR-time gate that a node is WHOLE, not just individually-fenced-clean. art-653's
 * three main-breaks in one day (stale identity shard, missing registration, dead
 * tools/653-... url) were each invisible to per-row fences and advisory-by-design
 * shared gates — the first full-node check happened on `main`. This gate makes
 * them branch-time reds by checking, per node:
 *
 *   (a) identity shard fresh vs landed kernel bytes
 *   (b) registration entry present (chaingraph.meta.json order.nodes + chaingraph.json)
 *   (c) registration `url` resolves to a file existing in the PR tree or on origin/main
 *   (d) node page chaingraph/art-NNN-<slug>.html exists, OR the shard carries an
 *       explicit `pageless: "<reason>"` field
 *   (e) fixtures + proptest files present
 *
 * SO #34 (INDEPENDENT DERIVATION): every check below RECOMPUTES from a primary
 * source — it never trusts a shard's self-claim about itself.
 *   (a) reuses `chaingraph/kernels/gen-kernel-identity.mjs --check --shard=<id>`
 *       verbatim (the canonical §17 producer/checker) — NO second identity
 *       implementation lives in this file.
 *   (b) reuses `scripts/check-shard-assembly.mjs`'s own branch-aware
 *       PENDING-ASSEMBLE / registered / leaked classification (parses its
 *       stdout for this one id) — NO second registration implementation here.
 *   (c) resolves the url against the actual filesystem (PR tree) and, if
 *       absent there, `git cat-file -e origin/main:<path>` — never the shard's
 *       claim that the url is good.
 * SO #34c: a node this gate CANNOT evaluate (malformed shard JSON) is reported
 * as its own FAIL state, never silently skipped or treated as a pass.
 *
 * Usage:
 *   node scripts/check-node-complete.mjs <art-id>          one node, ALL five axes HARD
 *   node scripts/check-node-complete.mjs --all-changed      every node shard/kernel
 *                                                            touched vs origin/main,
 *                                                            each HARD on all five axes
 *   node scripts/check-node-complete.mjs --all              full legacy sweep — (a)(b)(e)
 *                                                            always HARD, (c)(d) ratcheted
 *                                                            against the baseline file
 *   node scripts/check-node-complete.mjs --all --update-baseline
 *                                                            recompute the (c)/(d) legacy
 *                                                            baseline from the current sweep
 *
 * Baseline discipline (copy-hallmarks-baseline pattern): (c)/(d) legacy debt is
 * shielded by scripts/node-completeness-baseline.json — counts only go down. A
 * single-id or --all-changed run is ALWAYS hard on (c)/(d) regardless of the
 * baseline — the baseline only softens the whole-estate --all sweep.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const NODES_DIR = resolve(REPO, 'chaingraph', 'graph', 'nodes');
const KDIR = resolve(REPO, 'chaingraph', 'kernels');
const PROPTEST_DIR = resolve(KDIR, '__proptests__');
const FIXTURES_DIR = resolve(KDIR, 'fixtures');
const BASELINE_PATH = resolve(HERE, 'node-completeness-baseline.json');

const argv = process.argv.slice(2);
const ALL = argv.includes('--all');
const ALL_CHANGED = argv.includes('--all-changed');
const UPDATE_BASELINE = argv.includes('--update-baseline');
const singleId = argv.find((a) => !a.startsWith('--'));

if (!ALL && !ALL_CHANGED && !singleId) {
  console.error('Usage: node scripts/check-node-complete.mjs <art-id> | --all-changed | --all [--update-baseline]');
  process.exit(2);
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function fileExistsOnOriginMain(relPath) {
  try {
    execFileSync('git', ['cat-file', '-e', `origin/main:${relPath}`], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

// ── (a) identity freshness — shells to the canonical §17 producer/checker, no second impl ──────────
function checkIdentity(id) {
  try {
    const out = execFileSync('node', ['chaingraph/kernels/gen-kernel-identity.mjs', '--check', `--shard=${id}`], {
      cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 'PASS', detail: out.trim() };
  } catch (e) {
    const out = (e.stdout || '') + (e.stderr || '');
    // exit 3 = "not in scope for §17 identity" (not live, not gpu:false, kernel not
    // registered, or no .kernel.mjs on disk) — a distinct N-A, never a silent pass.
    if (e.status === 3) return { status: 'N-A', detail: out.trim() || 'not in scope for §17 identity (status/gpu/registration/kernel-file precondition unmet)' };
    return { status: 'FAIL', detail: out.trim() };
  }
}

// ── (b) registration — parses check-shard-assembly.mjs's own stdout for this one id, no second impl ──
function checkRegistration(id) {
  let stdout = '';
  let failed = false;
  try {
    stdout = execFileSync('node', ['scripts/check-shard-assembly.mjs'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    failed = true;
    stdout = (e.stdout || '') + (e.stderr || '');
  }
  const lines = stdout.split('\n');
  const idLineRe = new RegExp(`^\\s*-\\s+${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  let section = null;
  for (const line of lines) {
    if (/PENDING-ASSEMBLE — \d+ node shard/.test(line)) section = 'pending';
    else if (/node shard\(s\) not yet in the assembled chaingraph\.json/.test(line)) section = 'leaked';
    else if (/node\(s\) registered in chaingraph\.json with NO backing shard/.test(line)) section = 'orphan';
    else if (/under an explicit PAGE_BLOCKED_WAIVER/.test(line)) section = 'waived';
    else if (/^check-shard-assembly: OK/.test(line) || /^check-shard-assembly: exiting 0/.test(line)) section = null;
    if (idLineRe.test(line)) {
      if (section === 'pending') return { status: 'PASS', detail: `PENDING-ASSEMBLE — new shard, not yet on origin/main; ASSEMBLE-LAND owns registration, not this row.` };
      if (section === 'leaked') return { status: 'FAIL', detail: `NODE-REGISTRATION-GAP-1 shape — shard present but not registered/assembled (check-shard-assembly.mjs).` };
      if (section === 'waived') return { status: 'PASS', detail: `explicit PAGE_BLOCKED_WAIVER entry (informational).` };
    }
  }
  // Not mentioned anywhere in check-shard-assembly.mjs output at all ⇒ fully assembled + registered.
  if (!failed) return { status: 'PASS', detail: `registered + assembled (absent from every unassembled/orphan/pending list in check-shard-assembly.mjs).` };
  return { status: 'FAIL', detail: `check-shard-assembly.mjs itself failed to run cleanly:\n${stdout}` };
}

// ── (c) url resolution — recomputed against the actual filesystem/tree, never the shard's self-claim ──
function urlToRelPath(url) {
  if (typeof url !== 'string' || !url) return null;
  const m = url.match(/^https?:\/\/[^/]+\/(.+)$/);
  return m ? m[1] : url.replace(/^\/+/, '');
}

function checkUrl(shard) {
  const rel = urlToRelPath(shard?.url);
  if (!rel) return { status: 'FAIL', detail: `shard has no usable url field (raw: ${JSON.stringify(shard?.url)}).` };
  const abs = resolve(REPO, rel);
  if (existsSync(abs)) return { status: 'PASS', detail: `${rel} exists in the PR tree.` };
  if (fileExistsOnOriginMain(rel)) return { status: 'PASS', detail: `${rel} exists on origin/main.` };
  return { status: 'FAIL', detail: `${rel} (from url ${shard.url}) exists neither in the PR tree nor on origin/main — dead url.` };
}

// ── (d) node page exists, or explicit pageless escape ────────────────────────────────────────────────
function checkPage(id, shard) {
  const pagePath = resolve(REPO, 'chaingraph', `${id}.html`);
  if (existsSync(pagePath)) return { status: 'PASS', detail: `chaingraph/${id}.html exists.` };
  if (typeof shard?.pageless === 'string' && shard.pageless.trim()) {
    return { status: 'PASS', detail: `no node page — explicit pageless: "${shard.pageless}"` };
  }
  return { status: 'FAIL', detail: `no chaingraph/${id}.html and no explicit shard.pageless reason.` };
}

// ── (e) fixtures + proptest files present ───────────────────────────────────────────────────────────
function checkFixturesAndProptest(id) {
  const proptestPath = resolve(PROPTEST_DIR, `${id}.proptest.mjs`);
  const fixturesPath = resolve(FIXTURES_DIR, `${id}.fixtures.json`);
  const missing = [];
  if (!existsSync(proptestPath)) missing.push(`__proptests__/${id}.proptest.mjs`);
  if (!existsSync(fixturesPath)) missing.push(`fixtures/${id}.fixtures.json`);
  if (missing.length) return { status: 'FAIL', detail: `missing: ${missing.join(', ')}` };
  return { status: 'PASS', detail: `both __proptests__/${id}.proptest.mjs and fixtures/${id}.fixtures.json present.` };
}

// ── per-node evaluation ──────────────────────────────────────────────────────────────────────────────
function evaluateNode(id) {
  const shardPath = resolve(NODES_DIR, `${id}.json`);
  if (!existsSync(shardPath)) {
    return { id, malformed: true, checks: {}, note: `no chaingraph/graph/nodes/${id}.json shard file.` };
  }
  let shard;
  try {
    shard = JSON.parse(readFileSync(shardPath, 'utf8'));
  } catch (e) {
    // SO #34c: malformed shard is a DISTINCT FAIL, never a skip-pass.
    return { id, malformed: true, checks: {}, note: `shard does not parse as JSON: ${e.message}` };
  }
  return {
    id,
    malformed: false,
    checks: {
      identity: checkIdentity(id),
      registration: checkRegistration(id),
      url: checkUrl(shard),
      page: checkPage(id, shard),
      fixtures: checkFixturesAndProptest(id),
    },
  };
}

function isHardFail(result, { ratchetLegacy }) {
  if (result.malformed) return true;
  const c = result.checks;
  if (c.identity.status === 'FAIL' || c.registration.status === 'FAIL' || c.fixtures.status === 'FAIL') return true;
  if (!ratchetLegacy) {
    if (c.url.status === 'FAIL' || c.page.status === 'FAIL') return true;
  }
  return false;
}

function printNodeReport(result) {
  console.log(`\n── ${result.id} ──`);
  if (result.malformed) {
    console.log(`✗ MALFORMED — ${result.note}`);
    return;
  }
  const glyph = { PASS: '✓', FAIL: '✗', 'N-A': '·' };
  for (const [key, label] of [
    ['identity', '(a) identity fresh vs landed kernel bytes'],
    ['registration', '(b) registration entry present'],
    ['url', '(c) url resolves'],
    ['page', '(d) node page or explicit pageless'],
    ['fixtures', '(e) fixtures + proptest present'],
  ]) {
    const r = result.checks[key];
    console.log(`${glyph[r.status]} ${r.status.padEnd(5)} ${label}`);
    if (r.status !== 'PASS') console.log(`      ${r.detail.split('\n').join('\n      ')}`);
  }
}

// ── changed-id discovery (--all-changed) ────────────────────────────────────────────────────────────
function changedIds() {
  const out = git(['diff', '--name-only', 'origin/main', '--', 'chaingraph/graph/nodes', 'chaingraph/kernels']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', 'chaingraph/graph/nodes', 'chaingraph/kernels']);
  const files = `${out || ''}\n${untracked || ''}`.split('\n').map((l) => l.trim()).filter(Boolean);
  const ids = new Set();
  for (const f of files) {
    let m = f.match(/^chaingraph\/graph\/nodes\/(.+)\.json$/);
    if (m) { ids.add(m[1]); continue; }
    m = f.match(/^chaingraph\/kernels\/(.+)\.kernel\.mjs$/);
    if (m) { ids.add(m[1]); continue; }
  }
  return [...ids].sort();
}

function allIds() {
  return readdirSync(NODES_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
}

// ── modes ────────────────────────────────────────────────────────────────────────────────────────────
if (singleId) {
  const result = evaluateNode(singleId);
  printNodeReport(result);
  const fail = isHardFail(result, { ratchetLegacy: false });
  console.log(`\nNODE-COMPLETE ${singleId}: ${fail ? 'FAIL' : 'PASS'}`);
  process.exit(fail ? 1 : 0);
}

if (ALL_CHANGED) {
  const ids = changedIds();
  if (ids.length === 0) {
    console.log('check-node-complete: no chaingraph/graph/nodes/*.json or chaingraph/kernels/*.kernel.mjs changed vs origin/main — nothing to check.');
    process.exit(0);
  }
  console.log(`check-node-complete --all-changed: ${ids.length} node(s) touched vs origin/main: ${ids.join(', ')}`);
  const results = ids.map(evaluateNode);
  for (const r of results) printNodeReport(r);
  const fails = results.filter((r) => isHardFail(r, { ratchetLegacy: false }));
  console.log(`\nNODE-COMPLETE --all-changed: ${results.length - fails.length}/${results.length} PASS, ${fails.length} FAIL.`);
  if (fails.length) {
    console.log(`FAILING: ${fails.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
  process.exit(0);
}

// --all (whole-estate legacy sweep, (c)/(d) ratcheted against baseline)
{
  const ids = allIds();
  const results = ids.map(evaluateNode);
  const hardFails = results.filter((r) => isHardFail(r, { ratchetLegacy: true })); // (a)(b)(e) + malformed, always hard
  const legacyFails = results.filter((r) => !r.malformed && (r.checks.url.status === 'FAIL' || r.checks.page.status === 'FAIL'));

  if (UPDATE_BASELINE) {
    const baseline = {
      _comment: 'Ratchet ceiling for NODE-COMPLETENESS-GATE-1 (c)/(d) legacy debt — counts only go DOWN. Regenerate with: node scripts/check-node-complete.mjs --all --update-baseline',
      legacy_count: legacyFails.length,
      legacy_ids: legacyFails.map((r) => r.id).sort(),
    };
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`✓ baseline written: ${legacyFails.length} legacy (c)/(d) node(s) → ${BASELINE_PATH}`);
    if (hardFails.length) {
      console.log(`⚠ ${hardFails.length} node(s) also fail a HARD axis ((a)/(b)/(e)/malformed) — these are NEVER baselined:`);
      for (const r of hardFails) console.log(`  - ${r.id}`);
    }
    process.exit(0);
  }

  console.log(`check-node-complete --all: ${results.length} node shard(s) evaluated.`);
  console.log(`  HARD fails ((a)/(b)/(e)/malformed, never baselined): ${hardFails.length}`);
  if (hardFails.length) for (const r of hardFails) console.log(`    - ${r.id}`);
  console.log(`  Legacy (c)/(d) fails: ${legacyFails.length}`);

  let baseline = { legacy_count: 0, legacy_ids: [] };
  let baselineFailure = false;
  if (existsSync(BASELINE_PATH)) {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
    if (legacyFails.length > (baseline.legacy_count ?? 0)) {
      baselineFailure = true;
      const known = new Set(baseline.legacy_ids ?? []);
      const added = legacyFails.filter((r) => !known.has(r.id));
      console.log(`✗ (c)/(d) legacy ratchet FAILED — count rose to ${legacyFails.length}, baseline ceiling is ${baseline.legacy_count ?? 0}.`);
      if (added.length) {
        console.log('  New legacy (c)/(d) fail(s):');
        for (const r of added) console.log(`    - ${r.id}`);
      }
    } else {
      console.log(`✓ (c)/(d) legacy count (${legacyFails.length}) is at or below baseline ceiling (${baseline.legacy_count ?? 0}).`);
    }
  } else {
    console.log('⚠ no node-completeness-baseline.json — run --update-baseline to pin the (c)/(d) ratchet (not blocking here, but preflight wiring should not run --all without one).');
  }

  if (hardFails.length || baselineFailure) {
    console.log(`\nNODE-COMPLETENESS-GATE-1 --all: FAIL.`);
    process.exit(1);
  }
  console.log(`\nNODE-COMPLETENESS-GATE-1 --all: PASS.`);
  process.exit(0);
}
