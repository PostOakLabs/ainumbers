// art-681-best-execution-evidence-pack — class-K property-test FLOOR.
// Authored by BESTEX-PACK-BUILD-1 per BESTEX-PACK-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:fdd1917a5a6fa8051b0636a4e2a78af93da66b2cea56d8f699fd0cf8f63a0d20
// spec: BESTEX-PACK-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-681-best-execution-evidence-pack.proptest.mjs

import { compute } from '../art-681-best-execution-evidence-pack.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-681-best-execution-evidence-pack';

// ---------- deterministic PRNG (xorshift32) ----------
let seed = 0x681be5e7;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
function randInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

// 2dp half-up away from zero, mirroring the kernel's declared rounding.
function round2dpHalfUp(x) {
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.floor(Math.abs(x) * 100 + 0.5)) / 100;
}

// Property 1 — verdict consistency: REVIEW_ITEM_FLAGGED iff some declared venue has
// a negative declared improvement; weighted improvement equals the recomputed
// 2dp-half-up fill-weighted mean; negative_venues preserves declared order.
function checkVerdictConsistency() {
  const N = 2000;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const n = randInt(1, 6);
    const venues = [];
    for (let j = 0; j < n; j++) {
      venues.push({
        venue: `V${j}`,
        fills: randInt(1, 1000),
        avg_improvement_bps: randInt(-200, 200) / 2,
      });
    }
    const { output_payload: o, compliance_flags } = compute({ venues });
    if (compliance_flags.includes('DOMAIN_ERROR')) { violations++; continue; }
    const total = venues.reduce((s, v) => s + v.fills, 0);
    const weighted = round2dpHalfUp(venues.reduce((s, v) => s + v.fills * v.avg_improvement_bps, 0) / total);
    const negatives = venues.filter((v) => v.avg_improvement_bps < 0).map((v) => v.venue);
    const expect = negatives.length > 0 ? 'REVIEW_ITEM_FLAGGED' : 'WITHIN_POLICY';
    if (o.weighted_improvement_bps !== weighted || JSON.stringify(o.negative_venues) !== JSON.stringify(negatives) || o.overall !== expect) violations++;
  }
  return { name: 'verdict-consistency + half-up weighted improvement', checked: N, violations };
}

// Property 2 — invalid-domain rejection: any malformed input fails closed with named
// domain_errors, never a silently repaired evidence pack.
function checkFailClosed() {
  const bad = [
    {},
    { venues: [] },
    { venues: 'V1' },
    { venues: [{ venue: '', fills: 10, avg_improvement_bps: 1 }] },
    { venues: [{ venue: 'V1', fills: 0, avg_improvement_bps: 1 }] },
    { venues: [{ venue: 'V1', fills: 1.5, avg_improvement_bps: 1 }] },
    { venues: [{ venue: 'V1', fills: 10, avg_improvement_bps: '2' }] },
    { venues: [{ venue: 'V1', fills: 10, avg_improvement_bps: NaN }] },
    { venues: [{ venue: 'V1', fills: 10, avg_improvement_bps: 1 }, { venue: 'V2', fills: 10, avg_improvement_bps: undefined }] },
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DOMAIN_ERROR') || o.overall !== null || o.weighted_improvement_bps !== null || o.negative_venues !== null || !Array.isArray(o.domain_errors) || o.domain_errors.length === 0) violations++;
  }
  return { name: 'fail-closed on malformed inputs', checked, violations };
}

// Property 3 — determinism: same pp twice gives identical payloads.
function checkDeterminism() {
  const N = 500;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const n = randInt(1, 4);
    const venues = [];
    for (let j = 0; j < n; j++) {
      venues.push({ venue: `V${j}`, fills: randInt(1, 500), avg_improvement_bps: randInt(-100, 100) / 2 });
    }
    const a = JSON.stringify(compute({ venues }));
    const b = JSON.stringify(compute({ venues }));
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
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
