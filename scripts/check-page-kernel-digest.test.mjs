#!/usr/bin/env node
// scripts/check-page-kernel-digest.test.mjs — fixture proof for PAGE-KERNEL-DIGEST-SENTINEL-1
// (SO #40(b): a new gate proves RED before GREEN, and the proof is re-run by CI forever, not
// quoted once in a PR body).
//
// Every assertion runs on in-memory fixtures — no live page, no live kernel, no clock — so the
// five controls stay meaningful as the estate changes underneath them:
//
//   GREEN        stamped page + unmodified kernel  => OK
//   RED          stamped page + one changed kernel byte => MISMATCH, both digests reported
//   BASELINE     enumerated unstamped page => SHIELDED (passes)
//   NOT-SHIELDED the SAME baselined page with a WRONG sentinel => MISMATCH (absence is shielded,
//                a wrong value never is)
//   NEW-FILE     page absent from the baseline with no sentinel => UNSTAMPED_NEW (fails)
//   DUAL-READ    meta-form page => OK (format=meta); legacy comment-form => OK (format=legacy,
//                deprecated); a wrong/malformed/kernel-less value FAILS in EITHER form; both
//                forms in one page => DUPLICATE; neither => UNSTAMPED_NEW (PAGE-DIGEST-META-FIX-1)
//   COUNTS-ONLY-DOWN  planBaselineUpdate refuses an addition; baselineCeilingBreach catches a
//                hand-edited regrowth.
//
// The digest values here come from the REAL canonical producer (chaingraph/kernels/_buildid.mjs
// sourceDigest), never a stand-in, so a change to the canonicalization breaks this test rather
// than silently passing it.
//
// Usage: node scripts/check-page-kernel-digest.test.mjs
// Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.

import { resolve, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  classifyPage,
  findMetaDigests,
  findSentinels,
  kernelFileForPage,
  metaLineFor,
  planBaselineUpdate,
  baselineCeilingBreach,
  FAILING_STATES,
  NUMERIC_PAGE_RE,
  planStaleUpdate,
  SENTINEL_OPEN,
  SENTINEL_CLOSE,
} from './check-page-kernel-digest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const { sourceDigest } = await import(
  pathToFileURL(resolve(HERE, '..', 'chaingraph', 'kernels', '_buildid.mjs')).href
);

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log(`✗ ${msg}`); } else { console.log(`✓ ${msg}`); }
}

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────
const KERNEL_V1 = `export function compute(pp) {\n  return { rate: 0.36 };\n}\n`;
// ONE byte different (0.36 -> 0.35): the art-231 shape, where a kernel is corrected and the page
// keeps serving the old logic.
const KERNEL_V2 = `export function compute(pp) {\n  return { rate: 0.35 };\n}\n`;

const DIGEST_V1 = await sourceDigest(KERNEL_V1);
const DIGEST_V2 = await sourceDigest(KERNEL_V2);
assert(DIGEST_V1 !== DIGEST_V2, 'a one-byte kernel change moves the canonical sourceDigest');
assert(/^sha256:[0-9a-f]{64}$/.test(DIGEST_V1), 'sourceDigest returns a sha256:-prefixed 64-hex digest');

const page = (digest) =>
  `<!DOCTYPE html>\n<html><head>\n${digest ? SENTINEL_OPEN + digest + SENTINEL_CLOSE + '\n' : ''}</head><body>ok</body></html>\n`;
// Meta-form page (PAGE-DIGEST-META-FIX-1): the canonical non-rendering <head> line.
const metaPage = (digest) =>
  `<!DOCTYPE html>\n<html><head>\n${digest ? metaLineFor(digest) + '\n' : ''}</head><body>ok</body></html>\n`;

// ── the sentinel parser ───────────────────────────────────────────────────────────────────────
assert(findSentinels(page(DIGEST_V1)).length === 1, 'findSentinels finds the single sentinel');
assert(findSentinels(page(null)).length === 0, 'findSentinels finds nothing in an unstamped page');
assert(
  findSentinels(`<!--COUNT:tools-->595<!--/COUNT-->`).length === 0,
  'the COUNT sentinel is not mistaken for a kernel-digest sentinel (distinct key, same family)'
);
assert(findMetaDigests(metaPage(DIGEST_V1)).length === 1, 'findMetaDigests finds the meta-form declaration');
assert(findMetaDigests(metaPage(DIGEST_V1))[0] === DIGEST_V1, 'findMetaDigests reads the content attribute value');
assert(findMetaDigests(`<html><head><meta content="${DIGEST_V1}" name='kernel-digest'></head></html>`).length === 1,
  'findMetaDigests matches the meta tag with attributes in either order');
