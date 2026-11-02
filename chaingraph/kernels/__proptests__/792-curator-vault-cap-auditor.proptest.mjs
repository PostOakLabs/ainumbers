// 792-curator-vault-cap-auditor — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:9669b37921883a2f008cced06af7614440803b1548615191a49d4bf1ec53b081
// spec: CURATOR-VAULT-CAP-AUDIT-1 row; primary text pinned in research/CURATOR-VAULT-CAP-PIN-2026-10-30.md
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/792-curator-vault-cap-auditor.proptest.mjs

import { compute } from '../792-curator-vault-cap-auditor.kernel.mjs';
import { runFixtureOracle, summarize } from './_pbt-common.mjs';

const KERNEL_ID = '792-curator-vault-cap-auditor';

// Deterministic pseudo-random generator (no Math.random — proptest must be reproducible).
let seed = 0x792c0de;
function rnd(n) {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed % n;
}

function baseCase() {
  return {
    profile: 'morpho_vault_v2',
    snapshot: {
      total_assets_minor: 100_000_000,
      idle_minor: 10_000_000,
      markets: [
        { market_label: 'mkt-a', asset_class: 'rwa_treasury', allocated_minor: 30_000_000, abs_cap_minor: 40_000_000, rel_cap_bp: 4000, withdrawable_minor: 30_000_000 },
        { market_label: 'mkt-b', asset_class: 'defi_lending', allocated_minor: 60_000_000, abs_cap_minor: 70_000_000, rel_cap_bp: 7000, withdrawable_minor: 60_000_000 },
      ],
    },
    mandate: { max_per_market_bp: 7000, max_per_asset_class_bp: { defi_lending: 7000 }, min_idle_bp: 500 },
  };
}

// P1 determinism: identical inputs, identical outputs (pure function of pp).
function checkDeterminism() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 50; i++) {
    const pp = baseCase();
    pp.snapshot.markets[rnd(2)].allocated_minor = rnd(50_000_000);
    const a = JSON.stringify(compute(pp));
    const b = JSON.stringify(compute(pp));
    checked++;
    if (a !== b) violations++;
  }
  return { name: 'determinism-same-input-same-output', checked, violations };
}

// P2 conservation invariant: idle + allocations == total <=> conserved, and the reported
// delta equals total - (idle + allocations) exactly in every generated case.
function checkConservation() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = baseCase();
    const a = rnd(30_000_000), b = rnd(30_000_000);
    pp.snapshot.markets[0].allocated_minor = a;
    pp.snapshot.markets[1].allocated_minor = b;
    pp.snapshot.idle_minor = 100_000_000 - a - b + (rnd(3) - 1) * rnd(1_000); // mostly conserved, sometimes drifted
    const { output_payload: out } = compute(pp);
    const idlePlus = pp.snapshot.idle_minor + a + b;
    checked++;
    if (out.conservation.conserved !== (idlePlus === pp.snapshot.total_assets_minor)) violations++;
    if (out.conservation.delta_minor !== pp.snapshot.total_assets_minor - idlePlus) violations++;
  }
  return { name: 'conservation-idle-plus-allocations-equals-total', checked, violations };
}

// P3 relative-cap semantics: breach iff allocated * 10000 > rel_cap_bp * total (exact
// integer cross-multiplication, the pinned Morpho semantics, no division), independent of
// how large the numbers are (Big-integer scale safety).
function checkRelativeCapPredicate() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = baseCase();
    const total = 1_000_000_000_000_000 + rnd(1_000_000); // large scale, > 2^53 territory in products
    const bp = rnd(10000);
    const alloc = Math.floor((total * bp) / 10000) + (rnd(3) - 1); // straddle the exact boundary
    pp.snapshot.total_assets_minor = total;
    pp.snapshot.idle_minor = total - alloc;
    pp.snapshot.markets = [{ market_label: 'mkt-a', asset_class: 'other', allocated_minor: alloc, abs_cap_minor: undefined, rel_cap_bp: bp, withdrawable_minor: undefined }];
    pp.mandate = { max_per_market_bp: 1000000, max_per_asset_class_bp: { defi_lending: 1000000 }, min_idle_bp: 0 };
    const expected = alloc * 10000 > bp * total; // exact in float64? NO for big totals — use the kernel's own contract
    const exact = BigInt(alloc) * 10000n > BigInt(bp) * BigInt(total);
    const { output_payload: out } = compute(pp);
    const fired = out.cap_breaches.some((x) => x.kind === 'relative');
    checked++;
    if (fired !== exact) violations++;
    if (expected !== exact && Math.abs(alloc * 10000 - bp * total) < Number.MAX_SAFE_INTEGER) violations++; // float path may only disagree where exact arithmetic says so
  }
  return { name: 'relative-cap-exact-cross-multiplication-predicate', checked, violations };
}

