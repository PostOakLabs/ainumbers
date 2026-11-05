// 797-stablecoin-cash-equivalent-test — class-K property-test FLOOR.
// kernel_digest_at_authoring: sha256:ee032e45e811b5272ea2ff35bb5b2494084d34df6cbb58bc6aec3e920305167a
// spec: holder-side cash-equivalent classification for a declared stablecoin holding under the
//       FASB proposed Update of 2026-08-18 (Topic 230); criteria pinned from the exposure draft's
//       illustrative Example 2 (paragraph cites in the node shard metadata and on the node page —
//       kernel source stays behaviour-only per KERNEL-CITATION-CLASS-1). Pin note:
//       workspace research/STABLECOIN-CASH-EQUIVALENT-PIN-2026-10-30.md.
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/797-stablecoin-cash-equivalent-test.proptest.mjs

import { compute } from '../797-stablecoin-cash-equivalent-test.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, deepEqual } from './_pbt-common.mjs';

const KERNEL_ID = '797-stablecoin-cash-equivalent-test';

const CLASSES = ['MEETS_PROPOSED_EXAMPLES', 'DOES_NOT_MEET', 'NOT_DETERMINABLE'];
const STATUSES = ['PASS', 'FAIL', 'NOT_DETERMINABLE'];

const BASE = {
  holder_has_direct_issuer_redemption: true,
  redemption_on_demand: true,
  redemption_amount_known: true,
  gates_or_suspension_terms: false,
  access_via_intermediary_only: false,
  issuer_reserve_short_term_liquid_one_to_one: true,
  original_maturity_days: 1,
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// A well-formed random declared-terms input (all required terms valid booleans).
function randomInput(rand) {
  const h = clone(BASE);
  if (rand() < 0.5) h.redemption_fees_bp = Math.floor(rand() * 200);
  if (rand() < 0.5) h.redemption_min_minor = Math.floor(rand() * 2) * 500000 + 1000000;
  if (rand() < 0.5) h.redemption_settlement_days = Math.floor(rand() * 3);
  if (rand() < 0.5) h.original_maturity_days = Math.floor(rand() * 200);
  if (rand() < 0.5) h.laws_prohibit_cash_equivalent_treatment = rand() < 0.2;
  if (rand() < 0.6) h.token_label = 'Synth-token-' + Math.floor(rand() * 1e6);
  return { profile: 'fasb_proposed_2026_08', holding: h };
}

function flipSomeTerms(rand, h) {
  const keys = ['holder_has_direct_issuer_redemption', 'redemption_on_demand', 'gates_or_suspension_terms', 'access_via_intermediary_only', 'issuer_reserve_short_term_liquid_one_to_one', 'laws_prohibit_cash_equivalent_treatment'];
  const n = 1 + Math.floor(rand() * keys.length);
  for (let i = 0; i < n; i++) {
    const k = keys[Math.floor(rand() * keys.length)];
    if (h[k] === undefined) h[k] = true; else h[k] = !h[k];
  }
  return h;
}

// P1 (shape/enum): for any input, a non-refused payload carries the pinned profile only,
// a classification in the closed enum, six criteria each in the status enum, and the
// proposed-status label.
function checkOutputShapeAndEnums() {
  const rand = mulberry32(79701);
  let checked = 0, violations = 0;
  for (let i = 0; i < 300; i++) {
    const pp = randomInput(rand);
    if (rand() < 0.6) pp.holding = flipSomeTerms(rand, pp.holding);
    const r = compute(pp);
    const op = r.output_payload;
    checked++;
    if (op.refused) continue;
    if (op.profile !== 'fasb_proposed_2026_08') violations++;
    if (CLASSES.indexOf(op.classification) === -1) violations++;
    if (op.profile_status !== 'proposed') violations++;
    if (!Array.isArray(op.criteria) || op.criteria.length !== 6) { violations++; continue; }
    for (const c of op.criteria) if (STATUSES.indexOf(c.status) === -1) violations++;
    if (!Array.isArray(op.disclosure_checklist) || op.disclosure_checklist.length < 5) violations++;
    if (!op.policy_mandate_export || op.policy_mandate_export.exporter !== 'ap2ExportBtn') violations++;
  }
  return { name: 'P1_output_shape_enums_and_proposed_status_label', checked, violations };
}

// P2 (collective classification): MEETS only when all six criteria PASS; any FAIL forces
// DOES_NOT_MEET; NO criterion FAIL but at least one NOT_DETERMINABLE forces NOT_DETERMINABLE.
function checkCollectiveClassificationConsistency() {
  const rand = mulberry32(79702);
  let checked = 0, violations = 0;
  for (let i = 0; i < 400; i++) {
    const pp = randomInput(rand);
    if (rand() < 0.7) pp.holding = flipSomeTerms(rand, pp.holding);
    const op = compute(pp).output_payload;
    if (op.refused) continue;
    checked++;
    const fails = op.criteria.filter((c) => c.status === 'FAIL').length;
    const nds = op.criteria.filter((c) => c.status === 'NOT_DETERMINABLE').length;
    const want = fails > 0 ? 'DOES_NOT_MEET' : nds > 0 ? 'NOT_DETERMINABLE' : 'MEETS_PROPOSED_EXAMPLES';
    if (op.classification !== want) violations++;
  }
  return { name: 'P2_collective_classification_consistency', checked, violations };
}

// P3 (secondary-market boundary): intermediary-only access never yields MEETS, even with
// deep, ~par secondary markets declared — the Case-B boundary.
function checkSecondaryMarketNeverMeets() {
  const rand = mulberry32(79703);
  let checked = 0, violations = 0;
  for (let i = 0; i < 150; i++) {
    const pp = randomInput(rand);
    pp.holding.access_via_intermediary_only = true;
    pp.holding.holder_has_direct_issuer_redemption = rand() < 0.5; // even a contradictory direct claim
    const op = compute(pp).output_payload;
    checked++;
    const c2 = op.criteria.find((c) => c.criterion === 'c2_direct_issuer_redemption_known');
    if (!c2 || c2.status !== 'FAIL') violations++;
    if (op.classification === 'MEETS_PROPOSED_EXAMPLES') violations++;
  }
  return { name: 'P3_secondary_market_only_never_meets', checked, violations };
}

// P4 (invalid-domain rejection): a declared term with an invalid type is REFUSED and the
// refusal payload carries no classification; a missing required term is NOT refused but
// yields NOT_DETERMINABLE (row contract's missing-field branch).
function checkInvalidDomainAndMissingFieldBranches() {
  let checked = 0, violations = 0;
  const badInputs = [
    { profile: 'fasb_final', holding: clone(BASE) },
    { profile: 'fasb_proposed_2026_08', holding: Object.assign(clone(BASE), { redemption_on_demand: 'yes' }) },
    { profile: 'fasb_proposed_2026_08', holding: Object.assign(clone(BASE), { original_maturity_days: -5 }) },
    { profile: 'fasb_proposed_2026_08', holding: null },
    null,
  ];
  for (const pp of badInputs) {
    checked++;
    const r = compute(pp);
    if (!r.output_payload || r.output_payload.refused !== true) violations++;
    if (r.output_payload.classification !== undefined) violations++;
  }
  for (const key of ['holder_has_direct_issuer_redemption', 'redemption_on_demand', 'redemption_amount_known', 'gates_or_suspension_terms', 'access_via_intermediary_only', 'issuer_reserve_short_term_liquid_one_to_one']) {
    checked++;
    const h = clone(BASE); delete h[key];
    const op = compute({ profile: 'fasb_proposed_2026_08', holding: h }).output_payload;
    if (op.refused) violations++;
    if (op.classification !== 'NOT_DETERMINABLE') violations++;
  }
  return { name: 'P4_invalid_domain_refusal_and_missing_field_not_determinable', checked, violations };
}

// P5 (fee-significance threshold behaviour): fees at or below the declared threshold stay
// PASS on c3; above it FAIL; and the declared threshold can move the boundary (a holding
// failing at the default 25bp passes when the declared threshold is raised).
function checkFeeThresholdBoundary() {
  let checked = 0, violations = 0;
  const h = Object.assign(clone(BASE), { redemption_fees_bp: 25 });
  const atDefault = compute({ profile: 'fasb_proposed_2026_08', holding: h }).output_payload;
  checked++;
  if (atDefault.criteria.find((c) => c.criterion === 'c3_no_significant_fees_restrictions').status !== 'PASS') violations++;
  const h2 = Object.assign(clone(BASE), { redemption_fees_bp: 26 });
  const above = compute({ profile: 'fasb_proposed_2026_08', holding: h2 }).output_payload;
  checked++;
  if (above.criteria.find((c) => c.criterion === 'c3_no_significant_fees_restrictions').status !== 'FAIL') violations++;
  const raised = compute({ profile: 'fasb_proposed_2026_08', holding: h2, policy: { significant_fees_bp: 50 } }).output_payload;
  checked++;
  if (raised.criteria.find((c) => c.criterion === 'c3_no_significant_fees_restrictions').status !== 'PASS') violations++;
  return { name: 'P5_fee_significance_threshold_boundary', checked, violations };
}

// P6 (determinism + no-PII echo discipline): compute is a pure function of pp — identical
// inputs give byte-identical output_payload — and the payload never echoes a token_label
// longer than the declared 64-char cap.
function checkDeterminismAndLabelCap() {
  const rand = mulberry32(79706);
  let checked = 0, violations = 0;
  for (let i = 0; i < 100; i++) {
    const pp = randomInput(rand);
    pp.holding.token_label = 'T'.repeat(60) + String(i);
    const a = JSON.stringify(compute(pp).output_payload);
    const b = JSON.stringify(compute(clone(pp)).output_payload);
    checked++;
    if (a !== b) violations++;
    const op = JSON.parse(a);
    if (op.holding_declared.token_label !== null && op.holding_declared.token_label.length > 64) violations++;
  }
  return { name: 'P6_determinism_and_token_label_cap', checked, violations };
}

// ---------- run ----------
let oracle;
try {
  oracle = runFixtureOracle(KERNEL_ID, compute);
} catch (e) {
  oracle = { total: 1, failures: [{ name: 'fixture-oracle-load', expected: '(compute() implemented)', got: String((e && e.message) || e) }] };
}
const properties = [
  checkOutputShapeAndEnums(),
  checkCollectiveClassificationConsistency(),
  checkSecondaryMarketNeverMeets(),
  checkInvalidDomainAndMissingFieldBranches(),
  checkFeeThresholdBoundary(),
  checkDeterminismAndLabelCap(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — 6 properties over the declared-terms classification surface.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