assert(findMetaDigests(`<meta name="description" content="${DIGEST_V1}">`).length === 0,
  'findMetaDigests ignores a meta tag whose name is not kernel-digest');
assert(findMetaDigests(metaPage(null)).length === 0, 'findMetaDigests finds nothing in an unstamped page');

// ── kernel path derived from the PAGE filename, never from page content (SO #34) ──────────────
assert(
  kernelFileForPage('chaingraph/art-651-authzen-conformance-fixture.html') ===
    'art-651-authzen-conformance-fixture.kernel.mjs',
  'the kernel under test is derived from the page filename, so a page cannot point at a kernel it happens to match'
);

// ── CONTROL 1 — GREEN: stamped page, unmodified kernel ────────────────────────────────────────
{
  const v = classifyPage({ html: page(DIGEST_V1), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'OK', 'GREEN: stamped page + unmodified kernel passes');
  assert(!FAILING_STATES.has(v.state), 'GREEN: OK is not a failing state');
}

// ── CONTROL 2 — RED: stamped page, one kernel byte changed ────────────────────────────────────
{
  const v = classifyPage({ html: page(DIGEST_V1), recomputedDigest: DIGEST_V2, baselined: false });
  assert(v.state === 'MISMATCH', 'RED: one changed kernel byte makes the stamped page MISMATCH');
  assert(FAILING_STATES.has(v.state), 'RED: MISMATCH is a failing state (gate exits 1)');
  assert(v.declared === DIGEST_V1 && v.recomputed === DIGEST_V2, 'RED: both digests are reported, declared and recomputed');
}

// ── CONTROL 3 — BASELINE: enumerated unstamped page passes ────────────────────────────────────
{
  const v = classifyPage({ html: page(null), recomputedDigest: DIGEST_V1, baselined: true });
  assert(v.state === 'SHIELDED', 'BASELINE: an enumerated page with no sentinel is shielded');
  assert(!FAILING_STATES.has(v.state), 'BASELINE: SHIELDED is not a failing state');
}

// ── CONTROL 4 — shielding ABSENCE never shields a WRONG VALUE ─────────────────────────────────
{
  const v = classifyPage({ html: page(DIGEST_V1), recomputedDigest: DIGEST_V2, baselined: true });
  assert(v.state === 'MISMATCH', 'NOT-SHIELDED: a baselined page carrying a WRONG sentinel still FAILS');
  assert(FAILING_STATES.has(v.state), 'NOT-SHIELDED: the baseline shields absence only, never a wrong value');
}
{
  const v = classifyPage({ html: page('sha256:nothex'), recomputedDigest: DIGEST_V1, baselined: true });
  assert(v.state === 'MALFORMED', 'NOT-SHIELDED: a baselined page with a malformed sentinel FAILS rather than being skipped');
}

// ── CONTROL 5 — NEW-FILE: unbaselined page with no sentinel FAILS ─────────────────────────────
{
  const v = classifyPage({ html: page(null), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'UNSTAMPED_NEW', 'NEW-FILE: a page not in the baseline and not stamped FAILS');
  assert(FAILING_STATES.has(v.state), 'NEW-FILE: this is the ratchet — without it the debt grows');
}

// ── CONTROL 5b — DUAL-READ (PAGE-DIGEST-META-FIX-1): meta preferred, legacy tolerated ─────────
{
  const v = classifyPage({ html: metaPage(DIGEST_V1), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'OK' && v.format === 'meta', 'DUAL-READ: a meta-form page passes with format=meta');
}
{
  const v = classifyPage({ html: page(DIGEST_V1), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'OK' && v.format === 'legacy', 'DUAL-READ: a legacy comment-format page still passes with format=legacy (tolerated, deprecated)');
}
{
  const v = classifyPage({ html: metaPage(DIGEST_V1), recomputedDigest: DIGEST_V2, baselined: false });
  assert(v.state === 'MISMATCH' && v.format === 'meta', 'DUAL-READ: a WRONG meta-form digest still FAILS — the meta form is checked in full, not waved through');
}
{
  const v = classifyPage({ html: metaPage('sha256:nothex'), recomputedDigest: DIGEST_V1, baselined: true });
  assert(v.state === 'MALFORMED' && v.format === 'meta', 'DUAL-READ: a malformed meta-form content value FAILS rather than being skipped');
}
{
  const v = classifyPage({ html: metaPage(DIGEST_V1), recomputedDigest: null, baselined: true });
  assert(v.state === 'NO_KERNEL' && v.format === 'meta', 'DUAL-READ: a meta-form sentinel with no kernel file on disk FAILS (SO #34c holds in both forms)');
}
{
  const v = classifyPage({ html: metaPage(null).replace('<head>\n', '<head>\n<meta name="kernel-digest">\n'), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'MALFORMED', 'DUAL-READ: a kernel-digest meta tag with NO content attribute is MALFORMED, not unstamped');
}
{
  const both = `<!DOCTYPE html>\n<html><head>\n${metaLineFor(DIGEST_V1)}\n${SENTINEL_OPEN}${DIGEST_V1}${SENTINEL_CLOSE}\n</head><body>ok</body></html>\n`;
  const v = classifyPage({ html: both, recomputedDigest: DIGEST_V1 });
  assert(v.state === 'DUPLICATE', 'DUAL-READ: a page carrying BOTH forms FAILS as DUPLICATE (exactly one declaration, whichever form)');
}
{
  const v = classifyPage({ html: metaPage(null), recomputedDigest: DIGEST_V1, baselined: false });
  assert(v.state === 'UNSTAMPED_NEW', 'DUAL-READ: a page carrying NEITHER form is UNSTAMPED_NEW — the ratchet is unchanged');
}

// ── structural failure modes ──────────────────────────────────────────────────────────────────
{
  const dup = `<html><head>${SENTINEL_OPEN}${DIGEST_V1}${SENTINEL_CLOSE}${SENTINEL_OPEN}${DIGEST_V1}${SENTINEL_CLOSE}</head></html>`;
  assert(classifyPage({ html: dup, recomputedDigest: DIGEST_V1 }).state === 'DUPLICATE', 'two sentinels in one page FAIL (ambiguous declaration)');
}
{
  const v = classifyPage({ html: page(DIGEST_V1), recomputedDigest: null, baselined: true });
  assert(v.state === 'NO_KERNEL', 'a sentinel with no kernel file on disk FAILS rather than passing vacuously (SO #34c: absence is not a pass)');
}
{
  const upper = classifyPage({ html: page(DIGEST_V1.toUpperCase()), recomputedDigest: DIGEST_V1 });
  assert(upper.state === 'MALFORMED', 'an uppercase-hex sentinel is MALFORMED, not silently normalized (one canonical spelling)');
}

// ── CONTROL 6 — COUNTS ONLY DOWN ──────────────────────────────────────────────────────────────
{
  const base = ['chaingraph/art-01.html', 'chaingraph/art-02.html'];
  const shrink = planBaselineUpdate(['chaingraph/art-01.html'], base);
  assert(shrink.ok === true, 'COUNTS-ONLY-DOWN: removing a stamped page from the shield is allowed');
  assert(shrink.removals.length === 1 && shrink.next.length === 1, 'COUNTS-ONLY-DOWN: --update prunes the newly-stamped page');

  const grow = planBaselineUpdate([...base, 'chaingraph/art-03.html'], base);
  assert(grow.ok === false, 'COUNTS-ONLY-DOWN: --update REFUSES when a new unstamped page would be ADDED');
  assert(grow.additions.includes('chaingraph/art-03.html'), 'COUNTS-ONLY-DOWN: the refusal names the page it will not shield');
}
{
  assert(
    baselineCeilingBreach({ max_unstamped: 2, unstamped: ['a', 'b', 'c'] }) !== null,
    'COUNTS-ONLY-DOWN lock 2: a hand-edited baseline exceeding its own max_unstamped ceiling is caught by the strict gate'
  );
  assert(
    baselineCeilingBreach({ max_unstamped: 3, unstamped: ['a', 'b'] }) === null,
    'COUNTS-ONLY-DOWN lock 2: a baseline at or under its ceiling is clean'
  );
}

// ── NUMERIC SCOPE (PAGE-KERNEL-DIGEST-NUMERIC-SCOPE-1) ────────────────────────────────────────
// Each case builds a synthetic tree in a temp dir and drives the real CLI with --root, so the
// scan, the baseline loader, the ceilings and the updater are all exercised end to end.
const GATE = resolve(HERE, 'check-page-kernel-digest.mjs');
const run = (root, ...args) => spawnSync(process.execPath, [GATE, '--root', root, ...args], { encoding: 'utf8' });
const NUM_BASELINE = (root) => resolve(root, 'scripts', 'page-kernel-digest-numeric-baseline.json');
const readNum = (root) => JSON.parse(readFileSync(NUM_BASELINE(root), 'utf8'));

function makeTree(pages, kernels) {
  const root = mkdtempSync(join(tmpdir(), 'pkd-numeric-'));
  mkdirSync(join(root, 'chaingraph', 'kernels'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const [name, html] of Object.entries(pages)) writeFileSync(join(root, 'chaingraph', name), html);
  for (const [name, src] of Object.entries(kernels)) writeFileSync(join(root, 'chaingraph', 'kernels', name), src);
  return root;
}
const setPage = (root, name, html) => writeFileSync(join(root, 'chaingraph', name), html);

const tmpRoots = [];
try {
  // (a) stale numeric page NOT baselined is RED
  const rootA = makeTree({ '901-stale.html': metaPage(DIGEST_V1) }, { '901-stale.kernel.mjs': KERNEL_V2 });
  tmpRoots.push(rootA);
  {
    const r = run(rootA);
    assert(r.status === 1 && /901-stale\.html \[MISMATCH\]/.test(r.stderr), '(a) RED: a stale numeric page that is not baselined fails the strict gate');
  }
  // (b) the same page baselined is GREEN
  {
    const init = run(rootA, '--init-numeric');
    assert(init.status === 0 && readNum(rootA).stale.length === 1 && readNum(rootA).max_stale === 1, '(b) --init-numeric records the stale page with ceiling 1');
    const r = run(rootA);
    assert(r.status === 0, '(b) GREEN: the same stale numeric page, once baselined, passes');
    assert(run(rootA, '--init-numeric').status === 1, '(b) --init-numeric hard-refuses once the numeric baseline exists');
  }
  // baselined stale page that changes to a DIFFERENT failing state is RED again
  {
    setPage(rootA, '901-stale.html', metaPage('sha256:nothex'));
    const r = run(rootA);
    assert(r.status === 1 && /901-stale\.html \[MALFORMED\]/.test(r.stderr), 'a baselined stale page that changes failing state is RED again');
    setPage(rootA, '901-stale.html', metaPage(DIGEST_V2.replace(/.$/, DIGEST_V2.endsWith('0') ? '1' : '0')));
    assert(run(rootA).status === 1, 'a baselined stale page declaring a different wrong digest is RED again');
    setPage(rootA, '901-stale.html', metaPage(DIGEST_V1));
  }
  // (d) --update refuses to ADD a newly failing numeric page
  {
    setPage(rootA, '902-new.html', metaPage(DIGEST_V1));
    writeFileSync(join(rootA, 'chaingraph', 'kernels', '902-new.kernel.mjs'), KERNEL_V2);
    const before = readFileSync(NUM_BASELINE(rootA), 'utf8');
    const r = run(rootA, '--update');
    assert(r.status === 1 && /902-new\.html/.test(r.stderr), '(d) --update REFUSES to add a newly failing numeric page');
    assert(readFileSync(NUM_BASELINE(rootA), 'utf8') === before, '(d) the refused --update leaves the numeric baseline untouched');
    assert(run(rootA).status === 1, '(d) the newly failing numeric page stays RED');
    rmSync(join(rootA, 'chaingraph', '902-new.html'));
    rmSync(join(rootA, 'chaingraph', 'kernels', '902-new.kernel.mjs'));
  }
  // lock 2: ceiling breach by hand edit
  {
    const obj = readNum(rootA);
    writeFileSync(NUM_BASELINE(rootA), JSON.stringify({ ...obj, max_stale: 0 }, null, 2));
    assert(run(rootA).status === 1, 'lock 2: a stale list above its max_stale ceiling fails the strict gate');
    writeFileSync(NUM_BASELINE(rootA), JSON.stringify(obj, null, 2));
  }
  // (c) fixing the page lets --update lower the baseline and the ceiling
  {
    setPage(rootA, '901-stale.html', metaPage(DIGEST_V2));
    const r = run(rootA, '--update');
    const obj = readNum(rootA);
    assert(r.status === 0 && obj.stale.length === 0 && obj.max_stale === 0, '(c) a fixed stale page is removed by --update and the max_stale ceiling drops');
    assert(run(rootA).status === 0, '(c) the gate is green after the fix');
  }

  // (e) unstamped numeric page: RED unbaselined, GREEN baselined
  const rootE = makeTree({ '903-bare.html': metaPage(null) }, { '903-bare.kernel.mjs': KERNEL_V1 });
  tmpRoots.push(rootE);
  {
    const r = run(rootE);
    assert(r.status === 1 && /903-bare\.html \[UNSTAMPED_NEW\]/.test(r.stderr), '(e) RED: an unstamped numeric page that is not baselined fails');
    run(rootE, '--init-numeric');
    assert(readNum(rootE).unstamped.length === 1 && readNum(rootE).max_unstamped === 1, '(e) --init-numeric shields the unstamped page with ceiling 1');
    assert(run(rootE).status === 0, '(e) GREEN: the same unstamped numeric page, baselined, passes');
  }
  // (f) a baselined unstamped numeric page carrying a WRONG stamp is RED (absence-only shield)
  {
    setPage(rootE, '903-bare.html', metaPage(DIGEST_V2));
    const r = run(rootE);
    assert(r.status === 1 && /903-bare\.html \[MISMATCH\]/.test(r.stderr), '(f) RED: a baselined unstamped numeric page that carries a WRONG stamp fails (absence-only shield)');
    setPage(rootE, '903-bare.html', metaPage(DIGEST_V1));
    assert(run(rootE).status === 0, '(f) the same page with the RIGHT stamp passes');
    const u = run(rootE, '--update');
    assert(u.status === 0 && readNum(rootE).unstamped.length === 0 && readNum(rootE).max_unstamped === 0, '(f) --update drops the now-stamped page and lowers max_unstamped');
  }
  // (g) art-* behaviour unchanged, and non-numeric / other-prefix pages stay out of scope
  {
    const rootG = makeTree(
      { 'art-1-x.html': metaPage(DIGEST_V1), 'cry-9-x.html': metaPage(DIGEST_V2), '904-ok.html': metaPage(DIGEST_V1) },
      { 'art-1-x.kernel.mjs': KERNEL_V1, 'cry-9-x.kernel.mjs': KERNEL_V1, '904-ok.kernel.mjs': KERNEL_V1 }
    );
    tmpRoots.push(rootG);
    const r = run(rootG, '--list');
    assert(/OK\s+chaingraph\/art-1-x\.html/.test(r.stdout) && /OK\s+chaingraph\/904-ok\.html/.test(r.stdout), '(g) art-* and numeric pages are both scanned');
    assert(!/cry-9-x/.test(r.stdout), '(g) other prefixes (cry-) stay unscanned');
    assert(run(rootG).status === 0, '(g) art-* GREEN path is unchanged');
    setPage(rootG, 'art-1-x.html', metaPage(DIGEST_V2));
    assert(run(rootG).status === 1, '(g) art-* RED path is unchanged');
  }
} finally {
  for (const d of tmpRoots) rmSync(d, { recursive: true, force: true });
}

// pure helpers
assert(NUMERIC_PAGE_RE.test('732-x.html') && !NUMERIC_PAGE_RE.test('art-732.html') && !NUMERIC_PAGE_RE.test('cry-1.html'), 'NUMERIC_PAGE_RE matches digit-led names only');
{
  const e = { page: 'p', state: 'MISMATCH', declared: DIGEST_V1, recomputed: DIGEST_V2 };
  assert(planStaleUpdate([e], [e]).ok && planStaleUpdate([], [e]).removals.length === 1, 'planStaleUpdate: same entry ok, fixed entry removed');
  assert(!planStaleUpdate([{ ...e, state: 'MALFORMED' }], [e]).ok, 'planStaleUpdate: a changed state counts as an addition and is refused');
}

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nall fixture assertions passed');
