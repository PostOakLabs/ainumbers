// 824-zip317-transfer-fee — class-K property-test FLOOR.
//
// CLASS K — the declared domain is bounded (non-negative exact-integer counts
// and byte sizes over five declared pools, closed refusal set enumerated in the
// sibling reachability fixtures); the count/size axis is unbounded above, so no
// totality claim is made over it. Properties below run over a committed
// mulberry32 seed (deterministic) plus a fixed corpus of structural cases.
//
// kernel_digest_at_authoring: sha256:86764baa11260981f1a4d10e9d67b2c28aabee9c00ab6a9c6f503589eed4138b
// spec: recompute the conventional transfer fee from a declared transaction
//   shape, built to the pinned fee-rule excerpt
//   (research/clause-snapshots/zcash-2026-11/zip-0317-fee-calculation.revision0.excerpt.txt).
// human_sign_off: PENDING
//
// ZERO external dependencies — Node built-ins plus the in-repo _pbt-common.mjs helpers only.
//
// Run: node chaingraph/kernels/__proptests__/824-zip317-transfer-fee.proptest.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute } from '../824-zip317-transfer-fee.kernel.mjs';
import { runFixtureOracle, summarize, mulberry32, findShapeViolations } from './_pbt-common.mjs';

const KERNEL_ID = '824-zip317-transfer-fee';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REACH = JSON.parse(
  fs.readFileSync(path.join(HERE, '..', 'fixtures', KERNEL_ID + '.reachability.json'), 'utf8'),
);

const SEED = 20261103;
const N = 200;

const MARGINAL_FEE_ZATOSHI = 5000;
const GRACE_ACTIONS = 2;
const INPUT_UNIT_SIZE = 150;
const OUTPUT_UNIT_SIZE = 34;

/** Random VALID policy_parameters over the declared domain (non-negative exact integers; pools often absent). */
function randomValidPp(rng) {
  const pp = {};
  const pools = ['tx_in_total_size', 'tx_out_total_size', 'n_joinsplit', 'n_spends_sapling', 'n_outputs_sapling', 'n_actions_orchard'];
  for (const f of pools) {
    const roll = rng();
    if (roll < 0.35) continue; // absent pool contributes 0
    if (f === 'tx_in_total_size' || f === 'tx_out_total_size') {
      pp[f] = Math.floor(rng() * 600);
    } else {
      pp[f] = Math.floor(rng() * 30);
    }
  }
  return pp;
}

/** Independent recomputation of the declared formula (test-side oracle arithmetic). */
function expectedFee(pp) {
  const v = (x) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : 0);
  const ceilDiv = (a, b) => Math.ceil(a / b);
  const transparent = Math.max(ceilDiv(v(pp.tx_in_total_size), INPUT_UNIT_SIZE), ceilDiv(v(pp.tx_out_total_size), OUTPUT_UNIT_SIZE));
  const sprout = 2 * v(pp.n_joinsplit);
  const sapling = Math.max(v(pp.n_spends_sapling), v(pp.n_outputs_sapling));
  const orchard = v(pp.n_actions_orchard);
  const logical = transparent + sprout + sapling + orchard;
  return { transparent, sprout, sapling, orchard, logical, fee: MARGINAL_FEE_ZATOSHI * Math.max(GRACE_ACTIONS, logical) };
}

// P1 — DETERMINISM: identical inputs, identical payload, byte-for-byte.
function checkDeterminism() {
  const rng = mulberry32(SEED);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const a = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    const b = JSON.stringify(compute(JSON.parse(JSON.stringify(pp))));
    checked++;
    if (a !== b) { violations++; console.error(`P1 determinism violated on ${JSON.stringify(pp)}`); }
  }
  return { name: 'determinism_byte_for_byte', checked, violations };
}

// P2 — FORMULA CONFORMANCE: fee, logical_actions and each contribution equal the
// independent test-side recomputation for every random valid shape.
function checkFormulaConformance() {
  const rng = mulberry32(SEED + 1);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const { output_payload } = compute(pp);
    const exp = expectedFee(pp);
    checked += 6;
    if (output_payload.logical_actions !== exp.logical) violations++;
    if (output_payload.conventional_fee_zatoshi !== exp.fee) violations++;
    if (output_payload.contributions.transparent !== exp.transparent) violations++;
    if (output_payload.contributions.sprout !== exp.sprout) violations++;
    if (output_payload.contributions.sapling !== exp.sapling) violations++;
    if (output_payload.contributions.orchard !== exp.orchard) violations++;
    if (violations > 0 && violations < 7) console.error(`P2 formula mismatch on ${JSON.stringify(pp)}: got ${JSON.stringify(output_payload)}, expected ${JSON.stringify(exp)}`);
  }
  return { name: 'formula_conformance_vs_independent_recompute', checked, violations };
}

