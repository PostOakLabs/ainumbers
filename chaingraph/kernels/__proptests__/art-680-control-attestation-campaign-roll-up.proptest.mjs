// art-680-control-attestation-campaign-roll-up — class-K property-test FLOOR.
// Authored by ATTEST-CAMPAIGN-BUILD-1 per ATTEST-CAMPAIGN-BUILD-SPEC.md.
// kernel_digest_at_authoring: sha256:ee9ed419ccbe7db7955e9e733873a1d85d7107239c6d930490eb2e393be9b4a5
// spec: ATTEST-CAMPAIGN-BUILD-SPEC.md (workspace root)
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/art-680-control-attestation-campaign-roll-up.proptest.mjs

import { compute } from '../art-680-control-attestation-campaign-roll-up.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = 'art-680-control-attestation-campaign-roll-up';

// ---------- deterministic PRNG (xorshift32) ----------
let seed = 0x679c0a1f;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 4294967296;
}
function randInt(lo, hi) { return lo + Math.floor(rnd() * (hi - lo + 1)); }

// Property 1 — verdict consistency: ESCALATION_FLAGGED iff below threshold OR exceptions>0
// OR unresponded>0; completion_pct and exception_rate_pct match recomputed half-up values.
function checkVerdictConsistency() {
  const N = 2000;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const total = randInt(1, 500);
    const attested = randInt(0, total);
    const exceptions = randInt(0, total);
    const unresponded = randInt(0, total);
    const threshold = randInt(0, 100);
    const { output_payload: o, compliance_flags } = compute({
      controls_total: total, attested, exceptions, unresponded, escalation_threshold_pct: threshold,
    });
    if (compliance_flags.includes('DOMAIN_ERROR')) { violations++; continue; }
    const completion = Math.floor(((attested / total) * 100) * 100 + 0.5) / 100;
    const rate = Math.floor(((exceptions / total) * 100) * 100 + 0.5) / 100;
    const below = completion < threshold;
    const expect = (below || exceptions > 0 || unresponded > 0) ? 'ESCALATION_FLAGGED' : 'NO_ESCALATION';
    if (o.completion_pct !== completion || o.exception_rate_pct !== rate || o.below_threshold !== below || o.overall !== expect) violations++;
  }
  return { name: 'verdict-consistency + half-up rates', checked: N, violations };
}

// Property 2 — invalid-domain rejection: any malformed input fails closed with named
// domain_errors, never a silently repaired roll-up.
function checkFailClosed() {
  const bad = [
    { controls_total: 0, attested: 0, exceptions: 0, unresponded: 0, escalation_threshold_pct: 90 },
    { controls_total: 20, attested: 21, exceptions: 0, unresponded: 0, escalation_threshold_pct: 90 },
    { controls_total: 20, attested: 1.5, exceptions: 0, unresponded: 0, escalation_threshold_pct: 90 },
    { controls_total: 20, attested: 20, exceptions: -1, unresponded: 0, escalation_threshold_pct: 90 },
    { controls_total: 20, attested: 20, exceptions: 0, unresponded: '1', escalation_threshold_pct: 90 },
    { controls_total: 20, attested: 20, exceptions: 0, unresponded: 0, escalation_threshold_pct: 101 },
    { controls_total: 20, attested: 20, exceptions: 0, unresponded: 0, escalation_threshold_pct: '90' },
    {},
  ];
  let checked = 0;
  let violations = 0;
  for (const pp of bad) {
    const { output_payload: o, compliance_flags } = compute(pp);
    checked++;
    if (!compliance_flags.includes('DOMAIN_ERROR') || o.overall !== null || o.completion_pct !== null || !Array.isArray(o.domain_errors) || o.domain_errors.length === 0) violations++;
  }
  return { name: 'fail-closed on malformed inputs', checked, violations };
}

// Property 3 — determinism: same pp twice gives identical payloads.
function checkDeterminism() {
  const N = 500;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const total = randInt(1, 200);
    const pp = { controls_total: total, attested: randInt(0, total), exceptions: randInt(0, total), unresponded: randInt(0, total), escalation_threshold_pct: randInt(0, 100) };
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
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