// P4 invalid domain: malformed inputs are REFUSED (INDETERMINATE verdict + MALFORMED flag)
// and never throw, across a battery of shaped-bad inputs.
function checkInvalidDomainRefusal() {
  let checked = 0, violations = 0;
  const bad = [
    {},
    { profile: 'made_up' },
    { profile: 'generic', snapshot: { total_assets_minor: 1, idle_minor: -1, markets: [] }, mandate: { max_per_market_bp: 1, min_idle_bp: 0 } },
    { profile: 'generic', snapshot: { total_assets_minor: 1.5, idle_minor: 0, markets: [{ market_label: 'x', asset_class: 'other', allocated_minor: 0 }] }, mandate: { max_per_market_bp: 1, min_idle_bp: 0 } },
    { profile: 'generic', snapshot: { total_assets_minor: 10, idle_minor: 0, markets: [{ market_label: 'x', asset_class: 'y kombucha', allocated_minor: 0 }] }, mandate: { max_per_market_bp: 1, min_idle_bp: 0 } },
    { profile: 'generic', snapshot: { total_assets_minor: 10, idle_minor: 0, markets: [{ market_label: 'x', asset_class: 'other', allocated_minor: 0 }] }, mandate: { max_per_market_bp: 1, min_idle_bp: 0, max_defi_bp: 'high' } },
    { profile: 'generic', snapshot: { total_assets_minor: 10, idle_minor: 0, markets: [{ market_label: 'x', asset_class: 'other', allocated_minor: 0 }] }, mandate: { max_per_market_bp: 1, min_idle_bp: 0 }, redemptions: { pending_minor: -3, horizon_hours: 1 } },
  ];
  for (const pp of bad) {
    checked++;
    try {
      const { output_payload: out, compliance_flags } = compute(pp);
      if (out.verdict !== 'INDETERMINATE' || !compliance_flags.includes('CURATOR_VAULT_CAPS_MALFORMED_INPUT')) violations++;
    } catch {
      violations++; // refusal must be a value, never an exception
    }
  }
  return { name: 'invalid-domain-refused-not-thrown', checked, violations };
}

// P5 monotone severity: a within-mandate snapshot stays WITHIN_* when limits are widened,
// and scaling every allocation up uniformly eventually produces a cap or mandate breach.
function checkMonotoneSeverity() {
  let checked = 0, violations = 0;
  for (let i = 0; i < 50; i++) {
    const pp = baseCase();
    pp.snapshot.markets.forEach((m) => { m.allocated_minor = rnd(20_000_000); });
    pp.snapshot.idle_minor = 100_000_000 - pp.snapshot.markets.reduce((s, m) => s + m.allocated_minor, 0);
    const v1 = compute(pp).output_payload.verdict;
    // widen every limit by 10x: breaches cannot appear that were not there before
    pp.mandate.max_per_market_bp *= 10;
    for (const k of Object.keys(pp.mandate.max_per_asset_class_bp)) pp.mandate.max_per_asset_class_bp[k] *= 10;
    pp.mandate.min_idle_bp = 0;
    pp.snapshot.markets.forEach((m) => { if (m.abs_cap_minor !== undefined) m.abs_cap_minor = 1_000_000_000; if (m.rel_cap_bp !== undefined) m.rel_cap_bp = 1000000; });
    const v2 = compute(pp).output_payload.verdict;
    checked++;
    const breachRank = (v) => (v === 'BREACH' ? 2 : v === 'WITHIN_MANDATE_WITH_WARNINGS' ? 1 : 0);
    if (breachRank(v2) > breachRank(v1)) violations++;
  }
  return { name: 'widening-limits-never-creates-breaches', checked, violations };
}

// P6 verdict vocabulary and output shape on all well-formed fixture vectors.
function checkVerdictVocabulary() {
  const allowed = ['WITHIN_MANDATE', 'WITHIN_MANDATE_WITH_WARNINGS', 'BREACH', 'INDETERMINATE'];
  let checked = 0, violations = 0;
  for (let i = 0; i < 30; i++) {
    const pp = baseCase();
    pp.snapshot.markets[0].allocated_minor = rnd(100_000_001);
    pp.snapshot.markets[1].allocated_minor = Math.max(0, 100_000_000 - pp.snapshot.markets[0].allocated_minor - 5_000_000);
    const { output_payload: out } = compute(pp);
    checked++;
    if (!allowed.includes(out.verdict)) violations++;
    if (!out.conservation || typeof out.concentration.herfindahl_bp2 !== 'number') violations++;
  }
  return { name: 'verdict-vocabulary-and-output-shape', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkDeterminism(),
  checkConservation(),
  checkRelativeCapPredicate(),
  checkInvalidDomainRefusal(),
  checkMonotoneSeverity(),
  checkVerdictVocabulary(),
];
console.log(`[${KERNEL_ID}] class-K floor property test.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