// P3 — GRACE FLOOR: below the window the fee pins to the floor amount and
// grace_applied is true; at or above it, fee is exactly marginal * logical and
// grace_applied is false.
function checkGraceFloor() {
  const rng = mulberry32(SEED + 2);
  let checked = 0;
  let violations = 0;
  const cases = [{}, { n_actions_orchard: 1 }, { n_actions_orchard: 2 }, { n_actions_orchard: 3 }];
  for (let i = 0; i < N; i++) cases.push(randomValidPp(rng));
  for (const pp of cases) {
    const { output_payload } = compute(pp);
    const logical = output_payload.logical_actions;
    checked += 2;
    if (logical < GRACE_ACTIONS) {
      if (output_payload.conventional_fee_zatoshi !== MARGINAL_FEE_ZATOSHI * GRACE_ACTIONS || output_payload.applied.grace_applied !== true) {
        violations++;
        console.error(`P3 grace floor not applied on ${JSON.stringify(pp)}: got ${JSON.stringify(output_payload)}`);
      }
    } else {
      if (output_payload.conventional_fee_zatoshi !== MARGINAL_FEE_ZATOSHI * logical || output_payload.applied.grace_applied !== false) {
        violations++;
        console.error(`P3 fee off formula above the floor on ${JSON.stringify(pp)}: got ${JSON.stringify(output_payload)}`);
      }
    }
  }
  return { name: 'grace_floor_boundary', checked, violations };
}

// P4 — MONOTONICITY: increasing any single declared count or byte total never
// decreases the fee.
function checkMonotonicity() {
  const rng = mulberry32(SEED + 3);
  let checked = 0;
  let violations = 0;
  const fields = ['tx_in_total_size', 'tx_out_total_size', 'n_joinsplit', 'n_spends_sapling', 'n_outputs_sapling', 'n_actions_orchard'];
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const before = compute(pp).output_payload.conventional_fee_zatoshi;
    const bumped = JSON.parse(JSON.stringify(pp));
    const f = fields[Math.floor(rng() * fields.length)];
    bumped[f] = (typeof bumped[f] === 'number' ? bumped[f] : 0) + 1 + Math.floor(rng() * 3);
    const after = compute(bumped).output_payload.conventional_fee_zatoshi;
    checked++;
    if (after < before) { violations++; console.error(`P4 fee decreased when bumping ${f}: ${before} -> ${after} on ${JSON.stringify(pp)}`); }
  }
  return { name: 'monotone_in_declared_counts', checked, violations };
}

// P5 — REFUSAL INVARIANTS: every declared refusal branch returns a structured
// non-verdict with exactly the INPUT_REFUSED flag, manual_review_required true,
// and never echoes the offending value.
function checkRefusalInvariants() {
  let checked = 0;
  let violations = 0;
  const extra = [
    { pp: { n_spends_sapling: 2.5 }, label: 'fractional-count' },
    { pp: { tx_out_total_size: -34 }, label: 'negative-size' },
    { pp: { n_joinsplit: Number.MAX_SAFE_INTEGER + 1 }, label: 'beyond-exact-integer' },
  ];
  const vectors = REACH.vectors.map((v) => ({ pp: v.policy_parameters, label: v.name }))
    .concat(extra);
  for (const { pp, label } of vectors) {
    const { output_payload, compliance_flags } = compute(JSON.parse(JSON.stringify(pp)));
    checked += 4;
    if (output_payload.verdict !== 'refused') { violations++; console.error(`P5 ${label}: verdict not refused`); }
    if (JSON.stringify(compliance_flags) !== JSON.stringify(['INPUT_REFUSED'])) { violations++; console.error(`P5 ${label}: flags not exactly INPUT_REFUSED: ${JSON.stringify(compliance_flags)}`); }
    if (output_payload.manual_review_required !== true) { violations++; console.error(`P5 ${label}: manual_review_required not true`); }
    const offending = Object.values(pp).find((x) => typeof x === 'string');
    if (offending !== undefined && JSON.stringify(output_payload).includes(String(offending))) {
      violations++;
      console.error(`P5 ${label}: refusal payload echoes the offending value`);
    }
    const shape = findShapeViolations(output_payload);
    checked++;
    if (shape.length > 0) { violations++; console.error(`P5 ${label}: shape violations ${JSON.stringify(shape)}`); }
  }
  return { name: 'refusal_branches_closed_and_non_echoing', checked, violations };
}

// P6 — OUTPUT SHAPE: completed payloads are integers, non-negative, with no
// NaN/undefined anywhere.
function checkOutputShape() {
  const rng = mulberry32(SEED + 4);
  let checked = 0;
  let violations = 0;
  for (let i = 0; i < N; i++) {
    const pp = randomValidPp(rng);
    const { output_payload } = compute(pp);
    checked += 4;
    if (!Number.isInteger(output_payload.conventional_fee_zatoshi) || output_payload.conventional_fee_zatoshi < 0) violations++;
    if (!Number.isInteger(output_payload.logical_actions) || output_payload.logical_actions < 0) violations++;
    if (output_payload.evidence.refused !== false || output_payload.evidence.pii_carried !== false) violations++;
    const shape = findShapeViolations(output_payload);
    if (shape.length > 0) { violations++; console.error(`P6 shape violations on ${JSON.stringify(pp)}: ${JSON.stringify(shape)}`); }
  }
  return { name: 'completed_payload_exact_integers', checked, violations };
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
  checkFormulaConformance(),
  checkGraceFloor(),
  checkMonotonicity(),
  checkRefusalInvariants(),
  checkOutputShape(),
];
console.log(`[${KERNEL_ID}] class-K floor property test — authored 2026-11-03 against the pinned fee-rule excerpt.`);
const ok = summarize(KERNEL_ID, oracle, properties);
process.exit(ok ? 0 : 1);
