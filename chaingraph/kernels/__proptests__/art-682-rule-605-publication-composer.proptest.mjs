// art-682-rule-605-publication-composer — class-K property-test FLOOR.
// Authored by RULE605-COMPOSER-BUILD-1 per RULE605-COMPOSER-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:102dc03590fc41678c0b5303fa14a37825e69015161b20e6636d79a4210520b4
// spec: RULE605-COMPOSER-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-682-rule-605-publication-composer.proptest.mjs

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { compute } from '../art-682-rule-605-publication-composer.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-682-rule-605-publication-composer';

const here = dirname(fileURLToPath(import.meta.url));
const kernelSha = createHash('sha256')
  .update(readFileSync(join(here, '..', 'art-682-rule-605-publication-composer.kernel.mjs')))
  .digest('hex');

// ---------- deterministic PRNG (xorshift32) ----------
let seed = 0x682605a1;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
function randInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }
function randSpread() {
  // one-decimal bps figure in (0, 10000], deterministic from the PRNG
  return Math.round((rnd() * 9999 + 0.1) * 10) / 10;
}

// Half-up reference rounding (independent of the kernel implementation).
function refRoundHalfUp(x, dp) {
  let m = 1;
  for (let i = 0; i < dp; i++) m *= 10;
  const scaled = x * m;
  const r = scaled < 0 ? -Math.floor(-scaled + 0.5) : Math.floor(scaled + 0.5);
  return r / m;
}

// Property 1 — verdict + ratio consistency: in-domain input yields PUBLICATION_ROWS_BUILT with
// eq_ratio equal to the independent half-up recomputation; declared categories produce one row
// per category echoing the declared roll-up counts and the same ratio.
function checkVerdictConsistency() {
  const N = 2000;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = {
      orders_covered: randInt(1, 10000),
      shares_covered: randInt(1, 5000000),
      avg_effective_spread_bps: randSpread(),
      avg_quoted_spread_bps: randSpread(),
    };
    const withCats = rnd() < 0.3;
    if (withCats) pp.declared_categories = ['CAT_A', 'CAT_B'];
    const { output_payload: o, compliance_flags } = compute(pp);
    if (compliance_flags.includes('DOMAIN_ERROR')) { violations++; continue; }
    const expectRatio = refRoundHalfUp(pp.avg_effective_spread_bps / pp.avg_quoted_spread_bps, 2);
    if (o.overall !== 'PUBLICATION_ROWS_BUILT' || o.eq_ratio !== expectRatio) violations++;
    if (withCats) {
      if (!Array.isArray(o.publication_rows) || o.publication_rows.length !== 2) { violations++; continue; }
      for (let k = 0; k < 2; k++) {
        const row = o.publication_rows[k];
        if (row.category !== pp.declared_categories[k] || row.eq_ratio !== expectRatio ||
            row.orders_covered !== pp.orders_covered || row.shares_covered !== pp.shares_covered) violations++;
      }
    } else if ('publication_rows' in o) {
      violations++;
    }
  }
  return { name: 'verdict-consistency + half-up eq_ratio + row builder', checked: N, violations };
}

// Property 2 — invalid-domain rejection: any malformed input fails closed with named
// domain_errors, never a silently repaired publication set.
function checkFailClosed() {
  const bad = [
    { orders_covered: 0, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4 },
    { orders_covered: 100, shares_covered: 0, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4 },
    { orders_covered: 100.5, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4 },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 0, avg_quoted_spread_bps: 4 },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: -1, avg_quoted_spread_bps: 4 },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 0 },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 10001 },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: '4' },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4, declared_categories: [] },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4, declared_categories: [''] },
    { orders_covered: 100, shares_covered: 100, avg_effective_spread_bps: 3.2, avg_quoted_spread_bps: 4, declared_categories: 'US_LARGE_CAP' },
    {},
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DOMAIN_ERROR') || o.overall !== null || o.eq_ratio !== null || !Array.isArray(o.domain_errors) || o.domain_errors.length === 0) violations++;
  }
  return { name: 'fail-closed on malformed inputs', checked, violations };
}

// Property 3 — determinism: same pp twice gives identical payloads.
function checkDeterminism() {
  const N = 500;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = {
      orders_covered: randInt(1, 5000),
      shares_covered: randInt(1, 2000000),
      avg_effective_spread_bps: randSpread(),
      avg_quoted_spread_bps: randSpread(),
    };
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    if (a !== b) violations++;
  }
  return { name: 'determinism (pure function of pp)', checked: N, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkVerdictConsistency(),
  checkFailClosed(),
  checkDeterminism(),
];
console.log(`[${KERNEL_ID}] class-K floor property test. kernel sha256:${kernelSha}`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
