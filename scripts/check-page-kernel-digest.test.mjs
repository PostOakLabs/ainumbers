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
//   COUNTS-ONLY-DOWN  planBaselineUpdate refuses an addition; baselineCeilingBreach catches a
//                hand-edited regrowth.
//
// The digest values here come from the REAL canonical producer (chaingraph/kernels/_buildid.mjs
// sourceDigest), never a stand-in, so a change to the canonicalization breaks this test rather
// than silently passing it.
//
// Usage: node scripts/check-page-kernel-digest.test.mjs
// Exit 0 = all assertions passed. Exit 1 = a fixture assertion failed.

import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  classifyPage,
  findSentinels,
  kernelFileForPage,
  planBaselineUpdate,
  baselineCeilingBreach,
  FAILING_STATES,
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

// ── the sentinel parser ───────────────────────────────────────────────────────────────────────
assert(findSentinels(page(DIGEST_V1)).length === 1, 'findSentinels finds the single sentinel');
assert(findSentinels(page(null)).length === 0, 'findSentinels finds nothing in an unstamped page');
assert(
  findSentinels(`<!--COUNT:tools-->595<!--/COUNT-->`).length === 0,
  'the COUNT sentinel is not mistaken for a kernel-digest sentinel (distinct key, same family)'
);

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

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log('\nall fixture assertions passed');
